# HavenDex Voice Architecture (Sarvam AI Integration)

HavenDex integrates **Sarvam AI** for multilingual Indic voice capabilities, enabling tenants and owners across India to speak in Indian English, Hindi, and regional languages.

---

## 1. Supported Indian Languages

| Language | Code | Native Name | Flag |
|---|---|---|---|
| Indian English | `en-IN` | English | 🇮🇳 |
| Hindi | `hi-IN` | हिन्दी | 🇮🇳 |
| Tamil | `ta-IN` | தமிழ் | 🇮🇳 |
| Telugu | `te-IN` | తెలుగు | 🇮🇳 |
| Kannada | `kn-IN` | ಕನ್ನಡ | 🇮🇳 |
| Marathi | `mr-IN` | मराठी | 🇮🇳 |
| Bengali | `bn-IN` | বাংলা | 🇮🇳 |
| Gujarati | `gu-IN` | ગુજરાતી | 🇮🇳 |
| Malayalam | `ml-IN` | മലയാളം | 🇮🇳 |
| Punjabi | `pa-IN` | ਪੰਜਾਬੀ | 🇮🇳 |

---

## 2. Speech-to-Text (STT) - Sarvam Saaras

Voice audio recorded via the browser's `MediaRecorder` API is sent to `/api/voice/stt`:

```typescript
// lib/voice/sarvam.ts
export async function sarvamSpeechToText(options: SarvamSTTOptions): Promise<SarvamSTTResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', options.model || 'saaras:v3');
  formData.append('language_code', options.languageCode || 'en-IN');

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: formData,
  });

  const data = await response.json();
  return {
    transcript: data.transcript,
    languageCode: data.language_code,
    confidence: data.confidence,
  };
}
```

### Automatic Fallback (Deterministic Demo Mode)
If `SARVAM_API_KEY` is not configured or network connectivity is restricted, the service automatically uses simulated transcript parsing (`isSimulated: true`), ensuring reliable hackathon demonstrations.

---

## 3. Text-to-Speech (TTS) - Sarvam Bulbul

When HavenDex synthesizes a response, it can generate audio via Sarvam Bulbul (`bulbul:v3`):
- Speakers: `shreya` (Hindi), `priya` (Indian English), `meera`, `pavithra`.
- Audio format: `audio/wav` encoded as Base64.
- In the browser, `VoiceAssistant` automatically decodes and streams the audio buffer.
- If Sarvam TTS is offline, the browser's native `window.speechSynthesis` API is used as an instant, zero-latency fallback.

---

## 4. Voice Assistant UI Component

`components/voice/VoiceAssistant.tsx` provides:
- Live audio recording visualization with pulse indicators.
- Real-time timer and cancel controls.
- Canonical demo buttons for instant 1-click execution.
- Integrated `LiveAgentTimeline` displaying the 9-stage closed-loop execution.
- Audio play/pause controls for speech playback.
