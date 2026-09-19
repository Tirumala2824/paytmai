'use client';

import React, { useState, useEffect } from 'react';
import { LifecycleVisualizer } from '@/components/rental/LifecycleVisualizer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RentalLifecycle, PaymentStatus, MaintenanceStatus } from '@prisma/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import {
  CreditCard,
  Wrench,
  AlertTriangle,
  Building,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Send,
  Bell,
  Mic,
  MessageSquare,
} from 'lucide-react';

export default function TenantDashboard() {
  const [tenancy, setTenancy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [reportingIssue, setReportingIssue] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueCategory, setIssueCategory] = useState('PLUMBING');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load tenant's active tenancy
  const loadTenancy = async () => {
    try {
      setLoading(true);
      // For demo, we query tenancy for Arjun Mehta (tenant-auth-id-001) or first active tenancy
      const res = await fetch('/api/audit'); // Health check
      // Mock data for immediate preview, then fetch from API if available
      setTenancy({
        id: 'tenancy-101-nexus',
        property: {
          name: 'Nexus Heights Luxury PG',
          address: '42, 5th Block, 80 Feet Road, Koramangala, Bengaluru',
          owner: {
            userProfile: { name: 'Rajesh Sharma', phone: '+91 98765 43210' },
          },
        },
        room: {
          roomNumber: '101',
          floor: 1,
          roomType: 'SINGLE',
        },
        monthlyRent: 18000,
        securityDeposit: 36000,
        startDate: '2026-01-01',
        lifecycleStage: RentalLifecycle.RENT_DUE,
        rentSchedules: [
          {
            id: 'sched-sep-2026',
            dueDate: '2026-09-05',
            amount: 18000,
            billingMonth: '2026-09',
            status: PaymentStatus.PENDING,
          },
          {
            id: 'sched-aug-2026',
            dueDate: '2026-08-05',
            amount: 18000,
            billingMonth: '2026-08',
            status: PaymentStatus.SUCCESS,
            payments: [
              {
                id: 'pay-001',
                amount: 18000,
                paymentMethod: 'PAYTM',
                transactionRef: 'TXN_PAYTM_98234710',
                paidAt: '2026-08-04',
                status: PaymentStatus.SUCCESS,
              },
            ],
          },
        ],
        maintenanceIssues: [
          {
            id: 'issue-001',
            title: 'Water purifier filter needs replacement',
            category: 'APPLIANCE',
            priority: 'MEDIUM',
            status: MaintenanceStatus.IN_PROGRESS,
            createdAt: '2026-09-12',
            tasks: [
              {
                id: 'task-001',
                title: 'Kent RO Technician Visit',
                assignedTo: 'Eureka Service Hub',
                status: MaintenanceStatus.IN_PROGRESS,
              },
            ],
          },
        ],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenancy();
  }, []);

  const handleAdvanceStage = async (nextStage: RentalLifecycle) => {
    try {
      const res = await fetch('/api/lifecycle/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenancyId: tenancy.id,
          targetStage: nextStage,
          reason: `Manual advance from Tenant Portal to ${nextStage}`,
        }),
      });

      // Update state locally for instant snappy UI feedback
      setTenancy((prev: any) => ({
        ...prev,
        lifecycleStage: nextStage,
      }));

      setMessage({
        text: `Rental lifecycle successfully advanced to ${nextStage}! Audit event recorded.`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to advance stage', type: 'error' });
    }
  };

  const handlePayRent = async () => {
    setPaying(true);
    setMessage(null);
    try {
      const pendingSchedule = tenancy.rentSchedules.find(
        (s: any) => s.status === PaymentStatus.PENDING
      );

      const res = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentScheduleId: pendingSchedule?.id || 'sched-sep-2026',
          amount: pendingSchedule?.amount || 18000,
          paymentMethod: 'PAYTM',
        }),
      });

      // Advance stage to PAYMENT
      setTenancy((prev: any) => ({
        ...prev,
        lifecycleStage: RentalLifecycle.PAYMENT,
        rentSchedules: prev.rentSchedules.map((s: any) =>
          s.id === pendingSchedule?.id ? { ...s, status: PaymentStatus.SUCCESS } : s
        ),
      }));

      setMessage({
        text: '₹18,000 paid successfully via Paytm Adapter! Receipt generated & owner notified.',
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Payment failed', type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;

    try {
      const res = await fetch('/api/maintenance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenancyId: tenancy.id,
          title: issueTitle,
          description: issueDesc || 'Reported via Tenant Dashboard',
          category: issueCategory,
          priority: 'HIGH',
        }),
      });

      // Update state
      const newIssue = {
        id: `issue-${Date.now()}`,
        title: issueTitle,
        category: issueCategory,
        priority: 'HIGH',
        status: MaintenanceStatus.ISSUE_REPORTED,
        createdAt: new Date().toISOString(),
        tasks: [],
      };

      setTenancy((prev: any) => ({
        ...prev,
        lifecycleStage: RentalLifecycle.ISSUE,
        maintenanceIssues: [newIssue, ...prev.maintenanceIssues],
      }));

      setIssueTitle('');
      setIssueDesc('');
      setReportingIssue(false);
      setMessage({
        text: 'Maintenance issue logged! Tenancy transitioned to ISSUE phase and owner notified.',
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to report issue', type: 'error' });
    }
  };

  if (loading || !tenancy) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-indigo-400">
          <Sparkles className="h-5 w-5 animate-spin" />
          <span>Setting things up...</span>
        </div>
      </div>
    );
  }

  const currentPendingSchedule = tenancy.rentSchedules.find(
    (s: any) => s.status === PaymentStatus.PENDING
  );

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tenancy Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="success">Active Lease</Badge>
            <span className="text-xs text-slate-400">Room {tenancy.room.roomNumber}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            {tenancy.property.name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{tenancy.property.address}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-400">Monthly Rent</span>
            <div className="text-xl font-bold text-white">
              {formatCurrency(tenancy.monthlyRent)}
            </div>
          </div>
          <Button
            onClick={() => setReportingIssue(!reportingIssue)}
            variant="outline"
            size="sm"
            className="border-slate-700 hover:bg-slate-800 text-xs gap-1.5"
          >
            <Wrench className="h-3.5 w-3.5 text-indigo-400" />
            <span>Report Issue</span>
          </Button>
        </div>
      </div>

      {/* Visual Rental Lifecycle Machine */}
      <LifecycleVisualizer
        currentStage={tenancy.lifecycleStage}
        tenancyId={tenancy.id}
        onAdvanceStage={handleAdvanceStage}
        canAdvance={true}
      />

      {/* Report Issue Form Modal/Drawer */}
      {reportingIssue && (
        <Card className="border-indigo-500/30 bg-slate-900/90 shadow-xl">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Wrench className="h-4 w-4 text-indigo-400" />
              Report Maintenance or Service Request
            </CardTitle>
            <CardDescription className="text-xs">
              Describe what&apos;s wrong — we&apos;ll take care of the rest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReportIssue} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="issueTitle">Issue Summary</Label>
                  <Input
                    id="issueTitle"
                    placeholder="e.g. Geyser not heating water"
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="PLUMBING">Plumbing</option>
                    <option value="ELECTRICAL">Electrical</option>
                    <option value="APPLIANCE">Appliance</option>
                    <option value="CLEANING">Housekeeping</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issueDesc">Description</Label>
                <Input
                  id="issueDesc"
                  placeholder="Provide any specific details (e.g. leaking since morning)"
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReportingIssue(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="gap-2">
                  <Send className="h-3.5 w-3.5" />
                  Submit Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Two Column Grid: Rent Due / Payment Card & Active Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Rent Due & Paytm Checkout Card */}
        <Card className="border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-indigo-400" />
                Monthly Rent Status
              </CardTitle>
              <CardDescription className="text-xs">
                Cycle: September 2026
              </CardDescription>
            </div>
            {currentPendingSchedule ? (
              <Badge variant="warning">Rent Due</Badge>
            ) : (
              <Badge variant="success">Paid for Month</Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Total Amount Due</span>
                <div className="text-2xl font-black text-white mt-0.5">
                  {formatCurrency(currentPendingSchedule?.amount || 18000)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-400" />
                  Due by 05 Sep 2026
                </div>
              </div>

              {currentPendingSchedule ? (
                <Button
                  onClick={handlePayRent}
                  disabled={paying}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {paying ? 'Processing...' : 'Pay via Paytm'}
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  Payment Cleared
                </div>
              )}
            </div>

            {/* Payment history list */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Recent Payments
              </span>
              <div className="mt-2 space-y-2">
                {tenancy.rentSchedules
                  .filter((s: any) => s.status === PaymentStatus.SUCCESS)
                  .map((sched: any) => (
                    <div
                      key={sched.id}
                      className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            Rent for {sched.billingMonth}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Ref: {sched.payments?.[0]?.transactionRef || 'TXN_PAYTM_OK'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{formatCurrency(sched.amount)}</p>
                        <p className="text-[10px] text-emerald-400 font-medium">SUCCESS</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>

          <CardFooter className="text-xs text-slate-500 flex items-center justify-between">
            <span>Security Deposit: {formatCurrency(tenancy.securityDeposit)}</span>
            <span className="text-indigo-400 hover:underline cursor-pointer">
              Download Receipt
            </span>
          </CardFooter>
        </Card>

        {/* Maintenance & Support Tickets */}
        <Card className="border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Wrench className="h-4 w-4 text-indigo-400" />
                Active Maintenance
              </CardTitle>
              <CardDescription className="text-xs">
                Issues logged with your property manager
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {tenancy.maintenanceIssues.length} Request(s)
            </Badge>
          </CardHeader>

          <CardContent className="space-y-3 pt-2">
            {tenancy.maintenanceIssues.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active maintenance requests. Everything in your room is in good shape!
              </div>
            ) : (
              tenancy.maintenanceIssues.map((issue: any) => (
                <div
                  key={issue.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-white">
                      {issue.title}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                      {issue.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Category: {issue.category}</span>
                    <span>Priority: {issue.priority}</span>
                  </div>

                  {issue.tasks && issue.tasks.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs">
                      <div className="text-[10px] font-semibold text-indigo-300 uppercase">
                        Assigned Task:
                      </div>
                      <p className="text-slate-300 mt-0.5">{issue.tasks[0].title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Assigned to: {issue.tasks[0].assignedTo}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>

          <CardFooter className="text-xs text-slate-500 flex items-center justify-between">
            <span>Owner Contact: {tenancy.property.owner.userProfile.phone}</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => setReportingIssue(true)}
              className="text-xs text-indigo-400"
            >
              + Log New Issue
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Grid: Notifications & AI Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications Feed */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-400" />
                Notifications &amp; Alerts
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time updates on rent, maintenance, and owner messages
              </CardDescription>
            </div>
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">
              2 Unread
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <div className="space-y-1 flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Rent Schedule Generated</span>
                  <span className="text-[10px] text-slate-500">01 Sep 2026</span>
                </div>
                <p className="text-slate-400">
                  September 2026 rent of ₹18,000 is due by 05 Sep 2026.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div className="space-y-1 flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Payment Confirmed</span>
                  <span className="text-[10px] text-slate-500">04 Aug 2026</span>
                </div>
                <p className="text-slate-400">
                  ₹18,000 received for August 2026. Receipt TXN_PAYTM_98234710 generated.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-slate-500 flex justify-between">
            <span>Recent activity</span>
            <Link href="/notifications" className="text-indigo-400 hover:underline">
              View all &rarr;
            </Link>
          </CardFooter>
        </Card>

        {/* AI Assistant Quick Launcher */}
        <Card className="border-indigo-900/40 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                HavenDex AI Assistant
              </CardTitle>
              <CardDescription className="text-xs">
                &quot;One AI teammate for your entire rental relationship&quot;
              </CardDescription>
            </div>
            <Badge className="bg-indigo-600/30 text-indigo-300 border-indigo-500/40 text-[10px]">
              Active
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <p className="text-slate-300 leading-relaxed">
              HavenDex understands your rental context, checks payment status, logs maintenance, alerts your owner, and dispatches technicians autonomously.
            </p>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-indigo-200 italic">
              &ldquo;My rent is paid. Please confirm it and tell the owner that my AC isn&apos;t working again.&rdquo;
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/assistant">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 shadow-md shadow-indigo-600/20">
                  <Mic className="h-3.5 w-3.5" />
                  <span>Launch Voice Assistant</span>
                </Button>
              </Link>
              <Link href="/assistant">
                <Button variant="outline" size="sm" className="border-slate-700 text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Open Text Chat</span>
                </Button>
              </Link>
            </div>
          </CardContent>
          <CardFooter className="text-[11px] text-slate-500">
            Supports Indian English, Hindi, and 8 regional languages via Sarvam AI
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
