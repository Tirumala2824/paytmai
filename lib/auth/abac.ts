import { UserProfile } from '@prisma/client';
import prisma from '@/lib/db';

/**
 * Attribute-Based Access Control (ABAC) module.
 * Validates resource-level ownership and association on the server side.
 * Never trusts client-supplied IDs.
 */

export async function canAccessProperty(
  userProfile: UserProfile,
  propertyId: string
): Promise<boolean> {
  // ADMIN has platform-wide access
  if (userProfile.role === 'ADMIN') {
    return true;
  }

  // OWNER can only access properties they own
  if (userProfile.role === 'OWNER') {
    const owner = await prisma.owner.findUnique({
      where: { userProfileId: userProfile.id },
    });
    if (!owner) return false;

    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        ownerId: owner.id,
      },
    });

    return !!property;
  }

  // TENANT can access property if they have an active tenancy there
  if (userProfile.role === 'TENANT') {
    const tenant = await prisma.tenant.findUnique({
      where: { userProfileId: userProfile.id },
    });
    if (!tenant) return false;

    const tenancy = await prisma.tenancy.findFirst({
      where: {
        propertyId,
        tenantId: tenant.id,
      },
    });

    return !!tenancy;
  }

  return false;
}

export async function canAccessRoom(
  userProfile: UserProfile,
  roomId: string
): Promise<boolean> {
  if (userProfile.role === 'ADMIN') return true;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { property: true },
  });

  if (!room) return false;

  return canAccessProperty(userProfile, room.propertyId);
}

export async function canAccessTenancy(
  userProfile: UserProfile,
  tenancyId: string
): Promise<boolean> {
  if (userProfile.role === 'ADMIN') return true;

  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: {
      tenant: true,
      property: {
        include: { owner: true },
      },
    },
  });

  if (!tenancy) return false;

  // Tenant can access ONLY own tenancy
  if (userProfile.role === 'TENANT') {
    return tenancy.tenant.userProfileId === userProfile.id;
  }

  // Owner can access tenancy in their owned properties
  if (userProfile.role === 'OWNER') {
    return tenancy.property.owner.userProfileId === userProfile.id;
  }

  // Property manager check (if assigned)
  if (userProfile.role === 'PROPERTY_MANAGER') {
    return tenancy.property.owner.userProfileId === userProfile.id;
  }

  return false;
}

export async function canAccessMaintenanceIssue(
  userProfile: UserProfile,
  issueId: string
): Promise<boolean> {
  if (userProfile.role === 'ADMIN') return true;

  const issue = await prisma.maintenanceIssue.findUnique({
    where: { id: issueId },
    include: {
      reportedBy: true,
      property: {
        include: { owner: true },
      },
      tenancy: {
        include: { tenant: true },
      },
    },
  });

  if (!issue) return false;

  if (userProfile.role === 'TENANT') {
    return issue.reportedBy.userProfileId === userProfile.id;
  }

  if (userProfile.role === 'OWNER') {
    return issue.property.owner.userProfileId === userProfile.id;
  }

  return false;
}

export async function canAccessPayment(
  userProfile: UserProfile,
  paymentId: string
): Promise<boolean> {
  if (userProfile.role === 'ADMIN') return true;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      rentSchedule: {
        include: {
          tenancy: {
            include: {
              tenant: true,
              property: { include: { owner: true } },
            },
          },
        },
      },
    },
  });

  if (!payment) return false;

  const tenancy = payment.rentSchedule.tenancy;

  if (userProfile.role === 'TENANT') {
    return tenancy.tenant.userProfileId === userProfile.id;
  }

  if (userProfile.role === 'OWNER') {
    return tenancy.property.owner.userProfileId === userProfile.id;
  }

  return false;
}

/**
 * Assertion helpers that throw standard FORBIDDEN errors if access is denied.
 */
export async function assertPropertyAccess(userProfile: UserProfile, propertyId: string) {
  const allowed = await canAccessProperty(userProfile, propertyId);
  if (!allowed) {
    throw new Error(`FORBIDDEN: You do not have access to property ${propertyId}`);
  }
}

export async function assertTenancyAccess(userProfile: UserProfile, tenancyId: string) {
  const allowed = await canAccessTenancy(userProfile, tenancyId);
  if (!allowed) {
    throw new Error(`FORBIDDEN: You do not have access to tenancy ${tenancyId}`);
  }
}

export async function assertMaintenanceIssueAccess(userProfile: UserProfile, issueId: string) {
  const allowed = await canAccessMaintenanceIssue(userProfile, issueId);
  if (!allowed) {
    throw new Error(`FORBIDDEN: You do not have access to maintenance issue ${issueId}`);
  }
}
