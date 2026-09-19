import prisma from '@/lib/db';
import { UserProfile } from '@prisma/client';
import { buildRentalAssistantGraph } from './graph';
import { AIExecutionResponse, ChatTurn } from './types';
import { createAuditEvent } from '@/lib/audit/service';
import { getGeminiModelName } from './llm';
import { sarvamTextToSpeech } from '@/lib/voice/sarvam';
import { kcache } from './cache/kcache';

export interface ExecuteAssistantParams {
  userMessage: string;
  userProfile: UserProfile;
  sessionId?: string;
  modelName?: string;
  languageCode?: string;
  generateAudio?: boolean;
  confirmedAction?: boolean;
  history?: ChatTurn[];
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

  // 2. Load conversation history from KCache or caller parameters
  let conversationHistory: ChatTurn[] = params.history || [];
  if (conversationHistory.length === 0 && session.id) {
    conversationHistory = kcache.getHistory(session.id, 10);
  }

  const effectiveModel = getGeminiModelName(modelName);

  // 3. Build and execute stateful 10-node LangGraph pipeline
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
      conversationHistory,
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
    conversationHistory,
    suggestedFollowUps: [],
  };

  const finalState = await graph.invoke(initialState);

  // 4. Update KCache with this conversation turn and active entities
  kcache.appendTurn(session.id, {
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  if (finalState.userResponse) {
    kcache.appendTurn(session.id, {
      role: 'assistant',
      content: finalState.userResponse,
      intent: finalState.intent,
      suggestedFollowUps: finalState.suggestedFollowUps,
      timestamp: new Date().toISOString(),
    });
  }

  // Infer and persist active session topic and entities in KCache
  const lowerMsg = userMessage.toLowerCase();
  let activeTopic: string | undefined = undefined;
  let activeAppliance: string | undefined = undefined;
  if (lowerMsg.includes('wifi') || lowerMsg.includes('wi-fi') || lowerMsg.includes('password') || lowerMsg.includes('internet')) {
    activeTopic = 'WIFI';
  } else if (lowerMsg.includes('mess') || lowerMsg.includes('food') || lowerMsg.includes('dinner') || lowerMsg.includes('lunch')) {
    activeTopic = 'MESS_TIMINGS';
  } else if (lowerMsg.includes('ac') || lowerMsg.includes('cooling')) {
    activeTopic = 'AC_MAINTENANCE';
    activeAppliance = 'AC';
  } else if (lowerMsg.includes('geyser') || lowerMsg.includes('water') || lowerMsg.includes('heater')) {
    activeTopic = 'GEYSER_MAINTENANCE';
    activeAppliance = 'Geyser';
  } else if (lowerMsg.includes('rent') || lowerMsg.includes('pay')) {
    activeTopic = 'RENT_PAYMENT';
  }

  const createdIssueId = finalState.results?.createMaintenanceIssue?.output?.issueId;
  kcache.updateActiveContext(session.id, {
    activePropertyId: finalState.context?.tenancy?.propertyId,
    activePropertyName: finalState.context?.tenancy?.propertyName,
    activeRoomNumber: finalState.context?.tenancy?.roomNumber,
    activeIssueId: createdIssueId || kcache.getActiveContext(session.id)?.activeIssueId,
    activeTopic: activeTopic || kcache.getActiveContext(session.id)?.activeTopic,
    activeAppliance: activeAppliance || kcache.getActiveContext(session.id)?.activeAppliance,
    lastIntent: finalState.intent,
  });

  // 5. Record overall AuditEvent for this assistant interaction
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

  // 6. Optionally generate audio using Sarvam TTS
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

  // 7. Return structured output with suggested follow-ups and history
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
    ragEvaluation: finalState.ragEvaluation,
    suggestedFollowUps: finalState.suggestedFollowUps || [],
    conversationHistory: kcache.getHistory(session.id, 10),
  };
}
