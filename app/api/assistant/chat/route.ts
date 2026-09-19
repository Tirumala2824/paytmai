import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, modelName } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Server-side authentication (NEVER trust client-supplied user IDs)
    let authContext = await getAuthenticatedUser();

    // In demo environment, if no active auth session is present, fallback to default seed tenant
    if (!authContext?.userProfile) {
      const demoTenant = await prisma.userProfile.findFirst({
        where: { role: UserRole.TENANT },
        include: { tenant: true },
      });

      if (demoTenant) {
        authContext = {
          userProfile: demoTenant,
          supabaseUser: { id: demoTenant.authUserId, email: demoTenant.email },
        };
      }
    }

    if (!authContext?.userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Execute through LangGraph AI Orchestrator
    const response = await executeRentalAssistant({
      userMessage: message,
      userProfile: authContext.userProfile,
      sessionId,
      modelName,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in /api/assistant/chat:', error);
    return NextResponse.json(
      { error: error.message || 'Internal AI Orchestrator Error' },
      { status: 500 }
    );
  }
}
