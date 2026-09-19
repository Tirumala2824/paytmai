import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';
import { UserRole } from '@prisma/client';
import prisma from '@/lib/db';

vi.mock('@/lib/db', () => ({
  default: {
    agentSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    agentAction: {
      create: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
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
    $transaction: vi.fn((cb) => cb({
      tenancy: { update: vi.fn().mockResolvedValue({}) },
      notification: { create: vi.fn().mockResolvedValue({}) },
    })),
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

describe('AI Orchestrator Phase 2 Success Criteria Tests', () => {
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
        status: 'PENDING',
        payments: [],
      },
    ],
    maintenanceIssues: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.agentSession.create as any).mockResolvedValue({
      id: 'sess-001',
      userProfileId: tenantProfile.id,
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
  });

  it('1. Handles "Is my rent paid?" correctly and returns structured status', async () => {
    (prisma.rentSchedule.findMany as any).mockResolvedValue([
      {
        id: 'rs-01',
        billingMonth: '2026-09',
        amount: 18000,
        dueDate: new Date('2026-09-05'),
        status: 'PENDING',
        payments: [],
      },
    ]);

    const result = await executeRentalAssistant({
      userMessage: 'Is my rent paid?',
      userProfile: tenantProfile as any,
    });

    expect(result.intent).toBe('PAYMENT_STATUS');
    expect(result.plannedActions).toContain('getRentStatus');
    expect(result.userResponse).toContain('18,000');
    expect(result.userResponse).toContain('PENDING');
    expect(result.executionSteps.length).toBeGreaterThan(0);
    expect(prisma.agentSession.create).toHaveBeenCalled();
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });

  it('2. Handles "My rent is due when?" and returns upcoming due date', async () => {
    (prisma.rentSchedule.findMany as any).mockResolvedValue([
      {
        id: 'rs-01',
        billingMonth: '2026-09',
        amount: 18000,
        dueDate: new Date('2026-09-05'),
        status: 'PENDING',
        payments: [],
      },
    ]);

    const result = await executeRentalAssistant({
      userMessage: 'My rent is due when?',
      userProfile: tenantProfile as any,
    });

    expect(result.intent).toBe('RENT_DUE');
    expect(result.plannedActions).toContain('getRentStatus');
    expect(result.userResponse).toContain('2026-09-05');
  });

  it('3. Handles "My AC isn\'t working." by autonomously creating issue, task, and notifying owner', async () => {
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
      title: 'Maintenance Update from Arjun Mehta',
      createdAt: new Date(),
    });

    const result = await executeRentalAssistant({
      userMessage: "My AC isn't working.",
      userProfile: tenantProfile as any,
    });

    expect(result.intent).toBe('MAINTENANCE_REPORT');
    expect(result.plannedActions).toContain('createMaintenanceIssue');
    expect(result.plannedActions).toContain('createMaintenanceTask');
    expect(result.plannedActions).toContain('notifyOwner');
    expect(result.userResponse).toContain('Air Conditioning');
    expect(result.userResponse).toContain('HIGH');
    expect(result.nextState).toBe('ISSUE');
  });

  it('4. Handles "Show my maintenance issues." by retrieving open issues', async () => {
    (prisma.maintenanceIssue.findMany as any).mockResolvedValue([
      {
        id: 'issue-01',
        title: 'AC leaking water',
        category: 'APPLIANCE',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        property: { name: 'Nexus Heights Luxury PG' },
        createdAt: new Date(),
        tasks: [{ id: 'task-01' }],
      },
    ]);

    const result = await executeRentalAssistant({
      userMessage: 'Show my maintenance issues.',
      userProfile: tenantProfile as any,
    });

    expect(result.intent).toBe('MAINTENANCE_STATUS');
    expect(result.plannedActions).toContain('getMaintenanceIssues');
    expect(result.userResponse).toContain('AC leaking water');
    expect(result.userResponse).toContain('IN_PROGRESS');
  });

  it('5. Handles "Tell the owner my AC is broken." by dispatching notification', async () => {
    (prisma.notification.create as any).mockResolvedValue({
      id: 'notif-02',
      title: 'Alert from Arjun Mehta',
      message: 'Tell the owner my AC is broken.',
      createdAt: new Date(),
    });

    const result = await executeRentalAssistant({
      userMessage: 'Tell the owner my AC is broken.',
      userProfile: tenantProfile as any,
    });

    expect(result.intent).toBe('OWNER_NOTIFICATION');
    expect(result.plannedActions).toContain('notifyOwner');
    expect(result.userResponse).toContain('dispatched to your property owner');
  });
});
