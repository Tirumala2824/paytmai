/**
 * HavenDex Agentic RAG Evaluation Engine
 * Implements the RAG Triad standard:
 * 1. Context Relevance (Retrieval Precision)
 * 2. Groundedness / Faithfulness (Hallucination Detection)
 * 3. Answer Relevance (Intent Fulfillment)
 * Plus Latency & Benchmark Scorecards.
 */

import { memoryService } from '@/lib/ai/memory/service';

export interface RagContextSnippet {
  id?: string;
  category?: string;
  key?: string | null;
  summary: string;
  content?: any;
  score?: number;
  source?: string;
}

export interface RagEvaluationInput {
  query: string;
  contextSnippets: RagContextSnippet[];
  generatedResponse: string;
  retrievalLatencyMs?: number;
  modelUsed?: string;
}

export interface RagEvaluationResult {
  evaluatedAt: string;
  contextRelevance: number; // 0.0 - 1.0 (Retrieval precision)
  faithfulness: number; // 0.0 - 1.0 (Groundedness / Hallucination detection)
  answerRelevance: number; // 0.0 - 1.0 (Direct response alignment)
  overallScore: number; // 0.0 - 1.0 (Composite RAG Triad index)
  verdict: 'EXCELLENT' | 'GOOD' | 'NEEDS_REVIEW' | 'FAILED';
  retrievalCount: number;
  latencyMs: number;
  breakdown: {
    matchedQueryTerms: string[];
    unmatchedQueryTerms: string[];
    groundedClaimsCount: number;
    totalClaimsCount: number;
    hallucinationRisk: 'NONE' | 'LOW' | 'HIGH';
    notes: string[];
  };
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'is', 'are', 'was',
  'were', 'what', 'how', 'when', 'where', 'who', 'which', 'can', 'you', 'tell', 'me',
  'please', 'my', 'your', 'i', 'we', 'about', 'there', 'any', 'do', 'does', 'have'
]);

function extractKeyTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Evaluates the relevance of retrieved context passages relative to the user query
 */
export function evaluateContextRelevance(
  query: string,
  contextSnippets: RagContextSnippet[]
): { score: number; matchedTerms: string[]; unmatchedTerms: string[] } {
  if (!contextSnippets || contextSnippets.length === 0) {
    return { score: 0.0, matchedTerms: [], unmatchedTerms: extractKeyTerms(query) };
  }

  const queryTerms = extractKeyTerms(query);
  if (queryTerms.length === 0) {
    return { score: 1.0, matchedTerms: [], unmatchedTerms: [] };
  }

  const combinedContextText = contextSnippets
    .map((s) => `${s.category || ''} ${s.key || ''} ${s.summary} ${JSON.stringify(s.content || '')}`)
    .join(' ')
    .toLowerCase();

  const matchedTerms: string[] = [];
  const unmatchedTerms: string[] = [];

  for (const term of queryTerms) {
    if (combinedContextText.includes(term)) {
      matchedTerms.push(term);
    } else {
      unmatchedTerms.push(term);
    }
  }

  const coverageRatio = matchedTerms.length / queryTerms.length;

  // Average top snippet relevance scores
  const topScores = contextSnippets.slice(0, 3).map((s) => s.score ?? 0.8);
  const avgSnippetScore = Math.min(
    1.0,
    topScores.reduce((acc, val) => acc + val, 0) / topScores.length
  );

  // Weighted combination of term coverage (70%) and retrieval scoring (30%)
  const score = Math.min(1.0, Math.max(0.0, coverageRatio * 0.7 + avgSnippetScore * 0.3));

  return {
    score: Number(score.toFixed(3)),
    matchedTerms,
    unmatchedTerms,
  };
}

/**
 * Evaluates faithfulness (groundedness): are the claims in the generated response
 * strictly substantiated by the retrieved context without hallucination?
 */
export function evaluateFaithfulness(
  generatedResponse: string,
  contextSnippets: RagContextSnippet[]
): {
  score: number;
  groundedClaimsCount: number;
  totalClaimsCount: number;
  hallucinationRisk: 'NONE' | 'LOW' | 'HIGH';
  notes: string[];
} {
  if (!generatedResponse || generatedResponse.trim().length === 0) {
    return {
      score: 1.0,
      groundedClaimsCount: 0,
      totalClaimsCount: 0,
      hallucinationRisk: 'NONE',
      notes: ['Empty response provided'],
    };
  }

  if (!contextSnippets || contextSnippets.length === 0) {
    return {
      score: 0.3,
      groundedClaimsCount: 0,
      totalClaimsCount: 1,
      hallucinationRisk: 'HIGH',
      notes: ['Response generated without any supporting context snippets'],
    };
  }

  const contextCorpus = contextSnippets
    .map((s) => `${s.summary} ${JSON.stringify(s.content || '')}`)
    .join(' ')
    .toLowerCase();

  // Extract critical factual tokens from response (numbers, times, passphrases, proper nouns)
  const factualPatterns = [
    /\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b/g, // Timings (e.g. 7:30 AM, 11:00 PM)
    /\b[A-Za-z0-9]+@[0-9]{4}\b/g, // Passwords (e.g. NexusPG@2025)
    /\b[A-Za-z0-9]+![0-9]{4}\b/g,
    /\b\d+\s*Mbps\b/gi, // Speeds (e.g. 200 Mbps)
    /\b(?:Breakfast|Lunch|Dinner|Curfew|Biometric|Deposit|Rent)\b/gi,
  ];

  const extractedEntities: string[] = [];
  for (const pat of factualPatterns) {
    const matches = generatedResponse.match(pat);
    if (matches) {
      for (const m of matches) {
        if (!extractedEntities.includes(m.toLowerCase())) {
          extractedEntities.push(m.toLowerCase());
        }
      }
    }
  }

  const notes: string[] = [];
  let groundedCount = 0;
  const totalClaims = Math.max(1, extractedEntities.length);

  for (const entity of extractedEntities) {
    if (contextCorpus.includes(entity)) {
      groundedCount++;
    } else {
      notes.push(`Ungrounded claim detected: "${entity}" not found in context`);
    }
  }

  let faithfulnessRatio = groundedCount / totalClaims;
  // If no specific technical patterns were extracted, check general keyword overlap
  if (extractedEntities.length === 0) {
    const responseKeywords = extractKeyTerms(generatedResponse);
    let groundedKeywords = 0;
    for (const kw of responseKeywords) {
      if (contextCorpus.includes(kw)) groundedKeywords++;
    }
    faithfulnessRatio = responseKeywords.length > 0 ? groundedKeywords / responseKeywords.length : 1.0;
  }

  let hallucinationRisk: 'NONE' | 'LOW' | 'HIGH' = 'NONE';
  if (faithfulnessRatio < 0.6) {
    hallucinationRisk = 'HIGH';
  } else if (faithfulnessRatio < 0.85) {
    hallucinationRisk = 'LOW';
  }

  return {
    score: Number(faithfulnessRatio.toFixed(3)),
    groundedClaimsCount: groundedCount,
    totalClaimsCount: totalClaims,
    hallucinationRisk,
    notes,
  };
}

/**
 * Evaluates whether the generated answer directly addresses the query
 */
export function evaluateAnswerRelevance(query: string, generatedResponse: string): number {
  if (!generatedResponse || generatedResponse.trim().length === 0) return 0.0;

  const queryTerms = extractKeyTerms(query);
  if (queryTerms.length === 0) return 1.0;

  const responseLower = generatedResponse.toLowerCase();
  let matched = 0;

  for (const term of queryTerms) {
    if (responseLower.includes(term)) matched++;
  }

  const termMatchRatio = matched / queryTerms.length;

  // Check for presence of decisive answers
  const hasSubstantiveContent =
    generatedResponse.length > 30 &&
    !generatedResponse.toLowerCase().includes("i don't have information");

  const score = hasSubstantiveContent
    ? Math.min(1.0, termMatchRatio * 0.7 + 0.3)
    : Math.max(0.1, termMatchRatio * 0.5);

  return Number(score.toFixed(3));
}

/**
 * Full RAG Evaluation Function
 */
export async function evaluateRagResponse(input: RagEvaluationInput): Promise<RagEvaluationResult> {
  const { query, contextSnippets, generatedResponse, retrievalLatencyMs = 0 } = input;

  const contextRel = evaluateContextRelevance(query, contextSnippets);
  const faith = evaluateFaithfulness(generatedResponse, contextSnippets);
  const ansRel = evaluateAnswerRelevance(query, generatedResponse);

  // Composite RAG Triad Index: 35% Context Relevance, 40% Faithfulness, 25% Answer Relevance
  const overallScore = Number(
    (0.35 * contextRel.score + 0.4 * faith.score + 0.25 * ansRel).toFixed(3)
  );

  let verdict: 'EXCELLENT' | 'GOOD' | 'NEEDS_REVIEW' | 'FAILED' = 'FAILED';
  if (overallScore >= 0.85) {
    verdict = 'EXCELLENT';
  } else if (overallScore >= 0.7) {
    verdict = 'GOOD';
  } else if (overallScore >= 0.5) {
    verdict = 'NEEDS_REVIEW';
  }

  return {
    evaluatedAt: new Date().toISOString(),
    contextRelevance: contextRel.score,
    faithfulness: faith.score,
    answerRelevance: ansRel,
    overallScore,
    verdict,
    retrievalCount: contextSnippets.length,
    latencyMs: retrievalLatencyMs,
    breakdown: {
      matchedQueryTerms: contextRel.matchedTerms,
      unmatchedQueryTerms: contextRel.unmatchedTerms,
      groundedClaimsCount: faith.groundedClaimsCount,
      totalClaimsCount: faith.totalClaimsCount,
      hallucinationRisk: faith.hallucinationRisk,
      notes: faith.notes,
    },
  };
}

/**
 * Standard RAG Evaluation Benchmark Suite
 * Runs 5 standard property questions against the knowledge graph and computes aggregate metrics.
 */
export async function runRagBenchmark(): Promise<{
  timestamp: string;
  totalBenchmarks: number;
  averageScore: number;
  averageContextRelevance: number;
  averageFaithfulness: number;
  averageAnswerRelevance: number;
  benchmarkVerdict: 'PASSED' | 'FAILED';
  results: Array<{
    query: string;
    score: number;
    verdict: string;
    evaluation: RagEvaluationResult;
  }>;
}> {
  const benchmarkQueries = [
    {
      query: 'What is the wifi password for Nexus Grand?',
      expectedCategory: 'WIFI',
      mockResponse: 'The Wi-Fi for Nexus Grand has SSID NexusGrand_HighSpeed_5G and password NexusLiving@2026 with 300 Mbps fiber.',
    },
    {
      query: 'What are the mess and meal timings for CyberCity?',
      expectedCategory: 'MESS',
      mockResponse: 'CyberCity mess dining: Breakfast 7:30 AM - 9:30 AM, Lunch 12:30 PM - 2:30 PM, Dinner 8:00 PM - 10:30 PM with special Biryani on Wed & Sun.',
    },
    {
      query: 'What are the property gate curfew rules for Deccan Comfort?',
      expectedCategory: 'RULES',
      mockResponse: 'Biometric gate open 24/7 for night-shift IT employees working in Hinjawadi. ID card display required for night entry.',
    },
    {
      query: 'What are the AC specifications for Nexus Grand?',
      expectedCategory: 'APPLIANCE',
      mockResponse: 'All AC rooms are equipped with Daikin 1.5 Ton 5-Star Inverter Split ACs with PM 2.5 air filtration and quarterly servicing.',
    },
    {
      query: 'What are the shuttle facility timings for Royal Palms?',
      expectedCategory: 'FACILITY',
      mockResponse: 'Complimentary shuttle service to ITPL at 8:30 AM, 9:15 AM, 9:45 AM. Return shuttles from 6:00 PM to 8:30 PM.',
    },
  ];

  const results: Array<{
    query: string;
    score: number;
    verdict: string;
    evaluation: RagEvaluationResult;
  }> = [];

  for (const item of benchmarkQueries) {
    const tStart = Date.now();
    const snippets = await memoryService.searchKnowledgeGraph({
      query: item.query,
      category: item.expectedCategory,
      limit: 5,
    });
    const latency = Date.now() - tStart;

    // Evaluate answer synthesized from top retrieved context
    const topSnippet = snippets[0];
    const generatedResponse = topSnippet
      ? `Property records indicate: ${topSnippet.summary}`
      : item.mockResponse;

    const evaluation = await evaluateRagResponse({
      query: item.query,
      contextSnippets: snippets,
      generatedResponse,
      retrievalLatencyMs: latency,
    });

    results.push({
      query: item.query,
      score: evaluation.overallScore,
      verdict: evaluation.verdict,
      evaluation,
    });
  }

  const avgScore = Number(
    (results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(3)
  );
  const avgContext = Number(
    (results.reduce((acc, r) => acc + r.evaluation.contextRelevance, 0) / results.length).toFixed(3)
  );
  const avgFaith = Number(
    (results.reduce((acc, r) => acc + r.evaluation.faithfulness, 0) / results.length).toFixed(3)
  );
  const avgAns = Number(
    (results.reduce((acc, r) => acc + r.evaluation.answerRelevance, 0) / results.length).toFixed(3)
  );

  return {
    timestamp: new Date().toISOString(),
    totalBenchmarks: results.length,
    averageScore: avgScore,
    averageContextRelevance: avgContext,
    averageFaithfulness: avgFaith,
    averageAnswerRelevance: avgAns,
    benchmarkVerdict: avgScore >= 0.7 ? 'PASSED' : 'FAILED',
    results,
  };
}
