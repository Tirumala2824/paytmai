'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Send,
  CheckCircle2,
  Mic,
  MicOff,
  RefreshCw,
  ArrowRight,
  Home,
  CreditCard,
  Wrench,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { AIExecutionResponse, ExecutionStep } from '@/lib/ai/types';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
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
  'Checking your account...',
  'Looking that up for you...',
  'Almost there...',
  'Pulling that information...',
];

const QUICK_ACTIONS = [
  { icon: CreditCard, label: 'Is my rent paid?', color: 'text-emerald-400' },
  { icon: Wrench, label: "My AC isn't working.", color: 'text-amber-400' },
  { icon: CreditCard, label: 'When is my rent due?', color: 'text-indigo-400' },
  { icon: Home, label: 'Show me my lease details.', color: 'text-violet-400' },
];

const FOLLOW_UPS: Record<string, string[]> = {
  payment: ['Show my payment history', 'Download rent receipt', 'When is next payment due?'],
  maintenance: ['Check issue status', 'Report another problem', 'Contact my property manager'],
  lease: ['Show my full lease', 'Who is my property manager?', 'How much is my deposit?'],
  default: ['What else can you help with?', 'Show my rent status', 'Any issues in my room?'],
};

function getFollowUps(intent?: string, results?: Record<string, any>): string[] {
  if (!intent) return FOLLOW_UPS.default;
  if (intent.includes('pay') || intent.includes('rent')) return FOLLOW_UPS.payment;
  if (intent.includes('maintenance') || intent.includes('issue') || intent.includes('repair')) return FOLLOW_UPS.maintenance;
  if (intent.includes('lease') || intent.includes('tenancy')) return FOLLOW_UPS.lease;
  return FOLLOW_UPS.default;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: "Hi there! 👋 I'm Haven, your rental companion.\n\nI can help you check your rent, report a problem in your room, get updates on repairs, or answer anything about your tenancy.\n\nWhat's on your mind today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      followUps: ['Is my rent paid?', "My AC isn't working.", 'When is my rent due?'],
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState(THINKING_MESSAGES[0]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [rentalContext, setRentalContext] = useState<any>(null);
  const [showVoice, setShowVoice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const thinkingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Cycle through friendly thinking messages
  useEffect(() => {
    if (isLoading) {
      let i = 0;
      thinkingRef.current = setInterval(() => {
        i = (i + 1) % THINKING_MESSAGES.length;
        setThinkingText(THINKING_MESSAGES[i]);
      }, 1800);
    } else {
      if (thinkingRef.current) clearInterval(thinkingRef.current);
    }
    return () => {
      if (thinkingRef.current) clearInterval(thinkingRef.current);
    };
  }, [isLoading]);

  async function fetchContext() {
    try {
      const res = await fetch('/api/assistant/context');
      if (res.ok) {
        const data = await res.json();
        setRentalContext(data);
      }
    } catch {
      // Silent fail — context is supplementary
    }
  }

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const textToSend = (messageText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    setThinkingText(THINKING_MESSAGES[0]);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          sessionId: activeSessionId,
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
        executionSteps: data.executionSteps,
        plannedActions: data.plannedActions,
        results: data.results,
        intent: data.intent,
        previousRelatedIssue: data.previousRelatedIssue,
        isRepeatedIssue: data.isRepeatedIssue,
        followUps: getFollowUps(data.intent, data.results),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      fetchContext();
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: "Sorry, I ran into a problem. Please try again in a moment.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          followUps: ['Try again', 'Check my rent status', 'Go back to home'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, activeSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewSession = () => {
    setMessages([
      {
        id: `welcome-fresh-${Date.now()}`,
        sender: 'assistant',
        text: "Fresh start! 🌱 What can I help you with today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        followUps: ['Check my rent', 'Report an issue', 'My lease details'],
      },
    ]);
    setActiveSessionId(undefined);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between py-3 px-1 mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Haven</h1>
            <p className="text-xs text-slate-400">Your rental companion</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Context pill */}
          {rentalContext?.tenancy && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Home className="h-3.5 w-3.5 text-indigo-400" />
              <span>Room {rentalContext.tenancy.roomNumber}</span>
              <span className="text-slate-600">·</span>
              <span className={rentalContext.rentSchedule?.isPaid ? 'text-emerald-400' : 'text-amber-400'}>
                Rent {rentalContext.rentSchedule?.isPaid ? 'paid ✓' : 'due'}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowVoice(!showVoice)}
            aria-label={showVoice ? 'Switch to text chat' : 'Switch to voice'}
            className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all ${
              showVoice
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            {showVoice ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            onClick={handleNewSession}
            aria-label="Start new conversation"
            title="Start fresh"
            className="h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/80 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Voice Mode */}
      {showVoice && (
        <div className="shrink-0 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 mb-4">
          <VoiceAssistant
            activeSessionId={activeSessionId}
            onExecutionComplete={(res) => {
              if (res.sessionId) setActiveSessionId(res.sessionId);
              fetchContext();
            }}
          />
        </div>
      )}

      {/* Quick action chips — shown only when no messages from user yet */}
      {messages.length === 1 && !showVoice && (
        <div className="shrink-0 mb-4">
          <p className="text-xs text-slate-500 mb-2 px-1">Common questions:</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => handleSendMessage(action.label)}
                  disabled={isLoading}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 hover:bg-indigo-900/20 text-left transition-all group disabled:opacity-50"
                >
                  <Icon className={`h-4 w-4 ${action.color} shrink-0`} />
                  <span className="text-xs text-slate-300 group-hover:text-white leading-snug">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 no-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 message-enter ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-indigo-600/20">
                <Sparkles className="h-4 w-4" />
              </div>
            )}

            <div className={`max-w-[82%] space-y-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              {/* Memory context banner */}
              {msg.sender === 'assistant' && msg.previousRelatedIssue && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">I remember this one —</span>
                    <span className="text-amber-200/80 ml-1">
                      {msg.previousRelatedIssue.title} was {msg.previousRelatedIssue.status.toLowerCase()} before.
                      {msg.previousRelatedIssue.resolution ? ` Resolution: ${msg.previousRelatedIssue.resolution}` : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Main bubble */}
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-900 border border-slate-800/80 text-slate-200 rounded-tl-sm shadow-sm'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
                <div className={`text-[10px] mt-2 ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-600'}`}>
                  {msg.timestamp}
                </div>
              </div>

              {/* Follow-up suggestions */}
              {msg.sender === 'assistant' && msg.followUps && msg.followUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {msg.followUps.slice(0, 3).map((fu) => (
                    <button
                      key={fu}
                      onClick={() => handleSendMessage(fu)}
                      disabled={isLoading}
                      className="suggestion-chip disabled:opacity-50"
                    >
                      {fu}
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start message-enter">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-600/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800/80 text-sm text-slate-400 rounded-tl-sm flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="thinking-dot h-2 w-2 rounded-full bg-indigo-400 inline-block" />
                <span className="thinking-dot h-2 w-2 rounded-full bg-indigo-400 inline-block" />
                <span className="thinking-dot h-2 w-2 rounded-full bg-indigo-400 inline-block" />
              </div>
              <span className="text-xs">{thinkingText}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="shrink-0 pt-3 border-t border-slate-800/60 mt-2">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your rental..."
            disabled={isLoading}
            aria-label="Type your message"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-60"
          />
          <Button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            aria-label="Send message"
            className="h-11 w-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white p-0 shadow-md shadow-indigo-600/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-center text-[11px] text-slate-600 mt-2">
          Haven uses AI · Your data stays private
        </p>
      </div>
    </div>
  );
}
