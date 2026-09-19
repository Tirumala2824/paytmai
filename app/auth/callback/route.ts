import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { createAuditEvent } from '@/lib/audit/service';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        // Ensure user profile exists
        let profile = await prisma.userProfile.findUnique({
          where: { authUserId: data.user.id },
        });

        if (!profile) {
          profile = await prisma.userProfile.create({
            data: {
              authUserId: data.user.id,
              email: data.user.email || 'user@havendex.io',
              name: data.user.user_metadata?.full_name || 'HavenDex User',
              avatarUrl: data.user.user_metadata?.avatar_url,
              role: 'TENANT',
            },
          });
        }

        await createAuditEvent({
          actorId: profile.id,
          actorRole: profile.role,
          action: 'AUTH_OAUTH_SUCCESS',
          resourceType: 'USER_PROFILE',
          resourceId: profile.id,
          metadata: { provider: 'GOOGLE' },
        });

        // Redirect based on role
        const targetPath = profile.role === 'OWNER' ? '/owner' : '/tenant';
        const redirectResponse = NextResponse.redirect(`${origin}${targetPath}`);

        redirectResponse.cookies.set(
          'havendex_session',
          JSON.stringify({
            userId: profile.id,
            authUserId: profile.authUserId,
            email: profile.email,
            role: profile.role,
            name: profile.name,
          }),
          {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
          }
        );

        return redirectResponse;
      }
    } catch (err) {
      console.error('OAuth exchange error:', err);
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/tenant`);
}
