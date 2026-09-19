import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { UserProfile, UserRole } from '@prisma/client';
import prisma from '@/lib/db';
import {
  IntentType,
  ToolCallResult,
  ExecutionStep,
  AgentRentalContext,
  AIExecutionResponse,
} from './types';
import { AI_TOOLS_REGISTRY } from './tools';
import {
  dynamicAnalyzeIntent,
  dynamicPlanTools,
  dynamicSynthesizeResponse,
  isGeminiConfigured,
} from './llm';

/**
 * Define the LangGraph State Annotation
 */
export const AgentStateAnnotation = Annotation.Root({
  userMessage: Annotation<string>(),
  userProfile: Annotation<UserProfile>(),
  sessionId: Annotation<string>(),
  intent: Annotation<IntentType>(),
  entities: Annotation<Record<string, any>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  context: Annotation<AgentRentalContext>(),
  plannedActions: Annotation<string[]>({
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
  nextState: Annotation<string | undefined>(),
  userResponse: Annotation<string>(),
  modelName: Annotation<string | undefined>(),
});

export type AgentStateType = typeof AgentStateAnnotation.State;

// ============================================================================
// NODE 1: Understand Intent
// ============================================================================
export async function understandIntentNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  // 1. Try dynamic LLM classification via Gemini if API key is configured
  const dynamicResult = await dynamicAnalyzeIntent(state.userMessage, state.modelName);
  if (dynamicResult) {
    const step: ExecutionStep = {
      id: `step-intent-${Date.now()}`,
      label: `Understanding request (${dynamicResult.modelUsed || 'Gemini'})`,
      status: 'completed',
      timestamp: new Date().toISOString(),
      details: `Dynamically detected intent: ${dynamicResult.intent}`,
    };
    return {
      intent: dynamicResult.intent,
      entities: dynamicResult.entities,
      executionSteps: [step],
    };
  }

  // 2. Deterministic Fallback Rules
  const message = state.userMessage.toLowerCase().trim();
  let intent: IntentType = 'GENERAL_RENTAL_ASSISTANCE';
  const entities: Record<string, any> = {};

  // Intent classification rules
  if (
    message.includes('is my rent paid') ||
    message.includes('rent paid') ||
    message.includes('did i pay rent') ||
    message.includes('payment status')
  ) {
    intent = 'PAYMENT_STATUS';
  } else if (
    message.includes('rent is due when') ||
    message.includes('when is rent due') ||
    message.includes('rent due date') ||
    message.includes('due date') ||
    message.includes('rent due')
  ) {
    intent = 'RENT_DUE';
  } else if (
    message.includes('validate payment') ||
    message.includes('verify payment') ||
    message.includes('transaction')
  ) {
    intent = 'PAYMENT_VALIDATION';
    const txnMatch = message.match(/txn[_\w]+/i);
    if (txnMatch) entities.transactionRef = txnMatch[0];
  } else if (
    message.includes('tell the owner') ||
    message.includes('notify the owner') ||
    message.includes('notify owner') ||
    message.includes('inform owner')
  ) {
    intent = 'OWNER_NOTIFICATION';
    entities.urgent = message.includes('urgent') || message.includes('emergency') || message.includes('broken');
    entities.message = state.userMessage;
  } else if (
    message.includes('show my maintenance') ||
    message.includes('show maintenance') ||
    message.includes('maintenance issues') ||
    message.includes('my issues') ||
    message.includes('status of my issue')
  ) {
    intent = 'MAINTENANCE_STATUS';
  } else if (
    message.includes('not working') ||
    message.includes("isn't working") ||
    message.includes('broken') ||
    message.includes('leak') ||
    message.includes('fix') ||
    message.includes('repair') ||
    message.includes('ac ') ||
    message.includes('tap') ||
    message.includes('geyser') ||
    message.includes('light') ||
    message.includes('wifi')
  ) {
    intent = 'MAINTENANCE_REPORT';

    // Classify category and priority
    if (message.includes('ac') || message.includes('air conditioner') || message.includes('cooler')) {
      entities.category = 'APPLIANCE';
      entities.title = 'Air Conditioning malfunction reported';
      entities.priority = 'HIGH';
    } else if (message.includes('leak') || message.includes('tap') || message.includes('flush') || message.includes('pipe')) {
      entities.category = 'PLUMBING';
      entities.title = 'Plumbing leak / water fixture issue';
      entities.priority = 'MEDIUM';
    } else if (message.includes('spark') || message.includes('power') || message.includes('switch') || message.includes('light')) {
      entities.category = 'ELECTRICAL';
      entities.title = 'Electrical / power supply issue';
      entities.priority = 'HIGH';
    } else {
      entities.category = 'GENERAL';
      entities.title = 'Maintenance assistance requested';
      entities.priority = 'MEDIUM';
    }
    entities.description = state.userMessage;
  } else if (
    message.includes('property') ||
    message.includes('amenities') ||
    message.includes('address') ||
    message.includes('building')
  ) {
    intent = 'PROPERTY_INFORMATION';
  } else if (
    message.includes('tenancy') ||
    message.includes('lease') ||
    message.includes('room') ||
    message.includes('contract')
  ) {
    intent = 'RENTAL_INFORMATION';
  }

  const step: ExecutionStep = {
    id: `step-intent-${Date.now()}`,
    label: 'Understanding request',
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: `Detected intent: ${intent}`,
  };

  return {
    intent,
    entities,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 2: Retrieve Rental Context
// ============================================================================
export async function retrieveContextNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
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
                take: 3,
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
          roomNumber: tenancyRecord.room.roomNumber,
          monthlyRent: tenancyRecord.monthlyRent,
          lifecycleStage: tenancyRecord.lifecycleStage,
          isActive: tenancyRecord.isActive,
          ownerName: tenancyRecord.property.owner?.userProfile?.name,
          ownerPhone: tenancyRecord.property.owner?.userProfile?.phone,
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
  };

  const step: ExecutionStep = {
    id: `step-context-${Date.now()}`,
    label: 'Rental context loaded',
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: context.tenancy
      ? `Active lease at ${context.tenancy.propertyName} (${context.tenancy.roomNumber})`
      : 'No active tenancy located',
  };

  return {
    context,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 3: Plan Actions & Tool Selection
// ============================================================================
export async function planActionsNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { intent, userMessage } = state;

  // 1. Try dynamic tool planning via Gemini if API key is configured
  const dynamicTools = await dynamicPlanTools(
    userMessage,
    intent,
    Object.keys(AI_TOOLS_REGISTRY),
    state.modelName
  );

  if (dynamicTools && dynamicTools.length > 0) {
    const step: ExecutionStep = {
      id: `step-plan-${Date.now()}`,
      label: `Actions planned (${state.modelName || 'Gemini'})`,
      status: 'completed',
      timestamp: new Date().toISOString(),
      details: `Dynamically selected tools: ${dynamicTools.join(', ')}`,
    };

    return {
      plannedActions: dynamicTools,
      executionSteps: [step],
    };
  }

  // 2. Deterministic Fallback Tool Mapping
  const plannedActions: string[] = [];

  switch (intent) {
    case 'PAYMENT_STATUS':
      plannedActions.push('getRentStatus', 'getPaymentHistory');
      break;

    case 'RENT_DUE':
      plannedActions.push('getRentStatus');
      break;

    case 'PAYMENT_VALIDATION':
      plannedActions.push('validatePayment');
      break;

    case 'MAINTENANCE_REPORT':
      // End-to-end autonomous flow: create issue -> assign task -> notify owner
      plannedActions.push('createMaintenanceIssue', 'createMaintenanceTask', 'notifyOwner');
      break;

    case 'MAINTENANCE_STATUS':
      plannedActions.push('getMaintenanceIssues');
      break;

    case 'OWNER_NOTIFICATION':
      plannedActions.push('notifyOwner');
      break;

    case 'PROPERTY_INFORMATION':
      plannedActions.push('getProperty');
      break;

    case 'RENTAL_INFORMATION':
      plannedActions.push('getTenancy', 'getRoom');
      break;

    case 'GENERAL_RENTAL_ASSISTANCE':
    default:
      plannedActions.push('getTenancy');
      break;
  }

  const step: ExecutionStep = {
    id: `step-plan-${Date.now()}`,
    label: 'Actions planned',
    status: 'completed',
    timestamp: new Date().toISOString(),
    details: `Selected tools: ${plannedActions.join(', ')}`,
  };

  return {
    plannedActions,
    executionSteps: [step],
  };
}

// ============================================================================
// NODE 4: Execute Authorized Tools
// ============================================================================
export async function executeToolsNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { plannedActions, userProfile, sessionId, context, entities } = state;
  const toolCalls: ToolCallResult[] = [];
  const executionSteps: ExecutionStep[] = [];
  const results: Record<string, any> = {};

  const toolContext = {
    userProfile,
    sessionId,
    activeTenancyId: context.tenancy?.id,
  };

  for (const toolName of plannedActions) {
    const toolDef = (AI_TOOLS_REGISTRY as any)[toolName];
    if (!toolDef) continue;

    let input: any = {};

    // Prepare inputs based on resolved server context and extracted entities
    if (toolName === 'createMaintenanceIssue') {
      input = {
        title: entities.title || 'Maintenance issue reported by tenant',
        description: entities.description || state.userMessage,
        category: entities.category || 'GENERAL',
        priority: entities.priority || 'MEDIUM',
      };
    } else if (toolName === 'createMaintenanceTask') {
      // Use issue created in previous step if available
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
    } else if (toolName === 'validatePayment') {
      input = {
        transactionRef: entities.transactionRef,
        rentScheduleId: context.currentRentSchedule?.id,
      };
    } else if (toolName === 'getRentStatus') {
      input = { tenancyId: context.tenancy?.id };
    } else if (toolName === 'getPaymentHistory') {
      input = { tenancyId: context.tenancy?.id, limit: 5 };
    } else if (toolName === 'getProperty') {
      input = { propertyId: context.tenancy?.propertyId };
    } else if (toolName === 'getRoom') {
      input = { roomId: context.tenancy?.roomId };
    }

    try {
      const result: ToolCallResult = await toolDef.execute(input, toolContext);
      toolCalls.push(result);
      results[toolName] = result;

      // Human-readable execution step
      let stepLabel = `Executed ${toolName}`;
      if (toolName === 'createMaintenanceIssue') stepLabel = 'Maintenance issue created';
      if (toolName === 'createMaintenanceTask') stepLabel = 'Technician task assigned';
      if (toolName === 'notifyOwner') stepLabel = 'Owner notified';
      if (toolName === 'getRentStatus') stepLabel = 'Rent status retrieved';
      if (toolName === 'getMaintenanceIssues') stepLabel = 'Maintenance records retrieved';

      executionSteps.push({
        id: `step-${toolName}-${Date.now()}`,
        label: stepLabel,
        status: result.status === 'SUCCESS' ? 'completed' : 'failed',
        timestamp: new Date().toISOString(),
        details: result.summary || result.error,
      });
    } catch (err: any) {
      const errorResult: ToolCallResult = {
        toolName,
        status: 'FAILED',
        input,
        output: {},
        error: err.message,
      };
      toolCalls.push(errorResult);
      executionSteps.push({
        id: `step-${toolName}-${Date.now()}`,
        label: `Failed to execute ${toolName}`,
        status: 'failed',
        timestamp: new Date().toISOString(),
        details: err.message,
      });
    }
  }

  return {
    toolCalls,
    results,
    executionSteps,
  };
}

// ============================================================================
// NODE 5: Synthesize Structured Response
// ============================================================================
export async function synthesizeResponseNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { intent, results, context, userMessage } = state;
  let userResponse = '';
  let nextState: string | undefined = undefined;

  // 1. Try dynamic natural language response synthesis via Gemini
  const dynamicResponse = await dynamicSynthesizeResponse(
    userMessage,
    intent,
    results,
    context,
    state.modelName
  );
  if (dynamicResponse) {
    if (intent === 'MAINTENANCE_REPORT') nextState = 'ISSUE';
    else if (intent === 'PAYMENT_STATUS') {
      const rs = results.getRentStatus?.output;
      nextState = rs?.isPaid ? 'PAYMENT' : 'RENT_DUE';
    } else if (context.tenancy?.lifecycleStage) {
      nextState = context.tenancy.lifecycleStage;
    }

    const finalStep: ExecutionStep = {
      id: `step-complete-${Date.now()}`,
      label: `✓ Completed (${state.modelName || 'Gemini'})`,
      status: 'completed',
      timestamp: new Date().toISOString(),
      details: `Synthesized dynamic response with ${state.modelName || 'Gemini'}`,
    };

    return {
      userResponse: dynamicResponse,
      nextState,
      executionSteps: [finalStep],
    };
  }

  // 2. Deterministic Structured Synthesis Fallback
  switch (intent) {
    case 'PAYMENT_STATUS': {
      const rentStatus = results.getRentStatus?.status === 'SUCCESS' ? results.getRentStatus.output : null;
      if (rentStatus && rentStatus.amount !== undefined) {
        const formattedAmount = Number(rentStatus.amount).toLocaleString('en-IN');
        if (rentStatus.isPaid) {
          userResponse = `Yes, your rent of ₹${formattedAmount} for ${rentStatus.billingMonth} has been paid successfully. (Due date was ${rentStatus.dueDate}).`;
          nextState = 'PAYMENT';
        } else {
          userResponse = `No, your rent of ₹${formattedAmount} for ${rentStatus.billingMonth} is currently ${rentStatus.status}. It is due on ${rentStatus.dueDate}.`;
          nextState = 'RENT_DUE';
        }
      } else {
        userResponse = 'I checked your account, but could not locate an active rent schedule for this cycle.';
      }
      break;
    }

    case 'RENT_DUE': {
      const rentStatus = results.getRentStatus?.status === 'SUCCESS' ? results.getRentStatus.output : null;
      if (rentStatus && rentStatus.amount !== undefined) {
        const formattedAmount = Number(rentStatus.amount).toLocaleString('en-IN');
        userResponse = `Your rent of ₹${formattedAmount} for ${rentStatus.billingMonth} is due on ${rentStatus.dueDate}. Status: ${rentStatus.status}.`;
        nextState = rentStatus.status === 'SUCCESS' ? 'PAYMENT' : 'RENT_DUE';
      } else {
        userResponse = 'No upcoming rent due date found in your active tenancy records.';
      }
      break;
    }

    case 'MAINTENANCE_REPORT': {
      const issue = results.createMaintenanceIssue?.status === 'SUCCESS' ? results.createMaintenanceIssue.output : null;
      const task = results.createMaintenanceTask?.status === 'SUCCESS' ? results.createMaintenanceTask.output : null;
      const notify = results.notifyOwner?.status === 'SUCCESS' ? results.notifyOwner.output : null;

      if (issue) {
        userResponse = `I have logged your maintenance issue ("${issue.title}") with ${issue.priority} priority under ${issue.category}. An authorized technician has been assigned (${task?.assignedTo || 'QuickFix Services'}) and your property owner (${notify?.recipientOwner || 'Owner'}) has been notified.`;
        nextState = 'ISSUE';
      } else {
        userResponse = 'I encountered an error trying to log your maintenance issue. Please try again or reach out to your property manager.';
      }
      break;
    }

    case 'MAINTENANCE_STATUS': {
      const issuesResult = results.getMaintenanceIssues?.status === 'SUCCESS' ? results.getMaintenanceIssues.output : null;
      if (issuesResult && issuesResult.issues?.length > 0) {
        const issueList = issuesResult.issues
          .map((i: any, idx: number) => `${idx + 1}. ${i.title} — Status: ${i.status} (Priority: ${i.priority})`)
          .join('\n');
        userResponse = `Here are your current maintenance records:\n${issueList}`;
      } else {
        userResponse = 'You currently have no open or recorded maintenance issues.';
      }
      break;
    }

    case 'OWNER_NOTIFICATION': {
      const notify = results.notifyOwner?.status === 'SUCCESS' ? results.notifyOwner.output : null;
      if (notify) {
        userResponse = `Your message has been dispatched to your property owner (${notify.recipientOwner}). They will receive an immediate notification in their dashboard.`;
      } else {
        userResponse = 'Unable to dispatch notification to the owner. Please verify your active tenancy.';
      }
      break;
    }

    case 'PROPERTY_INFORMATION': {
      const prop = results.getProperty?.status === 'SUCCESS' ? results.getProperty.output : null;
      if (prop) {
        userResponse = `${prop.name} is located at ${prop.address}, ${prop.city}. Amenities include: ${prop.amenities?.join(', ') || 'N/A'}. Property owner: ${prop.ownerName}.`;
      } else {
        userResponse = 'Could not load property details for your active lease.';
      }
      break;
    }

    case 'RENTAL_INFORMATION':
    default: {
      if (context.tenancy) {
        userResponse = `You are currently residing in Room ${context.tenancy.roomNumber} at ${context.tenancy.propertyName}. Monthly rent: ₹${context.tenancy.monthlyRent.toLocaleString('en-IN')}. Lifecycle stage: ${context.tenancy.lifecycleStage}.`;
        nextState = context.tenancy.lifecycleStage;
      } else {
        userResponse = 'Welcome to HavenDex! I am your AI rental teammate. How can I assist you today?';
      }
      break;
    }
  }

  const finalStep: ExecutionStep = {
    id: `step-complete-${Date.now()}`,
    label: '✓ Completed',
    status: 'completed',
    timestamp: new Date().toISOString(),
  };

  return {
    userResponse,
    nextState,
    executionSteps: [finalStep],
  };
}

// ============================================================================
// Compile LangGraph State Graph
// ============================================================================
export function buildRentalAssistantGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
    .addNode('understandIntent', understandIntentNode)
    .addNode('retrieveContext', retrieveContextNode)
    .addNode('planActions', planActionsNode)
    .addNode('executeTools', executeToolsNode)
    .addNode('synthesizeResponse', synthesizeResponseNode)
    .addEdge(START, 'understandIntent')
    .addEdge('understandIntent', 'retrieveContext')
    .addEdge('retrieveContext', 'planActions')
    .addEdge('planActions', 'executeTools')
    .addEdge('executeTools', 'synthesizeResponse')
    .addEdge('synthesizeResponse', END);

  return workflow.compile();
}
