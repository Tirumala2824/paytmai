'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaintenanceStatus } from '@prisma/client';
import { Wrench, Plus, CheckCircle2, Clock, AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';

interface MaintenanceIssueItem {
  id: string;
  title: string;
  description: string;
  property: string;
  tenant: string;
  category: string;
  priority: string;
  status: MaintenanceStatus;
  date: string;
  assignedTask: {
    title: string;
    assignedTo: string;
    cost: string;
  } | null;
}

export default function MaintenancePage() {
  const [filter, setFilter] = useState<string>('ALL');
  const [showReportModal, setShowReportModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('PLUMBING');
  const [priority, setPriority] = useState('MEDIUM');

  const [issues, setIssues] = useState<MaintenanceIssueItem[]>([
    {
      id: 'issue-1',
      title: 'AC leaking water and cooling insufficient',
      description: 'Daikin 1.5T AC unit has water leaking onto the desk and low cooling.',
      property: 'Nexus Studio Suites Indiranagar (Room 301)',
      tenant: 'Sneha Rao',
      category: 'APPLIANCE',
      priority: 'HIGH',
      status: MaintenanceStatus.IN_PROGRESS,
      date: '2026-09-12',
      assignedTask: {
        title: 'AC Drain Clearing & Filter Service',
        assignedTo: 'CoolCare Services (Mr. Ramesh: +91 98450 11223)',
        cost: '₹1,500',
      },
    },
    {
      id: 'issue-2',
      title: 'Washroom mixer tap dripping constantly',
      description: 'Hot/cold mixer faucet in attached bathroom does not shut off completely.',
      property: 'UrbanNest HSR Haven (Room A-101)',
      tenant: 'Rohan Gupta',
      category: 'PLUMBING',
      priority: 'MEDIUM',
      status: MaintenanceStatus.VERIFIED,
      date: '2026-09-08',
      assignedTask: {
        title: 'Replace faucet cartridge washer',
        assignedTo: 'City Plumbers (Technician Suresh)',
        cost: '₹750',
      },
    },
    {
      id: 'issue-3',
      title: 'Geyser MCB tripping when switched on',
      description: 'The miniature circuit breaker trips immediately when the bathroom geyser is turned on.',
      property: 'Nexus Heights Luxury PG (Room 101)',
      tenant: 'Arjun Mehta',
      category: 'ELECTRICAL',
      priority: 'HIGH',
      status: MaintenanceStatus.ISSUE_REPORTED,
      date: '2026-09-14',
      assignedTask: null,
    },
  ]);

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const newIssue = {
      id: `issue-${Date.now()}`,
      title,
      description: desc || 'Logged via portal',
      property: 'Nexus Heights Luxury PG (Room 101)',
      tenant: 'Arjun Mehta',
      category,
      priority,
      status: MaintenanceStatus.ISSUE_REPORTED,
      date: 'Today',
      assignedTask: null,
    };

    setIssues([newIssue, ...issues]);
    setTitle('');
    setDesc('');
    setShowReportModal(false);
  };

  const handleUpdateStatus = (issueId: string, newStatus: MaintenanceStatus) => {
    setIssues(
      issues.map((iss) => (iss.id === issueId ? { ...iss, status: newStatus } : iss))
    );
  };

  const filteredIssues =
    filter === 'ALL'
      ? issues
      : issues.filter((i) => i.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default">Facilities & Service Desk</Badge>
            <span className="text-xs text-slate-400">Autonomous Triage</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Maintenance & Repairs</h1>
          <p className="text-xs text-slate-400">
            Real-time tracking of reported issues, contractor dispatch, and tenant verification
          </p>
        </div>

        <Button
          onClick={() => setShowReportModal(true)}
          className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Report New Issue
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs">
        {['ALL', 'ISSUE_REPORTED', 'IN_PROGRESS', 'FIXED', 'VERIFIED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filter === tab
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <Card className="border-indigo-500/40 bg-slate-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-base text-white">Log Maintenance Request</CardTitle>
            <CardDescription className="text-xs">
              Directly routes to the property manager and assigns appropriate category priority
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Issue Title</Label>
                  <Input
                    placeholder="e.g. WiFi router unresponsive"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="PLUMBING">Plumbing</option>
                    <option value="ELECTRICAL">Electrical</option>
                    <option value="APPLIANCE">Appliance</option>
                    <option value="CLEANING">Cleaning / Housekeeping</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Detailed Description</Label>
                <Input
                  placeholder="Describe location, symptoms, urgency..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReportModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Create Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Issues List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredIssues.map((issue) => (
          <Card
            key={issue.id}
            className="border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all"
          >
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      issue.priority === 'HIGH'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {issue.priority} Priority
                  </span>
                  <span className="text-xs text-indigo-400 font-medium">{issue.category}</span>
                  <span className="text-slate-500 text-xs">•</span>
                  <span className="text-xs text-slate-400">{issue.property}</span>
                </div>

                <h3 className="text-base font-bold text-white">{issue.title}</h3>
                <p className="text-xs text-slate-400">{issue.description}</p>

                {issue.assignedTask ? (
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-300 uppercase">
                        Assigned Task:
                      </span>
                      <p className="text-slate-200">{issue.assignedTask.title}</p>
                      <p className="text-slate-500 text-[11px]">
                        Vendor: {issue.assignedTask.assignedTo}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500">Est. Cost</span>
                      <p className="text-sm font-bold text-white">{issue.assignedTask.cost}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    Pending technician dispatch by Property Manager
                  </div>
                )}
              </div>

              {/* Status & Actions */}
              <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Status:</span>
                  <Badge
                    variant={
                      issue.status === MaintenanceStatus.VERIFIED
                        ? 'success'
                        : issue.status === MaintenanceStatus.IN_PROGRESS
                        ? 'warning'
                        : 'secondary'
                    }
                  >
                    {issue.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {issue.status === MaintenanceStatus.ISSUE_REPORTED && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs h-8"
                      onClick={() => handleUpdateStatus(issue.id, MaintenanceStatus.IN_PROGRESS)}
                    >
                      Assign Task
                    </Button>
                  )}
                  {issue.status === MaintenanceStatus.IN_PROGRESS && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs h-8 text-emerald-400 border-emerald-500/30"
                      onClick={() => handleUpdateStatus(issue.id, MaintenanceStatus.FIXED)}
                    >
                      Mark Fixed
                    </Button>
                  )}
                  {issue.status === MaintenanceStatus.FIXED && (
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500"
                      onClick={() => handleUpdateStatus(issue.id, MaintenanceStatus.VERIFIED)}
                    >
                      Verify & Close
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
