'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Shield, Mail, Phone, Lock, CheckCircle2 } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="default">Account Settings</Badge>
          <span className="text-xs text-slate-400">Authenticated Profile</span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-1">User Profile</h1>
        <p className="text-xs text-slate-400">
          Manage your contact credentials, emergency info, and security preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <Card className="border-slate-800 bg-slate-900/60 p-6 flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-2xl font-bold text-white shadow-xl shadow-indigo-500/20">
            A
          </div>
          <h3 className="text-lg font-bold text-white mt-4">Arjun Mehta</h3>
          <p className="text-xs text-slate-400">arjun.mehta@gmail.com</p>

          <div className="mt-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              TENANT
            </span>
          </div>

          <div className="mt-6 w-full pt-6 border-t border-slate-800 text-xs text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Member Since:</span>
              <span className="text-slate-300">Jan 2026</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Auth Method:</span>
              <span className="text-slate-300">Supabase Auth</span>
            </div>
          </div>
        </Card>

        {/* Profile Info Form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base text-white">Personal Information</CardTitle>
              <CardDescription className="text-xs">
                Your primary contact and identification details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input defaultValue="Arjun Mehta" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input defaultValue="arjun.mehta@gmail.com" disabled />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input defaultValue="+91 99887 76655" />
                </div>
                <div className="space-y-1.5">
                  <Label>Emergency Contact</Label>
                  <Input defaultValue="Suresh Mehta (Father): +91 99887 76600" />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500">
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security & Access */}
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base text-white">Security & Permissions</CardTitle>
              <CardDescription className="text-xs">
                Server-enforced access controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-white">Strict ABAC Enforced</p>
                    <p className="text-[11px] text-slate-400">
                      Isolated to Tenancy #tenancy-101-nexus only
                    </p>
                  </div>
                </div>
                <span className="text-emerald-400 text-xs font-semibold">Active</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
