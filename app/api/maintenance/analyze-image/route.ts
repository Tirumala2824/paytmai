import { NextRequest, NextResponse } from 'next/server';
import { sarvamVisionAnalyze } from '@/lib/voice/sarvam';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType, description, prompt } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing imageBase64 payload' }, { status: 400 });
    }

    const visionPrompt =
      prompt ||
      (description
        ? `Analyze this maintenance repair photo for the reported issue: "${description}". Check if the repair or issue is visible and confirm the work quality. Rate confidence 0.0 to 1.0.`
        : 'Analyze this maintenance repair photo. Determine if the repair appears complete and sound.');

    const result = await sarvamVisionAnalyze({
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
      prompt: visionPrompt,
    });

    return NextResponse.json({
      success: true,
      modelUsed: 'sarvam-vision',
      ...result,
    });
  } catch (error: any) {
    console.error('AI image analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Image analysis failed',
        confidence: 0.85,
        analysis: 'AI image analysis could not complete. Manual verification recommended.',
        repairConfirmed: false,
      },
      { status: 500 }
    );
  }
}
