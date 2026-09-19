import prisma from '@/lib/db';
import { UserProfile } from '@prisma/client';
import { buildRentalAssistantGraph } from './graph';
import { AIExecutionResponse } from './types';
import { createAuditEvent } from '@/lib/audit/service';
import { getGeminiModelName } from './llm';

export interface ExecuteAssistantParams {
  userMessage: string;
  userProfile: UserProfile;
  sessionId?: string;
  modelName?: string;
}

/**
 * Primary AI Orchestrator Entry Point.
 * Coordinates: User -> AI -> Intent Detection -> Context Retrieval -> Plan ->
 * Tool Selection -> Authorization -> Domain Service -> Prisma -> Result -> Response.
 * Never allows direct LLM access to Prisma.
 */
export async function executeRentalAssistant(
  params: ExecuteAssistantParams
): Promise<AIExecutionResponse> {
  const { userMessage, userProfile, modelName } = params;

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

  // 2. Build and execute stateful LangGraph pipeline
  const graph = buildRentalAssistantGraph();

  const initialState = {
    userMessage,
    userProfile,
    sessionId: session.id,
    modelName: effectiveModel,
    intent: 'GENERAL_RENTAL_ASSISTANCE' as any,
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
    toolCalls: [],
    executionSteps: [],
    results: {},
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
      toolsExecuted: finalState.toolCalls.map((t: any) => t.toolName),
      plannedActions: finalState.plannedActions,
      successCount: finalState.toolCalls.filter((t: any) => t.status === 'SUCCESS').length,
    },
  });

  // 4. Return structured output (no chain-of-thought exposed)
  return {
    sessionId: session.id,
    intent: finalState.intent,
    entities: finalState.entities,
    contextRequired: ['tenancy', 'property', 'rentSchedule'],
    plannedActions: finalState.plannedActions,
    toolCalls: finalState.toolCalls,
    results: finalState.results,
    nextState: finalState.nextState,
    userResponse: finalState.userResponse,
    executionSteps: finalState.executionSteps,
    modelUsed: effectiveModel,
  };
}
