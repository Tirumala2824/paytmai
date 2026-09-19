import { describe, it, expect } from 'vitest';
import { UserRole } from '@prisma/client';
import { hasPermission, hasRole } from '@/lib/auth/rbac';
import { ROLE_PERMISSIONS } from '@/lib/auth/permissions';

describe('RBAC (Role-Based Access Control)', () => {
  describe('Tenant Role Permissions', () => {
    it('allows TENANT to read their own profile, tenancy, and report maintenance', () => {
      expect(hasPermission(UserRole.TENANT, 'profile:read:own')).toBe(true);
      expect(hasPermission(UserRole.TENANT, 'tenancy:read:own')).toBe(true);
      expect(hasPermission(UserRole.TENANT, 'payment:read:own')).toBe(true);
      expect(hasPermission(UserRole.TENANT, 'maintenance:report:own')).toBe(true);
    });

    it('denies TENANT from managing properties or accessing any data', () => {
      expect(hasPermission(UserRole.TENANT, 'property:create')).toBe(false);
      expect(hasPermission(UserRole.TENANT, 'property:delete:own')).toBe(false);
      expect(hasPermission(UserRole.TENANT, 'room:manage:own_property')).toBe(false);
      expect(hasPermission(UserRole.TENANT, 'tenancy:read:any')).toBe(false);
      expect(hasPermission(UserRole.TENANT, 'audit:read:any')).toBe(false);
    });
  });

  describe('Owner Role Permissions', () => {
    it('allows OWNER to manage owned properties, rooms, and view tenancies', () => {
      expect(hasPermission(UserRole.OWNER, 'property:read:own')).toBe(true);
      expect(hasPermission(UserRole.OWNER, 'property:create')).toBe(true);
      expect(hasPermission(UserRole.OWNER, 'room:manage:own_property')).toBe(true);
      expect(hasPermission(UserRole.OWNER, 'maintenance:read:own_property')).toBe(true);
    });

    it('denies OWNER from platform-wide arbitrary access', () => {
      expect(hasPermission(UserRole.OWNER, 'property:read:any')).toBe(false);
      expect(hasPermission(UserRole.OWNER, 'profile:manage:any')).toBe(false);
      expect(hasPermission(UserRole.OWNER, 'audit:read:any')).toBe(false);
    });
  });

  describe('Admin Role Permissions', () => {
    it('grants ADMIN full platform-wide access and permissions', () => {
      expect(hasPermission(UserRole.ADMIN, 'property:read:any')).toBe(true);
      expect(hasPermission(UserRole.ADMIN, 'profile:manage:any')).toBe(true);
      expect(hasPermission(UserRole.ADMIN, 'tenancy:manage:any')).toBe(true);
      expect(hasPermission(UserRole.ADMIN, 'audit:read:any')).toBe(true);
    });
  });

  describe('hasRole helper', () => {
    it('correctly matches single role', () => {
      expect(hasRole(UserRole.TENANT, UserRole.TENANT)).toBe(true);
      expect(hasRole(UserRole.TENANT, UserRole.OWNER)).toBe(false);
    });

    it('correctly matches role in allowed array', () => {
      expect(hasRole(UserRole.OWNER, [UserRole.OWNER, UserRole.ADMIN])).toBe(true);
      expect(hasRole(UserRole.TENANT, [UserRole.OWNER, UserRole.ADMIN])).toBe(false);
    });
  });
});
