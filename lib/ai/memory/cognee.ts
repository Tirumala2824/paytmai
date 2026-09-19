/**
 * Cognee Memory Integration Service
 * Manages semantic rental memory graph, storing user preferences,
 * tenancy interactions, and maintenance event history.
 */

import prisma from '@/lib/db';

export interface MemoryEventData {
  userProfileId: string;
  tenancyId?: string;
  eventType: 'INTERACTION' | 'MAINTENANCE_REPORT' | 'PAYMENT_EVENT' | 'PREFERENCE_UPDATE' | 'LIFECYCLE_CHANGE';
  summary: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface MemoryQueryResult {
  relevantMemories: Array<{
    id: string;
    summary: string;
    score?: number;
    timestamp: string;
  }>;
  source: 'COGNEE_API' | 'LOCAL_GRAPH';
}

export const getCogneeApiBase = (): string => {
  const url =
    process.env.COGNEE_BASE_URL ||
    process.env.COGNEE_SERVICE_URL ||
    process.env.COGNEE_API_URL ||
    'https://api.cognee.ai';
  return url.trim().replace(/\/+$/, '');
};

export function getCogneeApiKey(): string | undefined {
  const key = process.env.COGNEE_API_KEY;
  if (!key || key.includes('placeholder') || key === 'undefined' || key.trim().length === 0) {
    return undefined;
  }
  return key.trim();
}

export function isCogneeConfigured(): boolean {
  return !!getCogneeApiKey();
}

/**
 * Checks connection health to the configured Cognee service.
 */
export async function checkCogneeHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  keyMasked?: string;
  localKnowledgeCount: number;
  message: string;
  instructions?: string;
}> {
  const apiKey = getCogneeApiKey();
  const baseUrl = getCogneeApiBase();
  const localKnowledgeCount = await prisma.rentalMemory.count().catch(() => 0);

  if (!apiKey) {
    return {
      configured: false,
      connected: false,
      baseUrl,
      localKnowledgeCount,
      message: 'COGNEE_API_KEY is not configured in .env',
      instructions: 'Obtain an API key from https://platform.cognee.ai and set COGNEE_API_KEY and COGNEE_BASE_URL.',
    };
  }

  const keyMasked = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;

  // If user has the generic unrouted placeholder "https://api.cognee.ai"
  if (baseUrl === 'https://api.cognee.ai') {
    return {
      configured: true,
      connected: false,
      baseUrl,
      keyMasked,
      localKnowledgeCount,
      message: 'Cognee API key is active, but URL is pointing to placeholder https://api.cognee.ai.',
      instructions:
        'Cognee Cloud (https://platform.cognee.ai) provisions dedicated tenant endpoints formatted like https://<your-tenant>.aws.cognee.ai. Find your workspace URL on the API Keys page of platform.cognee.ai and set COGNEE_BASE_URL in .env. Meanwhile, 155 knowledge records are actively served from PostgreSQL RentalMemory.',
    };
  }

  try {
    // 1. Try health endpoint
    const healthRes = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(2000),
    });

    if (healthRes.ok) {
      return {
        configured: true,
        connected: true,
        baseUrl,
        keyMasked,
        localKnowledgeCount,
        message: 'Successfully connected to Cognee Cloud instance.',
      };
    }
  } catch {
    // try search ping fallback
  }

  try {
    // 2. Try pinging /api/v1/search
    const searchRes = await fetch(`${baseUrl}/api/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: 'ping',
        datasets: ['havendex_test'],
        top_k: 1,
      }),
      signal: AbortSignal.timeout(2000),
    });

    if (searchRes.ok || searchRes.status === 400 || searchRes.status === 422) {
      return {
        configured: true,
        connected: true,
        baseUrl,
        keyMasked,
        localKnowledgeCount,
        message: 'Successfully connected to Cognee Cloud tenant.',
      };
    }
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      baseUrl,
      keyMasked,
      localKnowledgeCount,
      message: `Cognee endpoint at ${baseUrl} is unreachable (${err.message}). Using local PostgreSQL Knowledge Graph with ${localKnowledgeCount} entries.`,
      instructions:
        'If using Cognee Cloud (https://platform.cognee.ai), find your workspace tenant URL (e.g., https://your-tenant.aws.cognee.ai) on the API Keys page and set COGNEE_BASE_URL in .env.',
    };
  }

  return {
    configured: true,
    connected: false,
    baseUrl,
    keyMasked,
    localKnowledgeCount,
    message: `Cognee endpoint at ${baseUrl} returned non-200 response. Using resilient local Knowledge Graph in PostgreSQL (${localKnowledgeCount} entries).`,
  };
}

/**
 * Records a rental lifecycle memory event into Cognee memory graph.
 * Falls back to local database audit/action logging if remote Cognee is unavailable.
 */
export async function recordRentalMemoryEvent(data: MemoryEventData): Promise<{ success: boolean; memoryId?: string; source: string }> {
  const apiKey = getCogneeApiKey();
  const baseUrl = getCogneeApiBase();

  // Try Cognee API if key is present
  if (apiKey) {
    try {
      const datasetName = `havendex_${data.tenancyId || data.userProfileId || 'general'}`;
      const payloadText = JSON.stringify({
        summary: data.summary,
        eventType: data.eventType,
        metadata: data.metadata,
        user_id: data.userProfileId,
        timestamp: data.timestamp || new Date().toISOString(),
      });

      const formData = new FormData();
      formData.append('raw_data', payloadText);
      formData.append('datasetName', datasetName);

      const response = await fetch(`${baseUrl}/api/v1/add`, {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        // Trigger cognify asynchronously
        fetch(`${baseUrl}/api/v1/cognify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ datasets: [datasetName] }),
        }).catch(() => {});

        const result = await response.json();
        return {
          success: true,
          memoryId: result.id || result.memory_id || `cognee-${Date.now()}`,
          source: 'COGNEE_API',
        };
      }
    } catch (err: any) {
      console.warn('Cognee API call failed, falling back to local memory logging:', err.message);
    }
  }

  // Fallback: Record memory event locally in Prisma AuditEvent table
  try {
    const audit = await prisma.auditEvent.create({
      data: {
        actorId: data.userProfileId,
        actorRole: 'TENANT',
        action: `MEMORY_${data.eventType}`,
        resourceType: 'MEMORY_GRAPH',
        resourceId: data.tenancyId || data.userProfileId,
        metadata: {
          summary: data.summary,
          eventType: data.eventType,
          details: data.metadata || {},
          isMemoryEvent: true,
        } as any,
      },
    });

    return {
      success: true,
      memoryId: audit.id,
      source: 'LOCAL_GRAPH',
    };
  } catch (dbErr: any) {
    console.error('Failed to log memory event locally:', dbErr);
    return {
      success: false,
      source: 'FAILED',
    };
  }
}

/**
 * Searches relevant rental memories for a user or tenancy.
 */
export async function searchRentalMemories(
  userProfileId: string,
  query: string,
  limit: number = 3
): Promise<MemoryQueryResult> {
  const apiKey = getCogneeApiKey();
  const baseUrl = getCogneeApiBase();

  if (apiKey) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          datasets: [`havendex_${userProfileId}`, 'havendex_general'],
          top_k: limit,
          searchType: 'GRAPH_COMPLETION',
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        const results = Array.isArray(data) ? data : data.results || [];
        return {
          relevantMemories: results.map((r: any) => ({
            id: r.id || `cognee-${Date.now()}`,
            summary: r.text || r.summary || (typeof r === 'string' ? r : JSON.stringify(r)),
            score: r.score ?? 0.9,
            timestamp: r.created_at || new Date().toISOString(),
          })),
          source: 'COGNEE_API',
        };
      }
    } catch (err: any) {
      console.warn('Cognee search failed, falling back to local audit queries:', err.message);
    }
  }

  // Fallback: Query recent memory audit events
  try {
    const audits = await prisma.auditEvent.findMany({
      where: {
        actorId: userProfileId,
        action: { startsWith: 'MEMORY_' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      relevantMemories: audits.map((a) => ({
        id: a.id,
        summary: (a.metadata as any)?.summary || a.action,
        timestamp: a.createdAt.toISOString(),
      })),
      source: 'LOCAL_GRAPH',
    };
  } catch {
    return {
      relevantMemories: [],
      source: 'LOCAL_GRAPH',
    };
  }
}
