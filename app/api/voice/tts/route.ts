import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';
import { UserRole } from '@prisma/client';
import { sarvamTextToSpeech } from '@/lib/voice/sarvam';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
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
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse request JSON
    const body = await req.json();
    const { text, languageCode = 'en-IN', speaker, sampleRate } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    // 3. Call Sarvam TTS service
    const ttsResult = await sarvamTextToSpeech({
      text,
      targetLanguageCode: languageCode,
      speaker,
      sampleRate,
    });

    return NextResponse.json(ttsResult);
  } catch (error: any) {
    console.error('Error in /api/voice/tts:', error);
    return NextResponse.json(
      { error: error.message || 'Text-to-Speech conversion failed' },
      { status: 500 }
    );
  }
}
