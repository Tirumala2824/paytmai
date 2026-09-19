/**
 * HavenDex MemoryService
 * Clean abstraction over Cognee API and Persistent Rental Memory Graph in PostgreSQL.
 * Provides: remember(), retrieve(), search(), summarize(), and retrieveRelevantContext().
 * The rest of HavenDex never directly depends on Cognee APIs.
 */

import prisma from '@/lib/db';
import { createAuditEvent } from '@/lib/audit/service';

export type MemoryType =
  | 'TENANCY_RELATION'
  | 'ROOM'
  | 'MAINTENANCE_ISSUE'
  | 'MAINTENANCE_RESOLUTION'
  | 'PAYMENT_CONTEXT'
  | 'RENTAL_EVENT'
  | 'AGENT_ACTION'
  | 'INTERACTION_SUMMARY';

export interface RememberParams {
  userProfileId: string;
  tenancyId?: string;
  propertyId?: string;
  memoryType: MemoryType;
  key?: string; // e.g. "AC_UNIT", "RENT_PAYMENT_SCHEDULE"
  summary: string;
  content?: Record<string, unknown>;
  confidence?: number;
}

export interface RetrieveParams {
  userProfileId: string;
  tenancyId?: string;
  memoryTypes?: MemoryType[];
  limit?: number;
}

export interface SearchParams {
  userProfileId: string;
  tenancyId?: string;
  query: string;
  limit?: number;
  threshold?: number;
}

export interface SummarizeParams {
  userProfileId: string;
  tenancyId?: string;
}

export interface MemoryRecord {
  id: string;
  userProfileId: string;
  tenancyId?: string | null;
  propertyId?: string | null;
  memoryType: string;
  key?: string | null;
  summary: string;
  content?: any;
  confidence?: number | null;
  source: 'COGNEE_API' | 'LOCAL_GRAPH';
  createdAt: Date;
}

export interface RelevantContextResult {
  relevantMemories: Array<{
    id: string;
    summary: string;
    memoryType: string;
    key?: string | null;
    score: number;
    createdAt: string;
    content?: any;
  }>;
  previousRelatedIssue?: {
    id: string;
    title: string;
    status: string;
    resolution?: string | null;
    verifiedAt?: string;
    isRepeated: boolean;
  };
  summary: string;
}

const COGNEE_API_BASE = process.env.COGNEE_API_URL || 'https://api.cognee.ai';

function getCogneeApiKey(): string | undefined {
  const key = process.env.COGNEE_API_KEY;
  if (!key || key.includes('placeholder') || key === 'undefined' || key.trim().length === 0) {
    return undefined;
  }
  return key.trim();
}

/**
 * Sanitize memory content to ensure sensitive data is not stored.
 */
function sanitizeContent(content?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!content) return undefined;
  const sanitized = { ...content };
  const sensitiveKeys = ['password', 'secret', 'token', 'cvv', 'cardNumber', 'pin', 'idProofNumber'];
  for (const k of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      sanitized[k] = '[REDACTED_SENSITIVE]';
    }
  }
  return sanitized;
}

export class MemoryService {
  /**
   * Stores useful rental context in Cognee memory graph and persistent database.
   * Does not store raw passwords, unnecessary sensitive info, or noisy conversations.
   */
  async remember(params: RememberParams): Promise<MemoryRecord> {
    const {
      userProfileId,
      tenancyId,
      propertyId,
      memoryType,
      key,
      summary,
      content,
      confidence = 1.0,
    } = params;

    const safeContent = sanitizeContent(content);
    let source: 'COGNEE_API' | 'LOCAL_GRAPH' = 'LOCAL_GRAPH';

    // 1. Send to Cognee API if configured
    const apiKey = getCogneeApiKey();
    if (apiKey) {
      try {
        const res = await fetch(`${COGNEE_API_BASE}/api/v1/memory/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            user_id: userProfileId,
            dataset_name: `havendex_${tenancyId || userProfileId}`,
            data: {
              memoryType,
              key,
              summary,
              content: safeContent,
              timestamp: new Date().toISOString(),
            },
          }),
          signal: AbortSignal.timeout(1500),
        });

        if (res.ok) {
          source = 'COGNEE_API';
        }
      } catch (err: any) {
        console.warn('Cognee API add failed, using persistent local graph:', err.message);
      }
    }

    // 2. Persist to Prisma RentalMemory table
    const record = await prisma.rentalMemory.create({
      data: {
        userProfileId,
        tenancyId,
        propertyId,
        memoryType,
        key,
        summary,
        content: safeContent as any,
        confidence,
        source,
      },
    });

    // 3. Log Audit Event
    await createAuditEvent({
      actorId: userProfileId,
      actorRole: 'SYSTEM',
      action: 'MEMORY_REMEMBER',
      resourceType: 'RENTAL_MEMORY',
      resourceId: record.id,
      metadata: {
        memoryType,
        key,
        summary,
        source,
      },
    });

    return {
      id: record.id,
      userProfileId: record.userProfileId,
      tenancyId: record.tenancyId,
      propertyId: record.propertyId,
      memoryType: record.memoryType,
      key: record.key,
      summary: record.summary,
      content: record.content,
      confidence: record.confidence,
      source: record.source as any,
      createdAt: record.createdAt,
    };
  }

  /**
   * Retrieves stored rental memories by user, tenancy, property, or type.
   */
  async retrieve(params: RetrieveParams & { propertyId?: string }): Promise<MemoryRecord[]> {
    const { userProfileId, tenancyId, propertyId, memoryTypes, limit = 50 } = params;

    const orConditions: any[] = [{ userProfileId }];
    if (tenancyId) {
      orConditions.push({ tenancyId });
    }
    if (propertyId) {
      orConditions.push({ propertyId });
    }

    const whereClause: any = {
      OR: orConditions,
    };
    if (memoryTypes && memoryTypes.length > 0) {
      whereClause.memoryType = { in: memoryTypes };
    }

    const records = await prisma.rentalMemory.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      userProfileId: r.userProfileId,
      tenancyId: r.tenancyId,
      propertyId: r.propertyId,
      memoryType: r.memoryType,
      key: r.key,
      summary: r.summary,
      content: r.content,
      confidence: r.confidence,
      source: r.source as any,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Searches relevant memories using semantic relevance (via Cognee API or keyword ranking).
   */
  async search(params: SearchParams & { propertyId?: string }): Promise<Array<MemoryRecord & { score: number }>> {
    const { userProfileId, tenancyId, propertyId, query, limit = 8 } = params;
    const apiKey = getCogneeApiKey();

    // Try Cognee API Search
    if (apiKey) {
      try {
        const res = await fetch(`${COGNEE_API_BASE}/api/v1/memory/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            user_id: userProfileId,
            query,
            limit,
          }),
          signal: AbortSignal.timeout(1500),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results) && data.results.length > 0) {
            return data.results.map((r: any) => ({
              id: r.id || `cognee-${Date.now()}`,
              userProfileId,
              tenancyId,
              propertyId,
              memoryType: r.memoryType || 'INTERACTION_SUMMARY',
              key: r.key,
              summary: r.summary || r.text,
              content: r.content || r.metadata,
              confidence: r.confidence || 0.95,
              source: 'COGNEE_API',
              createdAt: new Date(r.timestamp || Date.now()),
              score: r.score || 0.9,
            }));
          }
        }
      } catch (err: any) {
        console.warn('Cognee search failed, falling back to local memory matching:', err.message);
      }
    }

    // Local semantic scoring fallback across user, tenancy, and property
    const allMemories = await this.retrieve({ userProfileId, tenancyId, propertyId, limit: 100 });
    const queryTokens = query
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2);

    const scored = allMemories.map((m) => {
      const textToMatch = `${m.summary} ${m.key || ''} ${JSON.stringify(m.content || {})}`.toLowerCase();
      let matches = 0;
      for (const token of queryTokens) {
        if (textToMatch.includes(token)) {
          matches += 1;
        }
      }

      // Keyword density score
      const score = queryTokens.length > 0 ? matches / queryTokens.length : 0;
      return { ...m, score };
    });

    return scored
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Produces a concise natural language summary of the user's rental relationship.
   */
  async summarize(params: SummarizeParams): Promise<string> {
    const { userProfileId, tenancyId } = params;

    const profile = await prisma.userProfile.findUnique({
      where: { id: userProfileId },
      include: {
        tenant: {
          include: {
            tenancies: {
              where: tenancyId ? { id: tenancyId } : { isActive: true },
              include: { property: true, room: true },
              take: 1,
            },
          },
        },
      },
    });

    const memories = await this.retrieve({
      userProfileId,
      tenancyId,
      limit: 20,
    });

    const parts: string[] = [];

    if (profile) {
      const activeTenancy = profile.tenant?.tenancies[0];
      if (activeTenancy) {
        parts.push(
          `Tenant: ${profile.name} at ${activeTenancy.property.name} (Room ${activeTenancy.room?.roomNumber || 'N/A'})`
        );
      } else {
        parts.push(`User: ${profile.name} (${profile.role})`);
      }
    }

    const tenancyMemory = memories.find((m) => m.memoryType === 'TENANCY_RELATION');
    const roomMemory = memories.find((m) => m.memoryType === 'ROOM');
    const paymentMemory = memories.find((m) => m.memoryType === 'PAYMENT_CONTEXT');
    const recentResolutions = memories.filter((m) => m.memoryType === 'MAINTENANCE_RESOLUTION');

    if (tenancyMemory && !parts.some((p) => p.includes(tenancyMemory.summary))) {
      parts.push(tenancyMemory.summary);
    }
    if (roomMemory) parts.push(roomMemory.summary);
    if (paymentMemory) parts.push(paymentMemory.summary);
    if (recentResolutions.length > 0) {
      parts.push(`Recent maintenance: ${recentResolutions.slice(0, 3).map((r) => r.summary).join('; ')}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'No prior rental memory recorded.';
  }

  /**
   * Core Context Retrieval for Section 3 & 4.
   * User Request -> Authenticated User -> Rental Identity -> Relevant Context Retrieval -> AI
   * Detects if the user query refers to a previous maintenance issue (e.g. "The AC is broken again").
   */
  async retrieveRelevantContext(params: {
    userProfileId: string;
    tenancyId?: string;
    propertyId?: string;
    userMessage: string;
  }): Promise<RelevantContextResult> {
    const { userProfileId, userMessage } = params;
    let tenancyId = params.tenancyId;
    let propertyId = params.propertyId;

    // Resolve propertyId if not explicitly passed
    if (!propertyId && tenancyId) {
      const ten = await prisma.tenancy.findUnique({
        where: { id: tenancyId },
        select: { propertyId: true },
      });
      if (ten) propertyId = ten.propertyId;
    } else if (!propertyId) {
      const tenant = await prisma.tenant.findUnique({
        where: { userProfileId },
        include: { tenancies: { where: { isActive: true }, select: { id: true, propertyId: true }, take: 1 } },
      });
      if (tenant?.tenancies[0]) {
        tenancyId = tenancyId || tenant.tenancies[0].id;
        propertyId = tenant.tenancies[0].propertyId;
      } else {
        const owner = await prisma.owner.findUnique({
          where: { userProfileId },
          include: { properties: { select: { id: true }, take: 1 } },
        });
        if (owner?.properties[0]) {
          propertyId = owner.properties[0].id;
        }
      }
    }

    // Search memories matching user query across user, tenancy, and property
    const searchResults = await this.search({
      userProfileId,
      tenancyId,
      propertyId,
      query: userMessage,
      limit: 8,
    });

    // Detect if message mentions recurring or specific maintenance items
    const lower = userMessage.toLowerCase();
    const isMaintenanceRelated =
      lower.includes('ac') ||
      lower.includes('cooler') ||
      lower.includes('cooling') ||
      lower.includes('water') ||
      lower.includes('leak') ||
      lower.includes('tap') ||
      lower.includes('pipe') ||
      lower.includes('light') ||
      lower.includes('geyser') ||
      lower.includes('broken') ||
      lower.includes('repair') ||
      lower.includes('fix') ||
      lower.includes('working');

    const isRecurring =
      lower.includes('again') ||
      lower.includes('still') ||
      lower.includes('recur') ||
      lower.includes('repeat') ||
      lower.includes('same');

    let previousRelatedIssue: RelevantContextResult['previousRelatedIssue'] = undefined;

    if (isMaintenanceRelated) {
      // Find past verified or in-progress maintenance issues for this tenancy or user
      const pastIssues = await prisma.maintenanceIssue.findMany({
        where: {
          OR: [
            { reportedBy: { userProfileId } },
            tenancyId ? { tenancyId } : { reportedBy: { userProfileId } },
          ],
        },
        include: { verifications: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      // Match by keyword in title/category/description
      const matched = pastIssues.find((issue) => {
        const text = `${issue.title} ${issue.description || ''} ${issue.category}`.toLowerCase();
        if (
          lower.includes('ac') &&
          (text.includes('ac') || text.includes('air conditioning') || issue.category === 'APPLIANCE')
        )
          return true;
        if (lower.includes('tap') && text.includes('tap')) return true;
        if (lower.includes('leak') && text.includes('leak')) return true;
        if (lower.includes('geyser') && text.includes('geyser')) return true;
        return false;
      });

      if (matched) {
        previousRelatedIssue = {
          id: matched.id,
          title: matched.title,
          status: matched.status,
          resolution: matched.resolution || (matched.verifications[0]?.evidence ?? 'Technician service completed'),
          verifiedAt: matched.verifications[0]?.verifiedAt?.toISOString(),
          isRepeated: isRecurring || matched.status === 'VERIFIED',
        };
      } else {
        // Also check if relevantMemories found a MAINTENANCE_RESOLUTION or MAINTENANCE_ISSUE
        const mem = searchResults.find(
          (m) => m.memoryType === 'MAINTENANCE_RESOLUTION' || m.memoryType === 'MAINTENANCE_ISSUE'
        );
        if (mem && (mem.summary.toLowerCase().includes('ac') || mem.key?.includes('AC'))) {
          previousRelatedIssue = {
            id: mem.content?.issueId || mem.id,
            title: mem.content?.issueTitle || 'Air Conditioning unit service',
            status: mem.content?.status || 'VERIFIED',
            resolution: mem.content?.resolution || mem.summary,
            verifiedAt: mem.content?.verifiedAt,
            isRepeated: true,
          };
        }
      }
    }

    const summary = await this.summarize({ userProfileId, tenancyId });

    return {
      relevantMemories: searchResults.map((m) => ({
        id: m.id,
        summary: m.summary,
        memoryType: m.memoryType,
        key: m.key,
        score: m.score,
        createdAt: m.createdAt.toISOString(),
        content: m.content,
      })),
      previousRelatedIssue,
      summary,
    };
  }
}

export const memoryService = new MemoryService();
