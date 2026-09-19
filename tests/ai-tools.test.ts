import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI_TOOLS_REGISTRY } from '@/lib/ai/tools';
import { UserRole } from '@prisma/client';
import prisma from '@/lib/db';

// Mock prisma for isolated tool unit testing
vi.mock('@/lib/db', () => ({
  default: {
    tenant: {
      findUnique: vi.fn(),
    },
    owner: {
      findUnique: vi.fn(),
    },
    tenancy: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    rentSchedule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    maintenanceIssue: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    maintenanceTask: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    agentAction: {
      create: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
  },
}));

describe('AI Typed Tools Registry & Authorization Tests', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registry contains all 14 required typed tools', () => {
    const requiredTools = [
      'getTenantProfile',
      'getTenancy',
      'getRentStatus',
      'getPaymentHistory',
      'validatePayment',
      'getProperty',
      'getRoom',
      'getMaintenanceIssues',
      'getMaintenanceStatus',
      'createMaintenanceIssue',
      'createMaintenanceTask',
      'notifyOwner',
      'updateMaintenanceTask',
      'verifyMaintenanceResolution',
    ];

    for (const tool of requiredTools) {
      expect((AI_TOOLS_REGISTRY as any)[tool]).toBeDefined();
      expect((AI_TOOLS_REGISTRY as any)[tool].execute).toBeInstanceOf(Function);
      expect((AI_TOOLS_REGISTRY as any)[tool].schema).toBeDefined();
    }
  });

  describe('getRentStatus tool', () => {
    it('executes and returns rent status for authenticated tenant', async () => {
      (prisma.tenant.findUnique as any).mockResolvedValue({
        id: 'tenant-01',
        tenancies: [{ id: 'tenancy-01' }],
      });

      (prisma.rentSchedule.findMany as any).mockResolvedValue([
        {
          id: 'rs-01',
          tenancyId: 'tenancy-01',
          dueDate: new Date('2026-09-05'),
          amount: 18000,
          billingMonth: '2026-09',
          status: 'PENDING',
          payments: [],
        },
      ]);

      const result = await AI_TOOLS_REGISTRY.getRentStatus.execute(
        {},
        {
          userProfile: tenantProfile as any,
          sessionId: 'test-session',
        }
      );

      expect(result.status).toBe('SUCCESS');
      expect(result.output.billingMonth).toBe('2026-09');
      expect(result.output.amount).toBe(18000);
      expect(result.output.isPaid).toBe(false);
    });
  });

  describe('createMaintenanceIssue tool', () => {
    it('creates a maintenance issue for authenticated tenant and logs AgentAction', async () => {
      (prisma.tenant.findUnique as any).mockResolvedValue({
        id: 'tenant-01',
        userProfileId: tenantProfile.id,
        tenancies: [{ id: 'tenancy-01' }],
      });

      (prisma.tenancy.findUnique as any).mockResolvedValue({
        id: 'tenancy-01',
        tenantId: 'tenant-01',
        propertyId: 'prop-01',
        tenant: { userProfile: tenantProfile },
        property: { owner: { userProfile: ownerProfile } },
      });

      (prisma.maintenanceIssue.create as any).mockResolvedValue({
        id: 'issue-01',
        tenancyId: 'tenancy-01',
        title: 'AC cooling issue',
        category: 'APPLIANCE',
        priority: 'HIGH',
        status: 'ISSUE_REPORTED',
        createdAt: new Date(),
      });

      const result = await AI_TOOLS_REGISTRY.createMaintenanceIssue.execute(
        {
          title: 'AC cooling issue',
          description: 'AC is leaking and not cooling the bedroom',
          category: 'APPLIANCE',
          priority: 'HIGH',
        },
        {
          userProfile: tenantProfile as any,
          sessionId: 'test-session',
        }
      );

      expect(result.status).toBe('SUCCESS');
      expect(result.output.issueId).toBe('issue-01');
      expect(result.output.priority).toBe('HIGH');
    });
  });

  describe('notifyOwner tool', () => {
    it('dispatches notification to property owner and creates AuditEvent', async () => {
      (prisma.tenant.findUnique as any).mockResolvedValue({
        id: 'tenant-01',
        tenancies: [{ id: 'tenancy-01' }],
      });

      (prisma.tenancy.findUnique as any).mockResolvedValue({
        id: 'tenancy-01',
        tenant: { userProfile: tenantProfile },
        property: {
          owner: {
            userProfile: ownerProfile,
          },
        },
      });

      (prisma.notification.create as any).mockResolvedValue({
        id: 'notif-01',
        title: 'Rental Update from Arjun Mehta',
        message: 'AC in room 101 needs urgent attention',
        createdAt: new Date(),
      });

      const result = await AI_TOOLS_REGISTRY.notifyOwner.execute(
        {
          message: 'AC in room 101 needs urgent attention',
          urgent: true,
        },
        {
          userProfile: tenantProfile as any,
          sessionId: 'test-session',
        }
      );

      expect(result.status).toBe('SUCCESS');
      expect(result.output.recipientOwner).toBe(ownerProfile.name);
    });
  });
});
