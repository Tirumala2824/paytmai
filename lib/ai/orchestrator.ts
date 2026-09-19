import prisma from '@/lib/db';
import { UserProfile } from '@prisma/client';
import { buildRentalAssistantGraph } from './graph';
import { AIExecutionResponse } from './types';
import { createAuditEvent } from '@/lib/audit/service';
import { getGeminiModelName } from './llm';
import { sarvamTextToSpeech } from '@/lib/voice/sarvam';

export interface ExecuteAssistantParams {
  userMessage: string;
  userProfile: UserProfile;
  sessionId?: string;
  modelName?: string;
  languageCode?: string;
  generateAudio?: boolean;
  confirmedAction?: boolean;
}

/**
 * Primary AI Orchestrator Entry Point for Phase 3.
 * Coordinates: User -> Understand -> Load Context -> Detect Intents -> Plan ->
 * Authorize -> Execute (Parallel) -> Verify -> Update State -> Memory Event -> Respond.
 * Never allows direct LLM access to Prisma.
 */
export async function executeRentalAssistant(
  params: ExecuteAssistantParams
): Promise<AIExecutionResponse> {
  const {
    userMessage,
    userProfile,
    modelName,
    languageCode = 'en-IN',
    generateAudio = false,
    confirmedAction = false,
  } = params;

  // 1. Resolve or create AgentSession in Prisma
  let session = params.sessionId
    ? await prisma.agentSession.findUnique({ where: { id: params.sessionId } })
    : null;

  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        userProfileId: userProfile.id,
        sessionTitle: userMessage.slice(0, 40),
        status: 'ACTIVE',
      },
    });
  }

  const effectiveModel = getGeminiModelName(modelName);

  // 2. Build and execute stateful 10-node LangGraph pipeline
  const graph = buildRentalAssistantGraph();

  const initialState = {
    userMessage,
    userProfile,
    sessionId: session.id,
    modelName: effectiveModel,
    languageCode,
    detectedLanguage: languageCode,
    intent: 'GENERAL_RENTAL_ASSISTANCE' as any,
    detectedIntents: [],
    entities: {},
    context: {
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
      },
    },
    plannedActions: [],
    authorizedActions: [],
    rejectedActions: [],
    toolCalls: [],
    executionSteps: [],
    results: {},
    verificationResults: {},
    intentBreakdown: [],
    pendingConfirmation: undefined,
    confirmedAction,
    nextState: undefined,
    userResponse: '',
  };

  const finalState = await graph.invoke(initialState);

  // 3. Record overall AuditEvent for this assistant interaction
  await createAuditEvent({
    actorId: userProfile.id,
    actorRole: userProfile.role,
    action: 'AI_ASSISTANT_INVOCATION',
    resourceType: 'AGENT_SESSION',
    resourceId: session.id,
    metadata: {
      intent: finalState.intent,
      detectedIntents: finalState.detectedIntents.map((i: any) => i.intent),
      toolsExecuted: finalState.toolCalls.map((t: any) => t.toolName),
      plannedActions: finalState.plannedActions,
      successCount: finalState.toolCalls.filter((t: any) => t.status === 'SUCCESS').length,
      language: finalState.detectedLanguage || languageCode,
    },
  });

  // 4. Optionally generate audio using Sarvam TTS
  let audioBase64: string | undefined = undefined;
  if (generateAudio && finalState.userResponse) {
    try {
      const ttsRes = await sarvamTextToSpeech({
        text: finalState.userResponse,
        targetLanguageCode: finalState.detectedLanguage || languageCode,
      });
      if (ttsRes && ttsRes.audioBase64) {
        audioBase64 = ttsRes.audioBase64;
      }
    } catch (ttsErr) {
      console.warn('Could not generate Sarvam TTS audio:', ttsErr);
    }
  }

  // 5. Return structured output (no chain-of-thought exposed)
  return {
    sessionId: session.id,
    intent: finalState.intent,
    detectedIntents: finalState.detectedIntents,
    intentBreakdown: finalState.intentBreakdown,
    entities: finalState.entities,
    contextRequired: ['tenancy', 'property', 'rentSchedule'],
    plannedActions: finalState.plannedActions,
    toolCalls: finalState.toolCalls,
    results: finalState.results,
    nextState: finalState.nextState,
    userResponse: finalState.userResponse,
    executionSteps: finalState.executionSteps,
    modelUsed: effectiveModel,
    languageCode: finalState.detectedLanguage || languageCode,
    audioBase64,
    pendingConfirmation: finalState.pendingConfirmation,
    previousRelatedIssue: finalState.context?.previousRelatedIssue,
    isRepeatedIssue: finalState.context?.isRepeatedIssue,
  };
}
