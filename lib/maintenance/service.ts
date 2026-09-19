import { MaintenanceStatus, RentalLifecycle } from '@prisma/client';
import prisma from '@/lib/db';
import { createAuditEvent } from '@/lib/audit/service';
import { advanceRentalLifecycle } from '@/lib/rental/service';

export interface ReportIssueParams {
  tenancyId: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  reporterUserProfileId: string;
}

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
    // If not in a state that allows ISSUE transition, log and continue
    console.warn('Could not advance lifecycle to ISSUE:', err);
  }

  // Audit log
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
    },
  });

  return issue;
}

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
    metadata: {
      issueId: params.issueId,
      assignedTo: params.assignedTo,
      estimatedCost: params.estimatedCost,
    },
  });

  return task;
}

export async function updateMaintenanceStatus(params: {
  issueId: string;
  status: MaintenanceStatus;
  actor: { id: string; role: string };
  notes?: string;
}) {
  const issue = await prisma.maintenanceIssue.findUnique({
    where: { id: params.issueId },
    include: { tenancy: true },
  });

  if (!issue) {
    throw new Error('Maintenance issue not found');
  }

  const updatedIssue = await prisma.maintenanceIssue.update({
    where: { id: params.issueId },
    data: { status: params.status },
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
  } else if (params.status === MaintenanceStatus.VERIFIED || params.status === MaintenanceStatus.CLOSED) {
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
    },
  });

  return updatedIssue;
}
