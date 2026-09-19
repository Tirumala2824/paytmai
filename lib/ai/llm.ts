import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { IntentType, ChatTurn } from './types';
import { kcache } from './cache/kcache';

/**
 * List of supported dynamic Gemini models.
 */
export const SUPPORTED_GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
] as const;

export type GeminiModelId = (typeof SUPPORTED_GEMINI_MODELS)[number] | string;

/**
 * Generates intelligent, context-aware follow-up question chips.
 */
export function generateContextualFollowUps(
  intent: string,
  userRole: string = 'TENANT',
  toolResults: Record<string, any> = {},
  userMessage: string = ''
): string[] {
  const lowerMsg = userMessage.toLowerCase();

  if (userRole === 'OWNER' || userRole === 'PROPERTY_MANAGER') {
    if (intent.includes('PORTFOLIO') || intent.includes('REVENUE')) {
      return ['Show vacant rooms', 'List active tenants', 'Show pending rent payments'];
    }
    if (intent.includes('VACANCY') || intent.includes('ROOM')) {
      return ['Show revenue breakdown', 'List active tenants', 'Show maintenance tickets'];
    }
    if (intent.includes('MAINTENANCE') || intent.includes('TICKET')) {
      return ['Dispatch technician', 'Show tenant roster', 'Show monthly revenue'];
    }
    return ['What is my monthly revenue?', 'Show vacant rooms', 'Show maintenance tickets'];
  }

  // Tenant persona contextual follow-ups
  if (lowerMsg.includes('wifi') || lowerMsg.includes('wi-fi') || lowerMsg.includes('password') || lowerMsg.includes('internet')) {
    return ['What are the mess timings?', 'What are the visitor hours?', 'Who is my property manager?'];
  }
  if (lowerMsg.includes('mess') || lowerMsg.includes('food') || lowerMsg.includes('dinner') || lowerMsg.includes('lunch')) {
    return ['What is the Wi-Fi password?', 'What are the gate rules?', 'Show my room details'];
  }
  if (lowerMsg.includes('gate') || lowerMsg.includes('curfew') || lowerMsg.includes('rule') || lowerMsg.includes('visitor')) {
    return ['What is the Wi-Fi password?', 'What are the mess timings?', 'Contact property manager'];
  }
  if (intent.includes('MAINTENANCE') || intent.includes('ISSUE') || lowerMsg.includes('broken') || lowerMsg.includes('ac') || lowerMsg.includes('leak')) {
    return ['When will the technician arrive?', 'Notify owner that it is urgent', 'Check repair status'];
  }
  if (intent.includes('PAYMENT') || intent.includes('RENT')) {
    return ['Download rent receipt', 'When is next month\'s rent due?', 'Show payment history'];
  }
  if (intent.includes('LEASE') || intent.includes('RENTAL') || intent.includes('ROOM')) {
    return ['Is my rent paid?', 'What are the house rules?', 'Contact property manager'];
  }
  return ['What is the Wi-Fi password?', 'When is my next rent due?', 'My AC is not working'];
}

let quotaCooldownUntil = 0;

export function recordQuotaExhausted(retryDelaySeconds: number = 60): void {
  quotaCooldownUntil = Date.now() + retryDelaySeconds * 1000;
  console.warn(`[KCache/LLM] Gemini quota rate limit hit. Activating fast deterministic fallback cooldown until ${new Date(quotaCooldownUntil).toISOString()}`);
}

export function isQuotaInCooldown(): boolean {
  return Date.now() < quotaCooldownUntil;
}

/**
 * Checks if a valid Gemini API key is present in environment variables.
 */
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

export function isGeminiConfigured(): boolean {
  if (isQuotaInCooldown()) return false;
  const key = getGeminiApiKey();
  return !!key && key.trim().length > 0 && !key.includes('placeholder') && key !== 'undefined';
}

/**
 * Dynamically resolves the LLM model name from:
 * 1. An explicit caller parameter (e.g. from UI selector)
 * 2. Environment variable `GEMINI_MODEL` or `LLM_MODEL`
 * 3. Default fallback to 'gemini-1.5-flash'
 */
export function getGeminiModelName(customModel?: string): string {
  if (customModel && customModel.trim().length > 0) {
    return customModel.trim();
  }
  return process.env.GEMINI_MODEL || process.env.LLM_MODEL || 'gemini-1.5-flash';
}

/**
 * Instantiates the ChatGoogleGenerativeAI model dynamically.
 */
export function getGeminiModel(
  temperature: number = 0.2,
  customModel?: string
): ChatGoogleGenerativeAI | null {
  if (isQuotaInCooldown()) return null;
  const apiKey = getGeminiApiKey();
  if (!apiKey || !isGeminiConfigured()) return null;

  const modelName = getGeminiModelName(customModel);

  return new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey,
    temperature,
    maxRetries: 0,
  });
}

/**
 * Dynamically analyzes user intent and extracts entities using the dynamically configured Gemini model.
 */
export async function dynamicAnalyzeIntent(
  userMessage: string,
  customModel?: string
): Promise<{
  intent: IntentType;
  entities: Record<string, any>;
  modelUsed?: string;
} | null> {
  const model = getGeminiModel(0.1, customModel);
  if (!model) return null;

  const modelUsed = getGeminiModelName(customModel);

  try {
    const prompt = `You are the intent classification and entity extraction engine for HavenDex, an AI-powered rental OS.
Analyze the user's message and return ONLY a valid JSON object with:
- "intent": exactly one of:
  - "PAYMENT_STATUS" (asking if rent is paid, payment state)
  - "RENT_DUE" (asking when rent is due, due date, invoice schedule)
  - "PAYMENT_VALIDATION" (validating a transaction ref or payment receipt)
  - "MAINTENANCE_REPORT" (reporting broken items, leaks, AC issues, repairs)
  - "MAINTENANCE_STATUS" (asking for status of existing issues/tasks)
  - "OWNER_NOTIFICATION" (asking to tell or notify the owner)
  - "PROPERTY_INFORMATION" (asking about building, amenities, rules)
  - "RENTAL_INFORMATION" (asking about tenancy, room, contract)
  - "PORTFOLIO_OVERVIEW" (asking about owner portfolio, total revenue, rent collection, occupancy statistics)
  - "TENANT_LIST" (asking for list/roster of all tenants across properties)
  - "VACANCY_STATUS" (asking about vacant/occupied rooms and occupancy rate)
  - "OWNER_MAINTENANCE_OVERVIEW" (asking for cross-property maintenance tickets and resolution status)
  - "GENERAL_RENTAL_ASSISTANCE" (general questions, greetings)
- "entities": object with extracted details:
  - "category": (e.g. "APPLIANCE", "PLUMBING", "ELECTRICAL", "GENERAL")
  - "priority": ("LOW", "MEDIUM", "HIGH", "EMERGENCY")
  - "title": concise issue title if maintenance
  - "description": description of issue
  - "transactionRef": transaction ID if mentioned
  - "urgent": boolean if urgent

Return strictly JSON without any markdown formatting or code blocks.

User message: "${userMessage}"`;

    const res = await model.invoke([new HumanMessage(prompt)]);
    const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.intent) {
      return {
        intent: parsed.intent as IntentType,
        entities: parsed.entities || {},
        modelUsed,
      };
    }
  } catch (err: any) {
    if (err?.message?.includes('429') || err?.message?.includes('Quota') || err?.status === 429) {
      recordQuotaExhausted(45);
    }
    console.warn(`Gemini (${modelUsed}) dynamic intent parsing failed, falling back:`, err?.message || err);
  }
  return null;
}

/**
 * Dynamically analyzes user message for MULTIPLE intents using Gemini.
 * Returns an array of detected intents with entities and confirmation requirements.
 */
export async function dynamicAnalyzeMultiIntents(
  userMessage: string,
  customModel?: string,
  conversationHistory?: ChatTurn[]
): Promise<{
  intents: Array<{
    intent: IntentType;
    confidence: number;
    entities: Record<string, any>;
    requiresConfirmation?: boolean;
    confirmationPrompt?: string;
  }>;
  modelUsed?: string;
} | null> {
  const model = getGeminiModel(0.1, customModel);
  if (!model) return null;

  const modelUsed = getGeminiModelName(customModel);
  const cacheKey = `intent:${modelUsed}:${userMessage.toLowerCase().trim()}`;
  const cached = kcache.getCachedLlm(cacheKey);
  if (cached) {
    return cached;
  }

  const historyContext =
    Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? `\nRecent Conversation Dialogue (use this to resolve follow-up questions, pronouns like 'it', 'again', or topic continuity):\n${conversationHistory
          .slice(-4)
          .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
          .join('\n')}\n`
      : '';

  try {
    const prompt = `You are the multi-intent extraction engine for HavenDex, an AI-powered rental OS.
A single user message can contain ONE OR MULTIPLE intents.
Analyze the message and extract ALL distinct intents as a JSON array.
${historyContext}
Possible intent values:
- "PAYMENT_STATUS": asking if rent is paid, checking payment status
- "RENT_DUE": asking when rent is due, due date, invoice schedule
- "PAYMENT_VALIDATION": validating/confirming a payment transaction
- "MAINTENANCE_REPORT": reporting broken items, leaks, AC issues, repair needs
- "MAINTENANCE_STATUS": inquiring about status of existing maintenance issues
- "OWNER_NOTIFICATION": explicitly requesting to inform/notify/tell the property owner
- "PORTFOLIO_OVERVIEW": asking about owner portfolio, total revenue, rent collections, overall metrics
- "TENANT_LIST": asking for roster of active tenants across properties
- "VACANCY_STATUS": asking about vacant rooms, available units, occupancy rates
- "OWNER_MAINTENANCE_OVERVIEW": asking about all maintenance tickets across properties
- "PROPERTY_INFORMATION": asking about property amenities, address, rules
- "RENTAL_INFORMATION": asking about lease, room, tenancy contract
- "GENERAL_RENTAL_ASSISTANCE": greetings or general inquiries

For each intent, provide:
- "intent": one of the above
- "confidence": number between 0.0 and 1.0
- "entities": object with extracted parameters (e.g., category, priority, title, description, transactionRef, message, urgent)
- "requiresConfirmation": boolean (true ONLY for sensitive operations like executing financial transactions or lease termination)
- "confirmationPrompt": if requiresConfirmation is true, clear prompt asking the user to confirm

Example user message: "My rent is paid, confirm it and tell the owner my AC isn't working."
Expected response:
[
  { "intent": "PAYMENT_VALIDATION", "confidence": 0.95, "entities": {} },
  { "intent": "MAINTENANCE_REPORT", "confidence": 0.95, "entities": { "category": "APPLIANCE", "priority": "HIGH", "title": "AC not working", "description": "Tenant reports AC is not working" } },
  { "intent": "OWNER_NOTIFICATION", "confidence": 0.9, "entities": { "message": "Tenant reported AC is not working", "urgent": true } }
]

Return ONLY a valid JSON array. No markdown code blocks.

User message: "${userMessage}"`;

    const res = await model.invoke([new HumanMessage(prompt)]);
    const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const result = {
        intents: parsed.map((item) => ({
          intent: item.intent as IntentType,
          confidence: item.confidence || 0.9,
          entities: item.entities || {},
          requiresConfirmation: item.requiresConfirmation || false,
          confirmationPrompt: item.confirmationPrompt,
        })),
        modelUsed,
      };
      kcache.setCachedLlm(cacheKey, result);
      return result;
    }
  } catch (err: any) {
    if (err?.message?.includes('429') || err?.message?.includes('Quota') || err?.status === 429) {
      recordQuotaExhausted(45);
    }
    console.warn(`Gemini (${modelUsed}) dynamic multi-intent parsing failed, falling back:`, err?.message || err);
  }
  return null;
}

/**
 * Dynamically selects required tools from available registry using the configured Gemini model.
 */
export async function dynamicPlanTools(
  userMessage: string,
  intent: string,
  availableTools: string[],
  customModel?: string
): Promise<string[] | null> {
  const model = getGeminiModel(0.1, customModel);
  if (!model) return null;

  const modelUsed = getGeminiModelName(customModel);

  try {
    const prompt = `You are the tool planning engine for HavenDex AI rental assistant.
User query: "${userMessage}"
Detected intent: "${intent}"

Available typed tools:
${JSON.stringify(availableTools)}

Select the minimal sequence of tools needed to fulfill the user's request.
Return ONLY a JSON array of tool names. Example: ["getRentStatus"] or ["createMaintenanceIssue", "createMaintenanceTask", "notifyOwner"].
Return strictly JSON array without markdown formatting.`;

    const res = await model.invoke([new HumanMessage(prompt)]);
    const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.every((t) => availableTools.includes(t))) {
      return parsed;
    }
  } catch (err) {
    console.warn(`Gemini (${modelUsed}) dynamic tool planning failed, falling back:`, err);
  }
  return null;
}

/**
 * Dynamically synthesizes natural language response using the configured Gemini model grounded in tool execution results.
 * Supports multi-turn dialogue context, multilingual responses (Hindi, Indian English, etc.), and strict role isolation (TENANT vs OWNER).
 * Also returns 2-3 context-aware suggested follow-up questions.
 */
export async function dynamicSynthesizeResponse(
  userMessage: string,
  intent: string,
  toolResults: Record<string, any>,
  context: any,
  customModel?: string,
  languageCode?: string,
  userRole?: string,
  conversationHistory?: ChatTurn[]
): Promise<{ userResponse: string; suggestedFollowUps: string[] } | null> {
  const model = getGeminiModel(0.3, customModel);
  if (!model) return null;

  const modelUsed = getGeminiModelName(customModel);
  const targetLanguage = languageCode && languageCode.startsWith('hi') ? 'Hindi (हिन्दी)' : 'English (Indian context)';

  // Role-specific persona & boundary enforcement
  const roleInstructions =
    userRole === 'OWNER' || userRole === 'PROPERTY_MANAGER'
      ? `You are HavenDex Manager, an executive property management AI copilot.
You have full access to portfolio-level data: all tenancies, property revenue, rent collections, occupancy metrics, and cross-property maintenance triage.
Provide strategic, concise operational insights for property management.`
      : `You are Haven, a friendly and empathetic tenant AI companion for HavenDex.
CRITICAL ROLE RESTRICTIONS:
- You ONLY assist the tenant with their own rental details, their own rent schedule, their own maintenance issues, and their lease.
- If the user asks about property revenue, other tenants' private details, occupancy rates, or owner-level portfolio financial metrics, politely decline:
  "I can only help you with your personal tenancy details, rent payments, and maintenance requests."
- Never expose private landlord financials or other tenants' data.`;

  const ragResults = toolResults.searchKnowledgeBase?.output?.results;
  const ragSection =
    Array.isArray(ragResults) && ragResults.length > 0
      ? `\nRetrieved Knowledge Base (RAG Grounding from Cognee/PostgreSQL Knowledge Graph):\n${ragResults.map((r: any) => `• [${r.category}] ${r.summary}`).join('\n')}\n`
      : '';

  const historySection =
    Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? `\nRecent Conversation History:\n${conversationHistory
          .slice(-6)
          .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
          .join('\n')}\n`
      : '';

  try {
    const prompt = `${roleInstructions}
${historySection}
The user asked: "${userMessage}"
Detected Intent(s): "${intent}"
Target Language: ${targetLanguage}
User Role: ${userRole || 'TENANT'}

Ground-truth domain service execution results:
${JSON.stringify(toolResults, null, 2)}
${ragSection}
Rental Context:
${JSON.stringify(context, null, 2)}

Instructions:
1. Synthesize a warm, helpful, professional, concise response to the user in ${targetLanguage}.
2. Maintain continuity with the prior conversation history. If the user asked a follow-up question (e.g. "What was the password again?" or "Tell the owner"), answer directly using the previous conversation context and results.
3. Respect the role boundaries specified above.
4. If multiple actions were executed, clearly report each one (e.g. Payment status confirmed, Maintenance issue created, Owner notified).
5. If an action failed, report its actual failure honestly. Never claim both succeeded if one failed!
6. Rely strictly on the ground-truth data from the tool results and knowledge base.
7. If the user asks about property rules, Wi-Fi credentials, mess/food timings, or amenities, provide the exact values retrieved from the knowledge base.
8. Do not invent any numbers, dates, or false facts.
9. Keep the response concise and clearly formatted.
10. At the very end of your response, provide exactly 2 or 3 contextual follow-up questions the user might ask next, formatted as:
Follow-up questions:
- [Question 1]
- [Question 2]
- [Question 3]

Response:`;

    const res = await model.invoke([new HumanMessage(prompt)]);
    const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);

    // Extract follow-up questions if provided in the model output
    let userResponse = content.trim();
    let suggestedFollowUps: string[] = [];

    const followUpMarker = /Follow-up questions:?\s*([\s\S]*)$/i;
    const match = userResponse.match(followUpMarker);
    if (match && match[1]) {
      const questionsBlock = match[1].trim();
      suggestedFollowUps = questionsBlock
        .split('\n')
        .map((line) => line.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter((line) => line.length > 0 && line.length < 80)
        .slice(0, 3);
      userResponse = userResponse.replace(followUpMarker, '').trim();
    }

    // If model didn't provide follow-ups, generate intelligent contextual defaults
    if (suggestedFollowUps.length === 0) {
      suggestedFollowUps = generateContextualFollowUps(intent, userRole, toolResults, userMessage);
    }

    return {
      userResponse,
      suggestedFollowUps,
    };
  } catch (err: any) {
    if (err?.message?.includes('429') || err?.message?.includes('Quota') || err?.status === 429) {
      recordQuotaExhausted(45);
    }
    console.warn(`Gemini (${modelUsed}) dynamic response synthesis failed, falling back:`, err?.message || err);
  }
  return null;
}


