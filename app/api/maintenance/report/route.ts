import { NextRequest, NextResponse } from 'next/server';
import { reportMaintenanceIssue } from '@/lib/maintenance/service';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenancyId, title, description, category, priority, demoActorId } = body;

    if (!tenancyId || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: tenancyId, title, description' },
        { status: 400 }
      );
    }

    const authContext = await getAuthenticatedUser();
    let actor = authContext?.userProfile;

    if (!actor && demoActorId) {
      actor = (await prisma.userProfile.findUnique({
        where: { id: demoActorId },
      })) || undefined;
    }

    if (!actor) {
      const defaultTenant = await prisma.userProfile.findFirst({
        where: { role: 'TENANT' },
      });
      if (defaultTenant) actor = defaultTenant;
    }

    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const issue = await reportMaintenanceIssue({
      tenancyId,
      title,
      description,
      category,
      priority,
      reporterUserProfileId: actor.id,
    });

    return NextResponse.json({ success: true, issue });
  } catch (error: any) {
    console.error('Report maintenance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to report issue' },
      { status: 400 }
    );
  }
}
