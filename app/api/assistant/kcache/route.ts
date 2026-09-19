import { NextRequest, NextResponse } from 'next/server';
import { kcache } from '@/lib/ai/cache/kcache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const telemetry = kcache.getTelemetry();
    return NextResponse.json({
      status: 'active',
      telemetry,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch KCache telemetry' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'clear') {
      kcache.clear();
      return NextResponse.json({ message: 'KCache flushed successfully', telemetry: kcache.getTelemetry() });
    }
    return NextResponse.json({ telemetry: kcache.getTelemetry() });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update KCache' },
      { status: 500 }
    );
  }
}
