# HavenDex Authentication Architecture

HavenDex strictly uses **Supabase Auth** for user identity and session management. **Firebase is completely prohibited.**

---

## 1. Core Principles

1. **Supabase Auth ONLY**: All user registration, login, session tokens, and refresh tokens are handled via Supabase Auth (`@supabase/ssr`).
2. **Server-Side Verification**: Client-provided identity tokens are never trusted blindly. All sessions are validated server-side using secure HTTP-only cookies.
3. **Canonical Profile Link**: Supabase Auth `auth.users.id` maps 1:1 to HavenDex's `UserProfile.authUserId` in PostgreSQL.
4. **No Secrets in Browser**: Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed to the client. The `SUPABASE_SERVICE_ROLE_KEY` is never exposed.

---

## 2. Authentication Flows

### Email / Password Login
- Handled at `/login` via `supabase.auth.signInWithPassword()`.
- On success, Supabase sets secure HTTP-only session cookies (`sb-*-auth-token`).
- Middleware intercepts requests, validates the session, resolves the user role, and routes to `/tenant` or `/owner`.

### Google OAuth
- Initiated via `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- Redirects to Supabase callback route `/auth/callback`.
- The callback exchanges the auth code for a session, creates a corresponding `UserProfile` if new, and redirects to the appropriate dashboard.

---

## 3. Session Management & SSR Cookie Handling

HavenDex implements `@supabase/ssr` with Next.js App Router:

```typescript
// lib/supabase/server.ts
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Handled in middleware
          }
        },
      },
    }
  );
}
```

---

## 4. Protected Routes & Middleware

`middleware.ts` guards the application routes:
- `/tenant/*`: Requires active authentication and role `TENANT` or `ADMIN`.
- `/owner/*`: Requires active authentication and role `OWNER` or `ADMIN`.
- `/assistant/*`: Requires active authentication.
- Unauthenticated requests are redirected to `/login`.
