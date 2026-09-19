/**
 * HavenDex KCache (Knowledge & Context Cache) Service
 *
 * Provides a high-performance multi-tier caching layer:
 * 1. Session Dialogue Cache: Multi-turn conversation history & active entity/topic tracking
 * 2. Knowledge RAG Cache: Caching property specs, Wi-Fi, rules, and mess schedules
 * 3. LLM Response & Intent Cache: Caches canonical query responses and reduces 429 quota exhaustion
 * 4. Real-time Telemetry: Hits, misses, hit rate, and latency saved
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  intent?: string;
  suggestedFollowUps?: string[];
}

export interface SessionActiveContext {
  activePropertyId?: string;
  activePropertyName?: string;
  activeRoomNumber?: string;
  activeIssueId?: string;
  activeTopic?: string; // e.g. 'WIFI', 'MESS_TIMINGS', 'AC_MAINTENANCE', 'RENT_PAYMENT'
  activeAppliance?: string;
  lastQuotedAmount?: number;
  lastIntent?: string;
  lastToolsExecuted?: string[];
  updatedAt: number;
}

export interface CachedKnowledgeItem {
  id: string;
  category: string;
  key?: string | null;
  summary: string;
  content?: any;
  propertyName?: string;
  propertyAddress?: string;
  score: number;
  source: 'COGNEE_API' | 'LOCAL_GRAPH';
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface KCacheTelemetry {
  hits: number;
  misses: number;
  hitRate: number;
  latencySavedMs: number;
  cachedSessionsCount: number;
  cachedKnowledgeCount: number;
  cachedLlmCount: number;
  uptimeSeconds: number;
}

export class KCacheService {
  private sessions: Map<string, { turns: ChatTurn[]; context: SessionActiveContext; expiresAt: number }> = new Map();
  private knowledgeCache: Map<string, CacheEntry<CachedKnowledgeItem[]>> = new Map();
  private llmCache: Map<string, CacheEntry<any>> = new Map();

  // Telemetry metrics
  private hits: number = 0;
  private misses: number = 0;
  private latencySavedMs: number = 0;
  private startTime: number = Date.now();

  private readonly DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly DEFAULT_KNOWLEDGE_TTL_MS = 15 * 60 * 1000; // 15 mins
  private readonly DEFAULT_LLM_TTL_MS = 30 * 60 * 1000; // 30 mins

  // ==========================================================================
  // 1. SESSION DIALOGUE & MULTI-TURN CONVERSATION CACHE
  // ==========================================================================

  /**
   * Appends a chat turn to the session history and refreshes TTL.
   */
  appendTurn(sessionId: string, turn: ChatTurn, maxTurns: number = 20): void {
    if (!sessionId) return;
    const now = Date.now();
    const existing = this.sessions.get(sessionId);

    if (existing) {
      existing.turns.push(turn);
      if (existing.turns.length > maxTurns) {
        existing.turns = existing.turns.slice(-maxTurns);
      }
      existing.expiresAt = now + this.DEFAULT_SESSION_TTL_MS;
    } else {
      this.sessions.set(sessionId, {
        turns: [turn],
        context: { updatedAt: now },
        expiresAt: now + this.DEFAULT_SESSION_TTL_MS,
      });
    }
  }

  /**
   * Retrieves conversation history for a session.
   */
  getHistory(sessionId: string, limit: number = 10): ChatTurn[] {
    if (!sessionId) return [];
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.misses++;
      return [];
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      this.misses++;
      return [];
    }

    this.hits++;
    this.latencySavedMs += 10; // Avoided DB roundtrip
    return session.turns.slice(-limit);
  }

  /**
   * Gets active session entities/topic context.
   */
  getActiveContext(sessionId: string): SessionActiveContext | undefined {
    if (!sessionId) return undefined;
    const session = this.sessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) return undefined;
    return session.context;
  }

  /**
   * Updates active session topic and entities.
   */
  updateActiveContext(sessionId: string, partial: Partial<SessionActiveContext>): void {
    if (!sessionId) return;
    const now = Date.now();
    const session = this.sessions.get(sessionId);

    if (session) {
      session.context = {
        ...session.context,
        ...partial,
        updatedAt: now,
      };
      session.expiresAt = now + this.DEFAULT_SESSION_TTL_MS;
    } else {
      this.sessions.set(sessionId, {
        turns: [],
        context: {
          ...partial,
          updatedAt: now,
        },
        expiresAt: now + this.DEFAULT_SESSION_TTL_MS,
      });
    }
  }

  /**
   * Resolves contextual topic or pronouns for follow-up questions.
   * E.g. "What was the password again?" -> Enriched with active topic "WIFI".
   */
  resolveFollowUpContext(
    sessionId: string,
    currentMessage: string
  ): {
    history: ChatTurn[];
    activeContext?: SessionActiveContext;
    resolvedMessage: string;
    isFollowUp: boolean;
  } {
    const history = this.getHistory(sessionId, 6);
    const activeContext = this.getActiveContext(sessionId);
    const lower = currentMessage.toLowerCase().trim();

    // Check if message is elliptical or references prior turn
    const isElliptical =
      lower.startsWith('why') ||
      lower.startsWith('when') ||
      lower.startsWith('how much') ||
      lower.startsWith('who is') ||
      lower.startsWith('what is the') ||
      lower.startsWith('can you') ||
      lower.includes('again') ||
      lower.includes('repeat') ||
      lower.includes('password') ||
      lower.includes('tell the owner') ||
      lower.includes('it') ||
      lower.includes('that') ||
      lower.split(/\s+/).length <= 4;

    const isFollowUp = history.length > 0 && isElliptical;
    let resolvedMessage = currentMessage;

    if (isFollowUp && activeContext?.activeTopic) {
      resolvedMessage = `${currentMessage} [Context Topic: ${activeContext.activeTopic}${
        activeContext.activeAppliance ? `, Item: ${activeContext.activeAppliance}` : ''
      }${activeContext.activePropertyName ? `, Property: ${activeContext.activePropertyName}` : ''}]`;
    }

    return {
      history,
      activeContext,
      resolvedMessage,
      isFollowUp,
    };
  }

  // ==========================================================================
  // 2. KNOWLEDGE & RAG QUERY CACHE
  // ==========================================================================

  private buildKnowledgeKey(propertyId?: string, query?: string, category?: string): string {
    const p = propertyId || 'global';
    const c = category || 'all';
    const q = (query || '').toLowerCase().trim().replace(/\s+/g, '_');
    return `rag:${p}:${c}:${q}`;
  }

  /**
   * Retrieves cached RAG knowledge items.
   */
  getCachedKnowledge(
    query: string,
    propertyId?: string,
    category?: string
  ): CachedKnowledgeItem[] | null {
    const key = this.buildKnowledgeKey(propertyId, query, category);
    const entry = this.knowledgeCache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.knowledgeCache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    this.latencySavedMs += 150; // Saved Cognee/DB RAG lookup
    return entry.data;
  }

  /**
   * Sets RAG knowledge items in cache with TTL.
   */
  setCachedKnowledge(
    query: string,
    data: CachedKnowledgeItem[],
    propertyId?: string,
    category?: string,
    ttlMs?: number
  ): void {
    const key = this.buildKnowledgeKey(propertyId, query, category);
    const ttl = ttlMs || this.DEFAULT_KNOWLEDGE_TTL_MS;
    this.knowledgeCache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  // ==========================================================================
  // 3. LLM QUERY & RESPONSE CACHE
  // ==========================================================================

  /**
   * Gets cached LLM response or intent analysis.
   */
  getCachedLlm<T = any>(key: string): T | null {
    const entry = this.llmCache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.llmCache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    this.latencySavedMs += 400; // Saved Gemini LLM invocation
    return entry.data;
  }

  /**
   * Sets LLM response in cache with TTL.
   */
  setCachedLlm<T = any>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs || this.DEFAULT_LLM_TTL_MS;
    this.llmCache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  // ==========================================================================
  // 4. TELEMETRY & CACHE MANAGEMENT
  // ==========================================================================

  getTelemetry(): KCacheTelemetry {
    this.cleanExpired();
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? Math.round((this.hits / total) * 100) : 0;
    const uptimeSeconds = Math.round((Date.now() - this.startTime) / 1000);

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      latencySavedMs: this.latencySavedMs,
      cachedSessionsCount: this.sessions.size,
      cachedKnowledgeCount: this.knowledgeCache.size,
      cachedLlmCount: this.llmCache.size,
      uptimeSeconds,
    };
  }

  cleanExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.sessions.entries()) {
      if (now > v.expiresAt) this.sessions.delete(k);
    }
    for (const [k, v] of this.knowledgeCache.entries()) {
      if (now > v.expiresAt) this.knowledgeCache.delete(k);
    }
    for (const [k, v] of this.llmCache.entries()) {
      if (now > v.expiresAt) this.llmCache.delete(k);
    }
  }

  clear(): void {
    this.sessions.clear();
    this.knowledgeCache.clear();
    this.llmCache.clear();
    this.hits = 0;
    this.misses = 0;
    this.latencySavedMs = 0;
  }
}

// Global Singleton Instance for HavenDex
export const kcache = new KCacheService();
