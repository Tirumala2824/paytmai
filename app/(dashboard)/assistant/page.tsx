'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Building2,
  Home,
  CreditCard,
  Wrench,
  ChevronRight,
  RefreshCw,
  Zap,
  ArrowRight,
  Info,
  Layers,
  Terminal,
} from 'lucide-react';
import { AIExecutionResponse, ExecutionStep } from '@/lib/ai/types';
import { LIFECYCLE_STAGE_LABELS } from '@/lib/rental/lifecycle';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  executionSteps?: ExecutionStep[];
  plannedActions?: string[];
  results?: Record<string, any>;
  intent?: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Hello! I am your HavenDex AI rental assistant. I have full context of your tenancy, rent schedules, and maintenance status. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash');
  const [rentalContext, setRentalContext] = useState<any>(null);
  const [recentToolCalls, setRecentToolCalls] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedCommands = [
    'Is my rent paid?',
    'My rent is due when?',
    "My AC isn't working.",
    'Show my maintenance issues.',
    'Tell the owner my AC is broken.',
  ];

  // Fetch rental context on mount
  useEffect(() => {
    fetchContext();
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function fetchContext() {
    try {
      const res = await fetch('/api/assistant/context');
      if (res.ok) {
        const data = await res.json();
        setRentalContext(data);
        if (data.llmModel) {
          setSelectedModel(data.llmModel);
        }
      }
    } catch (err) {
      console.warn('Failed to load rental context:', err);
    }
  }

  async function handleSendMessage(messageText?: string) {
    const textToSend = messageText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          sessionId: activeSessionId,
          modelName: selectedModel,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to communicate with AI Assistant');
      }

      const data: AIExecutionResponse = await res.json();

      if (data.sessionId) {
        setActiveSessionId(data.sessionId);
      }

      if (data.toolCalls && data.toolCalls.length > 0) {
        setRecentToolCalls((prev) => [...data.toolCalls, ...prev].slice(0, 10));
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: data.userResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        executionSteps: data.executionSteps,
        plannedActions: data.plannedActions,
        results: data.results,
        intent: data.intent,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Refresh rental context to reflect any lifecycle state transitions or new issues
      fetchContext();
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ Error: ${error.message || 'Something went wrong while processing your request.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  const lifecycleStages = [
    'BOOKED',
    'RENT_DUE',
    'PAYMENT',
    'ISSUE',
    'ACTION',
    'FIXED',
    'VERIFIED',
  ];

  const currentStage = rentalContext?.tenancy?.lifecycleStage || 'RENT_DUE';
  const currentStageIndex = lifecycleStages.indexOf(currentStage);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-slate-950 border border-indigo-900/40 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                HavenDex AI Assistant
              </h1>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] uppercase font-bold">
                Phase 2 Active
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              One AI teammate for the entire rental relationship.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                rentalContext?.llmActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300">AI Engine:</span>
            <span
              className={`font-semibold ${
                rentalContext?.llmActive ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {rentalContext?.llmActive ? 'Gemini Active' : 'Safety Mode (Set GEMINI_API_KEY in .env)'}
            </span>
          </div>

          {/* Dynamic Model Selector */}
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs flex items-center gap-2">
            <span className="text-slate-400">Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:border-indigo-500 font-mono font-semibold"
            >
              {(rentalContext?.availableModels || ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']).map((m: string) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-slate-400">RBAC/ABAC:</span>
            <span className="font-semibold text-indigo-300">Server-Enforced</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chat on Left, Context & Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Chat Feed (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl h-[750px] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                AI Rental Session
              </span>
              {activeSessionId && (
                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]">
                  ({activeSessionId.slice(0, 8)}...)
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([
                  {
                    id: 'welcome-msg-fresh',
                    sender: 'assistant',
                    text: 'Session refreshed! How can I assist you with your rental today?',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
                setActiveSessionId(undefined);
              }}
              className="text-xs text-slate-400 hover:text-white h-7 gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span>New Session</span>
            </Button>
          </div>

          {/* Quick Command Suggestions */}
          <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800/40 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
              Suggestions:
            </span>
            {suggestedCommands.map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleSendMessage(cmd)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full bg-slate-800/60 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-700/60 text-slate-300 hover:text-indigo-200 transition-colors shrink-0 text-xs cursor-pointer disabled:opacity-50"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-indigo-600/20">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                        : 'bg-slate-950/90 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* Execution Stepper for Assistant Responses */}
                  {msg.executionSteps && msg.executionSteps.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Terminal className="h-3 w-3 text-indigo-400" />
                          <span>AI Execution Flow</span>
                        </span>
                        {msg.intent && (
                          <span className="text-indigo-400 font-mono">[{msg.intent}]</span>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {msg.executionSteps.map((step) => (
                          <div key={step.id} className="flex items-center gap-2 text-slate-300">
                            <span className="h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-3 w-3" />
                            </span>
                            <span className="font-medium">{step.label}</span>
                            {step.details && (
                              <span className="text-slate-500 text-[11px] truncate">
                                — {step.details}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`text-[10px] text-slate-500 px-1 ${
                      msg.sender === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="h-8 w-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5 text-xs font-bold">
                    ME
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator with Animated Stepper */}
            {isLoading && (
              <div className="flex gap-3 justify-start items-start">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 mt-0.5 animate-pulse">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-300 text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                    <span className="font-semibold text-xs text-white">HavenDex is working...</span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                      <span>Understanding request & retrieving rental context...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask HavenDex anything about your rent, issues, or lease..."
                disabled={isLoading}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <Button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-xl shadow-md shadow-indigo-600/20"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Right Side: Rental Context & Security Inspector (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Rental Context Card */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Active Tenancy Context</h3>
              </div>
              <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[10px]">
                Ground Truth
              </Badge>
            </div>

            {rentalContext?.tenancy ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                  <div className="text-slate-400 text-[11px]">Property & Room</div>
                  <div className="font-bold text-white text-sm">
                    {rentalContext.tenancy.propertyName}
                  </div>
                  <div className="text-slate-300">
                    Room {rentalContext.tenancy.roomNumber} ({rentalContext.tenancy.roomType})
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {rentalContext.tenancy.address}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Monthly Rent</span>
                    <p className="text-sm font-black text-white">
                      ₹{rentalContext.tenancy.monthlyRent.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Current Cycle</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">
                        {rentalContext.rentSchedule?.billingMonth || '2026-09'}
                      </span>
                      <Badge
                        className={`text-[9px] py-0 ${
                          rentalContext.rentSchedule?.isPaid
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {rentalContext.rentSchedule?.status || 'PENDING'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Rental Lifecycle Timeline */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Rental Lifecycle Stage
                    </span>
                    <span className="text-xs font-bold text-indigo-400">
                      {(LIFECYCLE_STAGE_LABELS as any)[currentStage] || currentStage}
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-1 pt-1">
                    {lifecycleStages.map((stage, idx) => {
                      const isPastOrCurrent = idx <= currentStageIndex;
                      const isCurrent = idx === currentStageIndex;

                      return (
                        <div
                          key={stage}
                          title={stage}
                          className={`h-2 rounded-full transition-all ${
                            isCurrent
                              ? 'bg-indigo-500 ring-2 ring-indigo-400/40'
                              : isPastOrCurrent
                              ? 'bg-indigo-800'
                              : 'bg-slate-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                Loading tenancy context...
              </div>
            )}
          </div>

          {/* Security & Audit Inspector */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Agent Security & Audit</h3>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                Zero-Trust
              </Badge>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Caller Identity:</span>
                <span className="font-mono text-white">
                  {rentalContext?.user?.name || 'Arjun Mehta'} ({rentalContext?.user?.role || 'TENANT'})
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Database Access:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Prisma Isolated (No Direct LLM Access)
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Audit Logging:</span>
                <span className="text-indigo-300 font-semibold">
                  AgentAction + AuditEvent
                </span>
              </div>
            </div>

            {/* Recent Tool Executions */}
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Recent Authorized Tools Executed
              </span>

              {recentToolCalls.length > 0 ? (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {recentToolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono text-indigo-300">{tc.toolName}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        {tc.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-xs italic">
                  Ask a question above to trigger authorized tool executions.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
