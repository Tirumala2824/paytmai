'use client';

import React from 'react';
import { RentalLifecycle } from '@prisma/client';
import {
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_DESCRIPTIONS,
  LIFECYCLE_TRANSITIONS,
} from '@/lib/rental/lifecycle';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  AlertTriangle,
  Wrench,
  CheckCheck,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LifecycleVisualizerProps {
  currentStage: RentalLifecycle;
  tenancyId?: string;
  onAdvanceStage?: (nextStage: RentalLifecycle) => void;
  canAdvance?: boolean;
  className?: string;
}

const ORDERED_STAGES: RentalLifecycle[] = [
  RentalLifecycle.BOOKED,
  RentalLifecycle.RENT_DUE,
  RentalLifecycle.PAYMENT,
  RentalLifecycle.ISSUE,
  RentalLifecycle.ACTION,
  RentalLifecycle.FIXED,
  RentalLifecycle.VERIFIED,
];

const STAGE_ICONS: Record<RentalLifecycle, React.ElementType> = {
  BOOKED: CheckCircle2,
  RENT_DUE: Clock,
  PAYMENT: CreditCard,
  ISSUE: AlertTriangle,
  ACTION: Wrench,
  FIXED: CheckCheck,
  VERIFIED: ShieldCheck,
};

export function LifecycleVisualizer({
  currentStage,
  tenancyId,
  onAdvanceStage,
  canAdvance = false,
  className,
}: LifecycleVisualizerProps) {
  const currentIndex = ORDERED_STAGES.indexOf(currentStage);
  const nextAllowedStages = LIFECYCLE_TRANSITIONS[currentStage] || [];

  return (
    <div className={cn('w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-6 backdrop-blur-md shadow-xl', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-base font-semibold text-white tracking-wide">
              Rental Operating Lifecycle
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Continuous AI-assisted rental state machine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Current Phase:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {LIFECYCLE_STAGE_LABELS[currentStage]}
          </span>
        </div>
      </div>

      {/* Stepper Pipeline */}
      <div className="relative overflow-x-auto pb-4 pt-2">
        <div className="flex items-center min-w-[650px] justify-between relative">
          {/* Background progress track */}
          <div className="absolute top-5 left-6 right-6 h-0.5 bg-slate-800 -z-0" />

          {ORDERED_STAGES.map((stage, idx) => {
            const Icon = STAGE_ICONS[stage];
            const isCurrent = stage === currentStage;
            const isCompleted = idx < currentIndex;
            const isUpcoming = idx > currentIndex;

            return (
              <div
                key={stage}
                className="flex flex-col items-center relative z-10 group"
              >
                {/* Node Circle */}
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                    isCurrent &&
                      'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/50 scale-110 ring-4 ring-indigo-500/20',
                    isCompleted &&
                      'bg-emerald-950/70 border-emerald-500 text-emerald-400',
                    isUpcoming &&
                      'bg-slate-900 border-slate-700 text-slate-500'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Stage Label */}
                <span
                  className={cn(
                    'text-xs font-medium mt-2.5 transition-colors text-center whitespace-nowrap',
                    isCurrent && 'text-indigo-400 font-semibold',
                    isCompleted && 'text-slate-300',
                    isUpcoming && 'text-slate-500'
                  )}
                >
                  {LIFECYCLE_STAGE_LABELS[stage]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Description & Next Actions Banner */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-xl">
        <div>
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Current Stage Details
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {LIFECYCLE_STAGE_DESCRIPTIONS[currentStage]}
          </p>
        </div>

        {canAdvance && nextAllowedStages.length > 0 && onAdvanceStage && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Valid Next Actions:</span>
            {nextAllowedStages.map((next) => (
              <Button
                key={next}
                size="sm"
                variant="secondary"
                className="hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all text-xs"
                onClick={() => onAdvanceStage(next)}
              >
                <span>Advance to {LIFECYCLE_STAGE_LABELS[next]}</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
