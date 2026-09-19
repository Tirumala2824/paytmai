'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { cn } from '@/lib/utils';
import {
  Home,
  Building2,
  KeyRound,
  CreditCard,
  Wrench,
  Bell,
  Shield,
  User,
  Sparkles,
  Layers,
} from 'lucide-react';

interface SidebarProps {
  userRole?: UserRole;
  userName?: string;
  userEmail?: string;
}

export function Sidebar({
  userRole = UserRole.TENANT,
  userName = 'User',
  userEmail = 'user@havendex.io',
}: SidebarProps) {
  const pathname = usePathname();

  const isTenant = userRole === UserRole.TENANT;

  const tenantLinks = [
    { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
    { href: '/tenant', label: 'Dashboard', icon: Home },
    { href: '/payments', label: 'Rent & Payments', icon: CreditCard },
    { href: '/maintenance', label: 'Maintenance', icon: Wrench },
    { href: '/notifications', label: 'Notifications', icon: Bell },
    { href: '/profile', label: 'My Profile', icon: User },
  ];

  const ownerLinks = [
    { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
    { href: '/owner', label: 'Portfolio Overview', icon: Home },
    { href: '/property', label: 'Properties & Rooms', icon: Building2 },
    { href: '/maintenance', label: 'Maintenance Board', icon: Wrench },
    { href: '/payments', label: 'Payments & Revenue', icon: CreditCard },
    { href: '/audit', label: 'Security & Audit', icon: Shield },
    { href: '/notifications', label: 'Notifications', icon: Bell },
    { href: '/profile', label: 'Account Profile', icon: User },
  ];

  const links = isTenant ? tenantLinks : ownerLinks;

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              HavenDex
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                OS
              </span>
            </span>
            <p className="text-[11px] text-slate-400 -mt-0.5">Rental Operating System</p>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {isTenant ? 'Tenant Hub' : 'Owner Management'}
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  isActive ? 'text-indigo-400' : 'text-slate-400'
                )}
              />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Role Switcher & User Footer */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm">
            {userName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{userEmail}</p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/40 flex items-center justify-between text-xs">
          <span className="text-slate-400">Active Role:</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {userRole}
          </span>
        </div>
      </div>
    </aside>
  );
}
