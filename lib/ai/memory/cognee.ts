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

const COGNEE_API_BASE = process.env.COGNEE_API_URL || 'https://api.cognee.ai';

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
 * Records a rental lifecycle memory event into Cognee memory graph.
 * Falls back to local database audit/action logging if remote Cognee is unavailable.
 */
export async function recordRentalMemoryEvent(data: MemoryEventData): Promise<{ success: boolean; memoryId?: string; source: string }> {
  const apiKey = getCogneeApiKey();

  // Try Cognee API if key is present
  if (apiKey) {
    try {
      const response = await fetch(`${COGNEE_API_BASE}/api/v1/memory/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          user_id: data.userProfileId,
          dataset_name: `havendex_tenancy_${data.tenancyId || 'general'}`,
          data: {
            summary: data.summary,
            eventType: data.eventType,
            metadata: data.metadata,
            timestamp: data.timestamp || new Date().toISOString(),
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          memoryId: result.id || result.memory_id,
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

  if (apiKey) {
    try {
      const response = await fetch(`${COGNEE_API_BASE}/api/v1/memory/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          user_id: userProfileId,
          query,
          limit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          relevantMemories: (data.results || []).map((r: any) => ({
            id: r.id,
            summary: r.text || r.summary,
            score: r.score,
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
