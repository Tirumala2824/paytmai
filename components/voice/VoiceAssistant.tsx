'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Send,
  Globe,
  Radio,
  Loader2,
} from 'lucide-react';
import { AIExecutionResponse, DetectedIntent, MultiIntentExecutionStatus } from '@/lib/ai/types';
import { SUPPORTED_INDIAN_LANGUAGES } from '@/lib/voice/sarvam';
import { LiveAgentTimeline } from './LiveAgentTimeline';

export type VoiceState = 'Idle' | 'Listening' | 'Processing' | 'Executing' | 'Completed' | 'Error';

interface VoiceAssistantProps {
  onStateChange?: (state: VoiceState) => void;
  onExecutionComplete?: (response: AIExecutionResponse) => void;
  selectedModel?: string;
  activeSessionId?: string;
}

export function VoiceAssistant({
  onStateChange,
  onExecutionComplete,
  selectedModel = 'gemini-1.5-flash',
  activeSessionId,
}: VoiceAssistantProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('Idle');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-IN');
  const [transcript, setTranscript] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('en-IN');
  const [executionResponse, setExecutionResponse] = useState<AIExecutionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Update parent state
  useEffect(() => {
    onStateChange?.(voiceState);
  }, [voiceState, onStateChange]);

  // Clean up timer and audio on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, []);

  const [isSimulatingFix, setIsSimulatingFix] = useState<boolean>(false);

  // Quick Multilingual Demonstration Scenarios
  const demoScenarios = [
    {
      label: 'Main Hackathon Demo (English)',
      lang: 'en-IN',
      text: "My rent is paid. Please confirm it and tell the owner that my AC isn't working again.",
      badge: 'Primary Canonical Demo',
    },
    {
      label: 'Main Hackathon Demo (Hindi)',
      lang: 'hi-IN',
      text: 'मेरा किराया भर दिया है, पुष्टि करें और मालिक को बताएं कि मेरा एसी काम नहीं कर रहा है',
      badge: 'Multilingual हिन्दी',
    },
    {
      label: 'Rent Inquiry',
      lang: 'en-IN',
      text: 'Is my rent paid?',
      badge: 'Payment Query',
    },
    {
      label: 'Urgent Maintenance',
      lang: 'en-IN',
      text: 'My AC is leaking water, please fix it urgently.',
      badge: 'Maintenance',
    },
  ];

  // ==========================================================================
  // MICROPHONE RECORDING (Web Audio API)
  // ==========================================================================
  async function startListening() {
    try {
      setErrorMessage('');
      setTranscript('');
      setExecutionResponse(null);
      setAudioUrl(null);
      setAudioBase64(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/wav',
        });
        await handleAudioProcess(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(200);

      setVoiceState('Listening');
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access or use the quick demo buttons below.'
          : `Microphone error: ${err.message}`
      );
      setVoiceState('Error');
    }
  }

  function stopListening() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function cancelListening() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    setVoiceState('Idle');
    setRecordingDuration(0);
  }

  // ==========================================================================
  // PROCESS AUDIO (Sarvam STT -> LangGraph Execution -> Sarvam TTS)
  // ==========================================================================
  async function handleAudioProcess(audioBlob: Blob) {
    setVoiceState('Processing');

    try {
      // 1. Send audio to Sarvam STT
      const formData = new FormData();
      formData.append('file', audioBlob, 'speech.wav');
      formData.append('languageCode', selectedLanguage);

      const sttRes = await fetch('/api/voice/stt', {
        method: 'POST',
        body: formData,
      });

      if (!sttRes.ok) {
        throw new Error('Sarvam Speech-to-Text conversion failed');
      }

      const sttData = await sttRes.json();
      const recognizedText = sttData.transcript || '';
      const recognizedLang = sttData.languageCode || selectedLanguage;

      setTranscript(recognizedText);
      setDetectedLanguage(recognizedLang);

      if (!recognizedText.trim()) {
        throw new Error('No speech was detected. Please try speaking again.');
      }

      // 2. Pass transcript to LangGraph Stateful AI Orchestrator
      await executeWorkflow(recognizedText, recognizedLang);
    } catch (err: any) {
      console.error('Voice processing error:', err);
      setErrorMessage(err.message || 'Error processing speech');
      setVoiceState('Error');
    }
  }

  // ==========================================================================
  // DIRECT TEXT / DEMO SCENARIO EXECUTION
  // ==========================================================================
  async function handleDemoScenario(scenario: (typeof demoScenarios)[0]) {
    setErrorMessage('');
    setTranscript(scenario.text);
    setSelectedLanguage(scenario.lang);
    setDetectedLanguage(scenario.lang);
    setAudioUrl(null);
    setAudioBase64(null);

    await executeWorkflow(scenario.text, scenario.lang);
  }

  async function executeWorkflow(text: string, lang: string, confirmed: boolean = false) {
    setVoiceState('Executing');

    try {
      const chatRes = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: activeSessionId,
          modelName: selectedModel,
          languageCode: lang,
          generateAudio: true,
          confirmedAction: confirmed,
        }),
      });

      if (!chatRes.ok) {
        const errJson = await chatRes.json();
        throw new Error(errJson.error || 'AI Orchestrator failed');
      }

      const data: AIExecutionResponse = await chatRes.json();
      setExecutionResponse(data);
      onExecutionComplete?.(data);

      // Handle Audio playback from Sarvam TTS
      if (data.audioBase64) {
        setAudioBase64(data.audioBase64);
        playBase64Audio(data.audioBase64);
      } else if (window.speechSynthesis && data.userResponse) {
        // Fallback to browser SpeechSynthesis
        playBrowserTTS(data.userResponse, lang);
      }

      setVoiceState('Completed');
    } catch (err: any) {
      console.error('Execution error:', err);
      setErrorMessage(err.message || 'Execution error');
      setVoiceState('Error');
    }
  }

  // ==========================================================================
  // AUDIO PLAYBACK
  // ==========================================================================
  function playBase64Audio(base64Data: string) {
    try {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      setAudioUrl(url);

      const audio = new Audio(url);
      audioElementRef.current = audio;

      audio.onplay = () => setIsPlayingAudio(true);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);

      audio.play().catch((e) => console.warn('Audio play autoplay prevented:', e));
    } catch (e) {
      console.warn('Failed to decode base64 audio:', e);
    }
  }

  function playBrowserTTS(text: string, lang: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang.startsWith('hi') ? 'hi-IN' : 'en-IN';
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  }

  function toggleAudioPlayback() {
    if (audioElementRef.current) {
      if (isPlayingAudio) {
        audioElementRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioElementRef.current.play();
        setIsPlayingAudio(true);
      }
    } else if (executionResponse?.userResponse) {
      if (isPlayingAudio) {
        window.speechSynthesis?.cancel();
        setIsPlayingAudio(false);
      } else {
        playBrowserTTS(executionResponse.userResponse, detectedLanguage);
      }
    }
  }

  function handleConfirmAction() {
    if (!executionResponse?.pendingConfirmation) return;
    executeWorkflow(
      `Confirm ${executionResponse.pendingConfirmation.action}`,
      selectedLanguage,
      true
    );
  }

  function resetToIdle() {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    window.speechSynthesis?.cancel();
    setVoiceState('Idle');
    setTranscript('');
    setExecutionResponse(null);
    setErrorMessage('');
    setIsPlayingAudio(false);
  }

  const stateColors: Record<VoiceState, { bg: string; border: string; text: string; dot: string }> = {
    Idle: { bg: 'bg-slate-900/70', border: 'border-slate-800', text: 'text-slate-300', dot: 'bg-slate-500' },
    Listening: { bg: 'bg-rose-950/40', border: 'border-rose-500/50', text: 'text-rose-300', dot: 'bg-rose-500 animate-ping' },
    Processing: { bg: 'bg-amber-950/40', border: 'border-amber-500/50', text: 'text-amber-300', dot: 'bg-amber-400 animate-pulse' },
    Executing: { bg: 'bg-indigo-950/40', border: 'border-indigo-500/50', text: 'text-indigo-300', dot: 'bg-indigo-400 animate-bounce' },
    Completed: { bg: 'bg-emerald-950/40', border: 'border-emerald-500/50', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    Error: { bg: 'bg-red-950/40', border: 'border-red-500/50', text: 'text-red-300', dot: 'bg-red-400' },
  };

  return (
    <div className="space-y-6">
      {/* Voice Status & Language Control Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`h-3 w-3 rounded-full ${stateColors[voiceState].dot}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Voice Assistant</span>
              <Badge className={`${stateColors[voiceState].bg} ${stateColors[voiceState].text} border ${stateColors[voiceState].border} text-[10px] uppercase font-bold tracking-wider`}>
                {voiceState}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Sarvam AI Multilingual Speech & Multi-Intent State Machine
            </p>
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-slate-400" />
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={voiceState === 'Listening' || voiceState === 'Processing' || voiceState === 'Executing'}
            className="bg-slate-950/80 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {SUPPORTED_INDIAN_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name} ({lang.native})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-black border border-slate-800 p-8 flex flex-col items-center justify-center text-center backdrop-blur-2xl shadow-2xl min-h-[280px]">
        {/* Glow ambient effect */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* STATE: IDLE */}
        {voiceState === 'Idle' && (
          <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-300">
            <button
              onClick={startListening}
              className="relative group h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none"
              title="Click to Speak"
            >
              <div className="absolute inset-0 rounded-full bg-indigo-400/20 animate-ping duration-1000 group-hover:block hidden" />
              <Mic className="h-10 w-10 text-white" />
            </button>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">Tap to Speak to HavenDex</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Speak naturally in English, Hindi, or choose an Indian language. Supports multiple actions in one sentence.
              </p>
            </div>
          </div>
        )}

        {/* STATE: LISTENING */}
        {voiceState === 'Listening' && (
          <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-300">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping duration-700" />
              <button
                onClick={stopListening}
                className="relative h-24 w-24 rounded-full bg-rose-600 flex items-center justify-center shadow-xl shadow-rose-600/40 hover:bg-rose-500 active:scale-95 transition-all focus:outline-none"
              >
                <Radio className="h-10 w-10 text-white animate-pulse" />
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-sm font-semibold text-rose-300">Listening... ({recordingDuration}s)</span>
              </div>
              <p className="text-xs text-slate-400">
                Tap button when finished speaking, or click Cancel.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={stopListening}
                className="bg-rose-950/60 border-rose-800/80 text-rose-200 hover:bg-rose-900/80 text-xs"
              >
                Done Speaking
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelListening}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* STATE: PROCESSING (Sarvam STT) */}
        {voiceState === 'Processing' && (
          <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-300">
            <div className="h-20 w-20 rounded-full bg-amber-950/50 border border-amber-500/40 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-amber-400 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Transcribing with Sarvam AI...</h3>
              <p className="text-xs text-slate-400">
                Converting Indian audio to text using Sarvam Saaras model
              </p>
            </div>
          </div>
        )}

        {/* STATE: EXECUTING (10-Node LangGraph Pipeline) */}
        {voiceState === 'Executing' && (
          <div className="flex flex-col items-center space-y-4 w-full max-w-lg animate-in fade-in duration-300">
            <div className="h-16 w-16 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Sparkles className="h-8 w-8 text-indigo-400 animate-pulse" />
            </div>
            <div className="space-y-1 text-center">
              <h3 className="text-sm font-semibold text-white">LangGraph Stateful Orchestration</h3>
              <p className="text-xs text-slate-400">
                Multi-Intent Detection → Plan → Authorize → Parallel Tool Execution
              </p>
            </div>
            {transcript && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 italic w-full text-center">
                &ldquo;{transcript}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* STATE: COMPLETED */}
        {voiceState === 'Completed' && executionResponse && (
          <div className="flex flex-col items-center space-y-6 w-full max-w-2xl animate-in fade-in duration-300">
            <div className="flex items-center justify-between w-full border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Execution Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-800 text-slate-300 text-[10px]">
                  Lang: {detectedLanguage}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToIdle}
                  className="h-7 text-xs bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> New Voice Query
                </Button>
              </div>
            </div>

            {/* Transcript Display */}
            {transcript && (
              <div className="w-full text-left bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                  User Spoke
                </div>
                <div className="text-xs font-medium text-slate-200">
                  &ldquo;{transcript}&rdquo;
                </div>
              </div>
            )}

            {/* Multi-Intent Breakdown Cards */}
            {executionResponse.intentBreakdown && executionResponse.intentBreakdown.length > 0 && (
              <div className="w-full text-left space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Detected Multi-Intents &amp; Parallel Outcomes
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {executionResponse.intentBreakdown.map((item, idx) => {
                    const isSuccess = item.status === 'SUCCESS';
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border ${
                          isSuccess
                            ? 'bg-emerald-950/20 border-emerald-800/40'
                            : 'bg-rose-950/20 border-rose-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] font-bold text-white truncate">
                            {item.intent.replace('_', ' ')}
                          </span>
                          <Badge
                            className={`text-[9px] px-1.5 py-0 uppercase font-bold ${
                              isSuccess
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {isSuccess ? '✓ Confirmed' : '✗ Failed'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-2">
                          {item.summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Synthesized Response & Audio Player */}
            <div className="w-full bg-slate-900/90 border border-indigo-950 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white">Assistant Response</span>
                </div>
                {/* Audio Controls */}
                <Button
                  size="sm"
                  onClick={toggleAudioPlayback}
                  className={`h-7 text-xs px-3 gap-1.5 ${
                    isPlayingAudio
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isPlayingAudio ? (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Pause Audio
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Play Voice (Sarvam TTS)
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {executionResponse.userResponse}
              </p>
            </div>

            {/* Sensitive Action Confirmation Prompt (if applicable) */}
            {executionResponse.pendingConfirmation && (
              <div className="w-full p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-left space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                    Confirmation Required
                  </span>
                </div>
                <p className="text-xs text-amber-100 font-medium">
                  {executionResponse.pendingConfirmation.prompt}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleConfirmAction}
                    className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    Confirm &amp; Proceed via Paytm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetToIdle}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Live 9-Stage Agent Execution Timeline */}
            <div className="w-full">
              <LiveAgentTimeline
                onSimulateFixAndVerify={async () => {
                  setIsSimulatingFix(true);
                  try {
                    await fetch('/api/maintenance/demo-step', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ step: 'STEP_2_FIX_AND_VERIFY' }),
                    });
                    // Re-run workflow to refresh context and memory
                    await executeWorkflow(
                      "My rent is paid. Please confirm it and tell the owner that my AC isn't working again.",
                      selectedLanguage
                    );
                  } catch (e) {
                    console.warn('Simulation error:', e);
                  } finally {
                    setIsSimulatingFix(false);
                  }
                }}
                isSimulatingFix={isSimulatingFix}
              />
            </div>
          </div>
        )}

        {/* STATE: ERROR */}
        {voiceState === 'Error' && (
          <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-300">
            <div className="h-16 w-16 rounded-full bg-red-950/60 border border-red-500/40 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Voice Assistant Error</h3>
              <p className="text-xs text-red-300 max-w-md">{errorMessage}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToIdle}
              className="bg-slate-900 border-slate-800 text-slate-300 hover:text-white text-xs mt-2"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Quick-Demo Scenarios (Canonical & Multilingual) */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-indigo-400" />
          Quick Multilingual Demonstration Scenarios
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {demoScenarios.map((scenario, index) => (
            <button
              key={index}
              onClick={() => handleDemoScenario(scenario)}
              disabled={voiceState === 'Listening' || voiceState === 'Processing' || voiceState === 'Executing'}
              className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 text-left transition-all group focus:outline-none disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  {scenario.label}
                </span>
                <Badge className="bg-indigo-950/60 text-indigo-300 border-indigo-800/60 text-[9px]">
                  {scenario.badge}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                &ldquo;{scenario.text}&rdquo;
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
