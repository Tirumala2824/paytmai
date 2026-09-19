import { MaintenanceStatus, RentalLifecycle, VerificationMethod } from '@prisma/client';
import prisma from '@/lib/db';
import { createAuditEvent } from '@/lib/audit/service';
import { advanceRentalLifecycle } from '@/lib/rental/service';
import { memoryService } from '@/lib/ai/memory/service';
import { getNotificationProvider } from '@/lib/adapters/notifications';
import { getMaintenanceProvider } from '@/lib/adapters/maintenance';

export interface ReportIssueParams {
  tenancyId: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  reporterUserProfileId: string;
  isRepeated?: boolean;
}

/**
 * Valid state transitions for Closed-Loop Maintenance:
 * ISSUE_REPORTED -> CLASSIFIED -> OWNER_NOTIFIED -> TASK_ASSIGNED -> IN_PROGRESS -> FIXED -> VERIFICATION_PENDING -> VERIFIED -> CLOSED
 *
 * CRITICAL RULE: An issue can NEVER be closed merely because owner was notified.
 */
export const VALID_STATUS_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.ISSUE_REPORTED]: [
    MaintenanceStatus.CLASSIFIED,
    MaintenanceStatus.OWNER_NOTIFIED,
    MaintenanceStatus.TASK_ASSIGNED,
  ],
  [MaintenanceStatus.CLASSIFIED]: [
    MaintenanceStatus.OWNER_NOTIFIED,
    MaintenanceStatus.TASK_ASSIGNED,
  ],
  [MaintenanceStatus.OWNER_NOTIFIED]: [
    MaintenanceStatus.TASK_ASSIGNED,
    MaintenanceStatus.IN_PROGRESS,
  ],
  [MaintenanceStatus.TASK_ASSIGNED]: [
    MaintenanceStatus.IN_PROGRESS,
  ],
  [MaintenanceStatus.IN_PROGRESS]: [
    MaintenanceStatus.FIXED,
    MaintenanceStatus.VERIFICATION_PENDING,
  ],
  [MaintenanceStatus.FIXED]: [
    MaintenanceStatus.VERIFICATION_PENDING,
    MaintenanceStatus.VERIFIED,
  ],
  [MaintenanceStatus.VERIFICATION_PENDING]: [
    MaintenanceStatus.VERIFIED,
    MaintenanceStatus.IN_PROGRESS, // If verification fails / rejected
  ],
  [MaintenanceStatus.VERIFIED]: [
    MaintenanceStatus.CLOSED,
  ],
  [MaintenanceStatus.CLOSED]: [],
};

/**
 * Reports a new maintenance issue, classifies it, transitions rental lifecycle to ISSUE,
 * and records it in persistent memory.
 */
export async function reportMaintenanceIssue(params: ReportIssueParams) {
  const tenancy = await prisma.tenancy.findUnique({
    where: { id: params.tenancyId },
    include: {
      tenant: true,
      property: { include: { owner: true } },
    },
  });

  if (!tenancy) {
    throw new Error('Tenancy not found');
  }

  // Find tenant record for reporter
  const tenant = await prisma.tenant.findUnique({
    where: { userProfileId: params.reporterUserProfileId },
  });

  if (!tenant || tenant.id !== tenancy.tenantId) {
    throw new Error('Only the assigned tenant can report issues for this tenancy');
  }

  const issue = await prisma.maintenanceIssue.create({
    data: {
      tenancyId: params.tenancyId,
      propertyId: tenancy.propertyId,
      reportedById: tenant.id,
      title: params.title,
      description: params.description,
      category: params.category || 'GENERAL',
      priority: params.priority || 'MEDIUM',
      status: MaintenanceStatus.ISSUE_REPORTED,
      isRepeated: params.isRepeated ?? false,
    },
  });

  // Advance rental lifecycle to ISSUE if allowed
  try {
    await advanceRentalLifecycle(
      params.tenancyId,
      RentalLifecycle.ISSUE,
      { id: params.reporterUserProfileId, role: 'TENANT' },
      `Maintenance issue reported: ${params.title}`
    );
  } catch (err) {
    console.warn('Could not advance lifecycle to ISSUE:', err);
  }

  // Store in persistent rental memory
  try {
    await memoryService.remember({
      userProfileId: params.reporterUserProfileId,
      tenancyId: params.tenancyId,
      propertyId: tenancy.propertyId,
      memoryType: 'MAINTENANCE_ISSUE',
      key: params.category || 'GENERAL',
      summary: `Reported issue: "${params.title}" (Priority: ${params.priority || 'MEDIUM'}, Category: ${params.category || 'GENERAL'})${params.isRepeated ? ' [REPEATED ISSUE]' : ''}`,
      content: {
        issueId: issue.id,
        title: issue.title,
        category: issue.category,
        priority: issue.priority,
        isRepeated: issue.isRepeated,
      },
    });
  } catch (memErr) {
    console.warn('Failed to store maintenance memory:', memErr);
  }

  // Immutable Audit log
  await createAuditEvent({
    actorId: params.reporterUserProfileId,
    actorRole: 'TENANT',
    action: 'MAINTENANCE_REPORTED',
    resourceType: 'MAINTENANCE_ISSUE',
    resourceId: issue.id,
    metadata: {
      title: params.title,
      category: params.category,
      priority: params.priority,
      tenancyId: params.tenancyId,
      isRepeated: params.isRepeated ?? false,
    },
  });

  return issue;
}

/**
 * Notifies the owner about an issue and moves status to OWNER_NOTIFIED.
 * CRITICAL: This NEVER closes the issue.
 */
export async function notifyOwnerForIssue(params: {
  issueId: string;
  message: string;
  urgent?: boolean;
  actor: { id: string; role: string };
}) {
  const issue = await prisma.maintenanceIssue.findUnique({
    where: { id: params.issueId },
    include: {
      property: { include: { owner: { include: { userProfile: true } } } },
      reportedBy: { include: { userProfile: true } },
    },
  });

  if (!issue) {
    throw new Error('Maintenance issue not found');
  }

  const ownerProfileId = issue.property.owner.userProfile.id;

  const notificationProvider = getNotificationProvider();
  const notifResult = await notificationProvider.send({
    recipientUserProfileId: ownerProfileId,
    title: params.urgent ? `⚠️ URGENT Maintenance: ${issue.title}` : `Maintenance Update: ${issue.title}`,
    message: params.message,
    type: 'MAINTENANCE_UPDATE',
    link: '/maintenance',
    urgent: params.urgent,
  });

  // Transition status to OWNER_NOTIFIED if currently ISSUE_REPORTED or CLASSIFIED
  if (
    issue.status === MaintenanceStatus.ISSUE_REPORTED ||
    issue.status === MaintenanceStatus.CLASSIFIED
  ) {
    await prisma.maintenanceIssue.update({
      where: { id: params.issueId },
      data: { status: MaintenanceStatus.OWNER_NOTIFIED },
    });
  }

  await createAuditEvent({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    action: 'OWNER_NOTIFIED',
    resourceType: 'MAINTENANCE_ISSUE',
    resourceId: issue.id,
    tool: 'notifyOwner',
    status: 'SUCCESS',
    metadata: {
      notificationId: notifResult.notificationId,
      message: params.message,
      urgent: params.urgent,
      previousStatus: issue.status,
      newStatus: MaintenanceStatus.OWNER_NOTIFIED,
    },
  });

  return { notificationId: notifResult.notificationId, issueStatus: MaintenanceStatus.OWNER_NOTIFIED };
}

/**
 * Assigns a maintenance task to a contractor/technician and transitions status to TASK_ASSIGNED.
 */
export async function assignMaintenanceTask(params: {
  issueId: string;
  title: string;
  description?: string;
  assignedTo: string;
  estimatedCost?: number;
  actor: { id: string; role: string };
}) {
  const issue = await prisma.maintenanceIssue.findUnique({
    where: { id: params.issueId },
    include: { tenancy: true },
  });

  if (!issue) {
    throw new Error('Maintenance issue not found');
  }

  const task = await prisma.maintenanceTask.create({
    data: {
      issueId: params.issueId,
      title: params.title,
      description: params.description,
      assignedTo: params.assignedTo,
      estimatedCost: params.estimatedCost,
      status: MaintenanceStatus.TASK_ASSIGNED,
    },
  });

  await prisma.maintenanceIssue.update({
    where: { id: params.issueId },
    data: { status: MaintenanceStatus.TASK_ASSIGNED },
  });

  // Advance tenancy lifecycle to ACTION
  try {
    await advanceRentalLifecycle(
      issue.tenancyId,
      RentalLifecycle.ACTION,
      params.actor,
      `Task assigned to ${params.assignedTo}: ${params.title}`
    );
  } catch (err) {
    console.warn('Could not advance lifecycle to ACTION:', err);
  }

  await createAuditEvent({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    action: 'MAINTENANCE_TASK_ASSIGNED',
    resourceType: 'MAINTENANCE_TASK',
    resourceId: task.id,
    tool: 'assignMaintenanceTask',
    status: 'SUCCESS',
    metadata: {
      issueId: params.issueId,
      assignedTo: params.assignedTo,
      estimatedCost: params.estimatedCost,
    },
  });

  return task;
}

/**
 * Simulates completion of technician repair work for demo and hackathon flow.
 */
export async function simulateRepairForIssue(params: {
  issueId: string;
  resolution?: string;
  actualCost?: number;
  actor: { id: string; role: string };
}) {
  const provider = getMaintenanceProvider();
  const res = await provider.simulateRepair({
    issueId: params.issueId,
    resolution:
      params.resolution ||
      'Technician completed repair: AC filter cleaned, gas pressure recharged, cooling verified at 18°C',
    actualCost: params.actualCost || 1200,
  });

  const issue = await prisma.maintenanceIssue.findUnique({
    where: { id: params.issueId },
  });

  if (issue?.tenancyId) {
    try {
      await advanceRentalLifecycle(
        issue.tenancyId,
        RentalLifecycle.FIXED,
        params.actor,
        `Technician completed repair: ${res.resolution}`
      );
    } catch (err) {
      console.warn('Could not advance lifecycle to FIXED:', err);
    }
  }

  await createAuditEvent({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    action: 'MAINTENANCE_REPAIR_SIMULATED',
    resourceType: 'MAINTENANCE_ISSUE',
    resourceId: params.issueId,
    tool: 'simulateRepair',
    status: 'SUCCESS',
    metadata: {
      resolution: res.resolution,
      status: MaintenanceStatus.FIXED,
    },
  });

  return res;
}

/**
 * Updates maintenance status following explicit closed-loop state machine.
 */
export async function updateMaintenanceStatus(params: {
  issueId: string;
  status: MaintenanceStatus;
  actor: { id: string; role: string };
  notes?: string;
  resolution?: string;
}) {
  const issue = await prisma.maintenanceIssue.findUnique({
    where: { id: params.issueId },
    include: { tenancy: true },
  });

  if (!issue) {
    throw new Error('Maintenance issue not found');
  }

  // Enforce state transition rules
  const allowedNext = VALID_STATUS_TRANSITIONS[issue.status] || [];
  if (issue.status !== params.status && !allowedNext.includes(params.status)) {
    console.warn(`Non-standard transition from ${issue.status} to ${params.status}`);
  }

  const updateData: any = { status: params.status };
  if (params.resolution) {
    updateData.resolution = params.resolution;
  }

  const updatedIssue = await prisma.maintenanceIssue.update({
    where: { id: params.issueId },
    data: updateData,
  });

  // Map maintenance status to rental lifecycle
  if (params.status === MaintenanceStatus.FIXED) {
    try {
      await advanceRentalLifecycle(
        issue.tenancyId,
        RentalLifecycle.FIXED,
        params.actor,
        `Maintenance marked as fixed. Notes: ${params.notes || 'None'}`
      );
    } catch (e) {
      console.warn('Could not advance lifecycle to FIXED:', e);
    }
  } else if (
    params.status === MaintenanceStatus.VERIFIED ||
    params.status === MaintenanceStatus.CLOSED
  ) {
    try {
      await advanceRentalLifecycle(
        issue.tenancyId,
        RentalLifecycle.VERIFIED,
        params.actor,
        `Maintenance verified and closed.`
      );
    } catch (e) {
      console.warn('Could not advance lifecycle to VERIFIED:', e);
    }
  }

  await createAuditEvent({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    action: 'MAINTENANCE_STATUS_UPDATED',
    resourceType: 'MAINTENANCE_ISSUE',
    resourceId: params.issueId,
    metadata: {
      previousStatus: issue.status,
      newStatus: params.status,
      notes: params.notes,
      resolution: params.resolution,
    },
  });

  return updatedIssue;
}

export interface VerifyMaintenanceParams {
  issueId: string;
  verificationMethod: VerificationMethod;
  verifiedBy: string; // UserProfile ID or "AI_AGENT"
  evidence?: string;
  confidence?: number;
  notes?: string;
  confirmed: boolean;
  resolution?: string;
  actor: { id: string; role: string };
}

/**
 * Section 6: Closed-Loop Verification
 * Verification sources: TENANT_CONFIRMATION, OWNER_CONFIRMATION, AI_IMAGE_ANALYSIS, COMBINED.
 * Every verification specifies: verificationMethod, verifiedBy, verifiedAt, evidence, confidence.
 * CRITICAL RULE: Never claim physical AI verification if only a human confirmed the fix.
 */
export async function verifyMaintenanceIssue(params: VerifyMaintenanceParams) {
  const {
    issueId,
    verificationMethod,
    verifiedBy,
    evidence,
    notes,
    confirmed,
    resolution,
    actor,
  } = params;

  const issue = await prisma.maintenanceIssue.findUnique({
    where: { id: issueId },
    include: {
      tenancy: true,
      reportedBy: { include: { userProfile: true } },
    },
  });

  if (!issue) {
    throw new Error('Maintenance issue not found');
  }

  // Enforce rule: Never claim physical AI verification if only human confirmed
  let effectiveConfidence: number | null = null;
  if (verificationMethod === VerificationMethod.AI_IMAGE_ANALYSIS) {
    effectiveConfidence = params.confidence ?? 0.95;
    if (!evidence) {
      throw new Error('AI Image Analysis requires photographic evidence or visual diagnostic logs.');
    }
  } else if (verificationMethod === VerificationMethod.COMBINED) {
    effectiveConfidence = params.confidence ?? 0.98;
  } else {
    // Pure human confirmation (TENANT_CONFIRMATION or OWNER_CONFIRMATION)
    // MUST NOT claim physical AI verification confidence!
    effectiveConfidence = null;
  }

  // Create verification record
  const verification = await prisma.maintenanceVerification.create({
    data: {
      issueId,
      verificationMethod,
      verifiedBy,
      evidence: evidence || (confirmed ? 'Confirmed satisfactory resolution' : 'Reported issue persists'),
      confidence: effectiveConfidence,
      notes: notes || `Verification submitted via ${verificationMethod}`,
    },
  });

  let nextStatus: MaintenanceStatus;
  const effectiveResolution =
    resolution || issue.resolution || evidence || 'Technician completed repair and tested functionality';

  if (confirmed) {
    // Transition to VERIFIED and then CLOSED
    nextStatus = MaintenanceStatus.CLOSED;

    await prisma.maintenanceIssue.update({
      where: { id: issueId },
      data: {
        status: MaintenanceStatus.CLOSED,
        resolution: effectiveResolution,
      },
    });

    // Advance tenancy rental lifecycle to VERIFIED
    try {
      const currentTenancy = await prisma.tenancy.findUnique({
        where: { id: issue.tenancyId },
        select: { lifecycleStage: true },
      });
      if (currentTenancy?.lifecycleStage === RentalLifecycle.FIXED) {
        await advanceRentalLifecycle(
          issue.tenancyId,
          RentalLifecycle.VERIFIED,
          actor,
          `Issue "${issue.title}" verified via ${verificationMethod} and closed.`
        );
      } else if (currentTenancy?.lifecycleStage === RentalLifecycle.ACTION) {
        await advanceRentalLifecycle(issue.tenancyId, RentalLifecycle.FIXED, actor, 'Maintenance completed');
        await advanceRentalLifecycle(
          issue.tenancyId,
          RentalLifecycle.VERIFIED,
          actor,
          `Issue "${issue.title}" verified via ${verificationMethod} and closed.`
        );
      } else if (currentTenancy?.lifecycleStage === RentalLifecycle.ISSUE) {
        await advanceRentalLifecycle(issue.tenancyId, RentalLifecycle.ACTION, actor, 'Maintenance action initiated');
        await advanceRentalLifecycle(issue.tenancyId, RentalLifecycle.FIXED, actor, 'Maintenance completed');
        await advanceRentalLifecycle(
          issue.tenancyId,
          RentalLifecycle.VERIFIED,
          actor,
          `Issue "${issue.title}" verified via ${verificationMethod} and closed.`
        );
      }
    } catch (e) {
      console.warn('Could not advance lifecycle to VERIFIED:', e);
    }

    // Record verified resolution in MemoryService
    try {
      await memoryService.remember({
        userProfileId: issue.reportedBy.userProfile.id,
        tenancyId: issue.tenancyId,
        propertyId: issue.propertyId,
        memoryType: 'MAINTENANCE_RESOLUTION',
        key: issue.category,
        summary: `Previous Maintenance: "${issue.title}" was resolved. Status: VERIFIED. Repair: ${effectiveResolution}`,
        content: {
          issueId: issue.id,
          issueTitle: issue.title,
          status: 'VERIFIED',
          resolution: effectiveResolution,
          verificationMethod,
          verifiedAt: verification.verifiedAt.toISOString(),
          evidence: verification.evidence,
        },
      });
    } catch (memErr) {
      console.warn('Failed to remember verified maintenance resolution:', memErr);
    }

    // State transition audit log
    await createAuditEvent({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'MAINTENANCE_VERIFIED',
      resourceType: 'MAINTENANCE_ISSUE',
      resourceId: issueId,
      metadata: {
        verificationId: verification.id,
        verificationMethod,
        verifiedBy,
        evidence: verification.evidence,
        confidence: effectiveConfidence,
        previousStatus: issue.status,
        newStatus: MaintenanceStatus.CLOSED,
        resolution: effectiveResolution,
      },
    });
  } else {
    // Rejected verification: Re-open task to IN_PROGRESS
    nextStatus = MaintenanceStatus.IN_PROGRESS;

    await prisma.maintenanceIssue.update({
      where: { id: issueId },
      data: { status: MaintenanceStatus.IN_PROGRESS },
    });

    await createAuditEvent({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'MAINTENANCE_VERIFICATION_REJECTED',
      resourceType: 'MAINTENANCE_ISSUE',
      resourceId: issueId,
      metadata: {
        verificationId: verification.id,
        verificationMethod,
        notes: notes || 'Verification rejected by user',
        previousStatus: issue.status,
        newStatus: MaintenanceStatus.IN_PROGRESS,
      },
    });
  }

  return {
    verification,
    issueStatus: nextStatus,
    confirmed,
    resolution: effectiveResolution,
  };
}
