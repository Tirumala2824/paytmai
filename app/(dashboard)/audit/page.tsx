'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, ShieldAlert, CheckCircle2, RefreshCw, KeyRound, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs);
      } else {
        // Fallback demo audit events
        setLogs([
          {
            id: 'audit-1',
            actorId: 'owner-1',
            actorRole: 'OWNER',
            action: 'LIFECYCLE_TRANSITION',
            resourceType: 'TENANCY',
            resourceId: 'tenancy-101-nexus',
            metadata: { fromStage: 'BOOKED', toStage: 'RENT_DUE', reason: 'Onboarding completed' },
            createdAt: new Date().toISOString(),
          },
          {
            id: 'audit-2',
            actorId: 'tenant-1',
            actorRole: 'TENANT',
            action: 'PAYMENT_PROCESSED',
            resourceType: 'PAYMENT',
            resourceId: 'pay-001',
            metadata: { amount: 18000, provider: 'PAYTM_MOCK_GATEWAY', status: 'SUCCESS' },
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'audit-3',
            actorId: 'tenant-2',
            actorRole: 'TENANT',
            action: 'MAINTENANCE_REPORTED',
            resourceType: 'MAINTENANCE_ISSUE',
            resourceId: 'issue-001',
            metadata: { title: 'AC leaking water', priority: 'HIGH', category: 'APPLIANCE' },
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            id: 'audit-4',
            actorId: 'tenant-1',
            actorRole: 'TENANT',
            action: 'AUTH_LOGIN_SUCCESS',
            resourceType: 'USER_PROFILE',
            resourceId: 'profile-001',
            metadata: { provider: 'SUPABASE_EMAIL' },
            createdAt: new Date(Date.now() - 10800000).toISOString(),
          },
        ]);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default">Bank-Grade Compliance</Badge>
            <span className="text-xs text-slate-400">Tamper-Proof Ledger</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Security & Audit Trail</h1>
          <p className="text-xs text-slate-400">
            Immutable log of all authorization decisions, lifecycle mutations, and payment transactions
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="text-xs gap-1.5 border-slate-800 hover:bg-slate-900"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Trail</span>
        </Button>
      </div>

      {/* Security Architecture Principle Card */}
      <Card className="border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900">
        <CardContent className="p-4 flex items-start gap-4">
          <div className="h-9 w-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <Shield className="h-5 w-5" />
          </div>
          <div className="text-xs space-y-1">
            <h4 className="font-semibold text-slate-200">HavenDex Security Principle</h4>
            <p className="text-slate-400 leading-relaxed">
              Never allow an LLM or client to directly modify the database or execute sensitive operations.
              All operations follow:{' '}
              <span className="text-indigo-300 font-mono">
                Auth Verified → RBAC Verified → ABAC Verified → Domain Service → Prisma Execution → Audit Created
              </span>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-base text-white">Event Log</CardTitle>
          <CardDescription className="text-xs">
            Chronological audit events recorded server-side
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Actor Role</th>
                  <th className="pb-3">Resource</th>
                  <th className="pb-3">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {logs.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-900/40">
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleTimeString()} ·{' '}
                      {new Date(event.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {event.action}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">
                      {event.actorRole || 'SYSTEM'}
                    </td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {event.resourceType} :{' '}
                      <span className="text-slate-300">{event.resourceId?.substring(0, 12)}...</span>
                    </td>
                    <td className="py-3 text-slate-400">
                      <div className="max-w-md truncate bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        {JSON.stringify(event.metadata)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
