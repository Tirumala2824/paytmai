'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RentalLifecycle, MaintenanceStatus, PaymentStatus } from '@prisma/client';
import { formatCurrency } from '@/lib/utils';
import { LIFECYCLE_STAGE_LABELS } from '@/lib/rental/lifecycle';
import {
  Building2,
  Users,
  CreditCard,
  Wrench,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Plus,
} from 'lucide-react';

interface TenancyItem {
  id: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  roomNumber: string;
  rentAmount: number;
  lifecycleStage: RentalLifecycle;
  rentStatus: string;
}

interface MaintenanceRequestItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: MaintenanceStatus;
  isRepeated: boolean;
  resolution?: string | null;
  property: { name: string };
  room?: { roomNumber: string } | null;
  reportedBy: { name: string; email: string };
  tasks: Array<{ title: string; assignedTo?: string; estimatedCost?: number; actualCost?: number; status: MaintenanceStatus }>;
  verifications: Array<{ verificationMethod: string; evidence?: string; confidence?: number | null; verifiedAt: string }>;
}

export default function OwnerDashboard() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>('OPEN');

  // Demo owner properties & tenancies
  const [properties, setProperties] = useState([
    {
      id: 'prop-nexus-koramangala',
      name: 'Nexus Heights Luxury PG',
      address: '42, 5th Block, 80 Feet Road, Koramangala',
      city: 'Bengaluru',
      totalRooms: 6,
      occupiedRooms: 4,
      monthlyRevenue: 72000,
      propertyType: 'PG',
    },
    {
      id: 'prop-nexus-indiranagar',
      name: 'Nexus Studio Suites Indiranagar',
      address: '108, 12th Main Road, HAL 2nd Stage, Indiranagar',
      city: 'Bengaluru',
      totalRooms: 4,
      occupiedRooms: 3,
      monthlyRevenue: 78000,
      propertyType: 'COLIVING',
    },
  ]);

  const [tenancies, setTenancies] = useState<TenancyItem[]>([
    {
      id: 'tenancy-1',
      tenantName: 'Arjun Mehta',
      tenantEmail: 'arjun.mehta@gmail.com',
      propertyName: 'Nexus Heights Luxury PG',
      roomNumber: '101',
      rentAmount: 18000,
      lifecycleStage: RentalLifecycle.RENT_DUE,
      rentStatus: 'PENDING',
    },
    {
      id: 'tenancy-2',
      tenantName: 'Sneha Rao',
      tenantEmail: 'sneha.rao@gmail.com',
      propertyName: 'Nexus Studio Suites Indiranagar',
      roomNumber: '301',
      rentAmount: 26000,
      lifecycleStage: RentalLifecycle.ISSUE,
      rentStatus: 'PAID',
    },
  ]);

  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestItem[]>([]);

  useEffect(() => {
    fetchOwnerMaintenance();
  }, []);

  async function fetchOwnerMaintenance() {
    try {
      const res = await fetch('/api/maintenance');
      if (res.ok) {
        const data = await res.json();
        setMaintenanceRequests(data.issues || []);
      }
    } catch (err) {
      console.warn('Could not load owner maintenance issues:', err);
    }
  }

  const handleAdvanceTenancyStage = async (tenancyId: string, nextStage: RentalLifecycle) => {
    try {
      await fetch('/api/lifecycle/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenancyId,
          targetStage: nextStage,
          reason: `Owner advanced tenancy to ${nextStage}`,
        }),
      });

      setTenancies((prev) =>
        prev.map((t) => (t.id === tenancyId ? { ...t, lifecycleStage: nextStage } : t))
      );

      setMessage(`Tenancy advanced to ${LIFECYCLE_STAGE_LABELS[nextStage]}. Audit log updated.`);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleUpdateMaintenance = async (issueId: string, newStatus: MaintenanceStatus) => {
    try {
      await fetch('/api/maintenance/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId,
          status: newStatus,
          notes: `Owner updated status to ${newStatus}`,
        }),
      });

      setMaintenanceRequests((prev) =>
        prev.map((m) => (m.id === issueId ? { ...m, status: newStatus } : m))
      );

      setMessage(`Maintenance issue updated to ${newStatus}. Tenancy lifecycle updated.`);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default">Nexus Living Spaces Portfolio</Badge>
            <span className="text-xs text-slate-400">Owner: Rajesh Sharma</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Properties & Asset Management
          </h1>
          <p className="text-xs text-slate-400">
            Real-time occupancy, revenue streams, and automated tenant lifecycle oversight
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/audit">
            <Button variant="outline" size="sm" className="text-xs border-slate-700 gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              Security Audit
            </Button>
          </Link>
          <Button size="sm" className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500">
            <Plus className="h-3.5 w-3.5" />
            Add Property
          </Button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Properties</span>
            <Building2 className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">2</div>
          <div className="text-[11px] text-slate-400 mt-1">10 Total Rooms across 2 locations</div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Occupancy Rate</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">70%</div>
          <div className="text-[11px] text-emerald-400 mt-1">7 of 10 Rooms Occupied</div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Monthly Revenue</span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {formatCurrency(150000)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">₹26,000 received this week</div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Maintenance Triage</span>
            <Wrench className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">1 Active</div>
          <div className="text-[11px] text-amber-400 mt-1">1 In-Progress Task Assigned</div>
        </Card>
      </div>

      {/* Properties Overview Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Your Managed Properties</h2>
          <span className="text-xs text-slate-400">2 locations</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map((prop) => (
            <Card key={prop.id} className="border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      {prop.propertyType}
                    </span>
                    <CardTitle className="text-base text-white mt-0.5">{prop.name}</CardTitle>
                    <CardDescription className="text-xs text-slate-400">{prop.address}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {prop.city}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500">Rooms</span>
                    <p className="text-sm font-bold text-white">{prop.totalRooms}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Occupied</span>
                    <p className="text-sm font-bold text-emerald-400">{prop.occupiedRooms}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Monthly Est.</span>
                    <p className="text-sm font-bold text-white">{formatCurrency(prop.monthlyRevenue)}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 text-xs flex justify-between">
                <span className="text-slate-400">67% Occupied</span>
                <Link href={`/property/${prop.id}`} className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold">
                  View Rooms & Units <ArrowUpRight className="h-3 w-3" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Active Tenancies Lifecycle Management */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base text-white">Active Tenancies & Lifecycle State</CardTitle>
            <CardDescription className="text-xs">
              Live state machine stages across all occupied rooms
            </CardDescription>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {tenancies.length} Active Leases
          </span>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3">Tenant</th>
                  <th className="pb-3">Property & Room</th>
                  <th className="pb-3">Rent</th>
                  <th className="pb-3">Lifecycle Stage</th>
                  <th className="pb-3">Rent Status</th>
                  <th className="pb-3 text-right">Owner Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tenancies.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/40">
                    <td className="py-3 font-medium text-white">
                      <div>{t.tenantName}</div>
                      <div className="text-[10px] text-slate-400">{t.tenantEmail}</div>
                    </td>
                    <td className="py-3 text-slate-300">
                      <div>{t.propertyName}</div>
                      <div className="text-[10px] text-slate-500">Room {t.roomNumber}</div>
                    </td>
                    <td className="py-3 font-semibold text-white">
                      {formatCurrency(t.rentAmount)}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        {LIFECYCLE_STAGE_LABELS[t.lifecycleStage]}
                      </span>
                    </td>
                    <td className="py-3">
                      {t.rentStatus === 'PAID' ? (
                        <Badge variant="success">PAID</Badge>
                      ) : (
                        <Badge variant="warning">DUE</Badge>
                      )}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      {t.lifecycleStage === RentalLifecycle.BOOKED && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[11px]"
                          onClick={() => handleAdvanceTenancyStage(t.id, RentalLifecycle.RENT_DUE)}
                        >
                          Trigger Rent Due
                        </Button>
                      )}
                      {t.lifecycleStage === RentalLifecycle.RENT_DUE && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[11px]"
                          onClick={() => handleAdvanceTenancyStage(t.id, RentalLifecycle.PAYMENT)}
                        >
                          Record Payment
                        </Button>
                      )}
                      {t.lifecycleStage === RentalLifecycle.ISSUE && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[11px] text-amber-300 border-amber-500/30"
                          onClick={() => handleAdvanceTenancyStage(t.id, RentalLifecycle.ACTION)}
                        >
                          Initiate Action
                        </Button>
                      )}
                      {t.lifecycleStage === RentalLifecycle.ACTION && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[11px] text-emerald-300 border-emerald-500/30"
                          onClick={() => handleAdvanceTenancyStage(t.id, RentalLifecycle.FIXED)}
                        >
                          Mark Fixed
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Owner Maintenance & Facility Oversight (7 Views) */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Wrench className="h-4 w-4 text-indigo-400" />
                Facility &amp; Maintenance Oversight
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time contractor management, urgent escalations, and closed-loop verification
              </CardDescription>
            </div>
            <Link href="/maintenance">
              <Button variant="outline" size="sm" className="text-xs border-slate-700 h-8 gap-1">
                <span>View Full Workspace</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* 7 Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-b border-slate-800 text-xs">
            {[
              {
                key: 'OPEN',
                label: 'Open Issues',
                count: maintenanceRequests.filter(
                  (r) => r.status !== MaintenanceStatus.CLOSED && r.status !== MaintenanceStatus.VERIFIED
                ).length,
              },
              {
                key: 'URGENT',
                label: 'Urgent Issues',
                count: maintenanceRequests.filter(
                  (r) =>
                    (r.priority === 'HIGH' || r.priority === 'EMERGENCY') &&
                    r.status !== MaintenanceStatus.CLOSED
                ).length,
              },
              {
                key: 'ASSIGNED',
                label: 'Assigned Tasks',
                count: maintenanceRequests.filter((r) => r.tasks && r.tasks.length > 0).length,
              },
              {
                key: 'IN_PROGRESS',
                label: 'In Progress',
                count: maintenanceRequests.filter(
                  (r) =>
                    r.status === MaintenanceStatus.IN_PROGRESS ||
                    r.status === MaintenanceStatus.TASK_ASSIGNED
                ).length,
              },
              {
                key: 'VERIFICATION_PENDING',
                label: 'Verification Pending',
                count: maintenanceRequests.filter(
                  (r) =>
                    r.status === MaintenanceStatus.VERIFICATION_PENDING ||
                    r.status === MaintenanceStatus.FIXED
                ).length,
              },
              {
                key: 'RESOLVED',
                label: 'Resolved',
                count: maintenanceRequests.filter(
                  (r) =>
                    r.status === MaintenanceStatus.VERIFIED ||
                    r.status === MaintenanceStatus.CLOSED
                ).length,
              },
              {
                key: 'REPEATED',
                label: 'Repeated Issues',
                count: maintenanceRequests.filter((r) => r.isRepeated).length,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOwnerFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  ownerFilter === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    ownerFilter === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-2">
          {(() => {
            const filtered = maintenanceRequests.filter((req) => {
              if (ownerFilter === 'OPEN')
                return req.status !== MaintenanceStatus.CLOSED && req.status !== MaintenanceStatus.VERIFIED;
              if (ownerFilter === 'URGENT')
                return (
                  (req.priority === 'HIGH' || req.priority === 'EMERGENCY') &&
                  req.status !== MaintenanceStatus.CLOSED
                );
              if (ownerFilter === 'ASSIGNED') return req.tasks && req.tasks.length > 0;
              if (ownerFilter === 'IN_PROGRESS')
                return (
                  req.status === MaintenanceStatus.IN_PROGRESS ||
                  req.status === MaintenanceStatus.TASK_ASSIGNED
                );
              if (ownerFilter === 'VERIFICATION_PENDING')
                return (
                  req.status === MaintenanceStatus.VERIFICATION_PENDING ||
                  req.status === MaintenanceStatus.FIXED
                );
              if (ownerFilter === 'RESOLVED')
                return (
                  req.status === MaintenanceStatus.VERIFIED ||
                  req.status === MaintenanceStatus.CLOSED
                );
              if (ownerFilter === 'REPEATED') return req.isRepeated;
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No issues found in this category.
                </div>
              );
            }

            return filtered.map((req) => {
              const latestTask = req.tasks?.[req.tasks.length - 1];
              const latestVerification = req.verifications?.[0];

              return (
                <div
                  key={req.id}
                  className={`p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs ${
                    req.isRepeated ? 'ring-1 ring-amber-500/30' : ''
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.priority === 'HIGH' || req.priority === 'EMERGENCY'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {req.priority}
                      </span>
                      <span className="text-indigo-400 font-medium">{req.category}</span>
                      {req.isRepeated && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          ⚠️ Repeated Issue
                        </span>
                      )}
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">
                        {req.property.name}
                        {req.room ? ` (Room ${req.room.roomNumber})` : ''}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white tracking-tight">{req.title}</h4>

                    <div className="text-[11px] text-slate-400 space-y-0.5">
                      <p>
                        Reported by: <span className="text-slate-200">{req.reportedBy.name}</span>
                        {latestTask?.assignedTo && (
                          <>
                            {' '}• Contractor: <span className="text-indigo-300">{latestTask.assignedTo}</span>
                          </>
                        )}
                      </p>
                      {req.resolution && (
                        <p className="text-emerald-400 font-medium">
                          Resolution: {req.resolution}
                        </p>
                      )}
                      {latestVerification && (
                        <p className="text-sky-400">
                          Proof: {latestVerification.evidence} ({latestVerification.verificationMethod})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end justify-between gap-2 shrink-0">
                    <Badge
                      variant={
                        req.status === MaintenanceStatus.VERIFIED || req.status === MaintenanceStatus.CLOSED
                          ? 'success'
                          : req.status === MaintenanceStatus.IN_PROGRESS
                          ? 'warning'
                          : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {req.status}
                    </Badge>

                    <div className="flex items-center gap-1.5">
                      {req.status !== MaintenanceStatus.CLOSED && req.status !== MaintenanceStatus.VERIFIED && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-slate-700 hover:bg-slate-800"
                            onClick={() => handleUpdateMaintenance(req.id, MaintenanceStatus.FIXED)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />
                            Mark Fixed
                          </Button>
                          <Link href="/maintenance">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500"
                            >
                              Verify &amp; Close
                            </Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
