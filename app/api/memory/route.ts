import { NextRequest, NextResponse } from 'next/server';
import { memoryService, MemoryType } from '@/lib/ai/memory/service';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    let userProfile = auth?.userProfile;

    if (!userProfile) {
      userProfile = (await prisma.userProfile.findFirst({
        where: { role: 'TENANT' },
      })) || undefined;
    }

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const memoryType = searchParams.get('type') as MemoryType | null;

    if (query) {
      const searchResults = await memoryService.search({
        userProfileId: userProfile.id,
        query,
        limit: 10,
      });
      return NextResponse.json({ query, results: searchResults });
    }

    const memories = await memoryService.retrieve({
      userProfileId: userProfile.id,
      memoryTypes: memoryType ? [memoryType] : undefined,
      limit: 30,
    });

    const summary = await memoryService.summarize({
      userProfileId: userProfile.id,
    });

    return NextResponse.json({
      userProfileId: userProfile.id,
      summary,
      totalMemories: memories.length,
      memories,
    });
  } catch (error: any) {
    console.error('Error in /api/memory:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch memory graph' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memoryType, key, summary, content, confidence, tenancyId } = body;

    if (!memoryType || !summary) {
      return NextResponse.json(
        { error: 'memoryType and summary are required' },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedUser();
    let userProfile = auth?.userProfile;

    if (!userProfile) {
      userProfile = (await prisma.userProfile.findFirst({
        where: { role: 'TENANT' },
      })) || undefined;
    }

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const record = await memoryService.remember({
      userProfileId: userProfile.id,
      tenancyId,
      memoryType,
      key,
      summary,
      content,
      confidence,
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error('Error storing memory:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to store memory' },
      { status: 400 }
    );
  }
}
