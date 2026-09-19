import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  // If request contains OAuth code on any route other than /auth/callback,
  // redirect immediately to /auth/callback so the session code exchange happens!
  if (
    request.nextUrl.searchParams.has('code') &&
    !request.nextUrl.pathname.startsWith('/auth/callback')
  ) {
    const callbackUrl = new URL('/auth/callback', request.url);
    callbackUrl.search = request.nextUrl.search;
    return NextResponse.redirect(callbackUrl);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_SUPABASE_PUBLISHABLE_KEY;

  let user = null;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      });

      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (e) {
      // Supabase user fetch failed
    }
  }

  const demoSessionCookie = request.cookies.get('havendex_session');
  const isAuthenticated = !!user || !!demoSessionCookie?.value;

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup');

  const isDashboardRoute =
    request.nextUrl.pathname.startsWith('/tenant') ||
    request.nextUrl.pathname.startsWith('/owner') ||
    request.nextUrl.pathname.startsWith('/property') ||
    request.nextUrl.pathname.startsWith('/room') ||
    request.nextUrl.pathname.startsWith('/tenancy') ||
    request.nextUrl.pathname.startsWith('/maintenance') ||
    request.nextUrl.pathname.startsWith('/payments') ||
    request.nextUrl.pathname.startsWith('/notifications') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/audit');

  // If unauthenticated and trying to access protected dashboard routes
  if (!isAuthenticated && isDashboardRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If already authenticated and accessing login/signup, redirect to their role-based dashboard
  if (isAuthenticated && isAuthRoute) {
    let targetPath = '/tenant';
    if (demoSessionCookie?.value) {
      try {
        const parsed = JSON.parse(demoSessionCookie.value);
        if (parsed.role === 'OWNER' || parsed.role === 'ADMIN' || parsed.role === 'PROPERTY_MANAGER') {
          targetPath = '/owner';
        }
      } catch {}
    }
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
