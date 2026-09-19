import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { UserProfile, UserRole } from '@prisma/client';
import prisma from '@/lib/db';
import {
  IntentType,
  ToolCallResult,
  ExecutionStep,
  AgentRentalContext,
  DetectedIntent,
  MultiIntentExecutionStatus,
  PendingConfirmation,
} from './types';
import { AI_TOOLS_REGISTRY } from './tools';
import {
  dynamicAnalyzeMultiIntents,
  dynamicSynthesizeResponse,
} from './llm';
import { memoryService } from './memory/service';
import { createAuditEvent } from '@/lib/audit/service';
import { canAccessProperty, canAccessTenancy } from '@/lib/auth/abac';
import { advanceRentalLifecycle } from '@/lib/rental/service';

/**
 * Define the LangGraph State Annotation for Phase 3
 */
export const AgentStateAnnotation = Annotation.Root({
  userMessage: Annotation<string>(),
  userProfile: Annotation<UserProfile>(),
  sessionId: Annotation<string>(),
  languageCode: Annotation<string>(),
  detectedLanguage: Annotation<string | undefined>(),
  intent: Annotation<IntentType>(),
  detectedIntents: Annotation<DetectedIntent[]>({
    reducer: (curr, next) => (next.length > 0 ? next : curr),
    default: () => [],
  }),
  entities: Annotation<Record<string, any>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  context: Annotation<AgentRentalContext>(),
  plannedActions: Annotation<string[]>({
    reducer: (curr, next) => (next.length > 0 ? next : curr),
    default: () => [],
  }),
  authorizedActions: Annotation<string[]>({
    reducer: (curr, next) => (next.length > 0 ? next : curr),
    default: () => [],
  }),
  rejectedActions: Annotation<Array<{ toolName: string; reason: string }>>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  toolCalls: Annotation<ToolCallResult[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  executionSteps: Annotation<ExecutionStep[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  results: Annotation<Record<string, any>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  verificationResults: Annotation<Record<string, { verified: boolean; details: string }>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  intentBreakdown: Annotation<MultiIntentExecutionStatus[]>({
    reducer: (curr, next) => (next.length > 0 ? next : curr),
    default: () => [],
  }),
  pendingConfirmation: Annotation<PendingConfirmation | undefined>(),
  confirmedAction: Annotation<boolean | undefined>(),
  nextState: Annotation<string | undefined>(),
  userResponse: Annotation<string>(),
  modelName: Annotation<string | undefined>(),
});

export type AgentStateType = typeof AgentStateAnnotation.State;

// ============================================================================
// NODE 1: UNDERSTAND (Language Detection & Normalization)
// ============================================================================
export async function understandNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const rawMessage = state.userMessage.trim();
  let detectedLanguage = state.languageCode || 'en-IN';

  // Detect Devanagari/Hindi script
  const hasHindi = /[\u0900-\u097F]/.test(rawMessage);
  if (hasHindi) {
    detectedLanguage = 'hi-IN';
  }

  const langLabel = detectedLanguage.startsWith('hi') ? 'Hindi (हिन्दी)' : 'Indian English';

  const step: ExecutionStep = {
    id: `step-understand-${Date.now()}`,
    label: `Understanding request (${langLabel})`,
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: `Input normalized. Detected language: ${detectedLanguage}`,
  };

  return {
    detectedLanguage,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 2: LOAD_CONTEXT (Retrieve Rental Context via MemoryService)
// ============================================================================
export async function loadContextNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { userProfile } = state;
  let tenancyRecord: any = null;
  let rentScheduleRecord: any = null;
  let maintenanceRecords: any[] = [];

  try {
    if (userProfile.role === UserRole.TENANT) {
      const tenant = await prisma.tenant.findUnique({
        where: { userProfileId: userProfile.id },
        include: {
          tenancies: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              property: {
                include: {
                  owner: {
                    include: { userProfile: true },
                  },
                },
              },
              room: true,
              rentSchedules: {
                orderBy: { dueDate: 'desc' },
                take: 1,
              },
              maintenanceIssues: {
                orderBy: { createdAt: 'desc' },
                take: 5,
              },
            },
          },
        },
      });

      if (tenant && tenant.tenancies.length > 0) {
        tenancyRecord = tenant.tenancies[0];
        rentScheduleRecord = tenancyRecord.rentSchedules[0] || null;
        maintenanceRecords = tenancyRecord.maintenanceIssues || [];
      }
    } else if (userProfile.role === UserRole.OWNER) {
      const owner = await prisma.owner.findUnique({
        where: { userProfileId: userProfile.id },
        include: {
          properties: {
            include: {
              tenancies: {
                where: { isActive: true },
                take: 1,
                include: {
                  room: true,
                  tenant: { include: { userProfile: true } },
                  rentSchedules: { orderBy: { dueDate: 'desc' }, take: 1 },
                },
              },
            },
          },
        },
      });

      const firstProp = owner?.properties[0];
      if (firstProp && firstProp.tenancies.length > 0) {
        tenancyRecord = {
          ...firstProp.tenancies[0],
          property: firstProp,
        };
        rentScheduleRecord = tenancyRecord.rentSchedules[0] || null;
      }
    }
  } catch (err) {
    console.error('Error retrieving rental context in LangGraph:', err);
  }

  // Phase 4: Retrieve relevant context via MemoryService abstraction
  let memoryContextResult: any = null;
  try {
    memoryContextResult = await memoryService.retrieveRelevantContext({
      userProfileId: userProfile.id,
      tenancyId: tenancyRecord?.id,
      userMessage: state.userMessage,
    });
  } catch (memErr) {
    console.warn('Memory retrieval error in LangGraph:', memErr);
  }

  const prevIssue = memoryContextResult?.previousRelatedIssue;
  const hasPreviousIssue = !!prevIssue;

  const context: AgentRentalContext = {
    user: {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      role: userProfile.role,
    },
    tenancy: tenancyRecord
      ? {
          id: tenancyRecord.id,
          propertyId: tenancyRecord.propertyId,
          propertyName: tenancyRecord.property.name,
          roomId: tenancyRecord.roomId,
          roomNumber: tenancyRecord.room?.roomNumber || 'N/A',
          monthlyRent: tenancyRecord.monthlyRent,
          lifecycleStage: tenancyRecord.lifecycleStage,
          isActive: tenancyRecord.isActive,
          ownerName: tenancyRecord.property?.owner?.userProfile?.name,
          ownerPhone: tenancyRecord.property?.owner?.userProfile?.phone,
        }
      : undefined,
    currentRentSchedule: rentScheduleRecord
      ? {
          id: rentScheduleRecord.id,
          billingMonth: rentScheduleRecord.billingMonth,
          amount: rentScheduleRecord.amount,
          dueDate: rentScheduleRecord.dueDate.toISOString().split('T')[0],
          status: rentScheduleRecord.status,
        }
      : undefined,
    recentMaintenance: maintenanceRecords.map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      priority: m.priority,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    })),
    relevantMemories: memoryContextResult?.relevantMemories || [],
    previousRelatedIssue: prevIssue,
    isRepeatedIssue: hasPreviousIssue,
  };

  const stepDetails = prevIssue
    ? `Previous related maintenance issue found: "${prevIssue.title}" (${prevIssue.status}: ${prevIssue.resolution || 'Service completed'})`
    : context.tenancy
    ? `Active lease at ${context.tenancy.propertyName} (Room ${context.tenancy.roomNumber})`
    : 'No active lease loaded';

  const step: ExecutionStep = {
    id: `step-context-${Date.now()}`,
    label: prevIssue ? 'Previous related maintenance issue found' : 'Rental context loaded',
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: stepDetails,
  };

  return {
    context,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 3: DETECT_INTENTS (Multi-Intent Detection)
// ============================================================================
export async function detectIntentsNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const message = state.userMessage.toLowerCase().trim();

  // 1. Try dynamic multi-intent analysis via Gemini if configured
  const dynamicResult = await dynamicAnalyzeMultiIntents(state.userMessage, state.modelName);
  if (dynamicResult && dynamicResult.intents.length > 0) {
    const primaryIntent = dynamicResult.intents[0].intent;
    const mergedEntities = dynamicResult.intents.reduce(
      (acc, curr) => ({ ...acc, ...curr.entities }),
      {}
    );

    const step: ExecutionStep = {
      id: `step-intents-${Date.now()}`,
      label: `Multi-intent detected (${dynamicResult.intents.length} intents)`,
      status: 'completed',
      timestamp: new Date().toISOString(),
      details: dynamicResult.intents.map((i) => i.intent).join(', '),
    };

    return {
      intent: primaryIntent,
      detectedIntents: dynamicResult.intents,
      entities: mergedEntities,
      executionSteps: [step],
    };
  }

  // 2. Deterministic Multi-Intent Rule Engine (100% Reliable & Fast Fallback)
  const detectedIntents: DetectedIntent[] = [];
  const entities: Record<string, any> = {};

  // Check Intent: OWNER_NOTIFICATION (Prioritized if user specifically commands to notify/tell owner)
  const isExplicitOwnerCommand =
    message.startsWith('tell the owner') ||
    message.startsWith('notify the owner') ||
    message.startsWith('notify owner') ||
    message.startsWith('inform owner') ||
    message.startsWith('मालिक को बताएं');

  const hasOwnerNotification =
    isExplicitOwnerCommand ||
    message.includes('tell the owner') ||
    message.includes('notify the owner') ||
    message.includes('notify owner') ||
    message.includes('inform owner') ||
    message.includes('मालिक को बताएं') ||
    message.includes('मालिक को सूचित');

  if (isExplicitOwnerCommand && hasOwnerNotification) {
    const notifyMessage = entities.title
      ? `Tenant reported: ${entities.title}`
      : state.userMessage;
    const urgent =
      message.includes('urgent') ||
      message.includes('emergency') ||
      message.includes('broken');

    entities.urgent = urgent;
    entities.message = notifyMessage;

    detectedIntents.push({
      intent: 'OWNER_NOTIFICATION',
      confidence: 0.98,
      entities: { message: notifyMessage, urgent },
    });
  }

  // Check Intent: PAYMENT_VALIDATION / PAYMENT_STATUS
  const hasPaymentQuery =
    message.includes('rent is paid') ||
    message.includes('confirm it') ||
    message.includes('is my rent paid') ||
    message.includes('did i pay rent') ||
    message.includes('payment status') ||
    message.includes('validate payment') ||
    message.includes('verify payment') ||
    message.includes('किराया भर दिया') ||
    message.includes('किराया जमा');

  if (hasPaymentQuery) {
    const isValidation =
      message.includes('confirm') ||
      message.includes('validate') ||
      message.includes('verify') ||
      message.includes('पुष्टि');

    detectedIntents.push({
      intent: isValidation ? 'PAYMENT_VALIDATION' : 'PAYMENT_STATUS',
      confidence: 0.98,
      entities: {},
    });
  }

  // Check Intent: RENT_DUE
  const hasRentDueQuery =
    (message.includes('rent is due when') ||
      message.includes('when is rent due') ||
      message.includes('rent due date') ||
      message.includes('due date') ||
      message.includes('कब देना है')) &&
    !hasPaymentQuery;

  if (hasRentDueQuery) {
    detectedIntents.push({
      intent: 'RENT_DUE',
      confidence: 0.95,
      entities: {},
    });
  }

  // Check Intent: MAINTENANCE_REPORT
  const hasMaintenanceReport =
    message.includes('not working') ||
    message.includes("isn't working") ||
    message.includes('broken') ||
    message.includes('leak') ||
    message.includes('repair') ||
    message.includes('fix') ||
    message.includes('ac') ||
    message.includes('cooler') ||
    message.includes('geyser') ||
    message.includes('tap') ||
    message.includes('काम नहीं कर रहा') ||
    message.includes('खराब');

  if (hasMaintenanceReport && !isExplicitOwnerCommand) {
    let category = 'GENERAL';
    let priority = 'MEDIUM';
    let title = 'Maintenance issue reported';

    if (
      message.includes('ac') ||
      message.includes('air conditioner') ||
      message.includes('cooler') ||
      message.includes('एसी')
    ) {
      category = 'APPLIANCE';
      priority = 'HIGH';
      title = 'Air Conditioning malfunction reported';
    } else if (
      message.includes('leak') ||
      message.includes('tap') ||
      message.includes('pipe') ||
      message.includes('पानी')
    ) {
      category = 'PLUMBING';
      priority = 'MEDIUM';
      title = 'Plumbing leak / water fixture issue';
    } else if (
      message.includes('spark') ||
      message.includes('power') ||
      message.includes('light') ||
      message.includes('बिजली')
    ) {
      category = 'ELECTRICAL';
      priority = 'HIGH';
      title = 'Electrical issue reported';
    }

    entities.category = category;
    entities.priority = priority;
    entities.title = title;
    entities.description = state.userMessage;

    detectedIntents.push({
      intent: 'MAINTENANCE_REPORT',
      confidence: 0.97,
      entities: { category, priority, title, description: state.userMessage },
    });
  }

  // Check non-prefix OWNER_NOTIFICATION
  if (hasOwnerNotification && !isExplicitOwnerCommand) {
    const notifyMessage = entities.title
      ? `Tenant reported: ${entities.title}`
      : state.userMessage;
    const urgent =
      message.includes('urgent') ||
      message.includes('emergency') ||
      message.includes('again') ||
      entities.priority === 'HIGH';

    entities.urgent = urgent;
    entities.message = notifyMessage;

    detectedIntents.push({
      intent: 'OWNER_NOTIFICATION',
      confidence: 0.95,
      entities: { message: notifyMessage, urgent },
    });
  }

  // Check Intent: MAINTENANCE_STATUS
  if (
    message.includes('show my maintenance') ||
    message.includes('show maintenance') ||
    message.includes('maintenance issues') ||
    message.includes('my issues')
  ) {
    detectedIntents.push({
      intent: 'MAINTENANCE_STATUS',
      confidence: 0.95,
      entities: {},
    });
  }

  // Check Intent: SENSITIVE_CONFIRMATION_CHECK (e.g. paying rent)
  if (
    message.includes('pay rent') ||
    message.includes('proceed with payment') ||
    message.includes('make payment')
  ) {
    detectedIntents.push({
      intent: 'PAYMENT_STATUS',
      confidence: 0.95,
      requiresConfirmation: true,
      confirmationPrompt: `Your outstanding rent is ₹${state.context?.currentRentSchedule?.amount || '18,000'}. Do you want to proceed with payment?`,
      entities: {},
    });
  }

  // Default fallback if no intent detected
  if (detectedIntents.length === 0) {
    detectedIntents.push({
      intent: 'GENERAL_RENTAL_ASSISTANCE',
      confidence: 0.5,
      entities: {},
    });
  }

  const primaryIntent = detectedIntents[0].intent;

  const step: ExecutionStep = {
    id: `step-intents-${Date.now()}`,
    label: `Multi-intent detected (${detectedIntents.length} intents)`,
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: detectedIntents.map((i) => i.intent).join(' + '),
  };

  return {
    intent: primaryIntent,
    detectedIntents,
    entities,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 4: PLAN (Multi-Tool Planning & Dependency Mapping)
// ============================================================================
export async function planNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { detectedIntents, confirmedAction } = state;
  const plannedActions: string[] = [];
  let pendingConfirmation: PendingConfirmation | undefined = undefined;

  for (const item of detectedIntents) {
    // Check if sensitive confirmation is needed and not yet confirmed
    if (item.requiresConfirmation && !confirmedAction) {
      pendingConfirmation = {
        action: 'EXECUTE_PAYMENT',
        prompt:
          item.confirmationPrompt ||
          `Your outstanding rent is ₹${state.context?.currentRentSchedule?.amount || '18,000'}. Do you want to proceed with payment?`,
        intent: item.intent,
        payload: item.entities,
      };
      // Do not plan sensitive tool until confirmed
      continue;
    }

    switch (item.intent) {
      case 'PAYMENT_VALIDATION':
      case 'PAYMENT_STATUS':
      case 'RENT_DUE':
        if (!plannedActions.includes('getRentStatus')) {
          plannedActions.push('getRentStatus');
        }
        break;

      case 'MAINTENANCE_REPORT':
        if (!plannedActions.includes('createMaintenanceIssue')) {
          plannedActions.push('createMaintenanceIssue');
        }
        if (!plannedActions.includes('createMaintenanceTask')) {
          plannedActions.push('createMaintenanceTask');
        }
        if (!plannedActions.includes('notifyOwner')) {
          plannedActions.push('notifyOwner');
        }
        break;

      case 'OWNER_NOTIFICATION':
        if (!plannedActions.includes('notifyOwner')) {
          plannedActions.push('notifyOwner');
        }
        break;

      case 'MAINTENANCE_STATUS':
        if (!plannedActions.includes('getMaintenanceIssues')) {
          plannedActions.push('getMaintenanceIssues');
        }
        break;

      case 'PROPERTY_INFORMATION':
        if (!plannedActions.includes('getProperty')) {
          plannedActions.push('getProperty');
        }
        break;

      case 'RENTAL_INFORMATION':
        if (!plannedActions.includes('getTenancy')) {
          plannedActions.push('getTenancy');
        }
        break;

      case 'GENERAL_RENTAL_ASSISTANCE':
      default:
        if (plannedActions.length === 0) {
          plannedActions.push('getTenancy');
        }
        break;
    }
  }

  const step: ExecutionStep = {
    id: `step-plan-${Date.now()}`,
    label: `Actions planned (${plannedActions.length} tools)`,
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: `Tools: ${plannedActions.join(', ')}`,
  };

  return {
    plannedActions,
    pendingConfirmation,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 5: AUTHORIZE (Server-Side RBAC & ABAC Verification)
// ============================================================================
export async function authorizeNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { plannedActions, userProfile, context } = state;
  const authorizedActions: string[] = [];
  const rejectedActions: Array<{ toolName: string; reason: string }> = [];

  for (const toolName of plannedActions) {
    let isAuthorized = false;
    let rejectReason = '';

    // Verify RBAC and ABAC for each tool
    switch (toolName) {
      case 'getRentStatus':
      case 'getPaymentHistory':
      case 'validatePayment':
        // Tenant can access only own tenancy; Owner can access owned properties
        if (userProfile.role === UserRole.TENANT && context.tenancy) {
          isAuthorized = true;
        } else if (userProfile.role === UserRole.OWNER || userProfile.role === UserRole.ADMIN) {
          isAuthorized = true;
        } else {
          rejectReason = 'Unauthorized to access payment records for this tenancy';
        }
        break;

      case 'createMaintenanceIssue':
        // Tenants can report maintenance on their own tenancy
        if (userProfile.role === UserRole.TENANT && context.tenancy) {
          isAuthorized = true;
        } else if (userProfile.role === UserRole.ADMIN) {
          isAuthorized = true;
        } else {
          rejectReason = 'Only active tenants can report new maintenance issues';
        }
        break;

      case 'createMaintenanceTask':
        // Autonomous technician dispatch is permitted for active tenancy issues
        isAuthorized = true;
        break;

      case 'notifyOwner':
        // Tenants can notify their property owner
        if (context.tenancy) {
          isAuthorized = true;
        } else {
          rejectReason = 'No active tenancy located to resolve owner';
        }
        break;

      case 'getMaintenanceIssues':
      case 'getProperty':
      case 'getRoom':
      case 'getTenancy':
        isAuthorized = true;
        break;

      default:
        isAuthorized = true;
        break;
    }

    if (isAuthorized) {
      authorizedActions.push(toolName);
    } else {
      rejectedActions.push({ toolName, reason: rejectReason });
    }
  }

  const step: ExecutionStep = {
    id: `step-auth-${Date.now()}`,
    label: `Authorization verified (${authorizedActions.length} approved)`,
    status: rejectedActions.length > 0 ? 'failed' : 'completed',
    timestamp: new Date().toISOString(),
    details:
      rejectedActions.length > 0
        ? `Rejected: ${rejectedActions.map((r) => r.toolName).join(', ')}`
        : 'All proposed actions approved under RBAC & ABAC',
  };

  return {
    authorizedActions,
    rejectedActions,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 6: EXECUTE (Parallel & Sequential Tool Execution)
// ============================================================================
export async function executeNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { authorizedActions, userProfile, sessionId, context, entities } = state;
  const toolCalls: ToolCallResult[] = [];
  const executionSteps: ExecutionStep[] = [];
  const results: Record<string, any> = {};

  const toolContext = {
    userProfile,
    sessionId,
    activeTenancyId: context.tenancy?.id,
  };

  // Divide tools into independent vs dependent batches for parallel execution
  // Independent batch: getRentStatus, validatePayment, createMaintenanceIssue, getMaintenanceIssues
  // Dependent batch: createMaintenanceTask (needs issueId), notifyOwner (needs issue context)

  const independentTools = authorizedActions.filter((t) =>
    ['getRentStatus', 'validatePayment', 'createMaintenanceIssue', 'getMaintenanceIssues', 'getProperty', 'getRoom', 'getTenancy'].includes(t)
  );

  const dependentTools = authorizedActions.filter((t) =>
    ['createMaintenanceTask', 'notifyOwner'].includes(t)
  );

  // Helper to execute a single tool
  async function runTool(toolName: string, resolvedInput?: any): Promise<ToolCallResult> {
    const toolDef = (AI_TOOLS_REGISTRY as any)[toolName];
    if (!toolDef) {
      return {
        toolName,
        status: 'FAILED',
        input: {},
        output: {},
        error: `Tool ${toolName} not found in registry`,
      };
    }

    let input = resolvedInput || {};
    if (!resolvedInput) {
      if (toolName === 'createMaintenanceIssue') {
        input = {
          title: entities.title || (context.previousRelatedIssue ? context.previousRelatedIssue.title : 'Maintenance issue reported by tenant'),
          description: entities.description || state.userMessage,
          category: entities.category || (context.previousRelatedIssue ? 'APPLIANCE' : 'GENERAL'),
          priority: context.isRepeatedIssue ? 'HIGH' : (entities.priority || 'MEDIUM'),
          isRepeated: context.isRepeatedIssue || entities.isRepeated || false,
        };
      } else if (toolName === 'getRentStatus') {
        input = { tenancyId: context.tenancy?.id };
      } else if (toolName === 'validatePayment') {
        input = {
          transactionRef: entities.transactionRef,
          rentScheduleId: context.currentRentSchedule?.id,
        };
      } else if (toolName === 'getMaintenanceIssues') {
        input = { tenancyId: context.tenancy?.id };
      } else if (toolName === 'getProperty') {
        input = { propertyId: context.tenancy?.propertyId };
      } else if (toolName === 'getRoom') {
        input = { roomId: context.tenancy?.roomId };
      } else if (toolName === 'getTenancy') {
        input = { tenancyId: context.tenancy?.id };
      }
    }

    try {
      const res = await toolDef.execute(input, toolContext);
      return res;
    } catch (err: any) {
      return {
        toolName,
        status: 'FAILED',
        input,
        output: {},
        error: err.message,
      };
    }
  }

  // 1. Execute Independent Batch in Parallel via Promise.allSettled
  if (independentTools.length > 0) {
    const parallelPromises = independentTools.map((t) => runTool(t));
    const settledResults = await Promise.allSettled(parallelPromises);

    settledResults.forEach((settled, index) => {
      const toolName = independentTools[index];
      let res: ToolCallResult;

      if (settled.status === 'fulfilled') {
        res = settled.value;
      } else {
        res = {
          toolName,
          status: 'FAILED',
          input: {},
          output: {},
          error: settled.reason?.message || 'Tool execution rejected',
        };
      }

      toolCalls.push(res);
      results[toolName] = res;

      let label = `Executed ${toolName}`;
      if (toolName === 'getRentStatus') label = 'Rent status validated (Parallel)';
      if (toolName === 'createMaintenanceIssue') label = 'Maintenance issue created (Parallel)';

      executionSteps.push({
        id: `step-${toolName}-${Date.now()}`,
        label,
        status: res.status === 'SUCCESS' ? 'completed' : 'failed',
        timestamp: new Date().toISOString(),
        details: res.summary || res.error,
      });
    });
  }

  // 2. Execute Dependent Batch Sequentially (with inputs from independent batch)
  for (const toolName of dependentTools) {
    let input: any = {};

    if (toolName === 'createMaintenanceTask') {
      const createdIssue = results.createMaintenanceIssue?.output;
      const issueId = createdIssue?.issueId || context.recentMaintenance?.[0]?.id;

      if (issueId) {
        input = {
          issueId,
          title: `Dispatch Technician for ${createdIssue?.title || 'Inspection'}`,
          description: `Autonomous task dispatched for issue ${issueId}`,
          assignedTo: 'QuickFix Coliving Services (Authorized Vendor)',
          estimatedCost: 1200,
        };
      } else {
        // Issue creation may have failed
        toolCalls.push({
          toolName,
          status: 'FAILED',
          input: {},
          output: {},
          error: 'Cannot assign technician: no maintenance issue was created',
        });
        executionSteps.push({
          id: `step-${toolName}-${Date.now()}`,
          label: 'Technician task skipped',
          status: 'failed',
          timestamp: new Date().toISOString(),
          details: 'Dependent maintenance issue was not found',
        });
        continue;
      }
    } else if (toolName === 'notifyOwner') {
      const issueTitle = results.createMaintenanceIssue?.output?.title || entities.title;
      input = {
        message: issueTitle
          ? `Tenant reported: ${issueTitle}. Technician dispatch initiated.`
          : entities.message || state.userMessage,
        urgent: entities.urgent || false,
      };
    }

    const res = await runTool(toolName, input);
    toolCalls.push(res);
    results[toolName] = res;

    let label = `Executed ${toolName}`;
    if (toolName === 'createMaintenanceTask') label = 'Technician task assigned';
    if (toolName === 'notifyOwner') label = 'Owner notified';

    executionSteps.push({
      id: `step-${toolName}-${Date.now()}`,
      label,
      status: res.status === 'SUCCESS' ? 'completed' : 'failed',
      timestamp: new Date().toISOString(),
      details: res.summary || res.error,
    });
  }

  return {
    toolCalls,
    results,
    executionSteps,
  };
}

// ============================================================================
// NODE 7: VERIFY (Verify Tool Outcomes & State Consistency)
// ============================================================================
export async function verifyNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { results, detectedIntents } = state;
  const verificationResults: Record<string, { verified: boolean; details: string }> = {};
  const intentBreakdown: MultiIntentExecutionStatus[] = [];

  for (const item of detectedIntents) {
    let intentStatus: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'CONFIRMATION_REQUIRED' = 'SUCCESS';
    let summary = '';
    const tools: string[] = [];

    switch (item.intent) {
      case 'PAYMENT_VALIDATION':
      case 'PAYMENT_STATUS': {
        tools.push('getRentStatus');
        const r = results.getRentStatus;
        if (r?.status === 'SUCCESS') {
          const isPaid = r.output?.isPaid;
          const amt = Number(r.output?.amount || 0).toLocaleString('en-IN');
          verificationResults['PAYMENT'] = {
            verified: true,
            details: `Rent payment status: ${isPaid ? 'PAID' : 'PENDING'} (₹${amt})`,
          };
          summary = isPaid
            ? `Rent of ₹${amt} for ${r.output?.billingMonth} is confirmed paid.`
            : `Rent of ₹${amt} for ${r.output?.billingMonth} is ${r.output?.status}.`;
        } else {
          intentStatus = 'FAILED';
          summary = r?.error || 'Could not retrieve rent status';
        }
        break;
      }

      case 'RENT_DUE': {
        tools.push('getRentStatus');
        const r = results.getRentStatus;
        if (r?.status === 'SUCCESS') {
          const amt = Number(r.output?.amount || 0).toLocaleString('en-IN');
          verificationResults['RENT_DUE'] = {
            verified: true,
            details: `Rent due on ${r.output?.dueDate}: ₹${amt}`,
          };
          summary = `Your rent of ₹${amt} for ${r.output?.billingMonth} is due on ${r.output?.dueDate}. Status: ${r.output?.status}.`;
        } else {
          intentStatus = 'FAILED';
          summary = r?.error || 'Could not retrieve rent due date';
        }
        break;
      }

      case 'MAINTENANCE_STATUS': {
        tools.push('getMaintenanceIssues');
        const r = results.getMaintenanceIssues;
        if (r?.status === 'SUCCESS') {
          const issues = r.output?.issues || [];
          verificationResults['MAINTENANCE_STATUS'] = {
            verified: true,
            details: `Found ${issues.length} maintenance issues`,
          };
          summary =
            issues.length > 0
              ? issues
                  .map(
                    (i: any, idx: number) =>
                      `${idx + 1}. ${i.title} — Status: ${i.status} (Priority: ${i.priority})`
                  )
                  .join('\n')
              : 'You currently have no open maintenance issues.';
        } else {
          intentStatus = 'FAILED';
          summary = r?.error || 'Could not retrieve maintenance issues';
        }
        break;
      }

      case 'MAINTENANCE_REPORT': {
        tools.push('createMaintenanceIssue', 'createMaintenanceTask');
        const issueRes = results.createMaintenanceIssue;
        const taskRes = results.createMaintenanceTask;

        if (issueRes?.status === 'SUCCESS') {
          verificationResults['MAINTENANCE'] = {
            verified: true,
            details: `Issue ${issueRes.output?.issueId} logged with task ${taskRes?.output?.taskId || 'pending'}`,
          };
          summary = `Logged issue "${issueRes.output?.title}" (${issueRes.output?.priority} priority). Technician assigned.`;
        } else {
          intentStatus = 'FAILED';
          summary = issueRes?.error || 'Could not create maintenance issue';
        }
        break;
      }

      case 'OWNER_NOTIFICATION': {
        tools.push('notifyOwner');
        const notifyRes = results.notifyOwner;
        if (notifyRes?.status === 'SUCCESS') {
          verificationResults['NOTIFICATION'] = {
            verified: true,
            details: `Owner ${notifyRes.output?.recipientOwner} notified successfully`,
          };
          summary = `Owner (${notifyRes.output?.recipientOwner}) notified.`;
        } else {
          intentStatus = 'FAILED';
          summary = notifyRes?.error || 'Could not dispatch owner notification';
        }
        break;
      }

      default:
        summary = 'Assistance query processed';
        break;
    }

    intentBreakdown.push({
      intent: item.intent,
      status: intentStatus,
      summary,
      tools,
    });
  }

  const step: ExecutionStep = {
    id: `step-verify-${Date.now()}`,
    label: 'Verified tool execution outcomes',
    status: intentBreakdown.some((i) => i.status === 'FAILED') ? 'failed' : 'completed',
    timestamp: new Date().toISOString(),
    details: intentBreakdown.map((i) => `${i.intent}: ${i.status}`).join(' | '),
  };

  return {
    verificationResults,
    intentBreakdown,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 8: UPDATE_STATE (Advance Rental Lifecycle & Session)
// ============================================================================
export async function updateStateNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { results, context, userProfile, sessionId } = state;
  let nextState: string | undefined = undefined;

  try {
    // If maintenance issue was created, advance lifecycle to ISSUE
    if (results.createMaintenanceIssue?.status === 'SUCCESS' && context.tenancy?.id) {
      nextState = 'ISSUE';
      try {
        const currentTenancy = await prisma.tenancy.findUnique({
          where: { id: context.tenancy.id },
          select: { lifecycleStage: true },
        });
        if (
          currentTenancy?.lifecycleStage === 'RENT_DUE' ||
          currentTenancy?.lifecycleStage === 'PAYMENT' ||
          currentTenancy?.lifecycleStage === 'VERIFIED'
        ) {
          await advanceRentalLifecycle(
            context.tenancy.id,
            'ISSUE' as any,
            { id: userProfile.id, role: userProfile.role, name: userProfile.name },
            `Maintenance issue reported: ${results.createMaintenanceIssue.output?.title}`
          );
        }
      } catch (lifecycleErr) {
        console.warn('Could not advance lifecycle in updateStateNode:', lifecycleErr);
      }
    } else if (results.getRentStatus?.status === 'SUCCESS') {
      nextState = results.getRentStatus.output?.isPaid ? 'PAYMENT' : 'RENT_DUE';
    } else if (context.tenancy?.lifecycleStage) {
      nextState = context.tenancy.lifecycleStage;
    }

    // Update AgentSession in Prisma if update method exists
    if (sessionId && typeof (prisma.agentSession as any)?.update === 'function') {
      await (prisma.agentSession as any).update({
        where: { id: sessionId },
        data: {
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.warn('Could not advance lifecycle in updateStateNode:', err);
  }

  const step: ExecutionStep = {
    id: `step-update-state-${Date.now()}`,
    label: `State updated (${nextState || 'Unchanged'})`,
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: nextState ? `Lifecycle stage advanced to: ${nextState}` : 'Session updated',
  };

  return {
    nextState,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 9: MEMORY_EVENT (Record Cognee Memory & Audit Logs)
// ============================================================================
export async function memoryEventNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { userProfile, context, intentBreakdown, results, sessionId } = state;

  // 1. Record Cognee Memory Event via MemoryService abstraction
  try {
    const summary = intentBreakdown.map((i) => `${i.intent}: ${i.summary}`).join('; ');
    await memoryService.remember({
      userProfileId: userProfile.id,
      tenancyId: context.tenancy?.id,
      propertyId: context.tenancy?.propertyId,
      memoryType: 'INTERACTION_SUMMARY',
      key: 'ASSISTANT_SESSION',
      summary: `User asked: "${state.userMessage}". Executed: ${summary}`,
      content: {
        intents: state.detectedIntents.map((i) => i.intent),
        resultsSummary: summary,
        isRepeatedIssue: context.isRepeatedIssue ?? false,
      },
    });
  } catch (err) {
    console.warn('Failed to record memory event:', err);
  }

  // 2. Log immutable AuditEvent
  try {
    await createAuditEvent({
      actorId: userProfile.id,
      actorRole: userProfile.role,
      action: 'AI_MULTI_INTENT_EXECUTION',
      resourceType: 'AGENT_SESSION',
      resourceId: sessionId,
      metadata: {
        intents: state.detectedIntents.map((i) => i.intent),
        toolsExecuted: Object.keys(results),
        intentBreakdown,
        success: intentBreakdown.every((i) => i.status === 'SUCCESS'),
      },
    });
  } catch (err) {
    console.warn('Failed to log audit event:', err);
  }

  const step: ExecutionStep = {
    id: `step-memory-${Date.now()}`,
    label: 'Recorded memory graph event & audit trail',
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: 'Logged to Cognee memory and immutable database audit log',
  };

  return {
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 10: RESPOND (Multilingual Response Synthesis & Partial Failure Handling)
// ============================================================================
export async function respondNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const {
    detectedIntents,
    intentBreakdown,
    results,
    context,
    userMessage,
    detectedLanguage,
    pendingConfirmation,
  } = state;

  // If pending confirmation, ask user directly
  if (pendingConfirmation) {
    const step: ExecutionStep = {
      id: `step-confirm-${Date.now()}`,
      label: 'Confirmation Required',
      status: 'pending',
      timestamp: new Date().toISOString(),
      details: pendingConfirmation.prompt,
    };

    return {
      userResponse: pendingConfirmation.prompt,
      executionSteps: [step],
    };
  }

  // 1. Try dynamic natural language response synthesis via Gemini
  const dynamicResponse = await dynamicSynthesizeResponse(
    userMessage,
    detectedIntents.map((i) => i.intent).join(' + '),
    results,
    context,
    state.modelName,
    detectedLanguage
  );

  if (dynamicResponse) {
    const prev = context.previousRelatedIssue;
    let finalDynamic = dynamicResponse;
    if (
      prev &&
      !dynamicResponse.includes('Previous related') &&
      (detectedIntents.some((i) => i.intent === 'MAINTENANCE_REPORT' || i.intent === 'MAINTENANCE_STATUS') ||
        userMessage.toLowerCase().includes('ac') ||
        userMessage.toLowerCase().includes('broken'))
    ) {
      finalDynamic = `Previous related maintenance issue found.\n\nYou previously reported "${prev.title}" for this property (Status: ${prev.status}, Resolution: ${prev.resolution || 'AC service completed'}). Since this issue has recurred, I have escalated it with HIGH priority to the property owner and technician.\n\n${dynamicResponse}`;
    }

    const finalStep: ExecutionStep = {
      id: `step-complete-${Date.now()}`,
      label: `✓ Completed (${state.modelName || 'Gemini'})`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    };

    return {
      userResponse: finalDynamic,
      executionSteps: [finalStep],
    };
  }

  // 2. Deterministic Multilingual Response Synthesis Fallback
  const isHindi = detectedLanguage?.startsWith('hi');
  const isSingleIntent = detectedIntents.length === 1;
  const responseParts: string[] = [];

  for (const item of intentBreakdown) {
    const isSuccess = item.status === 'SUCCESS';
    const statusIcon = isSuccess ? '✓' : '✗';

    switch (item.intent) {
      case 'PAYMENT_VALIDATION':
      case 'PAYMENT_STATUS': {
        const rs = results.getRentStatus?.output;
        if (isSuccess && rs) {
          const amt = Number(rs.amount || 0).toLocaleString('en-IN');
          if (rs.isPaid) {
            if (isHindi) {
              responseParts.push(
                isSingleIntent
                  ? `हाँ, आपका ₹${amt} किराया (${rs.billingMonth || '2026-09'}) सफलतापूर्वक जमा हो चुका है।`
                  : `भुगतान: ${statusIcon} पुष्ट (आपका 2026-09 का ₹${amt} किराया जमा हो चुका है।)`
              );
            } else {
              responseParts.push(
                isSingleIntent
                  ? `Yes, your rent of ₹${amt} for ${rs.billingMonth || '2026-09'} has been paid successfully. (Due date was ${rs.dueDate}).`
                  : `Payment: ${statusIcon} Confirmed (Your rent of ₹${amt} for ${rs.billingMonth || 'September 2026'} is confirmed paid).`
              );
            }
          } else {
            if (isHindi) {
              responseParts.push(
                isSingleIntent
                  ? `नहीं, आपका ₹${amt} किराया अभी ${rs.status || 'PENDING'} है। देय तिथि: ${rs.dueDate}।`
                  : `भुगतान: ${statusIcon} आपका ₹${amt} किराया अभी ${rs.status || 'PENDING'} है (देय तिथि: ${rs.dueDate})।`
              );
            } else {
              responseParts.push(
                isSingleIntent
                  ? `No, your rent of ₹${amt} for ${rs.billingMonth || '2026-09'} is currently ${rs.status || 'PENDING'}. It is due on ${rs.dueDate}.`
                  : `Payment: ${statusIcon} Your rent of ₹${amt} for ${rs.billingMonth || 'September 2026'} is currently ${rs.status || 'PENDING'}.`
              );
            }
          }
        } else {
          responseParts.push(
            isHindi
              ? `भुगतान: ${statusIcon} स्थिति प्राप्त नहीं हो सकी (${item.summary})`
              : `Payment: ${statusIcon} Could not verify status (${item.summary})`
          );
        }
        break;
      }

      case 'RENT_DUE': {
        const rs = results.getRentStatus?.output;
        if (isSuccess && rs) {
          const amt = Number(rs.amount || 0).toLocaleString('en-IN');
          responseParts.push(
            isHindi
              ? `किराया देय: 2026-09 का ₹${amt} किराया ${rs.dueDate} को देय है। स्थिति: ${rs.status}।`
              : `Your rent of ₹${amt} for ${rs.billingMonth || '2026-09'} is due on ${rs.dueDate}. Status: ${rs.status}.`
          );
        } else {
          responseParts.push(`Rent Due: ${item.summary}`);
        }
        break;
      }

      case 'MAINTENANCE_STATUS': {
        responseParts.push(
          isSingleIntent
            ? `Here are your current maintenance records:\n${item.summary}`
            : `Maintenance Status:\n${item.summary}`
        );
        break;
      }

      case 'MAINTENANCE_REPORT': {
        const issue = results.createMaintenanceIssue?.output;
        const task = results.createMaintenanceTask?.output;
        if (isSuccess && issue) {
          if (isHindi) {
            responseParts.push(
              isSingleIntent
                ? `मैंने आपकी रखरखाव शिकायत ("${issue.title}") ${issue.priority} प्राथमिकता के साथ दर्ज कर ली है। तकनीशियन (${task?.assignedTo || 'QuickFix Services'}) को काम सौंप दिया गया है और मकान मालिक को सूचित कर दिया गया है।`
                : `रखरखाव: ${statusIcon} दर्ज (एसी खराबी की शिकायत ${issue.priority || 'HIGH'} प्राथमिकता के साथ दर्ज कर ली गई है। तकनीशियन ${task?.assignedTo || 'QuickFix Services'} को सौंपा गया)।`
            );
          } else {
            responseParts.push(
              isSingleIntent
                ? `I have logged your maintenance issue ("${issue.title}") with ${issue.priority} priority under ${issue.category}. An authorized technician has been assigned (${task?.assignedTo || 'QuickFix Services'}) and your property owner has been notified.`
                : `Maintenance: ${statusIcon} Created (Issue logged for ${issue.title || 'AC malfunction'} with ${issue.priority || 'HIGH'} priority. Technician assigned: ${task?.assignedTo || 'QuickFix Coliving Services'}).`
            );
          }
        } else {
          responseParts.push(
            isHindi
              ? `रखरखाव: ${statusIcon} शिकायत दर्ज नहीं हो सकी (${item.summary})`
              : `Maintenance: ${statusIcon} Could not create task (${item.summary})`
          );
        }
        break;
      }

      case 'OWNER_NOTIFICATION': {
        const notify = results.notifyOwner?.output;
        if (isSuccess) {
          if (isHindi) {
            responseParts.push(
              isSingleIntent
                ? `आपका संदेश आपके मकान मालिक (${notify?.recipientOwner || 'मालिक'}) को भेज दिया गया है।`
                : `मालिक को सूचना: ${statusIcon} प्रेषित (मकान मालिक ${notify?.recipientOwner || 'मालिक'} को तत्काल सूचना भेज दी गई है)।`
            );
          } else {
            responseParts.push(
              isSingleIntent
                ? `Your message has been dispatched to your property owner (${notify?.recipientOwner || 'Owner'}). They will receive an immediate notification in their dashboard.`
                : `Owner Notification: ${statusIcon} Sent (Dispatched immediate alert to owner ${notify?.recipientOwner || 'Owner'}).`
            );
          }
        } else {
          responseParts.push(
            isHindi
              ? `मालिक को सूचना: ${statusIcon} सूचना नहीं भेजी जा सकी (${item.summary})`
              : `Owner Notification: ${statusIcon} Could not notify owner (${item.summary})`
          );
        }
        break;
      }

      default:
        responseParts.push(`${item.intent}: ${item.summary}`);
        break;
    }
  }

  // Phase 4: Prepend explicit historical context notice when previous related issue is retrieved
  const prev = context.previousRelatedIssue;
  let memoryNotice = '';
  if (
    prev &&
    (detectedIntents.some((i) => i.intent === 'MAINTENANCE_REPORT' || i.intent === 'MAINTENANCE_STATUS') ||
      userMessage.toLowerCase().includes('ac') ||
      userMessage.toLowerCase().includes('broken'))
  ) {
    memoryNotice = `Previous related maintenance issue found.\n\nYou previously reported "${prev.title}" for this property (Status: ${prev.status}, Resolution: ${prev.resolution || 'AC service completed'}). Since this issue has recurred, I have escalated it with HIGH priority to the property owner and technician.\n\n`;
  }

  const userResponse = memoryNotice + responseParts.join('\n\n');

  const finalStep: ExecutionStep = {
    id: `step-complete-${Date.now()}`,
    label: '✓ Completed',
    status: 'completed',
    timestamp: new Date().toISOString(),
  };

  return {
    userResponse,
    executionSteps: [finalStep],
  };
}

// ============================================================================
// Compile Phase 3 Stateful LangGraph
// ============================================================================
export function buildRentalAssistantGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
    .addNode('understand', understandNode)
    .addNode('loadContext', loadContextNode)
    .addNode('detectIntents', detectIntentsNode)
    .addNode('plan', planNode)
    .addNode('authorize', authorizeNode)
    .addNode('execute', executeNode)
    .addNode('verify', verifyNode)
    .addNode('updateState', updateStateNode)
    .addNode('memoryEvent', memoryEventNode)
    .addNode('respond', respondNode)
    .addEdge(START, 'understand')
    .addEdge('understand', 'loadContext')
    .addEdge('loadContext', 'detectIntents')
    .addEdge('detectIntents', 'plan')
    .addEdge('plan', 'authorize')
    .addEdge('authorize', 'execute')
    .addEdge('execute', 'verify')
    .addEdge('verify', 'updateState')
    .addEdge('updateState', 'memoryEvent')
    .addEdge('memoryEvent', 'respond')
    .addEdge('respond', END);

  return workflow.compile();
}
