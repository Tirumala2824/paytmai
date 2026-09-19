import { NextRequest, NextResponse } from 'next/server';
import { VerificationMethod } from '@prisma/client';
import { verifyMaintenanceIssue } from '@/lib/maintenance/service';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      issueId,
      verificationMethod,
      evidence,
      confidence,
      notes,
      confirmed = true,
      resolution,
      demoActorId,
    } = body;

    if (!issueId) {
      return NextResponse.json({ error: 'Missing issueId' }, { status: 400 });
    }

    if (!verificationMethod || !Object.values(VerificationMethod).includes(verificationMethod)) {
      return NextResponse.json(
        { error: `Invalid verificationMethod. Must be one of: ${Object.values(VerificationMethod).join(', ')}` },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedUser();
    let actor = auth?.userProfile;

    if (!actor && demoActorId) {
      actor = (await prisma.userProfile.findUnique({
        where: { id: demoActorId },
      })) || undefined;
    }

    if (!actor) {
      // Default to tenant or owner
      actor = (await prisma.userProfile.findFirst({
        where: { role: 'TENANT' },
      })) || undefined;
    }

    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await verifyMaintenanceIssue({
      issueId,
      verificationMethod,
      verifiedBy: actor.id,
      evidence,
      confidence,
      notes,
      confirmed,
      resolution,
      actor: { id: actor.id, role: actor.role },
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Error verifying maintenance issue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify maintenance issue' },
      { status: 400 }
    );
  }
}
