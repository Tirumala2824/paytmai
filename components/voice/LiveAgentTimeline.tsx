'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  CreditCard,
  Bell,
  CheckCheck,
  Database,
  Cpu,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface TimelineStage {
  id: string;
  name: string;
  label: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
  timestamp?: string;
  details?: string;
  meta?: Record<string, any>;
  iconType?: string;
}

interface LiveAgentTimelineProps {
  stages?: TimelineStage[];
  activeStageId?: string;
  isExecuting?: boolean;
  onSimulateFixAndVerify?: () => void;
  isSimulatingFix?: boolean;
}

export function LiveAgentTimeline({
  stages: customStages,
  activeStageId,
  isExecuting = false,
  onSimulateFixAndVerify,
  isSimulatingFix = false,
}: LiveAgentTimelineProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  // Default 9 canonical stages if custom not provided
  const defaultStages: TimelineStage[] = [
    {
      id: 'UNDERSTAND',
      name: 'UNDERSTAND',
      label: 'Speech Processing & Language Normalization',
      status: 'completed',
      details: 'Sarvam AI Saaras model transcribed speech. Language: Indian English (en-IN).',
      meta: {
        model: 'Sarvam Saaras v2',
        language: 'en-IN',
        confidence: 0.98,
      },
    },
    {
      id: 'CONTEXT',
      name: 'CONTEXT',
      label: 'Rental Ground Truth & Memory Retrieval',
      status: 'completed',
      details: 'Loaded lease at Nexus Heights (Room 101). Retrieved prior AC repair from Cognee memory.',
      meta: {
        tenancy: 'Nexus Heights Luxury PG (Room 101)',
        memoryRetrieved: 'Prior AC repair found (Status: CLOSED)',
        isRepeatedIssue: true,
      },
    },
    {
      id: 'INTENTS',
      name: 'INTENTS',
      label: 'Multi-Intent Dynamic Decomposition',
      status: 'completed',
      details: 'Detected 3 concurrent intents: PAYMENT_VALIDATION, MAINTENANCE_REPORT, OWNER_NOTIFICATION.',
      meta: {
        intents: ['PAYMENT_VALIDATION', 'MAINTENANCE_REPORT', 'OWNER_NOTIFICATION'],
        confidence: 0.97,
      },
    },
    {
      id: 'PAYMENT',
      name: 'PAYMENT',
      label: 'Rent Schedule & Payment Verification',
      status: 'completed',
      details: 'Rent status validated via getRentStatus tool: ₹18,000 for September 2026 is confirmed PAID.',
      meta: {
        amount: '₹18,000',
        billingMonth: '2026-09',
        status: 'SUCCESS',
        ref: 'TXN_PAYTM_98234710',
      },
    },
    {
      id: 'MAINTENANCE',
      name: 'MAINTENANCE',
      label: 'Autonomous Issue Creation & Triage',
      status: 'completed',
      details: 'Logged "Air Conditioning malfunction reported". Escalated to HIGH priority as repeated issue.',
      meta: {
        issueId: 'issue-ac-repeated-101',
        category: 'APPLIANCE',
        priority: 'HIGH',
        isRepeated: true,
      },
    },
    {
      id: 'OWNER_NOTIFIED',
      name: 'OWNER NOTIFIED',
      label: 'Owner Notification Dispatched',
      status: 'completed',
      details: 'Dispatched urgent in-app alert to owner Rajesh Sharma with technician dispatch details.',
      meta: {
        recipient: 'Rajesh Sharma (Owner)',
        urgent: true,
        channel: 'In-App + Push',
      },
    },
    {
      id: 'FIXED',
      name: 'FIXED',
      label: 'Technician Assigned & Repair Simulated',
      status: 'completed',
      details: 'QuickFix Coliving Services completed service: filter replaced, gas recharged, cooling restored to 18°C.',
      meta: {
        contractor: 'QuickFix Coliving Services',
        cost: '₹1,200',
        resolution: 'Filter cleaned, gas pressure recharged, cooling tested at 18°C',
      },
    },
    {
      id: 'VERIFIED',
      name: 'VERIFIED',
      label: 'Closed-Loop Verification Completed',
      status: 'completed',
      details: 'Resolution verified via COMBINED verification (Tenant Confirmation + AI Image Analysis, 98% confidence).',
      meta: {
        method: 'COMBINED (Tenant + AI Image Analysis)',
        confidence: 0.98,
        status: 'CLOSED (Verified)',
      },
    },
    {
      id: 'MEMORY_UPDATED',
      name: 'MEMORY UPDATED',
      label: 'Cognee Graph & Audit Trail Committed',
      status: 'completed',
      details: 'Committed verified resolution to Cognee semantic memory graph and immutable PostgreSQL audit trail.',
      meta: {
        graphNode: 'MAINTENANCE_RESOLUTION',
        auditId: 'audit-phase5-verification-001',
        syncSource: 'COGNEE_API / LOCAL_GRAPH',
      },
    },
  ];

  const stages = customStages && customStages.length > 0 ? customStages : defaultStages;

  const stageIcons: Record<string, React.ReactNode> = {
    UNDERSTAND: <Cpu className="h-4 w-4" />,
    CONTEXT: <Database className="h-4 w-4" />,
    INTENTS: <Layers className="h-4 w-4" />,
    PAYMENT: <CreditCard className="h-4 w-4" />,
    MAINTENANCE: <Wrench className="h-4 w-4" />,
    OWNER_NOTIFIED: <Bell className="h-4 w-4" />,
    FIXED: <Wrench className="h-4 w-4" />,
    VERIFIED: <CheckCheck className="h-4 w-4" />,
    MEMORY_UPDATED: <Sparkles className="h-4 w-4" />,
  };

  return (
    <div className="rounded-3xl bg-slate-950/90 border border-indigo-900/40 p-6 space-y-6 shadow-2xl backdrop-blur-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Live Agent Execution Timeline
              </h2>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider">
                9-Stage Closed Loop
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Autonomous rental orchestration • Multi-Intent → Action → Verification → Memory
            </p>
          </div>
        </div>

        {onSimulateFixAndVerify && (
          <Button
            size="sm"
            onClick={onSimulateFixAndVerify}
            disabled={isSimulatingFix}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{isSimulatingFix ? 'Verifying...' : 'Simulate Repair & Verify'}</span>
          </Button>
        )}
      </div>

      {/* 9-Stage Timeline Grid */}
      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const isCompleted = stage.status === 'completed';
          const isInProgress = stage.status === 'in_progress';
          const isFailed = stage.status === 'failed';
          const isExpanded = expandedStage === stage.id;

          return (
            <div
              key={stage.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isCompleted
                  ? 'bg-slate-900/60 border-slate-800/80 hover:border-indigo-500/40'
                  : isInProgress
                  ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                  : isFailed
                  ? 'bg-rose-950/30 border-rose-800/60'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              {/* Stage Summary Row */}
              <div
                onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Status Indicator Icon */}
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/20'
                        : isInProgress
                        ? 'bg-indigo-600 text-white animate-pulse shadow-md shadow-indigo-600/30'
                        : isFailed
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : (
                      <span className="font-mono text-[11px]">{idx + 1}</span>
                    )}
                  </div>

                  {/* Stage Titles */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tracking-wider uppercase text-white">
                        {stage.name}
                      </span>
                      {isCompleted && (
                        <span className="text-emerald-400 font-bold text-xs">✓</span>
                      )}
                      {isInProgress && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {stage.label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    className={`text-[9px] px-2 py-0.5 font-bold uppercase ${
                      isCompleted
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : isInProgress
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : isFailed
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isCompleted ? '✓ Completed' : isInProgress ? 'Executing...' : stage.status}
                  </Badge>

                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-2.5 text-xs text-slate-300 bg-slate-950/50 animate-in fade-in duration-200">
                  {stage.details && (
                    <p className="leading-relaxed text-slate-200">
                      {stage.details}
                    </p>
                  )}

                  {stage.meta && Object.keys(stage.meta).length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      {Object.entries(stage.meta).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">{key}:</span>
                          <span className="text-indigo-300 font-semibold truncate max-w-[200px]">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Assurance Banner */}
      <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-900/30 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>RBAC &amp; ABAC verified at every tool execution step</span>
        </div>
        <span className="text-[10px] font-mono text-indigo-400">
          Deterministic Demo Mode Active
        </span>
      </div>
    </div>
  );
}
