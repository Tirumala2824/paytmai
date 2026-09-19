import { z } from 'zod';
import prisma from '@/lib/db';
import { MaintenanceStatus, RentalLifecycle, UserRole, VerificationMethod } from '@prisma/client';
import { canAccessProperty, canAccessTenancy, canAccessMaintenanceIssue, canAccessPayment } from '@/lib/auth/abac';
import { getTenancyWithDetails } from '@/lib/rental/service';
import { reportMaintenanceIssue, assignMaintenanceTask, updateMaintenanceStatus, verifyMaintenanceIssue } from '@/lib/maintenance/service';
import { createAuditEvent } from '@/lib/audit/service';
import { ToolExecutionContext, ToolCallResult } from '../types';

/**
 * Helper to record an AgentAction in the database.
 * Every tool execution records an action linked to the AgentSession.
 */
async function logAgentAction(
  sessionId: string,
  actionType: string,
  toolName: string,
  inputPayload: Record<string, unknown>,
  outputPayload: Record<string, unknown>,
  status: 'EXECUTED' | 'REJECTED' | 'FAILED'
) {
  try {
    return await prisma.agentAction.create({
      data: {
        sessionId,
        actionType,
        toolName,
        inputPayload: inputPayload as any,
        outputPayload: outputPayload as any,
        status,
      },
    });
  } catch (err) {
    console.error('Failed to log AgentAction:', err);
    return null;
  }
}

/**
 * Helper to resolve the user's active tenancy server-side.
 * Never trust tenancyId from LLM/client.
 */
async function resolveActiveTenancy(context: ToolExecutionContext, overrideTenancyId?: string) {
  const { userProfile } = context;

  if (userProfile.role === UserRole.TENANT) {
    const tenant = await prisma.tenant.findUnique({
      where: { userProfileId: userProfile.id },
      include: {
        tenancies: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!tenant || tenant.tenancies.length === 0) {
      throw new Error('No active tenancy found for this tenant');
    }

    // If an override is provided, verify it belongs to this tenant
    if (overrideTenancyId) {
      const allowed = await canAccessTenancy(userProfile, overrideTenancyId);
      if (!allowed) throw new Error('Unauthorized tenancy access');
      return overrideTenancyId;
    }

    return tenant.tenancies[0].id;
  }

  // If Owner or Admin
  if (overrideTenancyId) {
    const allowed = await canAccessTenancy(userProfile, overrideTenancyId);
    if (!allowed) throw new Error('Unauthorized tenancy access');
    return overrideTenancyId;
  }

  // Find first active tenancy owned by owner
  if (userProfile.role === UserRole.OWNER) {
    const owner = await prisma.owner.findUnique({
      where: { userProfileId: userProfile.id },
      include: {
        properties: {
          include: {
            tenancies: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    const firstTenancy = owner?.properties.flatMap((p) => p.tenancies)[0];
    if (firstTenancy) return firstTenancy.id;
  }

  throw new Error('Tenancy ID must be specified for non-tenant roles');
}

// ============================================================================
// TOOL 1: getTenantProfile
// ============================================================================
export const getTenantProfileSchema = z.object({
  tenantId: z.string().optional(),
});

export async function executeGetTenantProfile(
  input: z.infer<typeof getTenantProfileSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getTenantProfile';
  try {
    const { userProfile } = context;

    let tenantRecord;
    if (userProfile.role === UserRole.TENANT) {
      tenantRecord = await prisma.tenant.findUnique({
        where: { userProfileId: userProfile.id },
        include: { userProfile: true },
      });
    } else if (input.tenantId) {
      // Owner/Admin checking a tenant
      tenantRecord = await prisma.tenant.findUnique({
        where: { id: input.tenantId },
        include: { userProfile: true },
      });
    }

    if (!tenantRecord) {
      await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: 'Tenant profile not found' }, 'FAILED');
      return {
        toolName,
        status: 'FAILED',
        input,
        output: {},
        error: 'Tenant profile not found',
      };
    }

    const output = {
      tenantId: tenantRecord.id,
      name: tenantRecord.userProfile.name,
      email: tenantRecord.userProfile.email,
      phone: tenantRecord.userProfile.phone,
      emergencyContact: tenantRecord.emergencyContact,
      idProofType: tenantRecord.idProofType,
      idProofNumber: tenantRecord.idProofNumber ? 'VERIFIED_ON_FILE' : 'NONE',
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Retrieved tenant profile for ${output.name}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 2: getTenancy
// ============================================================================
export const getTenancySchema = z.object({
  tenancyId: z.string().optional(),
});

export async function executeGetTenancy(
  input: z.infer<typeof getTenancySchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getTenancy';
  try {
    const tenancyId = await resolveActiveTenancy(context, input.tenancyId);
    const tenancy = await getTenancyWithDetails(tenancyId);

    if (!tenancy) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'Tenancy not found' };
    }

    const output = {
      id: tenancy.id,
      lifecycleStage: tenancy.lifecycleStage,
      monthlyRent: tenancy.monthlyRent,
      securityDeposit: tenancy.securityDeposit,
      startDate: tenancy.startDate.toISOString(),
      endDate: tenancy.endDate ? tenancy.endDate.toISOString() : null,
      propertyName: tenancy.property.name,
      propertyAddress: `${tenancy.property.address}, ${tenancy.property.city}`,
      roomNumber: tenancy.room.roomNumber,
      roomType: tenancy.room.roomType,
      ownerName: tenancy.property.owner.userProfile.name,
      ownerPhone: tenancy.property.owner.userProfile.phone,
      tenantName: tenancy.tenant.userProfile.name,
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Active tenancy at ${output.propertyName} (Room ${output.roomNumber}), Stage: ${output.lifecycleStage}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 3: getRentStatus
// ============================================================================
export const getRentStatusSchema = z.object({
  tenancyId: z.string().optional(),
  billingMonth: z.string().optional(), // e.g. "2026-09"
});

export async function executeGetRentStatus(
  input: z.infer<typeof getRentStatusSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getRentStatus';
  try {
    const tenancyId = await resolveActiveTenancy(context, input.tenancyId);

    const rentSchedules = await prisma.rentSchedule.findMany({
      where: {
        tenancyId,
        ...(input.billingMonth ? { billingMonth: input.billingMonth } : {}),
      },
      orderBy: { dueDate: 'desc' },
      take: 3,
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!rentSchedules || rentSchedules.length === 0) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'No rent schedules found' };
    }

    const currentSchedule = rentSchedules[0];
    const output = {
      tenancyId,
      billingMonth: currentSchedule.billingMonth,
      amount: currentSchedule.amount,
      dueDate: currentSchedule.dueDate.toISOString().split('T')[0],
      status: currentSchedule.status,
      isPaid: currentSchedule.status === 'SUCCESS',
      recentPayment: currentSchedule.payments[0]
        ? {
            amount: currentSchedule.payments[0].amount,
            paidAt: currentSchedule.payments[0].paidAt?.toISOString(),
            method: currentSchedule.payments[0].paymentMethod,
            ref: currentSchedule.payments[0].transactionRef,
          }
        : null,
      history: rentSchedules.map((s) => ({
        month: s.billingMonth,
        amount: s.amount,
        status: s.status,
        dueDate: s.dueDate.toISOString().split('T')[0],
      })),
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Rent for ${output.billingMonth} is ₹${output.amount}, status: ${output.status} (Due: ${output.dueDate})`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 4: getPaymentHistory
// ============================================================================
export const getPaymentHistorySchema = z.object({
  tenancyId: z.string().optional(),
  limit: z.number().optional().default(5),
});

export async function executeGetPaymentHistory(
  input: z.infer<typeof getPaymentHistorySchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getPaymentHistory';
  try {
    const tenancyId = await resolveActiveTenancy(context, input.tenancyId);

    const payments = await prisma.payment.findMany({
      where: {
        rentSchedule: { tenancyId },
      },
      include: {
        rentSchedule: true,
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit || 5,
    });

    const output = {
      tenancyId,
      totalPayments: payments.length,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        billingMonth: p.rentSchedule.billingMonth,
        paymentMethod: p.paymentMethod,
        transactionRef: p.transactionRef,
        paidAt: p.paidAt?.toISOString(),
      })),
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Retrieved ${payments.length} payment records for tenancy ${tenancyId}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 5: validatePayment
// ============================================================================
export const validatePaymentSchema = z.object({
  transactionRef: z.string().optional(),
  rentScheduleId: z.string().optional(),
});

export async function executeValidatePayment(
  input: z.infer<typeof validatePaymentSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'validatePayment';
  try {
    let payment;
    if (input.transactionRef) {
      payment = await prisma.payment.findUnique({
        where: { transactionRef: input.transactionRef },
        include: { rentSchedule: { include: { tenancy: true } } },
      });
    } else if (input.rentScheduleId) {
      payment = await prisma.payment.findFirst({
        where: { rentScheduleId: input.rentScheduleId },
        include: { rentSchedule: { include: { tenancy: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!payment) {
      return {
        toolName,
        status: 'FAILED',
        input,
        output: { isValid: false },
        error: 'No matching payment record found',
      };
    }

    // ABAC verification
    const allowed = await canAccessPayment(context.userProfile, payment.id);
    if (!allowed) {
      await logAgentAction(context.sessionId, 'VALIDATE', toolName, input, { error: 'FORBIDDEN' }, 'REJECTED');
      return { toolName, status: 'REJECTED', input, output: {}, error: 'Unauthorized payment access' };
    }

    const output = {
      isValid: payment.status === 'SUCCESS',
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      transactionRef: payment.transactionRef,
      billingMonth: payment.rentSchedule.billingMonth,
      paidAt: payment.paidAt?.toISOString(),
    };

    await logAgentAction(context.sessionId, 'VALIDATE', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Payment ${payment.transactionRef} validation status: ${payment.status}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'VALIDATE', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 6: getProperty
// ============================================================================
export const getPropertySchema = z.object({
  propertyId: z.string().optional(),
});

export async function executeGetProperty(
  input: z.infer<typeof getPropertySchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getProperty';
  try {
    let targetPropertyId = input.propertyId;

    if (!targetPropertyId) {
      const tenancyId = await resolveActiveTenancy(context);
      const tenancy = await prisma.tenancy.findUnique({
        where: { id: tenancyId },
        select: { propertyId: true },
      });
      targetPropertyId = tenancy?.propertyId;
    }

    if (!targetPropertyId) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'Property ID could not be determined' };
    }

    const allowed = await canAccessProperty(context.userProfile, targetPropertyId);
    if (!allowed) {
      await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: 'FORBIDDEN' }, 'REJECTED');
      return { toolName, status: 'REJECTED', input, output: {}, error: 'Unauthorized property access' };
    }

    const property = await prisma.property.findUnique({
      where: { id: targetPropertyId },
      include: {
        owner: { include: { userProfile: true } },
        _count: { select: { rooms: true, tenancies: true } },
      },
    });

    if (!property) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'Property not found' };
    }

    const output = {
      id: property.id,
      name: property.name,
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      propertyType: property.propertyType,
      description: property.description,
      amenities: property.amenities,
      totalRooms: property.totalRooms,
      ownerName: property.owner.userProfile.name,
      ownerPhone: property.owner.userProfile.phone,
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Property: ${output.name}, ${output.address} (${output.amenities.join(', ')})`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 7: getRoom
// ============================================================================
export const getRoomSchema = z.object({
  roomId: z.string().optional(),
});

export async function executeGetRoom(
  input: z.infer<typeof getRoomSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getRoom';
  try {
    let targetRoomId = input.roomId;

    if (!targetRoomId) {
      const tenancyId = await resolveActiveTenancy(context);
      const tenancy = await prisma.tenancy.findUnique({
        where: { id: tenancyId },
        select: { roomId: true },
      });
      targetRoomId = tenancy?.roomId;
    }

    if (!targetRoomId) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'Room ID could not be determined' };
    }

    const room = await prisma.room.findUnique({
      where: { id: targetRoomId },
      include: { property: true },
    });

    if (!room) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'Room not found' };
    }

    const allowed = await canAccessProperty(context.userProfile, room.propertyId);
    if (!allowed) {
      await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: 'FORBIDDEN' }, 'REJECTED');
      return { toolName, status: 'REJECTED', input, output: {}, error: 'Unauthorized room access' };
    }

    const output = {
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomType: room.roomType,
      rentAmount: room.rentAmount,
      depositAmount: room.depositAmount,
      isOccupied: room.isOccupied,
      propertyName: room.property.name,
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Room ${output.roomNumber} (${output.roomType}, Floor ${output.floor}), Rent ₹${output.rentAmount}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 8: getMaintenanceIssues
// ============================================================================
export const getMaintenanceIssuesSchema = z.object({
  status: z.nativeEnum(MaintenanceStatus).optional(),
  limit: z.number().optional().default(10),
});

export async function executeGetMaintenanceIssues(
  input: z.infer<typeof getMaintenanceIssuesSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getMaintenanceIssues';
  try {
    const { userProfile } = context;

    let whereClause: any = {};
    if (input.status) {
      whereClause.status = input.status;
    }

    if (userProfile.role === UserRole.TENANT) {
      const tenant = await prisma.tenant.findUnique({
        where: { userProfileId: userProfile.id },
      });
      if (!tenant) throw new Error('Tenant record not found');
      whereClause.reportedById = tenant.id;
    } else if (userProfile.role === UserRole.OWNER) {
      const owner = await prisma.owner.findUnique({
        where: { userProfileId: userProfile.id },
        include: { properties: true },
      });
      const propertyIds = owner?.properties.map((p) => p.id) || [];
      whereClause.propertyId = { in: propertyIds };
    }

    const issues = await prisma.maintenanceIssue.findMany({
      where: whereClause,
      include: {
        property: true,
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit || 10,
    });

    const output = {
      totalIssues: issues.length,
      issues: issues.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
        priority: i.priority,
        status: i.status,
        propertyName: i.property.name,
        reportedAt: i.createdAt.toISOString(),
        tasksCount: i.tasks.length,
      })),
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Found ${issues.length} maintenance issues`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 9: getMaintenanceStatus
// ============================================================================
export const getMaintenanceStatusSchema = z.object({
  issueId: z.string().optional(),
});

export async function executeGetMaintenanceStatus(
  input: z.infer<typeof getMaintenanceStatusSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getMaintenanceStatus';
  try {
    let issue;
    if (input.issueId) {
      issue = await prisma.maintenanceIssue.findUnique({
        where: { id: input.issueId },
        include: { property: true, tasks: true, reportedBy: { include: { userProfile: true } } },
      });
    } else {
      // Find latest issue for current user
      const tenancyId = await resolveActiveTenancy(context);
      issue = await prisma.maintenanceIssue.findFirst({
        where: { tenancyId },
        orderBy: { createdAt: 'desc' },
        include: { property: true, tasks: true, reportedBy: { include: { userProfile: true } } },
      });
    }

    if (!issue) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'No maintenance issue found' };
    }

    const allowed = await canAccessMaintenanceIssue(context.userProfile, issue.id);
    if (!allowed) {
      await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: 'FORBIDDEN' }, 'REJECTED');
      return { toolName, status: 'REJECTED', input, output: {}, error: 'Unauthorized issue access' };
    }

    const output = {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      category: issue.category,
      priority: issue.priority,
      status: issue.status,
      reportedBy: issue.reportedBy.userProfile.name,
      createdAt: issue.createdAt.toISOString(),
      tasks: issue.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        assignedTo: t.assignedTo,
        status: t.status,
        estimatedCost: t.estimatedCost,
      })),
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Issue "${issue.title}" is currently ${issue.status}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 10: createMaintenanceIssue
// ============================================================================
export const createMaintenanceIssueSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  category: z.string().optional().default('GENERAL'),
  priority: z.string().optional().default('MEDIUM'),
  isRepeated: z.boolean().optional(),
});

export async function executeCreateMaintenanceIssue(
  input: z.infer<typeof createMaintenanceIssueSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'createMaintenanceIssue';
  try {
    // Only tenant can report issue for themselves
    const tenancyId = await resolveActiveTenancy(context);

    // Call domain service
    const issue = await reportMaintenanceIssue({
      tenancyId,
      title: input.title,
      description: input.description,
      category: input.category || 'GENERAL',
      priority: input.priority || (input.isRepeated ? 'HIGH' : 'MEDIUM'),
      reporterUserProfileId: context.userProfile.id,
      isRepeated: input.isRepeated,
    });

    const output = {
      issueId: issue.id,
      title: issue.title,
      category: issue.category,
      priority: issue.priority,
      status: issue.status,
      isRepeated: issue.isRepeated,
      tenancyId: issue.tenancyId,
      createdAt: issue.createdAt.toISOString(),
    };

    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Created maintenance issue: "${output.title}" (Priority: ${output.priority}, Category: ${output.category})${output.isRepeated ? ' [Flagged as Repeated Issue]' : ''}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 11: createMaintenanceTask
// ============================================================================
export const createMaintenanceTaskSchema = z.object({
  issueId: z.string(),
  title: z.string().min(3),
  description: z.string().optional(),
  assignedTo: z.string().min(2),
  estimatedCost: z.number().optional(),
});

export async function executeCreateMaintenanceTask(
  input: z.infer<typeof createMaintenanceTaskSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'createMaintenanceTask';
  try {
    const allowed = await canAccessMaintenanceIssue(context.userProfile, input.issueId);
    if (!allowed) {
      await logAgentAction(context.sessionId, 'MUTATION', toolName, input, { error: 'FORBIDDEN' }, 'REJECTED');
      return { toolName, status: 'REJECTED', input, output: {}, error: 'Unauthorized issue access' };
    }

    const task = await assignMaintenanceTask({
      issueId: input.issueId,
      title: input.title,
      description: input.description,
      assignedTo: input.assignedTo,
      estimatedCost: input.estimatedCost,
      actor: { id: context.userProfile.id, role: context.userProfile.role },
    });

    const output = {
      taskId: task.id,
      issueId: task.issueId,
      title: task.title,
      assignedTo: task.assignedTo,
      status: task.status,
      estimatedCost: task.estimatedCost,
    };

    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Assigned task "${output.title}" to ${output.assignedTo}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 12: notifyOwner
// ============================================================================
export const notifyOwnerSchema = z.object({
  message: z.string().min(5),
  issueId: z.string().optional(),
  urgent: z.boolean().optional().default(false),
});

export async function executeNotifyOwner(
  input: z.infer<typeof notifyOwnerSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'notifyOwner';
  try {
    const tenancyId = await resolveActiveTenancy(context);
    const tenancy = await prisma.tenancy.findUnique({
      where: { id: tenancyId },
      include: {
        property: {
          include: {
            owner: {
              include: { userProfile: true },
            },
          },
        },
        tenant: {
          include: { userProfile: true },
        },
      },
    });

    if (!tenancy) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'Tenancy not found' };
    }

    const ownerProfileId = tenancy.property.owner.userProfile.id;
    const tenantName = tenancy.tenant.userProfile.name;

    const notification = await prisma.notification.create({
      data: {
        userProfileId: ownerProfileId,
        title: input.urgent ? `⚠️ URGENT: Alert from ${tenantName}` : `Rental Update from ${tenantName}`,
        message: input.message,
        type: 'MAINTENANCE_UPDATE',
        link: input.issueId ? `/maintenance` : `/owner`,
      },
    });

    // Create Audit Event
    await createAuditEvent({
      actorId: context.userProfile.id,
      actorRole: context.userProfile.role,
      action: 'OWNER_NOTIFIED',
      resourceType: 'NOTIFICATION',
      resourceId: notification.id,
      metadata: {
        ownerProfileId,
        message: input.message,
        urgent: input.urgent,
        tenancyId,
      },
    });

    const output = {
      notificationId: notification.id,
      recipientOwner: tenancy.property.owner.userProfile.name,
      message: notification.message,
      title: notification.title,
      sentAt: notification.createdAt.toISOString(),
    };

    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Successfully notified owner ${output.recipientOwner}: "${input.message}"`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 13: updateMaintenanceTask
// ============================================================================
export const updateMaintenanceTaskSchema = z.object({
  taskId: z.string(),
  status: z.nativeEnum(MaintenanceStatus),
  actualCost: z.number().optional(),
});

export async function executeUpdateMaintenanceTask(
  input: z.infer<typeof updateMaintenanceTaskSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'updateMaintenanceTask';
  try {
    const task = await prisma.maintenanceTask.findUnique({
      where: { id: input.taskId },
      include: { issue: true },
    });

    if (!task) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'Task not found' };
    }

    const allowed = await canAccessMaintenanceIssue(context.userProfile, task.issueId);
    if (!allowed) {
      await logAgentAction(context.sessionId, 'MUTATION', toolName, input, { error: 'FORBIDDEN' }, 'REJECTED');
      return { toolName, status: 'REJECTED', input, output: {}, error: 'Unauthorized task access' };
    }

    const updatedTask = await prisma.maintenanceTask.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        actualCost: input.actualCost,
        completedAt: input.status === MaintenanceStatus.FIXED || input.status === MaintenanceStatus.VERIFIED ? new Date() : undefined,
      },
    });

    // Also update parent issue status if applicable
    if (input.status === MaintenanceStatus.FIXED) {
      await updateMaintenanceStatus({
        issueId: task.issueId,
        status: MaintenanceStatus.FIXED,
        actor: { id: context.userProfile.id, role: context.userProfile.role },
      });
    }

    const output = {
      taskId: updatedTask.id,
      status: updatedTask.status,
      actualCost: updatedTask.actualCost,
    };

    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Updated task ${updatedTask.id} to status ${updatedTask.status}`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// TOOL 14: verifyMaintenanceResolution
// ============================================================================
export const verifyMaintenanceResolutionSchema = z.object({
  issueId: z.string().optional(),
  confirmed: z.boolean().default(true),
  verificationMethod: z.nativeEnum(VerificationMethod).optional().default(VerificationMethod.TENANT_CONFIRMATION),
  evidence: z.string().optional(),
  confidence: z.number().optional(),
  resolution: z.string().optional(),
  feedback: z.string().optional(),
});

export async function executeVerifyMaintenanceResolution(
  input: z.infer<typeof verifyMaintenanceResolutionSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'verifyMaintenanceResolution';
  try {
    let issueId = input.issueId;

    if (!issueId) {
      const tenancyId = await resolveActiveTenancy(context);
      const latestIssue = await prisma.maintenanceIssue.findFirst({
        where: { tenancyId, status: { in: [MaintenanceStatus.FIXED, MaintenanceStatus.TASK_ASSIGNED, MaintenanceStatus.IN_PROGRESS] } },
        orderBy: { createdAt: 'desc' },
      });
      issueId = latestIssue?.id;
    }

    if (!issueId) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'No maintenance issue found to verify' };
    }

    const allowed = await canAccessMaintenanceIssue(context.userProfile, issueId);
    if (!allowed) {
      await logAgentAction(context.sessionId, 'MUTATION', toolName, input, { error: 'FORBIDDEN' }, 'REJECTED');
      return { toolName, status: 'REJECTED', input, output: {}, error: 'Unauthorized issue access' };
    }

    const result = await verifyMaintenanceIssue({
      issueId,
      verificationMethod: input.verificationMethod || VerificationMethod.TENANT_CONFIRMATION,
      verifiedBy: context.userProfile.id,
      evidence: input.evidence || input.feedback || 'Tenant confirmed resolution via AI Assistant',
      confidence: input.confidence,
      notes: input.feedback,
      confirmed: input.confirmed,
      resolution: input.resolution,
      actor: { id: context.userProfile.id, role: context.userProfile.role },
    });

    const output = {
      issueId,
      status: result.issueStatus,
      verificationMethod: result.verification.verificationMethod,
      verified: result.confirmed,
      confidence: result.verification.confidence,
      evidence: result.verification.evidence,
      resolution: result.resolution,
    };

    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: result.confirmed
        ? `Maintenance issue verified (${result.verification.verificationMethod}) and closed.`
        : `Maintenance issue marked as still in progress.`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'MUTATION', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// OWNER TOOLS: Portfolio Overview, Tenant Roster, Maintenance Cross-Triage
// ============================================================================

export const getOwnerPortfolioSchema = z.object({
  propertyId: z.string().optional(),
});

export async function executeGetOwnerPortfolio(
  input: z.infer<typeof getOwnerPortfolioSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getOwnerPortfolio';
  try {
    const { userProfile } = context;

    let owner = await prisma.owner.findUnique({
      where: { userProfileId: userProfile.id },
      include: {
        properties: {
          include: {
            rooms: true,
            tenancies: {
              where: { isActive: true },
              include: {
                tenant: { include: { userProfile: true } },
                rentSchedules: { orderBy: { dueDate: 'desc' }, take: 1 },
              },
            },
            maintenanceIssues: true,
          },
        },
      },
    });

    if (!owner) {
      owner = await prisma.owner.findFirst({
        include: {
          properties: {
            include: {
              rooms: true,
              tenancies: {
                where: { isActive: true },
                include: {
                  tenant: { include: { userProfile: true } },
                  rentSchedules: { orderBy: { dueDate: 'desc' }, take: 1 },
                },
              },
              maintenanceIssues: true,
            },
          },
        },
      });
    }

    if (!owner) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'No owner profile found' };
    }

    const properties = owner.properties || [];
    let totalRooms = 0;
    let occupiedRooms = 0;
    let totalMonthlyExpectedRent = 0;
    let totalRentCollected = 0;
    let totalRentPending = 0;
    let totalOpenIssues = 0;

    const propertySummaries = properties.map((p) => {
      const roomCount = p.rooms.length || p.totalRooms;
      const occupied = p.tenancies.length;
      const vacant = Math.max(0, roomCount - occupied);

      totalRooms += roomCount;
      occupiedRooms += occupied;

      let propExpected = 0;
      let propCollected = 0;
      let propPending = 0;

      p.tenancies.forEach((t) => {
        propExpected += t.monthlyRent;
        const currentSched = t.rentSchedules[0];
        if (currentSched?.status === 'SUCCESS') {
          propCollected += currentSched.amount;
        } else {
          propPending += t.monthlyRent;
        }
      });

      totalMonthlyExpectedRent += propExpected;
      totalRentCollected += propCollected;
      totalRentPending += propPending;

      const openIssues = p.maintenanceIssues.filter(
        (i) => i.status !== 'CLOSED' && i.status !== 'VERIFIED'
      ).length;
      totalOpenIssues += openIssues;

      return {
        id: p.id,
        name: p.name,
        address: `${p.address}, ${p.city}`,
        totalRooms: roomCount,
        occupiedRooms: occupied,
        vacantRooms: vacant,
        occupancyRate: roomCount > 0 ? Math.round((occupied / roomCount) * 100) : 0,
        expectedRent: propExpected,
        collectedRent: propCollected,
        pendingRent: propPending,
        openMaintenance: openIssues,
      };
    });

    const vacantRooms = Math.max(0, totalRooms - occupiedRooms);
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    const output = {
      ownerName: userProfile.name,
      companyName: owner.companyName,
      totalProperties: properties.length,
      totalRooms,
      occupiedRooms,
      vacantRooms,
      occupancyRate,
      totalMonthlyExpectedRent,
      expectedMonthlyRent: totalMonthlyExpectedRent,
      totalRentCollected,
      collectedRent: totalRentCollected,
      totalRentPending,
      pendingRent: totalRentPending,
      totalOpenMaintenance: totalOpenIssues,
      activeMaintenanceCount: totalOpenIssues,
      properties: propertySummaries,
      propertiesSummary: propertySummaries,
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Portfolio Summary: ${properties.length} properties, ${occupiedRooms}/${totalRooms} occupied (${occupancyRate}% occupancy). Monthly rent: ₹${totalRentCollected.toLocaleString('en-IN')} collected, ₹${totalRentPending.toLocaleString('en-IN')} pending. ${totalOpenIssues} active maintenance issues.`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

export const getOwnerTenantsSchema = z.object({
  propertyId: z.string().optional(),
});

export async function executeGetOwnerTenants(
  input: z.infer<typeof getOwnerTenantsSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getOwnerTenants';
  try {
    const { userProfile } = context;

    let owner = await prisma.owner.findUnique({
      where: { userProfileId: userProfile.id },
      include: { properties: { select: { id: true } } },
    });

    if (!owner) {
      owner = await prisma.owner.findFirst({
        include: { properties: { select: { id: true } } },
      });
    }

    if (!owner) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'No owner profile found' };
    }

    const propIds = input.propertyId
      ? [input.propertyId]
      : owner.properties.map((p) => p.id);

    const tenancies = await prisma.tenancy.findMany({
      where: {
        propertyId: { in: propIds },
        isActive: true,
      },
      include: {
        tenant: { include: { userProfile: true } },
        property: true,
        room: true,
        rentSchedules: { orderBy: { dueDate: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const tenants = tenancies.map((t) => {
      const schedule = t.rentSchedules[0];
      const isPaid = schedule?.status === 'SUCCESS';
      return {
        tenancyId: t.id,
        name: t.tenant.userProfile.name,
        email: t.tenant.userProfile.email,
        phone: t.tenant.userProfile.phone,
        propertyName: t.property.name,
        roomNumber: t.room?.roomNumber || 'N/A',
        monthlyRent: t.monthlyRent,
        billingMonth: schedule?.billingMonth || 'Current',
        rentStatus: isPaid ? 'PAID' : (schedule?.status || 'PENDING'),
        dueDate: schedule?.dueDate ? schedule.dueDate.toISOString().split('T')[0] : null,
      };
    });

    const output = {
      count: tenants.length,
      tenants,
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Found ${tenants.length} active tenants across properties.`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

export const getOwnerMaintenanceOverviewSchema = z.object({
  status: z.string().optional(),
});

export async function executeGetOwnerMaintenanceOverview(
  input: z.infer<typeof getOwnerMaintenanceOverviewSchema>,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = 'getOwnerMaintenanceOverview';
  try {
    const { userProfile } = context;

    let owner = await prisma.owner.findUnique({
      where: { userProfileId: userProfile.id },
      include: { properties: { select: { id: true } } },
    });

    if (!owner) {
      owner = await prisma.owner.findFirst({
        include: { properties: { select: { id: true } } },
      });
    }

    if (!owner) {
      return { toolName, status: 'FAILED', input, output: {}, error: 'No owner profile found' };
    }

    const propIds = owner.properties.map((p) => p.id);

    const issues = await prisma.maintenanceIssue.findMany({
      where: {
        propertyId: { in: propIds },
      },
      include: {
        property: true,
        reportedBy: { include: { userProfile: true } },
        tasks: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const issueList = issues.map((i) => ({
      id: i.id,
      title: i.title,
      property: i.property.name,
      reportedBy: i.reportedBy.userProfile.name,
      category: i.category,
      priority: i.priority,
      status: i.status,
      resolution: i.resolution,
      assignedTechnician: i.tasks[0]?.assignedTo || 'Unassigned',
      createdAt: i.createdAt.toISOString().split('T')[0],
    }));

    const openCount = issueList.filter((i) => !['CLOSED', 'VERIFIED'].includes(i.status)).length;
    const resolvedCount = issueList.filter((i) => ['CLOSED', 'VERIFIED'].includes(i.status)).length;

    const output = {
      total: issueList.length,
      openCount,
      resolvedCount,
      issues: issueList,
    };

    await logAgentAction(context.sessionId, 'QUERY', toolName, input, output, 'EXECUTED');
    return {
      toolName,
      status: 'SUCCESS',
      input,
      output,
      summary: `Maintenance Overview: ${openCount} active tickets, ${resolvedCount} resolved tickets across properties.`,
    };
  } catch (err: any) {
    await logAgentAction(context.sessionId, 'QUERY', toolName, input, { error: err.message }, 'FAILED');
    return { toolName, status: 'FAILED', input, output: {}, error: err.message };
  }
}

// ============================================================================
// Registry of All Typed Tools
// ============================================================================
export const AI_TOOLS_REGISTRY = {
  getTenantProfile: {
    schema: getTenantProfileSchema,
    execute: executeGetTenantProfile,
    description: 'Retrieve tenant profile, KYC/ID status, and emergency contact details',
  },
  getTenancy: {
    schema: getTenancySchema,
    execute: executeGetTenancy,
    description: 'Retrieve active rental tenancy details, property, room, and lifecycle stage',
  },
  getRentStatus: {
    schema: getRentStatusSchema,
    execute: executeGetRentStatus,
    description: 'Check rent due date, billing month, amount, and payment status',
  },
  getPaymentHistory: {
    schema: getPaymentHistorySchema,
    execute: executeGetPaymentHistory,
    description: 'Retrieve past payment records, methods, transaction references, and dates',
  },
  validatePayment: {
    schema: validatePaymentSchema,
    execute: executeValidatePayment,
    description: 'Validate a payment transaction or rent schedule status against payment provider records',
  },
  getProperty: {
    schema: getPropertySchema,
    execute: executeGetProperty,
    description: 'Retrieve property details, address, rules, amenities, and owner contact',
  },
  getRoom: {
    schema: getRoomSchema,
    execute: executeGetRoom,
    description: 'Retrieve room details, floor, room type, and rent specifications',
  },
  getMaintenanceIssues: {
    schema: getMaintenanceIssuesSchema,
    execute: executeGetMaintenanceIssues,
    description: 'List maintenance issues for the tenant or property',
  },
  getMaintenanceStatus: {
    schema: getMaintenanceStatusSchema,
    execute: executeGetMaintenanceStatus,
    description: 'Check the real-time status, technician assignment, and progress of a maintenance issue',
  },
  createMaintenanceIssue: {
    schema: createMaintenanceIssueSchema,
    execute: executeCreateMaintenanceIssue,
    description: 'Report a new maintenance issue, classify it, and transition rental lifecycle to ISSUE',
  },
  createMaintenanceTask: {
    schema: createMaintenanceTaskSchema,
    execute: executeCreateMaintenanceTask,
    description: 'Assign a technician or vendor to a maintenance issue and transition lifecycle to ACTION',
  },
  notifyOwner: {
    schema: notifyOwnerSchema,
    execute: executeNotifyOwner,
    description: 'Send an urgent or regular notification to the property owner',
  },
  updateMaintenanceTask: {
    schema: updateMaintenanceTaskSchema,
    execute: executeUpdateMaintenanceTask,
    description: 'Update technician task progress, cost, or mark as fixed',
  },
  verifyMaintenanceResolution: {
    schema: verifyMaintenanceResolutionSchema,
    execute: executeVerifyMaintenanceResolution,
    description: 'Verify resolution of a maintenance issue and transition rental lifecycle to VERIFIED',
  },
  // Owner Portfolio Tools
  getOwnerPortfolio: {
    schema: getOwnerPortfolioSchema,
    execute: executeGetOwnerPortfolio,
    description: 'Retrieve portfolio-level property stats, occupancy rates, vacant rooms, and rent collection totals for owner',
  },
  getOwnerTenants: {
    schema: getOwnerTenantsSchema,
    execute: executeGetOwnerTenants,
    description: 'Retrieve all active tenants across all properties owned by the owner with rent payment status',
  },
  getOwnerMaintenanceOverview: {
    schema: getOwnerMaintenanceOverviewSchema,
    execute: executeGetOwnerMaintenanceOverview,
    description: 'Retrieve cross-property maintenance tickets and resolution status for owner',
  },
};

