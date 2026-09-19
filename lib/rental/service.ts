import { RentalLifecycle, Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { isValidLifecycleTransition, LIFECYCLE_STAGE_LABELS } from './lifecycle';
import { createAuditEvent } from '@/lib/audit/service';

export async function getTenancyWithDetails(tenancyId: string) {
  return await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: {
      tenant: {
        include: {
          userProfile: true,
        },
      },
      room: true,
      property: {
        include: {
          owner: {
            include: {
              userProfile: true,
            },
          },
        },
      },
      rentSchedules: {
        orderBy: { dueDate: 'desc' },
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      maintenanceIssues: {
        orderBy: { createdAt: 'desc' },
        include: {
          tasks: true,
        },
      },
    },
  });
}

export async function advanceRentalLifecycle(
  tenancyId: string,
  targetStage: RentalLifecycle,
  actor: { id: string; role: string; name?: string },
  reason?: string
) {
  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: {
      tenant: { include: { userProfile: true } },
      property: { include: { owner: { include: { userProfile: true } } } },
    },
  });

  if (!tenancy) {
    throw new Error(`Tenancy with ID ${tenancyId} not found`);
  }

  const currentStage = tenancy.lifecycleStage;

  if (currentStage === targetStage) {
    return tenancy;
  }

  if (!isValidLifecycleTransition(currentStage, targetStage)) {
    // Record unauthorized / invalid lifecycle transition attempt in audit
    await createAuditEvent({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'INVALID_LIFECYCLE_TRANSITION_ATTEMPT',
      resourceType: 'TENANCY',
      resourceId: tenancyId,
      metadata: {
        currentStage,
        targetStage,
        reason,
        status: 'REJECTED',
      },
    });

    throw new Error(
      `Invalid lifecycle transition from ${LIFECYCLE_STAGE_LABELS[currentStage]} to ${LIFECYCLE_STAGE_LABELS[targetStage]}`
    );
  }

  // Execute transition within a transaction
  const updatedTenancy = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenancy.update({
      where: { id: tenancyId },
      data: {
        lifecycleStage: targetStage,
      },
    });

    // Notify tenant if changed by owner, or notify owner if changed by tenant
    const recipientProfileId =
      actor.id === tenancy.tenant.userProfile.id
        ? tenancy.property.owner.userProfile.id
        : tenancy.tenant.userProfile.id;

    await tx.notification.create({
      data: {
        userProfileId: recipientProfileId,
        title: `Rental Status Updated: ${LIFECYCLE_STAGE_LABELS[targetStage]}`,
        message: `Tenancy for ${tenancy.property.name} (Room ${tenancy.roomId}) transitioned from ${LIFECYCLE_STAGE_LABELS[currentStage]} to ${LIFECYCLE_STAGE_LABELS[targetStage]}.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'LIFECYCLE_CHANGE',
        link: `/tenancy/${tenancyId}`,
      },
    });

    return updated;
  });

  // Record valid transition in audit log
  await createAuditEvent({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'LIFECYCLE_TRANSITION',
    resourceType: 'TENANCY',
    resourceId: tenancyId,
    metadata: {
      fromStage: currentStage,
      toStage: targetStage,
      reason,
      tenancyId,
    },
  });

  return updatedTenancy;
}
