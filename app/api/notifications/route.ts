import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedUser();
    let userProfile = authContext?.userProfile;

    const { searchParams } = new URL(request.url);
    const demoUserId = searchParams.get('userId');

    if (!userProfile && demoUserId) {
      userProfile = (await prisma.userProfile.findUnique({
        where: { id: demoUserId },
      })) || undefined;
    }

    // Default fallback in demo mode: find the primary tenant
    if (!userProfile) {
      userProfile = (await prisma.userProfile.findFirst({
        where: { role: 'TENANT' },
      })) || undefined;
    }

    if (!userProfile) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userProfileId: userProfile.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userProfileId: userProfile.id,
        isRead: false,
      },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notifications', notifications: [], unreadCount: 0 },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, markAllRead, userId } = body;

    const authContext = await getAuthenticatedUser();
    let userProfile = authContext?.userProfile;

    if (!userProfile && userId) {
      userProfile = (await prisma.userProfile.findUnique({
        where: { id: userId },
      })) || undefined;
    }

    if (!userProfile) {
      userProfile = (await prisma.userProfile.findFirst({
        where: { role: 'TENANT' },
      })) || undefined;
    }

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: {
          userProfileId: userProfile.id,
          isRead: false,
        },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (id) {
      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, notification: updated });
    }

    return NextResponse.json({ error: 'Missing id or markAllRead parameter' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update notification' },
      { status: 500 }
    );
  }
}
