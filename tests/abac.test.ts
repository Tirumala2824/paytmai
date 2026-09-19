import { describe, it, expect, vi } from 'vitest';
import { UserProfile, UserRole } from '@prisma/client';
import { canAccessProperty, canAccessTenancy } from '@/lib/auth/abac';
import prisma from '@/lib/db';

// Mock Prisma client for unit testing ABAC isolation rules
vi.mock('@/lib/db', () => ({
  default: {
    owner: {
      findUnique: vi.fn(),
    },
    property: {
      findFirst: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    tenancy: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('ABAC (Attribute-Based Access Control) Resource Isolation', () => {
  const adminUser: UserProfile = {
    id: 'admin-id',
    authUserId: 'admin-auth',
    email: 'admin@havendex.io',
    name: 'Admin',
    phone: null,
    role: UserRole.ADMIN,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const owner1User: UserProfile = {
    id: 'owner1-profile-id',
    authUserId: 'owner1-auth',
    email: 'owner1@nexus.in',
    name: 'Rajesh Sharma',
    phone: null,
    role: UserRole.OWNER,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const tenant1User: UserProfile = {
    id: 'tenant1-profile-id',
    authUserId: 'tenant1-auth',
    email: 'tenant1@gmail.com',
    name: 'Arjun Mehta',
    phone: null,
    role: UserRole.TENANT,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('Property Access Isolation', () => {
    it('allows ADMIN platform-wide access to any property', async () => {
      const allowed = await canAccessProperty(adminUser, 'any-property-id');
      expect(allowed).toBe(true);
    });

    it('allows OWNER to access their own property', async () => {
      (prisma.owner.findUnique as any).mockResolvedValueOnce({
        id: 'owner-1',
        userProfileId: owner1User.id,
        companyName: null,
        taxId: null,
        bankAccountDetails: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.property.findFirst as any).mockResolvedValueOnce({
        id: 'prop-1',
        ownerId: 'owner-1',
        name: 'Nexus Heights',
        address: 'Koramangala',
        city: 'Bangalore',
        state: 'KA',
        zipCode: '560095',
        propertyType: 'PG',
        description: null,
        totalRooms: 10,
        amenities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const allowed = await canAccessProperty(owner1User, 'prop-1');
      expect(allowed).toBe(true);
    });

    it('DENIES OWNER from accessing another owners property', async () => {
      (prisma.owner.findUnique as any).mockResolvedValueOnce({
        id: 'owner-1',
        userProfileId: owner1User.id,
        companyName: null,
        taxId: null,
        bankAccountDetails: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.property.findFirst as any).mockResolvedValueOnce(null);

      const allowed = await canAccessProperty(owner1User, 'other-owner-property');
      expect(allowed).toBe(false);
    });
  });

  describe('Tenancy Access Isolation', () => {
    it('allows TENANT to access only their own tenancy', async () => {
      (prisma.tenancy.findUnique as any).mockResolvedValueOnce({
        id: 'tenancy-1',
        tenantId: 'tenant-1',
        roomId: 'room-1',
        propertyId: 'prop-1',
        startDate: new Date(),
        endDate: null,
        monthlyRent: 18000,
        securityDeposit: 36000,
        lifecycleStage: 'RENT_DUE',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenant: {
          id: 'tenant-1',
          userProfileId: tenant1User.id,
        },
        property: {
          id: 'prop-1',
          owner: {
            id: 'owner-1',
            userProfileId: 'other-owner-id',
          },
        },
      } as any);

      const allowed = await canAccessTenancy(tenant1User, 'tenancy-1');
      expect(allowed).toBe(true);
    });

    it('DENIES TENANT A from accessing TENANT B tenancy', async () => {
      (prisma.tenancy.findUnique as any).mockResolvedValueOnce({
        id: 'tenancy-2',
        tenantId: 'tenant-2',
        roomId: 'room-2',
        propertyId: 'prop-1',
        startDate: new Date(),
        endDate: null,
        monthlyRent: 20000,
        securityDeposit: 40000,
        lifecycleStage: 'PAYMENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenant: {
          id: 'tenant-2',
          userProfileId: 'other-tenant-profile-id', // Different tenant!
        },
        property: {
          id: 'prop-1',
          owner: {
            id: 'owner-1',
            userProfileId: 'owner-1-id',
          },
        },
      } as any);

      const allowed = await canAccessTenancy(tenant1User, 'tenancy-2');
      expect(allowed).toBe(false);
    });
  });
});
