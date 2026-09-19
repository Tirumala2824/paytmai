'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Shield, ArrowRight, CheckCircle2, User, Building2, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      if (data.profile?.role === 'OWNER') {
        router.push('/owner');
      } else {
        router.push('/tenant');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (err: any) {
      setError('Google OAuth initialization error: ' + (err.message || 'Check Supabase config'));
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, targetPath: string) => {
    setEmail(demoEmail);
    setPassword('demo12345');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: 'demo' }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(targetPath);
      } else {
        // Direct route for demo if DB is in prototype mode
        router.push(targetPath);
      }
      router.refresh();
    } catch {
      router.push(targetPath);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Left Column: Branding and Product Pitch */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-gradient-to-b from-indigo-950/30 via-slate-950 to-slate-950">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl text-white tracking-tight">HavenDex</span>
              <span className="ml-2 text-xs uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                OS
              </span>
            </div>
          </div>

          <div className="mt-16 max-w-lg">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              One AI teammate for the <span className="text-indigo-400">entire rental relationship</span>.
            </h1>
            <p className="mt-4 text-slate-400 text-sm lg:text-base leading-relaxed">
              HavenDex eliminates rental fragmentation. Continuous assistance connecting booking, rent schedules, Paytm payments, maintenance triage, and verified resolutions.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400 mt-0.5">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Continuous Lifecycle Machine</h4>
                  <p className="text-xs text-slate-400">Booked → Rent Due → Payment → Issue → Action → Fixed → Verified</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400 mt-0.5">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Server-Side ABAC & RBAC</h4>
                  <p className="text-xs text-slate-400">Strict tenant and owner data isolation with tamper-proof audit trails.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
          <span>HavenDex AI Operating System © 2026</span>
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            Supabase Protected
          </span>
        </div>
      </div>

      {/* Right Column: Authentication & Demo Personas */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <Card className="border-slate-800 bg-slate-900/90 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-white">Sign In to HavenDex</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Access your tenancy or property management portal
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              {/* Google OAuth Button */}
              <Button
                variant="outline"
                type="button"
                onClick={handleGoogleOAuth}
                className="w-full justify-center gap-3 border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-200"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 10.5 0 12.4s.6 3.2 1.6 5.2l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.8c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16.7C3.5 20.4 7.4 23.8 12 23.8z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider relative">
                  Or email
                </span>
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="#" className="text-xs text-indigo-400 hover:underline">
                      Forgot?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Sign In'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>

              {/* Quick Demo Switcher Section */}
              <div className="pt-4 border-t border-slate-800/80">
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  ⚡ Hackathon Reviewers: 1-Click Fast Login
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2 text-xs justify-start h-11 bg-slate-800/70 border-slate-700/80 hover:border-indigo-500"
                    onClick={() => handleQuickDemoLogin('arjun.mehta@gmail.com', '/tenant')}
                  >
                    <User className="h-4 w-4 text-indigo-400 shrink-0" />
                    <div className="text-left truncate">
                      <div className="font-semibold text-slate-200 truncate">Arjun Mehta</div>
                      <div className="text-[10px] text-slate-400">Tenant Persona</div>
                    </div>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2 text-xs justify-start h-11 bg-slate-800/70 border-slate-700/80 hover:border-indigo-500"
                    onClick={() => handleQuickDemoLogin('rajesh@nexusliving.in', '/owner')}
                  >
                    <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
                    <div className="text-left truncate">
                      <div className="font-semibold text-slate-200 truncate">Rajesh Sharma</div>
                      <div className="text-[10px] text-slate-400">Owner Persona</div>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link href="/signup" className="text-indigo-400 font-semibold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
