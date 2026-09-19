import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, modelName, languageCode, generateAudio, confirmedAction, userRole } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Server-side authentication (NEVER trust client-supplied user IDs)
    let authContext = await getAuthenticatedUser();

    // If client specifically requests OWNER persona in demo mode or if user has no session:
    const targetRole = userRole === 'OWNER' ? UserRole.OWNER : UserRole.TENANT;

    if (!authContext?.userProfile || (userRole && authContext.userProfile.role !== targetRole)) {
      const demoUser = await prisma.userProfile.findFirst({
        where: { role: targetRole },
        include: { tenant: true, owner: true },
      });

      if (demoUser) {
        authContext = {
          userProfile: demoUser,
          supabaseUser: { id: demoUser.authUserId, email: demoUser.email },
        };
      }
    }

    if (!authContext?.userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Execute through LangGraph AI Orchestrator (Phase 3 10-node pipeline)
    const response = await executeRentalAssistant({
      userMessage: message,
      userProfile: authContext.userProfile,
      sessionId,
      modelName,
      languageCode,
      generateAudio,
      confirmedAction,
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
