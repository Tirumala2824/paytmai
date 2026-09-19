import { UserRole } from '@prisma/client';

export type Permission =
  // Profile permissions
  | 'profile:read:own'
  | 'profile:update:own'
  | 'profile:read:any'
  | 'profile:manage:any'
  // Property permissions
  | 'property:read:own'
  | 'property:create'
  | 'property:update:own'
  | 'property:delete:own'
  | 'property:read:any'
  | 'property:manage:any'
  // Room permissions
  | 'room:read:own_property'
  | 'room:manage:own_property'
  | 'room:read:any'
  | 'room:manage:any'
  // Tenancy permissions
  | 'tenancy:read:own'
  | 'tenancy:create:own_property'
  | 'tenancy:update:own'
  | 'tenancy:advance_lifecycle:own'
  | 'tenancy:read:any'
  | 'tenancy:manage:any'
  // Payment permissions
  | 'payment:read:own'
  | 'payment:create:own'
  | 'payment:read:own_property'
  | 'payment:read:any'
  | 'payment:manage:any'
  // Maintenance permissions
  | 'maintenance:report:own'
  | 'maintenance:read:own'
  | 'maintenance:read:own_property'
  | 'maintenance:update:own_property'
  | 'maintenance:read:any'
  | 'maintenance:manage:any'
  // Audit permissions
  | 'audit:read:own'
  | 'audit:read:own_property'
  | 'audit:read:any';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  TENANT: [
    'profile:read:own',
    'profile:update:own',
    'tenancy:read:own',
    'tenancy:advance_lifecycle:own',
    'payment:read:own',
    'payment:create:own',
    'maintenance:report:own',
    'maintenance:read:own',
    'audit:read:own',
  ],
  OWNER: [
    'profile:read:own',
    'profile:update:own',
    'property:read:own',
    'property:create',
    'property:update:own',
    'property:delete:own',
    'room:read:own_property',
    'room:manage:own_property',
    'tenancy:read:own',
    'tenancy:create:own_property',
    'tenancy:advance_lifecycle:own',
    'payment:read:own_property',
    'maintenance:read:own_property',
    'maintenance:update:own_property',
    'audit:read:own_property',
  ],
  PROPERTY_MANAGER: [
    'profile:read:own',
    'profile:update:own',
    'property:read:own',
    'room:read:own_property',
    'room:manage:own_property',
    'tenancy:read:own',
    'tenancy:advance_lifecycle:own',
    'payment:read:own_property',
    'maintenance:read:own_property',
    'maintenance:update:own_property',
    'audit:read:own_property',
  ],
  ADMIN: [
    'profile:read:own',
    'profile:update:own',
    'profile:read:any',
    'profile:manage:any',
    'property:read:own',
    'property:create',
    'property:update:own',
    'property:delete:own',
    'property:read:any',
    'property:manage:any',
    'room:read:own_property',
    'room:manage:own_property',
    'room:read:any',
    'room:manage:any',
    'tenancy:read:own',
    'tenancy:create:own_property',
    'tenancy:update:own',
    'tenancy:advance_lifecycle:own',
    'tenancy:read:any',
    'tenancy:manage:any',
    'payment:read:own',
    'payment:create:own',
    'payment:read:own_property',
    'payment:read:any',
    'payment:manage:any',
    'maintenance:report:own',
    'maintenance:read:own',
    'maintenance:read:own_property',
    'maintenance:update:own_property',
    'maintenance:read:any',
    'maintenance:manage:any',
    'audit:read:own',
    'audit:read:own_property',
    'audit:read:any',
  ],
};
