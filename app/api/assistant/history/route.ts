import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';
import { UserRole } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    let authContext = await getAuthenticatedUser();

    if (!authContext?.userProfile) {
      const demoTenant = await prisma.userProfile.findFirst({
        where: { role: UserRole.TENANT },
      });
      if (demoTenant) {
        authContext = {
          userProfile: demoTenant,
          supabaseUser: { id: demoTenant.authUserId, email: demoTenant.email },
        };
      }
    }

    if (!authContext?.userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await prisma.agentSession.findMany({
      where: { userProfileId: authContext.userProfile.id },
      include: {
        actions: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({ sessions });
  } catch (err: any) {
    console.error('Error fetching assistant history:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
