'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  RefreshCw,
  Home,
  CreditCard,
  Wrench,
  ChevronDown,
  X,
  Copy,
  Check,
  Zap,
  Star,
  Camera,
  Layers,
  Info,
} from 'lucide-react';

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
import { AIExecutionResponse, ExecutionStep } from '@/lib/ai/types';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import {
  SUPPORTED_LLM_MODELS,
  SUPPORTED_STT_MODELS,
  SUPPORTED_TTS_MODELS,
  SUPPORTED_VISION_MODELS,
} from '@/lib/voice/sarvam';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  timestamp: string;
  modelUsed?: string;
  executionSteps?: ExecutionStep[];
  plannedActions?: string[];
  results?: Record<string, any>;
  intent?: string;
  previousRelatedIssue?: {
    id: string;
    title: string;
    status: string;
    resolution?: string | null;
    verifiedAt?: string;
    isRepeated: boolean;
  };
  isRepeatedIssue?: boolean;
  followUps?: string[];
}

const THINKING_MESSAGES = [
  'Thinking...',
  'Checking your records...',
  'Coordinating with rental agent...',
  'Synthesizing response...',
];

const QUICK_PROMPTS = [
  {
    icon: CreditCard,
    title: 'Rent status',
    desc: 'Is my rent for this month confirmed paid?',
    prompt: 'Is my rent paid for this month?',
    color: 'text-emerald-400',
  },
  {
    icon: Wrench,
    title: 'Report AC issue',
    desc: 'Log air conditioning malfunction and dispatch repair',
    prompt: 'My AC is not working properly. Please report this to the owner.',
    color: 'text-amber-400',
  },
  {
    icon: Home,
    title: 'Lease details',
    desc: 'Check room, monthly rent, and agreement info',
    prompt: 'Show me my current tenancy details and lease terms.',
    color: 'text-indigo-400',
  },
  {
    icon: Camera,
    title: 'Photo issue report',
    desc: 'Attach an image to report a leak or repair need',
    prompt: 'I have a maintenance issue with photo evidence attached.',
    color: 'text-sky-400',
  },
];

const FOLLOW_UPS: Record<string, string[]> = {
  payment: ['Download rent receipt', 'When is my next rent due?', 'Show payment history'],
  maintenance: ['Check repair progress', 'Report another issue', 'Tell the owner it is urgent'],
  lease: ['Who is my property manager?', 'Show security deposit status', 'What are house rules?'],
  default: ['Is my rent paid?', 'My AC is not working', 'Show my room details'],
};

function getFollowUps(intent?: string): string[] {
  if (!intent) return FOLLOW_UPS.default;
  if (intent.includes('PAYMENT') || intent.includes('RENT')) return FOLLOW_UPS.payment;
  if (intent.includes('MAINTENANCE') || intent.includes('ISSUE')) return FOLLOW_UPS.maintenance;
  if (intent.includes('LEASE') || intent.includes('TENANCY')) return FOLLOW_UPS.lease;
  return FOLLOW_UPS.default;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState(THINKING_MESSAGES[0]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [rentalContext, setRentalContext] = useState<any>(null);
  const [showVoice, setShowVoice] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active Model State
  const [selectedLlm, setSelectedLlm] = useState<string>('gemini-3.8-flash');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thinkingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isLoading) {
      let i = 0;
      thinkingRef.current = setInterval(() => {
        i = (i + 1) % THINKING_MESSAGES.length;
        setThinkingText(THINKING_MESSAGES[i]);
      }, 1600);
    } else {
      if (thinkingRef.current) clearInterval(thinkingRef.current);
    }
    return () => {
      if (thinkingRef.current) clearInterval(thinkingRef.current);
    };
  }, [isLoading]);

  // Adjust textarea height dynamically like ChatGPT
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputMessage]);

  async function fetchContext() {
    try {
      const res = await fetch('/api/assistant/context');
      if (res.ok) {
        const data = await res.json();
        setRentalContext(data);
      }
    } catch {
      // Non-blocking
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }

    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setSelectedImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const textToSend = (messageText || inputMessage).trim();
    if ((!textToSend && !selectedImage) || isLoading) return;

    const currentImage = selectedImage;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend || (currentImage ? 'Attached maintenance repair photo.' : ''),
      imageUrl: currentImage || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setSelectedImage(null);
    setSelectedImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);
    setThinkingText(THINKING_MESSAGES[0]);

    try {
      // If user uploaded an image and reported a problem, analyze with sarvam-vision first
      let visionAnalysisText = '';
      if (currentImage) {
        try {
          const visionRes = await fetch('/api/maintenance/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: currentImage,
              description: textToSend,
            }),
          });
          if (visionRes.ok) {
            const vData = await visionRes.json();
            if (vData.analysis) {
              visionAnalysisText = ` [AI Vision Analysis (sarvam-vision): ${vData.analysis} (Confidence: ${Math.round((vData.confidence || 0.9) * 100)}%)]`;
            }
          }
        } catch (vErr) {
          console.warn('Vision analysis skipped:', vErr);
        }
      }

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend + visionAnalysisText,
          sessionId: activeSessionId,
          modelName: selectedLlm,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Something went wrong');
      }

      const data: AIExecutionResponse = await res.json();
      if (data.sessionId) setActiveSessionId(data.sessionId);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: data.userResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedLlm,
        executionSteps: data.executionSteps,
        plannedActions: data.plannedActions,
        results: data.results,
        intent: data.intent,
        previousRelatedIssue: data.previousRelatedIssue,
        isRepeatedIssue: data.isRepeatedIssue,
        followUps: getFollowUps(data.intent),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      fetchContext();
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: "I ran into a temporary issue connecting with the model. Please check your connection or try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          followUps: ['Is my rent paid?', 'My AC is not working', 'Try again'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, selectedImage, isLoading, activeSessionId, selectedLlm]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveSessionId(undefined);
    setSelectedImage(null);
    setSelectedImageFile(null);
  };

  const activeModelMeta = SUPPORTED_LLM_MODELS.find((m) => m.id === selectedLlm) || SUPPORTED_LLM_MODELS[0];

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] max-w-4xl mx-auto px-2 sm:px-4">
      {/* Top ChatGPT Bar */}
      <div className="flex items-center justify-between py-2 border-b border-slate-800/80 shrink-0">
        {/* Model Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-sm font-semibold text-slate-200 transition-colors shadow-sm"
          >
            <div className="h-5 w-5 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span>{activeModelMeta.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-normal">
              {activeModelMeta.badge}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400 border-b border-slate-800/60 flex items-center justify-between">
                <span>Select LLM Model</span>
                <span className="text-slate-500 font-mono text-[10px]">Google Gemini</span>
              </div>
              <div className="p-1 space-y-1">
                {SUPPORTED_LLM_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedLlm(model.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                      selectedLlm === model.id
                        ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    {model.badge === 'Recommended' ? (
                      <Zap className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    ) : model.badge === 'Best Quality' ? (
                      <Star className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{model.label}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {model.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{model.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Models Architecture Overview Pill */}
          <button
            onClick={() => setShowModelModal(true)}
            title="View configured AI & Voice models"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span>AI Models & Voice</span>
          </button>

          {/* Voice Assistant Toggle */}
          <button
            onClick={() => setShowVoice(!showVoice)}
            aria-label={showVoice ? 'Switch to chat' : 'Switch to voice'}
            className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all ${
              showVoice
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            {showVoice ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            aria-label="New chat"
            title="Start new conversation"
            className="h-8 w-8 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Voice Assistant Overlay */}
      {showVoice && (
        <div className="shrink-0 my-3 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/80 shadow-2xl">
          <VoiceAssistant
            activeSessionId={activeSessionId}
            onExecutionComplete={(res) => {
              if (res.sessionId) setActiveSessionId(res.sessionId);
              fetchContext();
            }}
          />
        </div>
      )}

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6 no-scrollbar">
        {messages.length === 0 && !showVoice ? (
          /* Clean ChatGPT Empty State */
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-600/20 mb-4">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">How can Haven help you today?</h2>
            <p className="text-sm text-slate-400 max-w-md mb-8">
              Ask about your rent payments, report room repairs with photos, or inspect lease agreements.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
              {QUICK_PROMPTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon className={`h-4 w-4 ${item.color}`} />
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="w-full">
              {msg.sender === 'user' ? (
                /* User Message (Right Aligned Bubble) */
                <div className="flex justify-end items-end gap-2">
                  <div className="max-w-[85%] sm:max-w-[75%] space-y-2">
                    {msg.imageUrl && (
                      <div className="rounded-2xl overflow-hidden border border-slate-700/60 shadow-lg">
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded evidence"
                          className="max-h-60 rounded-2xl object-cover"
                        />
                      </div>
                    )}
                    <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-md shadow-indigo-600/10">
                      <p className="whitespace-pre-line">{msg.text}</p>
                      <span className="block text-[10px] text-indigo-200/70 mt-1 text-right">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Assistant Message (ChatGPT style left aligned layout) */
                <div className="flex items-start gap-3.5 group">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-indigo-600/20">
                    <Sparkles className="h-4 w-4" />
                  </div>

                  <div className="flex-1 space-y-3 max-w-[90%]">
                    {/* Repeated Issue Banner */}
                    {msg.previousRelatedIssue && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
                        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-amber-300">Previous Record Linked: </span>
                          <span>
                            {msg.previousRelatedIssue.title} ({msg.previousRelatedIssue.status}). High priority flag assigned.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* AI Message Text */}
                    <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                      {msg.text}
                    </div>

                    {/* Footer with Model Name & Copy Action */}
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                      <span className="font-mono">{msg.modelUsed || selectedLlm}</span>
                      <span>·</span>
                      <span>{msg.timestamp}</span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="flex items-center gap-1 hover:text-slate-300 transition-colors ml-2"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Follow-up Prompts */}
                    {msg.followUps && msg.followUps.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.followUps.map((fu) => (
                          <button
                            key={fu}
                            onClick={() => handleSendMessage(fu)}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 text-xs text-slate-300 hover:text-white transition-all disabled:opacity-50"
                          >
                            {fu}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3.5 animate-in fade-in duration-200">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-indigo-600/20">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{thinkingText}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ChatGPT Input Capsule */}
      <div className="shrink-0 pb-3 pt-2">
        {/* Attached image preview capsule */}
        {selectedImage && (
          <div className="flex items-center gap-2 mb-2 p-1.5 pr-3 rounded-xl bg-slate-900 border border-slate-800 w-fit max-w-sm">
            <img src={selectedImage} alt="Attachment" className="h-10 w-10 rounded-lg object-cover" />
            <div className="text-xs text-slate-300 truncate">
              {selectedImageFile?.name || 'Photo evidence attached'}
            </div>
            <button
              onClick={removeSelectedImage}
              className="h-6 w-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white ml-auto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Input box */}
        <div className="relative rounded-3xl bg-slate-900 border border-slate-800 shadow-xl focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Haven (e.g., 'Is my rent paid?', attach photo to report repair)..."
            disabled={isLoading}
            className="w-full bg-transparent px-4 pt-3.5 pb-12 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none no-scrollbar"
          />

          {/* Bottom Bar inside Input Capsule */}
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
            {/* Left buttons: Image Upload */}
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="chat-image-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach photo of repair or room issue"
                className="h-8 px-2.5 rounded-xl text-xs flex items-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
              >
                <PaperclipIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Attach photo</span>
              </button>
            </div>

            {/* Right: Send Button */}
            <Button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!inputMessage.trim() && !selectedImage)}
              className="h-8 w-8 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white p-0 flex items-center justify-center transition-all disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-2">
          Haven AI v2 · Role-segregated for tenant privacy · Powered by Google Gemini & Sarvam AI
        </p>
      </div>

      {/* Model Overview Modal */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">AI Model & Speech Architecture</h3>
              </div>
              <button
                onClick={() => setShowModelModal(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 pt-4 text-xs">
              {/* LLM Models */}
              <div>
                <h4 className="font-semibold text-indigo-300 uppercase tracking-wider text-[11px] mb-2">
                  🧠 LLM Text Models (Reasoning & Intent)
                </h4>
                <div className="space-y-2">
                  {SUPPORTED_LLM_MODELS.map((m) => (
                    <div key={m.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-200">{m.label}</span>
                        <span className="ml-2 font-mono text-slate-400 text-[10px]">{m.id}</span>
                        <p className="text-slate-400 mt-0.5">{m.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-900/40 text-indigo-300 font-mono text-[10px]">
                        {m.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Speech Models */}
              <div>
                <h4 className="font-semibold text-emerald-300 uppercase tracking-wider text-[11px] mb-2">
                  🎙️ Voice & Speech Models (Indic Languages)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="font-semibold text-slate-200 mb-1">STT (Speech-to-Text)</div>
                    {SUPPORTED_STT_MODELS.map((stt) => (
                      <div key={stt.id} className="text-[11px] text-slate-400 mt-1">
                        <span className="font-medium text-slate-300">{stt.label}</span> ({stt.provider})
                        <span className="ml-1 text-[10px] text-emerald-400">{stt.badge}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="font-semibold text-slate-200 mb-1">TTS (Text-to-Speech)</div>
                    {SUPPORTED_TTS_MODELS.map((tts) => (
                      <div key={tts.id} className="text-[11px] text-slate-400 mt-1">
                        <span className="font-medium text-slate-300">{tts.label}</span> ({tts.provider})
                        <span className="ml-1 text-[10px] text-emerald-400">{tts.badge}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vision Models */}
              <div>
                <h4 className="font-semibold text-amber-300 uppercase tracking-wider text-[11px] mb-2">
                  📸 Vision Models (Photo Repair Analysis)
                </h4>
                <div className="space-y-2">
                  {SUPPORTED_VISION_MODELS.map((v) => (
                    <div key={v.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-200">{v.label}</span>
                        <p className="text-slate-400 mt-0.5">{v.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-amber-900/40 text-amber-300 font-mono text-[10px]">
                        {v.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <Button
                onClick={() => setShowModelModal(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
