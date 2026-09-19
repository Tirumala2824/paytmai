/**
 * Sarvam AI Integration Service
 * Provides Speech-to-Text (STT), Text-to-Speech (TTS), and Translation
 * for Indian languages and Indian English.
 */

export interface SarvamSTTOptions {
  audioBuffer: Buffer | ArrayBuffer;
  mimeType?: string;
  languageCode?: string; // 'hi-IN', 'en-IN', 'ta-IN', 'te-IN', 'kn-IN', etc., or 'unknown'
  model?: string; // 'saaras:v1' or 'saaras:v2'
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
  model?: string; // 'bulbul:v1'
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
      model: options.model || 'bulbul:v3',
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
