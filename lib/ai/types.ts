import { UserProfile, UserRole } from '@prisma/client';

export type IntentType =
  | 'PAYMENT_STATUS'
  | 'RENT_DUE'
  | 'PAYMENT_VALIDATION'
  | 'MAINTENANCE_REPORT'
  | 'MAINTENANCE_STATUS'
  | 'OWNER_NOTIFICATION'
  | 'PROPERTY_INFORMATION'
  | 'RENTAL_INFORMATION'
  | 'GENERAL_RENTAL_ASSISTANCE';

export interface ToolExecutionContext {
  userProfile: UserProfile;
  sessionId: string;
  activeTenancyId?: string;
}

export interface ToolCallResult {
  toolName: string;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  summary?: string;
}

export interface ExecutionStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
  details?: string;
}

export interface DetectedIntent {
  intent: IntentType;
  confidence: number;
  entities: Record<string, any>;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  confirmationPayload?: Record<string, any>;
}

export interface MultiIntentExecutionStatus {
  intent: IntentType;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'CONFIRMATION_REQUIRED';
  summary: string;
  tools: string[];
  error?: string;
}

export interface PendingConfirmation {
  action: string;
  prompt: string;
  intent: IntentType;
  payload: Record<string, any>;
}

export interface AIExecutionResponse {
  sessionId: string;
  intent: IntentType;
  detectedIntents?: DetectedIntent[];
  intentBreakdown?: MultiIntentExecutionStatus[];
  entities: Record<string, unknown>;
  contextRequired: string[];
  plannedActions: string[];
  toolCalls: ToolCallResult[];
  results: Record<string, unknown>;
  nextState?: string;
  userResponse: string;
  executionSteps: ExecutionStep[];
  modelUsed?: string;
  languageCode?: string;
  audioBase64?: string;
  pendingConfirmation?: PendingConfirmation;
}

export interface AgentRentalContext {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  tenancy?: {
    id: string;
    propertyId: string;
    propertyName: string;
    roomId: string;
    roomNumber: string;
    monthlyRent: number;
    lifecycleStage: string;
    isActive: boolean;
    ownerName?: string;
    ownerPhone?: string;
  };
  currentRentSchedule?: {
    id: string;
    billingMonth: string;
    amount: number;
    dueDate: string;
    status: string;
  };
  recentMaintenance?: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    createdAt: string;
  }>;
}

