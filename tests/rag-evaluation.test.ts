import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '@/lib/db';
import {
  serializePropertiesForCognee,
  serializeRoomsForCognee,
  serializeTenanciesForCognee,
  serializeRentalMemoriesForCognee,
  syncSupabaseToCognee,
  getLastSyncTelemetry,
} from '@/lib/ai/memory/sync';
import {
  evaluateContextRelevance,
  evaluateFaithfulness,
  evaluateAnswerRelevance,
  evaluateRagResponse,
  runRagBenchmark,
} from '@/lib/ai/rag/evaluator';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';
import { UserRole } from '@prisma/client';

describe('HavenDex Automated Supabase Sync & RAG Evaluation Suite', () => {
  let testTenantUser: any;

  beforeAll(async () => {
    testTenantUser = await prisma.userProfile.findFirst({
      where: { role: UserRole.TENANT },
    });
  });

  describe('1. Automated Supabase to Cognee Data Pipeline', () => {
    it('should serialize properties into rich semantic text for Cognee graph', async () => {
      const chunks = await serializePropertiesForCognee();
      expect(chunks.length).toBeGreaterThanOrEqual(8);
      const sample = chunks[0];
      expect(sample).toContain('[PROPERTY_PROFILE]');
      expect(sample).toContain('Property Name:');
      expect(sample).toContain('Key Amenities:');
    });

    it('should serialize room inventories into semantic text', async () => {
      const chunks = await serializeRoomsForCognee();
      expect(chunks.length).toBeGreaterThan(0);
      const sample = chunks[0];
      expect(sample).toContain('[ROOM_INVENTORY]');
      expect(sample).toContain('Monthly Rent:');
    });

    it('should serialize active tenancies into semantic text', async () => {
      const chunks = await serializeTenanciesForCognee();
      expect(chunks.length).toBeGreaterThan(0);
      const sample = chunks[0];
      expect(sample).toContain('[TENANCY_STATUS]');
      expect(sample).toContain('Tenant:');
    });

    it('should serialize all 193 PostgreSQL RentalMemory graph nodes', async () => {
      const chunks = await serializeRentalMemoriesForCognee();
      expect(chunks.length).toBeGreaterThanOrEqual(150);
      const sample = chunks.find((c) => c.includes('WIFI') || c.includes('MESS'));
      expect(sample).toBeDefined();
      expect(sample).toContain('[PROPERTY_POLICY]');
    });

    it('should execute syncSupabaseToCognee() and record valid telemetry', async () => {
      const telemetry = await syncSupabaseToCognee();
      expect(telemetry.success).toBe(true);
      expect(telemetry.totalChunks).toBeGreaterThan(150);
      expect(telemetry.counts.properties).toBeGreaterThanOrEqual(8);
      expect(telemetry.counts.rentalMemories).toBeGreaterThanOrEqual(150);
      expect(telemetry.durationMs).toBeGreaterThan(0);

      const cached = getLastSyncTelemetry();
      expect(cached).not.toBeNull();
      expect(cached?.totalChunks).toBe(telemetry.totalChunks);
    });
  });

  describe('2. RAG Evaluation Metrics (RAG Triad)', () => {
    const mockContext = [
      {
        category: 'WIFI',
        key: 'WIFI_CREDENTIALS',
        summary: 'Nexus Grand Wi-Fi network SSID is "NexusGrand-HighSpeed" with password "NexusPG@2025". High-speed 200 Mbps fiber.',
      },
      {
        category: 'MESS',
        key: 'MEAL_TIMINGS',
        summary: 'Mess schedule: Breakfast 07:30 - 09:30 AM, Lunch 12:30 - 14:30 PM, Dinner 19:30 - 21:30 PM.',
      },
    ];

    it('should evaluate Context Relevance accurately', () => {
      const relevant = evaluateContextRelevance('What is the wifi password?', mockContext);
      expect(relevant.score).toBeGreaterThan(0.7);
      expect(relevant.matchedTerms).toContain('wifi');
      expect(relevant.matchedTerms).toContain('password');

      const irrelevant = evaluateContextRelevance('Can I bring an elephant into the building?', mockContext);
      expect(irrelevant.score).toBeLessThan(0.4);
    });

    it('should evaluate Faithfulness (groundedness) and detect hallucination risk', () => {
      // Grounded answer strictly from context
      const faithfulAnswer = 'The Wi-Fi SSID is NexusGrand-HighSpeed and password is NexusPG@2025.';
      const faithfulEval = evaluateFaithfulness(faithfulAnswer, mockContext);
      expect(faithfulEval.score).toBeGreaterThanOrEqual(0.85);
      expect(faithfulEval.hallucinationRisk).toBe('NONE');

      // Hallucinated answer with fake credentials
      const hallucinatedAnswer = 'The Wi-Fi password is SecretPassword!9999 and speed is 10000 Mbps.';
      const hallucinatedEval = evaluateFaithfulness(hallucinatedAnswer, mockContext);
      expect(hallucinatedEval.hallucinationRisk).toBe('HIGH');
      expect(hallucinatedEval.notes.length).toBeGreaterThan(0);
    });

    it('should evaluate Answer Relevance', () => {
      const query = 'What are the mess timings?';
      const goodAnswer = 'Mess timings are: Breakfast 07:30 - 09:30 AM, Lunch 12:30 - 14:30 PM, and Dinner 19:30 - 21:30 PM.';
      const score = evaluateAnswerRelevance(query, goodAnswer);
      expect(score).toBeGreaterThanOrEqual(0.8);

      const badAnswer = 'I don\'t have information about that.';
      const lowScore = evaluateAnswerRelevance(query, badAnswer);
      expect(lowScore).toBeLessThan(0.4);
    });

    it('should compute composite RAG evaluation with overall score and verdict', async () => {
      const result = await evaluateRagResponse({
        query: 'What is the wifi password?',
        contextSnippets: mockContext,
        generatedResponse: 'The Wi-Fi network is NexusGrand-HighSpeed and the password is NexusPG@2025.',
        retrievalLatencyMs: 15,
      });

      expect(result.overallScore).toBeGreaterThanOrEqual(0.8);
      expect(['EXCELLENT', 'GOOD']).toContain(result.verdict);
      expect(result.retrievalCount).toBe(2);
      expect(result.latencyMs).toBe(15);
    });

    it('should run runRagBenchmark() and achieve passing scores across property questions', async () => {
      const benchmark = await runRagBenchmark();
      expect(benchmark.totalBenchmarks).toBe(5);
      expect(benchmark.averageScore).toBeGreaterThanOrEqual(0.7);
      expect(benchmark.benchmarkVerdict).toBe('PASSED');
      expect(benchmark.averageContextRelevance).toBeGreaterThan(0.6);
      expect(benchmark.averageFaithfulness).toBeGreaterThan(0.8);
    });
  });

  describe('3. End-to-End LangGraph Orchestrator Integration with RAG Evaluation', () => {
    it('should return ragEvaluation object when agent executes knowledge retrieval', async () => {
      if (!testTenantUser) return;

      const response = await executeRentalAssistant({
        userMessage: 'What is the wifi password for my property?',
        userProfile: testTenantUser,
        sessionId: `test-session-rag-eval-${Date.now()}`,
      });

      expect(response.userResponse).toBeDefined();
      expect(response.userResponse.length).toBeGreaterThan(0);

      // Verify that RAG evaluation was performed and attached
      expect(response.ragEvaluation).toBeDefined();
      if (response.ragEvaluation) {
        expect(response.ragEvaluation.overallScore).toBeGreaterThan(0.5);
        expect(response.ragEvaluation.contextRelevance).toBeGreaterThan(0.4);
        expect(response.ragEvaluation.verdict).toBeDefined();
        expect(response.ragEvaluation.retrievalCount).toBeGreaterThan(0);
      }
    });
  });
});
