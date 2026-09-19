'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, ArrowRight, User, Building2 } from 'lucide-react';
import { UserRole } from '@prisma/client';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.TENANT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Register with Supabase Auth
      try {
        const supabase = createClient();
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role,
            },
          },
        });
        if (authError) throw authError;
      } catch (sbError: any) {
        console.warn('Supabase auth signup notice:', sbError.message);
      }

      // 2. Direct sign-in or demo redirect
      if (role === UserRole.OWNER) {
        router.push('/owner');
      } else {
        router.push('/tenant');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">HavenDex</span>
          </Link>
          <h2 className="mt-4 text-2xl font-bold text-white">Create your HavenDex account</h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose your account role to get started with the rental operating system
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/90 shadow-2xl">
          <CardContent className="pt-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div className="space-y-1.5">
              <Label>Select Account Type</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setRole(UserRole.TENANT)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    role === UserRole.TENANT
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <User className="h-5 w-5 mb-1.5 text-indigo-400" />
                  <span className="text-xs font-semibold">Tenant</span>
                  <span className="text-[10px] text-slate-400">Rent & Services</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole(UserRole.OWNER)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    role === UserRole.OWNER
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Building2 className="h-5 w-5 mb-1.5 text-indigo-400" />
                  <span className="text-xs font-semibold">Owner / PG</span>
                  <span className="text-[10px] text-slate-400">Manage Properties</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Arjun Mehta"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full mt-3" disabled={loading}>
                {loading ? 'Creating Account...' : 'Get Started'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
