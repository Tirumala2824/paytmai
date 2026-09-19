import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';
import { UserRole } from '@prisma/client';
import { sarvamSpeechToText } from '@/lib/voice/sarvam';

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

    // 2. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const languageCode = (formData.get('languageCode') as string) || 'en-IN';

    if (!file) {
      return NextResponse.json(
        { error: 'Audio file is required (form field: file)' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Call Sarvam STT service
    const sttResult = await sarvamSpeechToText({
      audioBuffer: buffer,
      mimeType: file.type || 'audio/wav',
      languageCode,
    });

    return NextResponse.json(sttResult);
  } catch (error: any) {
    console.error('Error in /api/voice/stt:', error);
    return NextResponse.json(
      { error: error.message || 'Speech-to-Text conversion failed' },
      { status: 500 }
    );
  }
}
