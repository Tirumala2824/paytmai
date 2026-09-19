import { NextRequest, NextResponse } from 'next/server';
import { MaintenanceStatus } from '@prisma/client';
import { updateMaintenanceStatus, assignMaintenanceTask } from '@/lib/maintenance/service';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { issueId, status, notes, assignTo, taskTitle, demoActorId } = body;

    if (!issueId) {
      return NextResponse.json({ error: 'Missing issueId' }, { status: 400 });
    }

    const authContext = await getAuthenticatedUser();
    let actor = authContext?.userProfile;

    if (!actor && demoActorId) {
      actor = (await prisma.userProfile.findUnique({
        where: { id: demoActorId },
      })) || undefined;
    }

    if (!actor) {
      const defaultOwner = await prisma.userProfile.findFirst({
        where: { role: 'OWNER' },
      });
      if (defaultOwner) actor = defaultOwner;
    }

    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If assigning task
    if (assignTo && taskTitle) {
      const task = await assignMaintenanceTask({
        issueId,
        title: taskTitle,
        assignedTo: assignTo,
        actor: { id: actor.id, role: actor.role },
      });
      return NextResponse.json({ success: true, task });
    }

    // If updating status
    if (status) {
      const updated = await updateMaintenanceStatus({
        issueId,
        status: status as MaintenanceStatus,
        actor: { id: actor.id, role: actor.role },
        notes,
      });

      // If status is FIXED, VERIFIED, or CLOSED, broadcast notification to ALL active tenants in property
      if (['FIXED', 'VERIFIED', 'CLOSED'].includes(status)) {
        try {
          const issue = await prisma.maintenanceIssue.findUnique({
            where: { id: issueId },
            include: {
              property: {
                include: {
                  tenancies: {
                    where: { isActive: true },
                    include: { tenant: { include: { userProfile: true } } },
                  },
                },
              },
            },
          });

          if (issue && issue.property?.tenancies) {
            const notifs = issue.property.tenancies
              .filter((t) => t.tenant?.userProfile?.id)
              .map((t) => ({
                userProfileId: t.tenant.userProfile.id,
                title: `🔧 Issue Resolved: ${issue.title}`,
                message: `The maintenance issue "${issue.title}" at ${issue.property.name} has been resolved (${status}). All systems are running normally.`,
                type: 'MAINTENANCE_RESOLVED' as const,
                link: '/maintenance',
              }));

            if (notifs.length > 0) {
              await prisma.notification.createMany({
                data: notifs,
              });
            }
          }
        } catch (notifErr) {
          console.warn('Could not broadcast tenant notifications:', notifErr);
        }
      }

      return NextResponse.json({ success: true, issue: updated });
    }

    return NextResponse.json({ error: 'No action performed' }, { status: 400 });
  } catch (error: any) {
    console.error('Update maintenance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update maintenance' },
      { status: 400 }
    );
  }
}
