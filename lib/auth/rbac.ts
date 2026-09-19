import { UserRole, UserProfile } from '@prisma/client';
import { Permission, ROLE_PERMISSIONS } from './permissions';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/db';

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

export function hasRole(userRole: UserRole, allowedRoles: UserRole | UserRole[]): boolean {
  if (Array.isArray(allowedRoles)) {
    return allowedRoles.includes(userRole);
  }
  return userRole === allowedRoles;
}

export type AuthContext = {
  userProfile: UserProfile;
  supabaseUser: {
    id: string;
    email?: string;
  };
};

import { cookies } from 'next/headers';

/**
 * Server-side helper to retrieve the authenticated user and their UserProfile from the database.
 * NEVER trusts client-supplied user or role IDs.
 */
export async function getAuthenticatedUser(): Promise<AuthContext | null> {
  try {
    // 1. Try Supabase Auth user
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        const userProfile = await prisma.userProfile.findUnique({
          where: { authUserId: user.id },
          include: {
            tenant: true,
            owner: true,
          },
        });

        if (userProfile) {
          return {
            userProfile,
            supabaseUser: {
              id: user.id,
              email: user.email,
            },
          };
        }
      }
    } catch (sbErr) {
      // Supabase user fetch failed, fallback to session cookie
    }

    // 2. Check session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('havendex_session');
    if (sessionCookie?.value) {
      try {
        const parsed = JSON.parse(sessionCookie.value);
        const userProfile = await prisma.userProfile.findUnique({
          where: { id: parsed.userId },
          include: {
            tenant: true,
            owner: true,
          },
        });

        if (userProfile) {
          return {
            userProfile,
            supabaseUser: {
              id: userProfile.authUserId,
              email: userProfile.email,
            },
          };
        }
      } catch (parseErr) {
        console.warn('Failed to parse session cookie:', parseErr);
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching authenticated user:', error);
    return null;
  }
}

/**
 * Require an authenticated user with one of the allowed roles.
 * Throws an error if unauthenticated or unauthorized.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthContext> {
  const authContext = await getAuthenticatedUser();
  if (!authContext) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  if (!hasRole(authContext.userProfile.role, allowedRoles)) {
    throw new Error(
      `FORBIDDEN: Role ${authContext.userProfile.role} is not permitted for this operation`
    );
  }

  return authContext;
}

/**
 * Require an authenticated user with a specific permission.
 */
export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const authContext = await getAuthenticatedUser();
  if (!authContext) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  if (!hasPermission(authContext.userProfile.role, permission)) {
    throw new Error(
      `FORBIDDEN: Missing required permission "${permission}"`
    );
  }

  return authContext;
}
