import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { IntentType } from './types';

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
 * Checks if a valid Gemini API key is present in environment variables.
 */
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

export function isGeminiConfigured(): boolean {
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
  const apiKey = getGeminiApiKey();
  if (!apiKey || !isGeminiConfigured()) return null;

  const modelName = getGeminiModelName(customModel);

  return new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey,
    temperature,
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
  } catch (err) {
    console.warn(`Gemini (${modelUsed}) dynamic intent parsing failed, falling back:`, err);
  }
  return null;
}

/**
 * Dynamically analyzes user message for MULTIPLE intents using Gemini.
 * Returns an array of detected intents with entities and confirmation requirements.
 */
export async function dynamicAnalyzeMultiIntents(
  userMessage: string,
  customModel?: string
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

  try {
    const prompt = `You are the multi-intent extraction engine for HavenDex, an AI-powered rental OS.
A single user message can contain ONE OR MULTIPLE intents.
Analyze the message and extract ALL distinct intents as a JSON array.

Possible intent values:
- "PAYMENT_STATUS": asking if rent is paid, checking payment status
- "RENT_DUE": asking when rent is due, due date, invoice schedule
- "PAYMENT_VALIDATION": validating/confirming a payment transaction
- "MAINTENANCE_REPORT": reporting broken items, leaks, AC issues, repair needs
- "MAINTENANCE_STATUS": inquiring about status of existing maintenance issues
- "OWNER_NOTIFICATION": explicitly requesting to inform/notify/tell the property owner
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
      return {
        intents: parsed.map((item) => ({
          intent: item.intent as IntentType,
          confidence: item.confidence || 0.9,
          entities: item.entities || {},
          requiresConfirmation: item.requiresConfirmation || false,
          confirmationPrompt: item.confirmationPrompt,
        })),
        modelUsed,
      };
    }
  } catch (err) {
    console.warn(`Gemini (${modelUsed}) dynamic multi-intent parsing failed, falling back:`, err);
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
 * Supports multilingual responses (Hindi, Indian English, etc.).
 */
export async function dynamicSynthesizeResponse(
  userMessage: string,
  intent: string,
  toolResults: Record<string, any>,
  context: any,
  customModel?: string,
  languageCode?: string
): Promise<string | null> {
  const model = getGeminiModel(0.3, customModel);
  if (!model) return null;

  const modelUsed = getGeminiModelName(customModel);
  const targetLanguage = languageCode && languageCode.startsWith('hi') ? 'Hindi (हिन्दी)' : 'English (Indian context)';

  try {
    const prompt = `You are HavenDex, an AI rental assistant teammate.
The user asked: "${userMessage}"
Intent(s): "${intent}"
Target Language: ${targetLanguage}

Ground-truth domain service execution results:
${JSON.stringify(toolResults, null, 2)}

Rental Context:
${JSON.stringify(context, null, 2)}

Instructions:
1. Synthesize a warm, helpful, professional, concise response to the user in ${targetLanguage}.
2. If multiple actions were executed, clearly report each one (e.g. Payment status confirmed, Maintenance issue created, Owner notified).
3. If an action failed, report its actual failure honestly (e.g. "Payment: Confirmed, Maintenance: Could not create task"). Never claim both succeeded if one failed!
4. Rely strictly on the ground-truth data from the tool results.
5. Do not invent any numbers, dates, or false facts.
6. Keep the response concise (2-4 sentences max).

Response:`;

    const res = await model.invoke([new HumanMessage(prompt)]);
    const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    return content.trim();
  } catch (err) {
    console.warn(`Gemini (${modelUsed}) dynamic response synthesis failed, falling back:`, err);
  }
  return null;
}

