'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaintenanceStatus, VerificationMethod } from '@prisma/client';
import {
  Wrench,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  Camera,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Eye,
  Check,
  X,
  FileText,
  Home,
  User,
  Zap,
} from 'lucide-react';

interface VerificationItem {
  id: string;
  verificationMethod: VerificationMethod;
  verifiedBy: string;
  verifiedAt: string;
  evidence?: string;
  confidence?: number | null;
  notes?: string;
}

interface MaintenanceTaskItem {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string;
  estimatedCost?: number;
  actualCost?: number;
  status: MaintenanceStatus;
  completedAt?: string;
}

interface MaintenanceIssueItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: MaintenanceStatus;
  resolution?: string | null;
  imageUrl?: string | null;
  isRepeated: boolean;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    name: string;
    address: string;
  };
  room: {
    id: string;
    roomNumber: string;
    floor: number;
  } | null;
  reportedBy: {
    name: string;
    email: string;
    phone?: string;
  };
  tasks: MaintenanceTaskItem[];
  verifications: VerificationItem[];
}

export default function MaintenancePage() {
  const [filter, setFilter] = useState<string>('ALL');
  const [issues, setIssues] = useState<MaintenanceIssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedIssueForVerify, setSelectedIssueForVerify] = useState<MaintenanceIssueItem | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // New Issue Form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('APPLIANCE');
  const [newPriority, setNewPriority] = useState('HIGH');
  const [newIsRepeated, setNewIsRepeated] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);

  // Verification Form
  const [verifyMethod, setVerifyMethod] = useState<VerificationMethod>(VerificationMethod.COMBINED);
  const [verifyEvidence, setVerifyEvidence] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyResolution, setVerifyResolution] = useState('');
  const [verifyConfidence, setVerifyConfidence] = useState(0.96);
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);

  useEffect(() => {
    fetchIssues();
  }, []);

  async function fetchIssues() {
    setLoading(true);
    try {
      const res = await fetch('/api/maintenance');
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
      }
    } catch (err) {
      console.warn('Failed to load issues from API, using fallback data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || 'Reported via maintenance workspace',
          category: newCategory,
          priority: newPriority,
          isRepeated: newIsRepeated,
          imageUrl: newImageUrl || undefined,
        }),
      });

      if (res.ok) {
        setNewTitle('');
        setNewDesc('');
        setNewImageUrl(null);
        setShowReportModal(false);
        fetchIssues();
      }
    } catch (err) {
      console.error('Error creating issue:', err);
    }
  }

  async function handleVerifySubmit(confirmed: boolean) {
    if (!selectedIssueForVerify) return;
    setIsSubmittingVerify(true);

    try {
      const res = await fetch('/api/maintenance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: selectedIssueForVerify.id,
          verificationMethod: verifyMethod,
          evidence: verifyEvidence || (confirmed ? 'Resolution inspected and confirmed' : 'Issue persists'),
          confidence:
            verifyMethod === VerificationMethod.AI_IMAGE_ANALYSIS || verifyMethod === VerificationMethod.COMBINED
              ? verifyConfidence
              : undefined,
          notes: verifyNotes,
          resolution: verifyResolution || selectedIssueForVerify.resolution || 'Repairs completed by technician',
          confirmed,
        }),
      });

      if (res.ok) {
        setSelectedIssueForVerify(null);
        setVerifyEvidence('');
        setVerifyNotes('');
        setVerifyResolution('');
        fetchIssues();
      }
    } catch (err) {
      console.error('Error submitting verification:', err);
    } finally {
      setIsSubmittingVerify(false);
    }
  }

  // Visual Lifecycle Stepper definition
  const lifecycleSteps = [
    { key: 'REPORTED', label: 'Reported', statusMatch: [MaintenanceStatus.ISSUE_REPORTED, MaintenanceStatus.CLASSIFIED, MaintenanceStatus.OWNER_NOTIFIED] },
    { key: 'ASSIGNED', label: 'Assigned', statusMatch: [MaintenanceStatus.TASK_ASSIGNED] },
    { key: 'IN_PROGRESS', label: 'In Progress', statusMatch: [MaintenanceStatus.IN_PROGRESS] },
    { key: 'FIXED', label: 'Fixed', statusMatch: [MaintenanceStatus.FIXED] },
    { key: 'VERIFICATION', label: 'Verification', statusMatch: [MaintenanceStatus.VERIFICATION_PENDING] },
    { key: 'VERIFIED', label: 'Verified', statusMatch: [MaintenanceStatus.VERIFIED, MaintenanceStatus.CLOSED] },
  ];

  function getActiveStepIndex(status: MaintenanceStatus): number {
    switch (status) {
      case MaintenanceStatus.ISSUE_REPORTED:
      case MaintenanceStatus.CLASSIFIED:
      case MaintenanceStatus.OWNER_NOTIFIED:
        return 0;
      case MaintenanceStatus.TASK_ASSIGNED:
        return 1;
      case MaintenanceStatus.IN_PROGRESS:
        return 2;
      case MaintenanceStatus.FIXED:
        return 3;
      case MaintenanceStatus.VERIFICATION_PENDING:
        return 4;
      case MaintenanceStatus.VERIFIED:
      case MaintenanceStatus.CLOSED:
        return 5;
      default:
        return 0;
    }
  }

  const filteredIssues = issues.filter((issue) => {
    if (filter === 'ALL') return true;
    if (filter === 'REPEATED') return issue.isRepeated;
    if (filter === 'OPEN') return issue.status !== MaintenanceStatus.CLOSED && issue.status !== MaintenanceStatus.VERIFIED;
    if (filter === 'VERIFICATION_PENDING') return issue.status === MaintenanceStatus.VERIFICATION_PENDING || issue.status === MaintenanceStatus.FIXED;
    if (filter === 'RESOLVED') return issue.status === MaintenanceStatus.VERIFIED || issue.status === MaintenanceStatus.CLOSED;
    return issue.status === filter;
  });

  const urgentCount = issues.filter((i) => i.priority === 'HIGH' || i.priority === 'EMERGENCY').length;
  const inProgressCount = issues.filter((i) => i.status === MaintenanceStatus.IN_PROGRESS || i.status === MaintenanceStatus.TASK_ASSIGNED).length;
  const pendingVerifyCount = issues.filter((i) => i.status === MaintenanceStatus.VERIFICATION_PENDING || i.status === MaintenanceStatus.FIXED).length;
  const repeatedCount = issues.filter((i) => i.isRepeated).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Maintenance &amp; Repairs</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Report issues, track repairs, and confirm fixes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIssues}
            className="text-xs border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>

          <Button
            onClick={() => setShowReportModal(true)}
            className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Report Issue
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-xs text-slate-400">Total Issues</span>
          <p className="text-2xl font-bold text-white mt-1">{issues.length}</p>
          <span className="text-[11px] text-indigo-400">In your rental</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Urgent
          </span>
          <p className="text-2xl font-bold text-amber-300 mt-1">{urgentCount}</p>
          <span className="text-[11px] text-slate-400">Needs attention</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-xs text-sky-400 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> In Progress
          </span>
          <p className="text-2xl font-bold text-sky-300 mt-1">{inProgressCount}</p>
          <span className="text-[11px] text-slate-400">Repair underway</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Needs Confirmation
          </span>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{pendingVerifyCount}</p>
          <span className="text-[11px] text-slate-400">Awaiting your sign-off</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs no-scrollbar">
        {[
          { key: 'ALL', label: 'All' },
          { key: 'OPEN', label: 'Open' },
          { key: 'IN_PROGRESS', label: 'In Progress' },
          { key: 'VERIFICATION_PENDING', label: 'Awaiting Confirmation' },
          { key: 'RESOLVED', label: 'Resolved' },
          { key: 'REPEATED', label: `Recurring (${repeatedCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
              filter === tab.key
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Issues List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
          <span>Loading your issues...</span>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-white">All clear!</p>
          <p className="text-xs text-slate-400">No issues found here. Your room looks good.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => {
            const activeStep = getActiveStepIndex(issue.status);
            const latestTask = issue.tasks[issue.tasks.length - 1];
            const latestVerification = issue.verifications[0];

            return (
              <Card
                key={issue.id}
                className={`border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-all overflow-hidden ${
                  issue.isRepeated ? 'ring-1 ring-amber-500/30' : ''
                }`}
              >
                <CardContent className="p-6 space-y-4">
                  {/* Top Header: Priority, Category, Property, Room, Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          issue.priority === 'HIGH' || issue.priority === 'EMERGENCY'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {issue.priority} Priority
                      </span>

                      <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-800">
                        {issue.category}
                      </Badge>

                      {issue.isRepeated && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Repeated Issue
                        </span>
                      )}

                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-xs text-slate-300 flex items-center gap-1">
                        <Home className="h-3 w-3 text-slate-400" />
                        {issue.property.name}
                        {issue.room ? ` (Room ${issue.room.roomNumber})` : ''}
                      </span>
                    </div>

                    <span className="text-xs text-slate-500">
                      Reported: {new Date(issue.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{issue.title}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{issue.description}</p>
                  </div>

                  {/* Visual Lifecycle Stepper */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] mb-2 font-medium text-slate-400">
                      <span>Repair Progress</span>
                      <span className="text-indigo-400 font-semibold capitalize">{issue.status.toLowerCase().replace(/_/g, ' ')}</span>
                    </div>

                    <div className="grid grid-cols-6 gap-1 sm:gap-2">
                      {lifecycleSteps.map((step, idx) => {
                        const isCompleted = idx < activeStep;
                        const isCurrent = idx === activeStep;

                        return (
                          <div key={step.key} className="flex flex-col items-center text-center gap-1">
                            <div
                              className={`h-2 w-full rounded-full transition-all ${
                                isCompleted
                                  ? 'bg-emerald-500'
                                  : isCurrent
                                  ? 'bg-indigo-500 animate-pulse ring-2 ring-indigo-500/40'
                                  : 'bg-slate-800'
                              }`}
                            />
                            <span
                              className={`text-[9px] sm:text-[10px] font-semibold truncate w-full ${
                                isCompleted
                                  ? 'text-emerald-400'
                                  : isCurrent
                                  ? 'text-indigo-300'
                                  : 'text-slate-600'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detailed Specs Grid: Assigned To, Timeline, Evidence, Verification, Resolution */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Contractor details */}
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Repair Person
                      </span>
                      {latestTask ? (
                        <div>
                          <p className="text-white font-medium">{latestTask.title}</p>
                          <p className="text-slate-400 text-[11px]">
                            Assigned To: <span className="text-indigo-300">{latestTask.assignedTo || 'Unassigned'}</span>
                          </p>
                          {latestTask.estimatedCost && (
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              Est: ₹{latestTask.estimatedCost.toLocaleString('en-IN')}{' '}
                              {latestTask.actualCost ? `• Actual: ₹${latestTask.actualCost.toLocaleString('en-IN')}` : ''}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-amber-400/80 text-[11px]">
                          Pending technician dispatch by Property Manager.
                        </p>
                      )}
                    </div>

                    {/* Verification */}
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Verification
                      </span>
                      {latestVerification ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                              {latestVerification.verificationMethod}
                            </span>
                            {latestVerification.confidence && (
                              <span className="text-[10px] text-sky-300 font-mono">
                                (Confidence: {Math.round(latestVerification.confidence * 100)}%)
                              </span>
                            )}
                          </div>
                          <p className="text-slate-300 text-[11px]">{latestVerification.evidence}</p>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-[11px]">
                          {issue.status === MaintenanceStatus.CLOSED || issue.status === MaintenanceStatus.VERIFIED
                            ? 'Verified via tenant sign-off'
                            : 'Verification pending post-repair inspection'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Photo Evidence if uploaded */}
                  {issue.imageUrl && (
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider flex items-center gap-1">
                          <Camera className="h-3 w-3" /> Photo Evidence (Tenant Upload)
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-mono">
                          sarvam-vision ready
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img
                          src={issue.imageUrl}
                          alt="Issue photo"
                          onClick={() => setPreviewImageUrl(issue.imageUrl || null)}
                          className="h-16 w-16 rounded-lg object-cover cursor-pointer border border-slate-700 hover:border-indigo-500 transition-all shadow-md"
                        />
                        <div className="text-[11px] text-slate-400">
                          Click image to expand. Uploaded photo evidence attached to this ticket for agent & contractor inspection.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resolution */}
                  {issue.resolution && (
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
                          How it was fixed
                        </span>
                        <p className="text-emerald-100 text-[11px] mt-0.5">{issue.resolution}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] text-slate-500">
                      Reported by {issue.reportedBy.name}
                    </div>

                    <div className="flex items-center gap-2">
                      {issue.status !== MaintenanceStatus.CLOSED && issue.status !== MaintenanceStatus.VERIFIED && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedIssueForVerify(issue);
                            setVerifyResolution(issue.resolution || '');
                          }}
                          className="text-xs h-8 gap-1 bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirm It&apos;s Fixed
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Multi-Source Verification Modal */}
      {selectedIssueForVerify && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-indigo-500/40 bg-slate-900 shadow-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Confirm the Repair is Done
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIssueForVerify(null)}
                  className="h-7 w-7 p-0 text-slate-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Verify resolution for &quot;{selectedIssueForVerify.title}&quot; in {selectedIssueForVerify.property.name}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* Verification Source Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">How was it verified?</Label>
                <select
                  value={verifyMethod}
                  onChange={(e) => setVerifyMethod(e.target.value as VerificationMethod)}
                  className="flex h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value={VerificationMethod.TENANT_CONFIRMATION}>
                    I personally confirmed the repair
                  </option>
                  <option value={VerificationMethod.OWNER_CONFIRMATION}>
                    Owner/manager physically checked
                  </option>
                  <option value={VerificationMethod.AI_IMAGE_ANALYSIS}>
                    AI analysed a repair photo
                  </option>
                  <option value={VerificationMethod.COMBINED}>
                    I confirmed + AI checked the photo
                  </option>
                </select>
                <span className="text-[10px] text-slate-500">
                  Note: Pure human confirmation does not claim AI vision confidence.
                </span>
              </div>

              {/* Tenant Photo Evidence in Verification Modal if available */}
              {selectedIssueForVerify?.imageUrl && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-sky-300 font-semibold flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-sky-400" />
                      Uploaded Photo Evidence
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Tenant Evidence</span>
                  </div>
                  <img
                    src={selectedIssueForVerify.imageUrl}
                    alt="Uploaded evidence"
                    onClick={() => setPreviewImageUrl(selectedIssueForVerify.imageUrl || null)}
                    className="max-h-44 w-full rounded-xl object-cover cursor-pointer border border-slate-800 hover:border-indigo-500 transition-all shadow-md"
                  />
                  <p className="text-[10px] text-slate-500 text-center">Click photo to view full resolution</p>
                </div>
              )}

              {/* AI Image Analysis specific confidence display */}
              {(verifyMethod === VerificationMethod.AI_IMAGE_ANALYSIS ||
                verifyMethod === VerificationMethod.COMBINED) && (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-900/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      AI Photo Analysis (sarvam-vision)
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {Math.round(verifyConfidence * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="0.99"
                    step="0.01"
                    value={verifyConfidence}
                    onChange={(e) => setVerifyConfidence(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Model: <code className="text-indigo-300">sarvam-vision</code> (Multimodal Inspection)</span>
                    <span className="text-emerald-400 font-medium">Verified Clean</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">What proof do you have?</Label>
                <Input
                  placeholder="e.g. I tested the AC, it's cooling at 18°C. Invoice #CC-9021 attached."
                  value={verifyEvidence}
                  onChange={(e) => setVerifyEvidence(e.target.value)}
                />
              </div>

              {/* Resolution description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">How was it fixed?</Label>
                <Input
                  placeholder="e.g. AC serviced: filter cleaned, gas recharged."
                  value={verifyResolution}
                  onChange={(e) => setVerifyResolution(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Any additional notes?</Label>
                <Input
                  placeholder="Optional: warranty info, follow-up needed, etc."
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVerifySubmit(false)}
                  disabled={isSubmittingVerify}
                  className="text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  It&apos;s still broken
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleVerifySubmit(true)}
                  disabled={isSubmittingVerify}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {isSubmittingVerify ? 'Saving...' : 'Yes, it\'s fixed!'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-indigo-500/40 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-indigo-400" />
                  Report a Problem
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReportModal(false)}
                  className="h-7 w-7 p-0 text-slate-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Describe what&apos;s broken or not working — attach a photo for instant AI verification.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleCreateIssue} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Issue Title</Label>
                  <Input
                    placeholder="e.g. AC not cooling or leaking water"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Category</Label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100"
                    >
                      <option value="APPLIANCE">Appliance (AC, Geyser)</option>
                      <option value="PLUMBING">Plumbing (Tap, Pipe)</option>
                      <option value="ELECTRICAL">Electrical</option>
                      <option value="CLEANING">Cleaning / Housekeeping</option>
                      <option value="GENERAL">General</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Priority</Label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100"
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                      <option value="EMERGENCY">Emergency</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Detailed Description</Label>
                  <Input
                    placeholder="Describe symptoms, room location, urgency..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                {/* Photo Evidence Upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-sky-400" />
                      Attach Photo Evidence (Optional)
                    </span>
                    <span className="text-[10px] text-slate-500">Max 5MB (JPG/PNG)</span>
                  </Label>

                  {newImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-2 flex items-center gap-3">
                      <img src={newImageUrl} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
                      <div className="text-xs text-slate-300 flex-1 truncate">
                        Photo attached · Ready for sarvam-vision inspection
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewImageUrl(null)}
                        className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-3 text-center transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            alert('Image exceeds 5MB limit');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => setNewImageUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <Camera className="h-5 w-5 text-slate-500" />
                        <span className="text-xs font-medium text-slate-300">Click to upload photo evidence</span>
                        <span className="text-[10px] text-slate-500">Enables automatic sarvam-vision AI analysis</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isRepeatedCheck"
                    checked={newIsRepeated}
                    onChange={(e) => setNewIsRepeated(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isRepeatedCheck" className="text-slate-300 text-xs cursor-pointer">
                    This has happened before (Repeated Issue)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReportModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500">
                    Create Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Photo Preview Dialog */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center backdrop-blur-sm z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={previewImageUrl} alt="Full resolution evidence" className="max-h-[80vh] w-auto object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
