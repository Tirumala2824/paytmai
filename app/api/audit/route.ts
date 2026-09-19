import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/audit/service';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType') || undefined;
    const action = searchParams.get('action') || undefined;
    const limit = Number(searchParams.get('limit')) || 50;

    const authContext = await getAuthenticatedUser();
    let actor = authContext?.userProfile;

    // For demo exploration if not logged in
    if (!actor) {
      actor = (await prisma.userProfile.findFirst({
        where: { role: 'OWNER' },
      })) || undefined;
    }

    const filterActorId =
      actor?.role === 'TENANT' ? actor.id : undefined; // Tenants only see their own audit events

    const logs = await getAuditLogs({
      actorId: filterActorId,
      resourceType,
      action,
      limit,
    });

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error('Audit query error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
