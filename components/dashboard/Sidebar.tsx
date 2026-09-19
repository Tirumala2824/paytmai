'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { cn } from '@/lib/utils';
import {
  Home,
  Building2,
  CreditCard,
  Wrench,
  Bell,
  User,
  Sparkles,
  History,
  LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  const isTenant = userRole === UserRole.TENANT;

  const tenantLinks = [
    { href: '/assistant', label: 'Ask Anything', icon: Sparkles, desc: 'Chat or speak with Haven' },
    { href: '/tenant', label: 'My Home', icon: Home, desc: 'Your rental at a glance' },
    { href: '/payments', label: 'Rent & Payments', icon: CreditCard, desc: 'Pay and view history' },
    { href: '/maintenance', label: 'Fix Something', icon: Wrench, desc: 'Report issues' },
    { href: '/notifications', label: 'Updates', icon: Bell, desc: 'Alerts & messages' },
    { href: '/profile', label: 'My Account', icon: User, desc: 'Profile settings' },
  ];

  const ownerLinks = [
    { href: '/assistant', label: 'Ask Anything', icon: Sparkles, desc: 'Chat with Haven AI' },
    { href: '/owner', label: 'Overview', icon: Home, desc: 'Portfolio snapshot' },
    { href: '/property', label: 'My Properties', icon: Building2, desc: 'Rooms & listings' },
    { href: '/maintenance', label: 'Repairs', icon: Wrench, desc: 'Track all issues' },
    { href: '/payments', label: 'Income & Payments', icon: CreditCard, desc: 'Revenue overview' },
    { href: '/audit', label: 'Activity Log', icon: History, desc: 'All recent actions' },
    { href: '/notifications', label: 'Updates', icon: Bell, desc: 'Alerts & messages' },
    { href: '/profile', label: 'My Account', icon: User, desc: 'Profile settings' },
  ];

  const links = isTenant ? tenantLinks : ownerLinks;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="hidden md:flex w-60 border-r border-slate-800/60 bg-slate-950/90 backdrop-blur-xl flex-col h-screen sticky top-0 shrink-0">
      {/* Brand */}
      <div className="p-5 border-b border-slate-800/40">
        <Link href="/assistant" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base text-white tracking-tight">HavenDex</span>
            <p className="text-[11px] text-slate-400 -mt-0.5">
              {isTenant ? 'Your rental companion' : 'Manage your properties'}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== '/assistant' && pathname.startsWith(link.href + '/'));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              <span className="leading-tight">{link.label}</span>
              {link.href === '/assistant' && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800/40">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-800/40 transition-colors group cursor-default">
          <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{userName}</p>
            <p className="text-[11px] text-slate-400 truncate">{isTenant ? 'Tenant' : 'Property Owner'}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
