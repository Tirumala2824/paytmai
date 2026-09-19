import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';
import { UserRole } from '@prisma/client';
import prisma from '@/lib/db';
import { sarvamSpeechToText, sarvamTextToSpeech } from '@/lib/voice/sarvam';
import { recordRentalMemoryEvent } from '@/lib/ai/memory/cognee';

vi.mock('@/lib/db', () => ({
  default: {
    agentSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    agentAction: {
      create: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    tenancy: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    rentSchedule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    maintenanceIssue: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    maintenanceTask: {
      create: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb) =>
      cb({
        tenancy: { update: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      })
    ),
  },
}));

vi.mock('@/lib/ai/llm', () => ({
  isGeminiConfigured: vi.fn().mockReturnValue(false),
  getGeminiModelName: vi.fn().mockReturnValue('gemini-1.5-flash'),
  dynamicAnalyzeIntent: vi.fn().mockResolvedValue(null),
  dynamicAnalyzeMultiIntents: vi.fn().mockResolvedValue(null),
  dynamicPlanTools: vi.fn().mockResolvedValue(null),
  dynamicSynthesizeResponse: vi.fn().mockResolvedValue(null),
}));

describe('Phase 3: Multilingual Voice & Multi-Intent AI Execution Tests', () => {
  const tenantProfile = {
    id: 'profile-tenant-01',
    authUserId: 'auth-tenant-01',
    email: 'arjun.mehta@gmail.com',
    name: 'Arjun Mehta',
    role: UserRole.TENANT,
    phone: '+91 99887 76655',
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ownerProfile = {
    id: 'profile-owner-01',
    authUserId: 'auth-owner-01',
    email: 'rajesh@nexusliving.in',
    name: 'Rajesh Sharma',
    role: UserRole.OWNER,
    phone: '+91 98765 43210',
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenancy = {
    id: 'tenancy-01',
    tenantId: 'tenant-01',
    roomId: 'room-01',
    propertyId: 'prop-01',
    monthlyRent: 18000,
    securityDeposit: 36000,
    lifecycleStage: 'RENT_DUE',
    isActive: true,
    property: {
      id: 'prop-01',
      name: 'Nexus Heights Luxury PG',
      address: '42, 5th Block, Koramangala',
      city: 'Bengaluru',
      owner: { userProfile: ownerProfile },
    },
    room: {
      id: 'room-01',
      roomNumber: '101',
      roomType: 'SINGLE',
    },
    tenant: {
      id: 'tenant-01',
      userProfileId: tenantProfile.id,
      userProfile: tenantProfile,
    },
    rentSchedules: [
      {
        id: 'rs-01',
        billingMonth: '2026-09',
        amount: 18000,
        dueDate: new Date('2026-09-05'),
        status: 'SUCCESS',
        payments: [{ id: 'pay-01', status: 'SUCCESS', amount: 18000 }],
      },
    ],
    maintenanceIssues: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.agentSession.create as any).mockResolvedValue({
      id: 'sess-p3-001',
      userProfileId: tenantProfile.id,
      status: 'ACTIVE',
    });
    (prisma.agentSession.update as any).mockResolvedValue({
      id: 'sess-p3-001',
      status: 'ACTIVE',
    });

    (prisma.tenant.findUnique as any).mockResolvedValue({
      id: 'tenant-01',
      userProfileId: tenantProfile.id,
      tenancies: [mockTenancy],
    });

    (prisma.tenancy.findUnique as any).mockResolvedValue(mockTenancy);
    (prisma.tenancy.findFirst as any).mockResolvedValue(mockTenancy);
    (prisma.agentAction.create as any).mockResolvedValue({ id: 'act-001' });
    (prisma.auditEvent.create as any).mockResolvedValue({ id: 'audit-001' });

    (prisma.rentSchedule.findMany as any).mockResolvedValue([
      {
        id: 'rs-01',
        billingMonth: '2026-09',
        amount: 18000,
        dueDate: new Date('2026-09-05'),
        status: 'SUCCESS',
        payments: [{ id: 'pay-01', status: 'SUCCESS', amount: 18000 }],
      },
    ]);

    (prisma.maintenanceIssue.create as any).mockResolvedValue({
      id: 'issue-ac-01',
      title: 'Air Conditioning malfunction reported',
      category: 'APPLIANCE',
      priority: 'HIGH',
      status: 'ISSUE_REPORTED',
      tenancyId: 'tenancy-01',
      createdAt: new Date(),
    });

    (prisma.maintenanceTask.create as any).mockResolvedValue({
      id: 'task-ac-01',
      title: 'Dispatch Technician for Air Conditioning malfunction reported',
      assignedTo: 'QuickFix Coliving Services (Authorized Vendor)',
      status: 'TASK_ASSIGNED',
    });

    (prisma.notification.create as any).mockResolvedValue({
      id: 'notif-01',
      title: 'Tenant reported: Air Conditioning malfunction reported',
      message: 'Air Conditioning malfunction reported',
      createdAt: new Date(),
    });
  });

  // ==========================================================================
  // 1. CANONICAL SUCCESS CRITERIA TEST
  // ==========================================================================
  it('1. Canonical Scenario: "My rent is paid, confirm it and tell the owner my AC isn\'t working."', async () => {
    const result = await executeRentalAssistant({
      userMessage: "My rent is paid, confirm it and tell the owner my AC isn't working.",
      userProfile: tenantProfile as any,
    });

    // Multi-intent detection verification
    expect(result.detectedIntents).toBeDefined();
    expect(result.detectedIntents?.length).toBeGreaterThanOrEqual(3);

    const detectedTypes = result.detectedIntents?.map((d) => d.intent);
    expect(detectedTypes).toContain('PAYMENT_VALIDATION');
    expect(detectedTypes).toContain('MAINTENANCE_REPORT');
    expect(detectedTypes).toContain('OWNER_NOTIFICATION');

    // Planned actions verification
    expect(result.plannedActions).toContain('getRentStatus');
    expect(result.plannedActions).toContain('createMaintenanceIssue');
    expect(result.plannedActions).toContain('createMaintenanceTask');
    expect(result.plannedActions).toContain('notifyOwner');

    // Tool execution verification
    const executedTools = result.toolCalls.map((t) => t.toolName);
    expect(executedTools).toContain('getRentStatus');
    expect(executedTools).toContain('createMaintenanceIssue');
    expect(executedTools).toContain('createMaintenanceTask');
    expect(executedTools).toContain('notifyOwner');

    // Per-intent breakdown verification
    expect(result.intentBreakdown).toBeDefined();
    expect(result.intentBreakdown?.length).toBeGreaterThanOrEqual(3);
    expect(result.intentBreakdown?.every((i) => i.status === 'SUCCESS')).toBe(true);

    // Lifecycle transition verification
    expect(result.nextState).toBe('ISSUE');

    // Transparent response verification
    expect(result.userResponse).toContain('Payment: ✓ Confirmed');
    expect(result.userResponse).toContain('Maintenance: ✓ Created');
    expect(result.userResponse).toContain('Owner Notification: ✓ Sent');

    // Audit and session logging verification
    expect(prisma.agentSession.create).toHaveBeenCalled();
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });

  // ==========================================================================
  // 2. PARALLEL EXECUTION VERIFICATION
  // ==========================================================================
  it('2. Executes independent tools in parallel without blocking each other', async () => {
    const result = await executeRentalAssistant({
      userMessage: "My rent is paid, confirm it and tell the owner my AC isn't working.",
      userProfile: tenantProfile as any,
    });

    // Both getRentStatus and createMaintenanceIssue are executed
    const rentStatusCall = result.toolCalls.find((t) => t.toolName === 'getRentStatus');
    const maintenanceCall = result.toolCalls.find((t) => t.toolName === 'createMaintenanceIssue');

    expect(rentStatusCall?.status).toBe('SUCCESS');
    expect(maintenanceCall?.status).toBe('SUCCESS');

    // Check execution steps include parallel markers
    const parallelSteps = result.executionSteps.filter((s) => s.label.includes('Parallel'));
    expect(parallelSteps.length).toBeGreaterThanOrEqual(2);
  });

  // ==========================================================================
  // 3. PARTIAL FAILURE HANDLING
  // ==========================================================================
  it('3. Handles partial failure accurately: never claims both succeeded if one failed', async () => {
    // Simulate failure in createMaintenanceIssue
    (prisma.maintenanceIssue.create as any).mockRejectedValueOnce(
      new Error('Database lock timeout on maintenance_issue table')
    );

    const result = await executeRentalAssistant({
      userMessage: "My rent is paid, confirm it and tell the owner my AC isn't working.",
      userProfile: tenantProfile as any,
    });

    // Payment should succeed
    const paymentBreakdown = result.intentBreakdown?.find(
      (i) => i.intent === 'PAYMENT_VALIDATION' || i.intent === 'PAYMENT_STATUS'
    );
    expect(paymentBreakdown?.status).toBe('SUCCESS');

    // Maintenance should fail
    const maintenanceBreakdown = result.intentBreakdown?.find(
      (i) => i.intent === 'MAINTENANCE_REPORT'
    );
    expect(maintenanceBreakdown?.status).toBe('FAILED');

    // Response must honestly reflect individual statuses
    expect(result.userResponse).toContain('Payment: ✓ Confirmed');
    expect(result.userResponse).toContain('Maintenance: ✗');
    expect(result.userResponse).not.toContain('Maintenance: ✓ Created');
  });

  // ==========================================================================
  // 4. SENSITIVE ACTION CONFIRMATION MECHANISM
  // ==========================================================================
  it('4. Requires human-in-the-loop confirmation before executing sensitive actions like paying rent', async () => {
    const result = await executeRentalAssistant({
      userMessage: 'I want to pay rent now.',
      userProfile: tenantProfile as any,
      confirmedAction: false,
    });

    // Confirmation must be required
    expect(result.pendingConfirmation).toBeDefined();
    expect(result.pendingConfirmation?.prompt).toContain('proceed with payment');
    expect(result.userResponse).toContain('proceed with payment');

    // Payment tool must NOT have executed yet
    const paymentCalls = result.toolCalls.filter((t) => t.toolName === 'validatePayment');
    expect(paymentCalls.length).toBe(0);
  });

  // ==========================================================================
  // 5. MULTILINGUAL DEMO (HINDI)
  // ==========================================================================
  it('5. Handles Hindi input, detects language, and synthesizes Hindi response', async () => {
    const hindiInput = 'मेरा किराया भर दिया है, पुष्टि करें और मालिक को बताएं कि मेरा एसी काम नहीं कर रहा है';

    const result = await executeRentalAssistant({
      userMessage: hindiInput,
      userProfile: tenantProfile as any,
      languageCode: 'hi-IN',
    });

    expect(result.languageCode).toBe('hi-IN');
    expect(result.detectedIntents?.length).toBeGreaterThanOrEqual(3);

    // Should include Hindi response terms
    expect(result.userResponse).toContain('भुगतान: ✓ पुष्ट');
    expect(result.userResponse).toContain('रखरखाव: ✓ दर्ज');
    expect(result.userResponse).toContain('मालिक को सूचना: ✓ प्रेषित');
  });

  // ==========================================================================
  // 6. SARVAM VOICE SERVICE & COGNEE MEMORY
  // ==========================================================================
  it('6. Sarvam STT & TTS services handle audio transcription and speech synthesis gracefully', async () => {
    const emptyBuffer = Buffer.from([]);

    // STT Test
    const sttResult = await sarvamSpeechToText({
      audioBuffer: emptyBuffer,
      languageCode: 'en-IN',
    });
    expect(sttResult.transcript).toBeDefined();
    expect(sttResult.languageCode).toBe('en-IN');

    // TTS Test
    const ttsResult = await sarvamTextToSpeech({
      text: 'Your rent of 18000 is confirmed paid.',
      targetLanguageCode: 'en-IN',
    });
    expect(ttsResult).toBeDefined();
    expect(ttsResult.languageCode).toBe('en-IN');

    // Memory Event Test
    const memoryResult = await recordRentalMemoryEvent({
      userProfileId: tenantProfile.id,
      tenancyId: 'tenancy-01',
      eventType: 'INTERACTION',
      summary: 'Tenant confirmed rent and reported AC issue',
    });
    expect(memoryResult.success).toBe(true);
  });
});
