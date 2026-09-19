'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Sparkles, UserCheck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@prisma/client';

interface NavbarProps {
  userRole?: UserRole;
  userName?: string;
  unreadNotifications?: number;
}

export function Navbar({
  userRole = UserRole.TENANT,
  userName = 'User',
  unreadNotifications = 2,
}: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">
            HavenDex Workspace
          </span>
          <span className="text-slate-600">/</span>
          <span className="text-xs text-indigo-400 font-medium">
            {userRole === UserRole.TENANT ? 'Tenant Portal' : 'Owner Administration'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Demo Fast-Switch Toggle for Hackathon Reviewers */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <span className="text-[11px] text-slate-400 font-medium px-2">Demo Views:</span>
          <Link
            href="/tenant"
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              userRole === UserRole.TENANT
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tenant Mode
          </Link>
          <Link
            href="/owner"
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              userRole === UserRole.OWNER
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Owner Mode
          </Link>
        </div>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative h-9 w-9 rounded-lg border border-slate-800 bg-slate-900/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-slate-950">
              {unreadNotifications}
            </span>
          )}
        </Link>

        {/* Logout */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="gap-2 text-xs border-slate-800 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Exit</span>
        </Button>
      </div>
    </header>
  );
}
