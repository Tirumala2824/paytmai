import { NextRequest, NextResponse } from 'next/server';
import { RentalLifecycle, UserRole } from '@prisma/client';
import { advanceRentalLifecycle } from '@/lib/rental/service';
import { assertTenancyAccess } from '@/lib/auth/abac';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenancyId, targetStage, reason, demoActorId } = body;

    if (!tenancyId || !targetStage) {
      return NextResponse.json(
        { error: 'Missing tenancyId or targetStage' },
        { status: 400 }
      );
    }

    // Try to get authenticated user via Supabase session
    let authContext = await getAuthenticatedUser();

    // Support demo actor fallback for hackathon demonstration if no active supabase session
    let actor = authContext?.userProfile;
    if (!actor && demoActorId) {
      actor = (await prisma.userProfile.findUnique({
        where: { id: demoActorId },
      })) || undefined;
    }

    if (!actor) {
      // Default to Tenant 1 if testing locally without auth setup
      const defaultUser = await prisma.userProfile.findFirst({
        where: { role: UserRole.TENANT },
      });
      if (defaultUser) actor = defaultUser;
    }

    if (!actor) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // ABAC Verification: Ensure actor can access this specific tenancy
    await assertTenancyAccess(actor, tenancyId);

    // Advance lifecycle
    const updatedTenancy = await advanceRentalLifecycle(
      tenancyId,
      targetStage as RentalLifecycle,
      { id: actor.id, role: actor.role, name: actor.name },
      reason
    );

    return NextResponse.json({
      success: true,
      tenancy: updatedTenancy,
    });
  } catch (error: any) {
    console.error('Lifecycle transition error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to advance lifecycle' },
      { status: error.message?.includes('FORBIDDEN') ? 403 : 400 }
    );
  }
}
