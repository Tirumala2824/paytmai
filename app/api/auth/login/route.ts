import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuditEvent } from '@/lib/audit/service';
import prisma from '@/lib/db';
import { UserRole } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // 1. Try Supabase auth login
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password || 'demo12345',
      });

      if (!error && data.user) {
        let profile = await prisma.userProfile.findUnique({
          where: { authUserId: data.user.id },
        });

        if (!profile) {
          profile = await prisma.userProfile.create({
            data: {
              authUserId: data.user.id,
              email: data.user.email || email,
              name: data.user.user_metadata?.full_name || email.split('@')[0],
              role: (role as UserRole) || UserRole.TENANT,
            },
          });
        }

        await createAuditEvent({
          actorId: profile.id,
          actorRole: profile.role,
          action: 'AUTH_LOGIN_SUCCESS',
          resourceType: 'USER_PROFILE',
          resourceId: profile.id,
          metadata: { provider: 'SUPABASE_EMAIL' },
        });

        const response = NextResponse.json({
          success: true,
          user: data.user,
          profile,
        });

        // Set session cookie
        response.cookies.set('havendex_session', JSON.stringify({
          userId: profile.id,
          authUserId: profile.authUserId,
          email: profile.email,
          role: profile.role,
          name: profile.name,
        }), {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;
      }
    } catch (supabaseErr) {
      console.warn('Supabase auth signIn error:', supabaseErr);
    }

    // 2. Demo user fallback: Check database for matching userProfile
    let demoUser = await prisma.userProfile.findUnique({
      where: { email },
      include: { tenant: true, owner: true },
    });

    // Auto-create demo persona if not yet present
    if (!demoUser) {
      if (email === 'arjun.mehta@gmail.com') {
        demoUser = await prisma.userProfile.create({
          data: {
            authUserId: 'tenant-auth-id-001',
            email: 'arjun.mehta@gmail.com',
            name: 'Arjun Mehta',
            phone: '+91 99887 76655',
            role: UserRole.TENANT,
            tenant: {
              create: {
                emergencyContact: 'Suresh Mehta (Father): +91 99887 76600',
              },
            },
          },
          include: { tenant: true, owner: true },
        });
      } else if (email === 'rajesh@nexusliving.in') {
        demoUser = await prisma.userProfile.create({
          data: {
            authUserId: 'owner-auth-id-001',
            email: 'rajesh@nexusliving.in',
            name: 'Rajesh Sharma',
            phone: '+91 98765 43210',
            role: UserRole.OWNER,
            owner: {
              create: {
                companyName: 'Nexus Living Spaces LLP',
              },
            },
          },
          include: { tenant: true, owner: true },
        });
      } else if (email === 'admin@havendex.io') {
        demoUser = await prisma.userProfile.create({
          data: {
            authUserId: 'admin-auth-id-001',
            email: 'admin@havendex.io',
            name: 'HavenDex System Admin',
            role: UserRole.ADMIN,
          },
          include: { tenant: true, owner: true },
        });
      }
    }

    if (demoUser) {
      await createAuditEvent({
        actorId: demoUser.id,
        actorRole: demoUser.role,
        action: 'AUTH_LOGIN_DEMO',
        resourceType: 'USER_PROFILE',
        resourceId: demoUser.id,
        metadata: { provider: 'DEMO_CREDENTIALS' },
      });

      const response = NextResponse.json({
        success: true,
        user: { id: demoUser.authUserId, email: demoUser.email },
        profile: demoUser,
      });

      // Set session cookie
      response.cookies.set('havendex_session', JSON.stringify({
        userId: demoUser.id,
        authUserId: demoUser.authUserId,
        email: demoUser.email,
        role: demoUser.role,
        name: demoUser.name,
      }), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid credentials or user not found' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('Login route error:', error);
    return NextResponse.json(
      { error: error.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
