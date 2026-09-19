import { describe, it, expect, beforeEach } from 'vitest';
import { kcache, KCacheService } from '@/lib/ai/cache/kcache';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';
import { generateContextualFollowUps } from '@/lib/ai/llm';
import { UserRole } from '@prisma/client';
import prisma from '@/lib/db';

describe('HavenDex KCache & Multi-Turn Follow-Up Context Tests', () => {
  let tenantProfile: any;
  let ownerProfile: any;

  beforeEach(async () => {
    kcache.clear();

    tenantProfile = await prisma.userProfile.findFirst({
      where: { role: UserRole.TENANT },
      include: { tenant: { include: { tenancies: { where: { isActive: true }, take: 1 } } } },
    });

    ownerProfile = await prisma.userProfile.findFirst({
      where: { role: UserRole.OWNER },
      include: { owner: true },
    });
  });

  // ==========================================================================
  // 1. KCACHE CORE UNIT TESTS
  // ==========================================================================
  describe('1. KCache Unit & Telemetry Behavior', () => {
    it('should store, append, and retrieve multi-turn session dialogue history', () => {
      const sessionId = 'test-session-001';

      kcache.appendTurn(sessionId, {
        role: 'user',
        content: 'What is the Wi-Fi password?',
      });

      kcache.appendTurn(sessionId, {
        role: 'assistant',
        content: 'The Wi-Fi network is NexusGrand_5G and the password is Nexus@2026.',
        suggestedFollowUps: ['What are the mess timings?', 'What are the visitor hours?'],
      });

      const history = kcache.getHistory(sessionId);
      expect(history.length).toBe(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toContain('Wi-Fi password');
      expect(history[1].role).toBe('assistant');
      expect(history[1].suggestedFollowUps?.length).toBe(2);
    });

    it('should track and update active session context & topic', () => {
      const sessionId = 'test-session-002';

      kcache.updateActiveContext(sessionId, {
        activeTopic: 'WIFI',
        activePropertyName: 'Nexus Grand PG',
      });

      let ctx = kcache.getActiveContext(sessionId);
      expect(ctx?.activeTopic).toBe('WIFI');
      expect(ctx?.activePropertyName).toBe('Nexus Grand PG');

      // Update with an appliance/maintenance issue
      kcache.updateActiveContext(sessionId, {
        activeTopic: 'AC_MAINTENANCE',
        activeAppliance: 'AC',
        activeIssueId: 'issue-ac-123',
      });

      ctx = kcache.getActiveContext(sessionId);
      expect(ctx?.activeTopic).toBe('AC_MAINTENANCE');
      expect(ctx?.activeAppliance).toBe('AC');
      expect(ctx?.activeIssueId).toBe('issue-ac-123');
      expect(ctx?.activePropertyName).toBe('Nexus Grand PG'); // Preserved
    });

    it('should cache RAG knowledge lookups and record hit telemetry', () => {
      const query = 'wifi password';
      const propertyId = 'prop-nexus-01';
      const mockKnowledge = [
        {
          id: 'k1',
          category: 'PROPERTY_WIFI',
          key: 'WIFI_CREDENTIALS',
          summary: 'Wi-Fi: NexusGrand_5G / Pass: Nexus@2026',
          score: 1.0,
          source: 'LOCAL_GRAPH' as const,
        },
      ];

      // Miss on initial lookup
      const miss = kcache.getCachedKnowledge(query, propertyId, 'WIFI');
      expect(miss).toBeNull();

      // Populate cache
      kcache.setCachedKnowledge(query, mockKnowledge, propertyId, 'WIFI');

      // Hit on second lookup
      const hit = kcache.getCachedKnowledge(query, propertyId, 'WIFI');
      expect(hit).not.toBeNull();
      expect(hit?.length).toBe(1);
      expect(hit?.[0].summary).toContain('NexusGrand_5G');

      // Telemetry verification
      const telemetry = kcache.getTelemetry();
      expect(telemetry.hits).toBeGreaterThan(0);
      expect(telemetry.cachedKnowledgeCount).toBe(1);
      expect(telemetry.latencySavedMs).toBeGreaterThan(0);
    });

    it('should resolve follow-up context when queries contain pronouns or ellipsis', () => {
      const sessionId = 'test-session-003';
      kcache.appendTurn(sessionId, { role: 'user', content: 'What is the Wi-Fi password?' });
      kcache.appendTurn(sessionId, { role: 'assistant', content: 'Network is NexusGrand_5G.' });
      kcache.updateActiveContext(sessionId, { activeTopic: 'WIFI', activePropertyName: 'Nexus Grand PG' });

      const resolved = kcache.resolveFollowUpContext(sessionId, 'Can you repeat the password?');
      expect(resolved.isFollowUp).toBe(true);
      expect(resolved.history.length).toBe(2);
      expect(resolved.resolvedMessage).toContain('Context Topic: WIFI');
    });
  });

  // ==========================================================================
  // 2. CONTEXTUAL FOLLOW-UP GENERATOR TESTS
  // ==========================================================================
  describe('2. Contextual Follow-Up Question Generation', () => {
    it('should generate relevant follow-ups for Wi-Fi queries', () => {
      const followUps = generateContextualFollowUps('PROPERTY_INFORMATION', 'TENANT', {}, 'What is the wifi password?');
      expect(followUps).toContain('What are the mess timings?');
      expect(followUps).toContain('What are the visitor hours?');
    });

    it('should generate relevant follow-ups for maintenance reports', () => {
      const followUps = generateContextualFollowUps('MAINTENANCE_REPORT', 'TENANT', {}, 'My AC is broken');
      expect(followUps).toContain('When will the technician arrive?');
      expect(followUps).toContain('Notify owner that it is urgent');
    });

    it('should generate relevant follow-ups for rent queries', () => {
      const followUps = generateContextualFollowUps('PAYMENT_STATUS', 'TENANT', {}, 'Is my rent paid?');
      expect(followUps).toContain('Download rent receipt');
      expect(followUps).toContain('When is next month\'s rent due?');
    });

    it('should generate relevant owner portfolio follow-ups', () => {
      const followUps = generateContextualFollowUps('PORTFOLIO_OVERVIEW', 'OWNER', {}, 'What is my total monthly revenue?');
      expect(followUps).toContain('Show vacant rooms');
      expect(followUps).toContain('List active tenants');
    });
  });

  // ==========================================================================
  // 3. MULTI-TURN CONVERSATION CONTEXT & ORCHESTRATION CONTINUITY
  // ==========================================================================
  describe('3. Multi-Turn Orchestration Continuity', () => {
    it('should maintain context across Turn 1 (Wi-Fi Inquiry) and Turn 2 (Follow-up)', async () => {
      if (!tenantProfile) return;

      // Turn 1: Initial Question
      const turn1 = await executeRentalAssistant({
        userMessage: 'What is the Wi-Fi password for Nexus Grand PG?',
        userProfile: tenantProfile,
      });

      const sessionId = turn1.sessionId;
      expect(sessionId).toBeDefined();
      expect(turn1.userResponse).toBeDefined();
      expect(turn1.suggestedFollowUps).toBeDefined();
      expect(turn1.suggestedFollowUps?.length).toBeGreaterThan(0);

      // Verify Turn 1 is in KCache
      const historyAfterTurn1 = kcache.getHistory(sessionId);
      expect(historyAfterTurn1.length).toBe(2); // 1 user + 1 assistant

      // Turn 2: Follow-up question relying on previous turn context
      const turn2 = await executeRentalAssistant({
        userMessage: 'What was the password again?',
        userProfile: tenantProfile,
        sessionId,
      });

      expect(turn2.sessionId).toBe(sessionId);
      expect(turn2.userResponse).toBeDefined();
      expect(turn2.conversationHistory).toBeDefined();
      expect(turn2.conversationHistory!.length).toBeGreaterThanOrEqual(2);

      // Verify KCache accumulated turns
      const finalHistory = kcache.getHistory(sessionId);
      expect(finalHistory.length).toBe(4); // 2 user + 2 assistant
    }, 60000);

    it('should maintain active maintenance issue context across turns for owner notification', async () => {
      if (!tenantProfile) return;

      // Turn 1: Report an appliance breakdown
      const turn1 = await executeRentalAssistant({
        userMessage: 'My AC is not cooling properly in the room.',
        userProfile: tenantProfile,
      });

      const sessionId = turn1.sessionId;
      expect(sessionId).toBeDefined();
      const activeCtx = kcache.getActiveContext(sessionId);
      expect(activeCtx?.activeTopic).toBe('AC_MAINTENANCE');

      // Turn 2: Follow-up without repeating "AC"
      const turn2 = await executeRentalAssistant({
        userMessage: 'Tell the owner about it and ask them to send a technician.',
        userProfile: tenantProfile,
        sessionId,
      });

      expect(turn2.sessionId).toBe(sessionId);
      expect(turn2.userResponse).toBeDefined();
      // Should execute owner notification
      expect(turn2.plannedActions).toContain('notifyOwner');
    }, 60000);
  });
});
