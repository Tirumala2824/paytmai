import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';
import { UserRole } from '@prisma/client';
import { isGeminiConfigured, getGeminiModelName, SUPPORTED_GEMINI_MODELS } from '@/lib/ai/llm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    let authContext = await getAuthenticatedUser();

    if (!authContext?.userProfile) {
      const demoTenant = await prisma.userProfile.findFirst({
        where: { role: UserRole.TENANT },
      });
      if (demoTenant) {
        authContext = {
          userProfile: demoTenant,
          supabaseUser: { id: demoTenant.authUserId, email: demoTenant.email },
        };
      }
    }

    if (!authContext?.userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userProfile } = authContext;

    let tenancy: any = null;
    let rentSchedule: any = null;
    let recentIssues: any[] = [];

    if (userProfile.role === UserRole.TENANT) {
      const tenant = await prisma.tenant.findUnique({
        where: { userProfileId: userProfile.id },
        include: {
          tenancies: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              property: {
                include: {
                  owner: { include: { userProfile: true } },
                },
              },
              room: true,
              rentSchedules: {
                orderBy: { dueDate: 'desc' },
                take: 1,
                include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
              },
              maintenanceIssues: {
                orderBy: { createdAt: 'desc' },
                take: 5,
              },
            },
          },
        },
      });

      if (tenant && tenant.tenancies.length > 0) {
        tenancy = tenant.tenancies[0];
        rentSchedule = tenancy.rentSchedules[0] || null;
        recentIssues = tenancy.maintenanceIssues || [];
      }
    }

    return NextResponse.json({
      llmActive: isGeminiConfigured(),
      llmModel: getGeminiModelName(),
      availableModels: SUPPORTED_GEMINI_MODELS,
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
      },
      tenancy: tenancy
        ? {
            id: tenancy.id,
            propertyName: tenancy.property.name,
            address: `${tenancy.property.address}, ${tenancy.property.city}`,
            roomNumber: tenancy.room.roomNumber,
            roomType: tenancy.room.roomType,
            monthlyRent: tenancy.monthlyRent,
            securityDeposit: tenancy.securityDeposit,
            lifecycleStage: tenancy.lifecycleStage,
            ownerName: tenancy.property.owner.userProfile.name,
          }
        : null,
      rentSchedule: rentSchedule
        ? {
            id: rentSchedule.id,
            billingMonth: rentSchedule.billingMonth,
            amount: rentSchedule.amount,
            dueDate: rentSchedule.dueDate.toISOString().split('T')[0],
            status: rentSchedule.status,
            isPaid: rentSchedule.status === 'SUCCESS',
          }
        : null,
      recentIssues: recentIssues.map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        priority: i.priority,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error('Error fetching assistant context:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
