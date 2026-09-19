'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, Sparkles, Home, Building2, CreditCard, Wrench, User, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@prisma/client';
import { cn } from '@/lib/utils';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  userRole?: UserRole;
  userName?: string;
  unreadNotifications?: number;
}

export function Navbar({
  userRole = UserRole.TENANT,
  userName = 'User',
  unreadNotifications = 0,
}: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isTenant = userRole === UserRole.TENANT;

  const mobileLinks = isTenant
    ? [
        { href: '/assistant', label: 'Ask', icon: Sparkles },
        { href: '/tenant', label: 'Home', icon: Home },
        { href: '/payments', label: 'Rent', icon: CreditCard },
        { href: '/maintenance', label: 'Issues', icon: Wrench },
        { href: '/notifications', label: 'Updates', icon: Sparkles },
      ]
    : [
        { href: '/assistant', label: 'Ask', icon: Sparkles },
        { href: '/owner', label: 'Overview', icon: Home },
        { href: '/property', label: 'Properties', icon: Building2 },
        { href: '/payments', label: 'Income', icon: CreditCard },
        { href: '/audit', label: 'Activity', icon: History },
      ];

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
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex h-14 border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-md px-6 items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400 font-medium">
            {isTenant ? 'Welcome back,' : 'Managing as owner,'}
          </span>
          <span className="font-semibold text-white">{userName.split(' ')[0]}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <NotificationBell />

          {/* Sign out */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5 text-xs border-slate-800 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden h-14 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm">HavenDex</span>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
        </div>
      </header>

      {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/60 safe-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {mobileLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/assistant' && pathname.startsWith(link.href + '/'));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all',
                  isActive
                    ? 'text-indigo-400'
                    : 'text-slate-500 hover:text-slate-300'
                )}
                aria-label={link.label}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-indigo-400')} />
                <span className={cn('text-[10px] font-medium', isActive ? 'text-indigo-400' : 'text-slate-500')}>
                  {link.label}
                </span>
                {isActive && (
                  <span className="absolute h-0.5 w-8 bg-indigo-500 rounded-full -top-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
