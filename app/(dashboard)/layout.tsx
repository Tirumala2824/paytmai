import React from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Navbar } from '@/components/dashboard/Navbar';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile;

  try {
    const authContext = await getAuthenticatedUser();
    profile = authContext?.userProfile;

    if (!profile) {
      profile = (await prisma.userProfile.findFirst({
        where: { role: UserRole.TENANT },
      })) || undefined;
    }
  } catch (err) {
    console.warn('DashboardLayout user resolution warning:', err);
  }

  // Fallback demo profile
  if (!profile) {
    profile = {
      id: 'demo-tenant-id',
      authUserId: 'demo-auth',
      email: 'arjun.mehta@gmail.com',
      name: 'Arjun Mehta',
      phone: '+91 99887 76655',
      role: UserRole.TENANT,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Role-based Sidebar */}
      <Sidebar
        userRole={profile.role}
        userName={profile.name}
        userEmail={profile.email}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          userRole={profile.role}
          userName={profile.name}
          unreadNotifications={2}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6 pb-20 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
