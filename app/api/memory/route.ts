import { NextRequest, NextResponse } from 'next/server';
import { memoryService, MemoryType } from '@/lib/ai/memory/service';
import { checkCogneeHealth } from '@/lib/ai/memory/cognee';
import { syncSupabaseToCognee, getLastSyncTelemetry } from '@/lib/ai/memory/sync';
import { runRagBenchmark, evaluateRagResponse } from '@/lib/ai/rag/evaluator';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const check = searchParams.get('check');

    // Health / Diagnostics endpoint for Cognee connection
    if (check === 'cognee' || check === 'health') {
      const health = await checkCogneeHealth();
      return NextResponse.json(health);
    }

    // Automated RAG Evaluation Benchmark endpoint
    if (check === 'rag_eval' || check === 'rag-benchmark') {
      const benchmark = await runRagBenchmark();
      return NextResponse.json(benchmark);
    }

    // Sync Telemetry endpoint
    if (check === 'sync' || check === 'sync_status') {
      const telemetry = getLastSyncTelemetry();
      return NextResponse.json(telemetry || { status: 'NO_SYNC_YET', message: 'No sync run in this server lifecycle yet.' });
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
    const query = searchParams.get('q');
    const memoryType = searchParams.get('type') as MemoryType | null;

    if (query) {
      const propertyName = searchParams.get('property') || undefined;
      const category = searchParams.get('category') || undefined;
      const searchResults = await memoryService.searchKnowledgeGraph({
        query,
        propertyName,
        category,
        userProfileId: userProfile.id,
        limit: 10,
      });
      return NextResponse.json({ query, count: searchResults.length, results: searchResults });
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
    const { action, memoryType, key, summary, content, confidence, tenancyId } = body;

    // Automated Sync trigger: Supabase -> Cognee
    if (action === 'sync_cognee' || action === 'sync_supabase_to_cognee') {
      const syncResult = await syncSupabaseToCognee({ propertyId: body.propertyId });
      return NextResponse.json({ success: true, syncResult });
    }

    // On-demand RAG Evaluation
    if (action === 'evaluate_rag') {
      const { query, generatedResponse, contextSnippets, latencyMs } = body;
      if (!query || !generatedResponse) {
        return NextResponse.json(
          { error: 'query and generatedResponse are required for RAG evaluation' },
          { status: 400 }
        );
      }
      const evalResult = await evaluateRagResponse({
        query,
        generatedResponse,
        contextSnippets: contextSnippets || [],
        retrievalLatencyMs: latencyMs || 0,
      });
      return NextResponse.json({ success: true, evaluation: evalResult });
    }

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
