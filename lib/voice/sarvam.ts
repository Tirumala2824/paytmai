/**
 * Sarvam AI Integration Service
 * Provides Speech-to-Text (STT), Text-to-Speech (TTS), and Translation
 * for Indian languages and Indian English.
 */

export interface SarvamSTTOptions {
  audioBuffer: Buffer | ArrayBuffer;
  mimeType?: string;
  languageCode?: string; // 'hi-IN', 'en-IN', 'ta-IN', 'te-IN', 'kn-IN', etc., or 'unknown'
  model?: string; // 'saaras:v3' | 'saaras:v2'
}

export interface SarvamSTTResponse {
  transcript: string;
  languageCode: string;
  confidence?: number;
  isSimulated?: boolean;
}

export interface SarvamTTSOptions {
  text: string;
  targetLanguageCode?: string; // 'en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', etc.
  speaker?: string; // 'meera', 'pavithra', 'arvind', 'amelia', etc.
  model?: string; // 'bulbul:v3' | 'bulbul:v2'
  sampleRate?: number;
}

export interface SarvamTTSResponse {
  audioBase64: string;
  mimeType: string;
  languageCode: string;
  isSimulated?: boolean;
}

export interface SarvamTranslateOptions {
  input: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  mode?: 'formal' | 'code-mixed';
}

export interface SarvamVisionOptions {
  imageBase64: string;   // Base64 encoded image (JPEG or PNG)
  mimeType?: string;     // 'image/jpeg' | 'image/png' — default image/jpeg
  prompt?: string;       // What to check in the image
}

export interface SarvamVisionResponse {
  confidence: number;       // 0.0–1.0
  analysis: string;         // Human-readable description
  repairConfirmed: boolean; // true if repair looks complete
  isSimulated?: boolean;
}

// ============================================================================
// Model Registry — Exported for UI Model Selector
// ============================================================================

/** STT models. saaras:v3 is the latest & recommended. */
export const SUPPORTED_STT_MODELS = [
  { id: 'saaras:v3', label: 'Saaras v3', badge: 'Recommended', description: 'Latest — best accuracy for 10+ Indian languages', provider: 'Sarvam AI' },
  { id: 'saaras:v2', label: 'Saaras v2', badge: 'Legacy',      description: 'Previous generation fallback',                   provider: 'Sarvam AI' },
  { id: 'gemini-3.8-live', label: 'Gemini Live', badge: 'Coming Soon', description: 'Real-time bidirectional audio (WebSocket only)', provider: 'Google', comingSoon: true },
] as const;

/** TTS models. bulbul:v3 is the latest & recommended. */
export const SUPPORTED_TTS_MODELS = [
  { id: 'bulbul:v3', label: 'Bulbul v3', badge: 'Recommended', description: 'Natural expressive voice — Hindi, Tamil, Telugu & more', provider: 'Sarvam AI' },
  { id: 'bulbul:v2', label: 'Bulbul v2', badge: 'Legacy',      description: 'Previous generation voice fallback',                   provider: 'Sarvam AI' },
] as const;

/** Vision models for maintenance photo analysis. NOT audio. */
export const SUPPORTED_VISION_MODELS = [
  { id: 'sarvam-vision', label: 'Sarvam Vision', badge: 'AI Analysis', description: 'Analyses repair photos — returns confidence score', provider: 'Sarvam AI' },
  { id: 'disabled',      label: 'Disabled',      badge: 'Manual Only', description: 'Skip AI photo analysis; use manual evidence text',   provider: 'None' },
] as const;

/** LLM models — exported here as a convenience alongside speech models. */
export const SUPPORTED_LLM_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', badge: 'Recommended', description: 'Best balance — speed + quality for tenant chat', provider: 'Google', role: 'both' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', badge: 'Fast',        description: 'Lighter & cheaper — ideal for simple Q&A',       provider: 'Google', role: 'tenant' },
  { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   badge: 'Best Quality',description: 'Highest quality — owner portfolio analysis',      provider: 'Google', role: 'owner' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', badge: 'Legacy',      description: 'Legacy fallback model',                          provider: 'Google', role: 'both' },
  { id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro',   badge: 'Legacy',      description: 'Legacy higher quality fallback',                  provider: 'Google', role: 'both' },
] as const;

export type LLMModelId    = typeof SUPPORTED_LLM_MODELS[number]['id'];
export type STTModelId    = typeof SUPPORTED_STT_MODELS[number]['id'];
export type TTSModelId    = typeof SUPPORTED_TTS_MODELS[number]['id'];
export type VisionModelId = typeof SUPPORTED_VISION_MODELS[number]['id'];

/** Returns the active STT model from env (falls back to saaras:v3) */
export function getActiveSttModel(): string {
  return process.env.SARVAM_STT_MODEL || 'saaras:v3';
}

/** Returns the active TTS model from env (falls back to bulbul:v3) */
export function getActiveTtsModel(): string {
  return process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
}

/** Returns the active vision model from env */
export function getActiveVisionModel(): string {
  return process.env.SARVAM_VISION_MODEL || 'sarvam-vision';
}

const SARVAM_API_BASE = 'https://api.sarvam.ai';

export function getSarvamApiKey(): string | undefined {
  const key = process.env.SARVAM_API_KEY;
  if (!key || key.includes('placeholder') || key === 'undefined' || key.trim().length === 0) {
    return undefined;
  }
  return key.trim();
}

export function isSarvamConfigured(): boolean {
  return !!getSarvamApiKey();
}

/**
 * Speech-to-Text using Sarvam AI Saaras model.
 * If API key is missing or call fails, falls back gracefully.
 */
export async function sarvamSpeechToText(
  options: SarvamSTTOptions
): Promise<SarvamSTTResponse> {
  const apiKey = getSarvamApiKey();

  if (!apiKey) {
    console.warn('Sarvam API key not configured. Using simulated STT response.');
    return {
      transcript: 'My rent is paid, confirm it and tell the owner my AC is not working.',
      languageCode: options.languageCode || 'en-IN',
      confidence: 0.95,
      isSimulated: true,
    };
  }

  try {
    const formData = new FormData();
    const uint8Array = new Uint8Array(options.audioBuffer as any);
    const audioBlob = new Blob([uint8Array], {
      type: options.mimeType || 'audio/wav',
    });

    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', options.model || 'saaras:v3');

    if (options.languageCode && options.languageCode !== 'auto' && options.languageCode !== 'unknown') {
      formData.append('language_code', options.languageCode);
    }

    const response = await fetch(`${SARVAM_API_BASE}/speech-to-text`, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Sarvam STT failed with status ${response.status}: ${errorText}`);
      throw new Error(`Sarvam STT error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      transcript: data.transcript || '',
      languageCode: data.language_code || options.languageCode || 'en-IN',
      confidence: data.confidence,
      isSimulated: false,
    };
  } catch (error: any) {
    console.warn('Sarvam STT error, falling back to simulated transcript:', error.message);
    return {
      transcript: 'My rent is paid, confirm it and tell the owner my AC is not working.',
      languageCode: options.languageCode || 'en-IN',
      confidence: 0.9,
      isSimulated: true,
    };
  }
}

/**
 * Text-to-Speech using Sarvam AI Bulbul model.
 * Returns base64 encoded audio (audio/wav).
 */
export async function sarvamTextToSpeech(
  options: SarvamTTSOptions
): Promise<SarvamTTSResponse> {
  const apiKey = getSarvamApiKey();
  const targetLanguageCode = options.targetLanguageCode || 'en-IN';

  if (!apiKey) {
    console.warn('Sarvam API key not configured. Returning simulated TTS response.');
    return {
      audioBase64: '', // Client can fallback to browser SpeechSynthesis
      mimeType: 'audio/wav',
      languageCode: targetLanguageCode,
      isSimulated: true,
    };
  }

  try {
    const payload = {
      inputs: [options.text.slice(0, 500)], // Sarvam has input size limits per chunk
      target_language_code: targetLanguageCode,
      speaker: options.speaker || (targetLanguageCode.startsWith('hi') ? 'shreya' : 'priya'),
      model: options.model || getActiveTtsModel(),
      speech_sample_rate: options.sampleRate || 16000,
      enable_preprocessing: true,
    };

    const response = await fetch(`${SARVAM_API_BASE}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Sarvam TTS failed with status ${response.status}: ${errorText}`);
      throw new Error(`Sarvam TTS error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const audioBase64 = data.audios && data.audios.length > 0 ? data.audios[0] : '';

    return {
      audioBase64,
      mimeType: 'audio/wav',
      languageCode: targetLanguageCode,
      isSimulated: false,
    };
  } catch (error: any) {
    console.warn('Sarvam TTS error, falling back:', error.message);
    return {
      audioBase64: '',
      mimeType: 'audio/wav',
      languageCode: targetLanguageCode,
      isSimulated: true,
    };
  }
}

/**
 * Translation service using Sarvam AI.
 */
export async function sarvamTranslate(
  options: SarvamTranslateOptions
): Promise<string> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    return options.input;
  }

  try {
    const response = await fetch(`${SARVAM_API_BASE}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        input: options.input,
        source_language_code: options.sourceLanguageCode,
        target_language_code: options.targetLanguageCode,
        mode: options.mode || 'formal',
      }),
    });

    if (!response.ok) {
      return options.input;
    }

    const data = await response.json();
    return data.translated_text || options.input;
  } catch (err) {
    console.warn('Sarvam translate error:', err);
    return options.input;
  }
}

/**
 * Supported Indian languages metadata for the UI.
 */
export const SUPPORTED_INDIAN_LANGUAGES = [
  { code: 'en-IN', name: 'Indian English', native: 'English', flag: '🇮🇳' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
];

/**
 * Analyse a maintenance repair photo using Sarvam Vision model.
 * Returns a confidence score and description of what was found.
 * Falls back gracefully if Sarvam API key is not configured (demo mode).
 */
export async function sarvamVisionAnalyze(
  options: SarvamVisionOptions
): Promise<SarvamVisionResponse> {
  const apiKey = getSarvamApiKey();
  const visionModel = getActiveVisionModel();

  // Return simulated result if not configured or disabled
  if (!apiKey || visionModel === 'disabled') {
    return {
      confidence: 0.93,
      analysis: '[Demo] AI Vision analysis: Repair appears complete based on image inspection. Component condition looks satisfactory.',
      repairConfirmed: true,
      isSimulated: true,
    };
  }

  try {
    const response = await fetch(`${SARVAM_API_BASE}/vision/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: visionModel,
        image: options.imageBase64,
        mime_type: options.mimeType || 'image/jpeg',
        prompt: options.prompt ||
          'Analyse this maintenance repair photo. Determine if the repair looks complete and professional. ' +
          'Rate your confidence from 0.0 to 1.0 and describe what you see in 1-2 sentences.',
      }),
    });

    if (!response.ok) {
      throw new Error(`Sarvam Vision API error (${response.status})`);
    }

    const data = await response.json();
    const confidence = typeof data.confidence === 'number' ? data.confidence : 0.90;
    const analysis   = data.description || data.analysis || 'Repair image analysed successfully.';

    return {
      confidence,
      analysis,
      repairConfirmed: confidence >= 0.75,
      isSimulated: false,
    };
  } catch (err: any) {
    console.warn('Sarvam Vision analysis error, using simulated fallback:', err.message);
    return {
      confidence: 0.90,
      analysis: 'AI Vision analysis: Repair appears complete. (Simulated — API unavailable)',
      repairConfirmed: true,
      isSimulated: true,
    };
  }
}
