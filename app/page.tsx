'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Shield,
  CreditCard,
  Wrench,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Layers,
  Building2,
  Users,
  Clock,
} from 'lucide-react';

export default function LandingPage() {
  const lifecycleSteps = [
    { name: 'Booked', desc: 'Tenancy created & confirmed' },
    { name: 'Rent Due', desc: 'Automated invoice generation' },
    { name: 'Payment', desc: 'Paytm & UPI instant settlement' },
    { name: 'Issue', desc: 'Autonomous maintenance triage' },
    { name: 'Action', desc: 'Vendor assigned & dispatched' },
    { name: 'Fixed', desc: 'Technician completion logged' },
    { name: 'Verified', desc: 'Tenant sign-off & closed loop' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-white tracking-tight">
              HavenDex
              <span className="ml-1.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 1
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs text-slate-300 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/tenant">
              <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 gap-1.5">
                <span>Launch Prototype</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32 px-6">
        {/* Glow backdrop effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none -z-0" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>AI-Powered PG & Rental Operating System</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.1]">
            One AI teammate for the <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 via-indigo-200 to-violet-400 bg-clip-text text-transparent">
              entire rental relationship
            </span>
            .
          </h1>

          <p className="max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
            Eliminate disconnected tools, lost context, and manual follow-ups. HavenDex turns the fragmented rental lifecycle into a continuous, verified, and secure operating state machine.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link href="/tenant">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold shadow-xl shadow-indigo-600/25 gap-2">
                <span>Explore Tenant OS</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/owner">
              <Button size="lg" variant="secondary" className="text-sm font-semibold border-slate-700 bg-slate-900/80 hover:bg-slate-800 gap-2">
                <Building2 className="h-4 w-4 text-indigo-400" />
                <span>Explore Owner OS</span>
              </Button>
            </Link>
          </div>

          {/* Quick Demo Credentials pill */}
          <div className="pt-6 flex items-center justify-center gap-4 text-xs text-slate-500">
            <span>✓ Supabase Auth</span>
            <span>•</span>
            <span>✓ Prisma PostgreSQL</span>
            <span>•</span>
            <span>✓ Server-side ABAC</span>
            <span>•</span>
            <span>✓ Paytm Adapter</span>
          </div>
        </div>
      </section>

      {/* Core Rental Lifecycle Interactive Preview */}
      <section className="py-16 px-6 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Deterministic State Machine
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              The Continuous Rental Lifecycle
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Every transition is strictly validated, permissioned, and recorded to an immutable audit trail.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {lifecycleSteps.map((step, idx) => (
              <div
                key={step.name}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between space-y-2 hover:border-indigo-500/40 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{step.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Architecture Pillars */}
      <section className="py-20 px-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Server-Enforced RBAC & ABAC</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tenants can only access their own lease. Owners can only manage owned assets. Authorization is verified server-side on every query and mutation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Paytm & UPI Adapter</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Integrated payment lifecycle connecting rent schedule generation, automated notifications, instant settlement, and reconciliation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <Wrench className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Autonomous Maintenance Triage</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reported issues automatically classify priority, transition rental state, dispatch technicians, and require verified sign-off before closing.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-8 px-6 bg-slate-950 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-300">HavenDex</span>
            <span>— AI-Powered Rental Operating System</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/tenant" className="hover:text-white">Tenant Hub</Link>
            <Link href="/owner" className="hover:text-white">Owner Hub</Link>
            <Link href="/login" className="hover:text-white">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
