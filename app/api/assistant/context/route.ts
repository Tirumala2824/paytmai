import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';
import { UserRole } from '@prisma/client';
import { isGeminiConfigured, getGeminiModelName, SUPPORTED_GEMINI_MODELS } from '@/lib/ai/llm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const requestedRole = req.nextUrl.searchParams.get('role');
    const targetRole = requestedRole === 'OWNER' ? UserRole.OWNER : UserRole.TENANT;

    let authContext = await getAuthenticatedUser();

    // In demo environment or if switching persona via query parameter:
    if (!authContext?.userProfile || (requestedRole && authContext.userProfile.role !== targetRole)) {
      const demoUser = await prisma.userProfile.findFirst({
        where: { role: targetRole },
        include: { tenant: true, owner: true },
      });
      if (demoUser) {
        authContext = {
          userProfile: demoUser,
          supabaseUser: { id: demoUser.authUserId, email: demoUser.email },
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
    let portfolio: any = null;

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
    } else if (userProfile.role === UserRole.OWNER || userProfile.role === UserRole.ADMIN) {
      const owner = await prisma.owner.findUnique({
        where: { userProfileId: userProfile.id },
        include: {
          properties: {
            include: {
              rooms: true,
              tenancies: {
                where: { isActive: true },
                include: {
                  room: true,
                  tenant: { include: { userProfile: true } },
                  rentSchedules: { orderBy: { dueDate: 'desc' }, take: 1 },
                },
              },
              maintenanceIssues: {
                orderBy: { createdAt: 'desc' },
                take: 10,
              },
            },
          },
        },
      });

      if (owner && owner.properties.length > 0) {
        let totalRooms = 0;
        let occupiedRooms = 0;
        let expectedMonthlyRent = 0;
        let collectedRent = 0;
        let pendingRent = 0;
        let activeMaintenanceCount = 0;

        const propertiesSummary = owner.properties.map((p) => {
          const pRooms = p.rooms.length;
          const pOccupied = p.rooms.filter((r) => r.isOccupied).length;
          totalRooms += pRooms;
          occupiedRooms += pOccupied;

          p.tenancies.forEach((t) => {
            expectedMonthlyRent += t.monthlyRent;
            const rs = t.rentSchedules[0];
            if (rs) {
              if (rs.status === 'SUCCESS') {
                collectedRent += rs.amount;
              } else {
                pendingRent += rs.amount;
              }
            }
          });

          const pActiveIssues = p.maintenanceIssues.filter(
            (m) => !['RESOLVED', 'CLOSED'].includes(m.status)
          ).length;
          activeMaintenanceCount += pActiveIssues;

          return {
            id: p.id,
            name: p.name,
            address: `${p.address}, ${p.city}`,
            totalRooms: pRooms,
            occupiedRooms: pOccupied,
            occupancyRate: pRooms > 0 ? Math.round((pOccupied / pRooms) * 100) : 0,
          };
        });

        const vacantRooms = Math.max(0, totalRooms - occupiedRooms);
        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        portfolio = {
          totalProperties: owner.properties.length,
          totalRooms,
          occupiedRooms,
          vacantRooms,
          occupancyRate,
          expectedMonthlyRent,
          collectedRent,
          pendingRent,
          activeMaintenanceCount,
          propertiesSummary,
        };

        // All cross-property active maintenance issues for owner
        const allIssues: any[] = [];
        owner.properties.forEach((p) => {
          p.maintenanceIssues.forEach((i) => {
            allIssues.push({
              id: i.id,
              title: i.title,
              propertyName: p.name,
              category: i.category,
              priority: i.priority,
              status: i.status,
              createdAt: i.createdAt.toISOString(),
            });
          });
        });
        recentIssues = allIssues.slice(0, 5);
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
      portfolio,
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
        propertyName: i.propertyName,
        category: i.category,
        priority: i.priority,
        status: i.status,
        createdAt: typeof i.createdAt === 'string' ? i.createdAt : i.createdAt?.toISOString?.() || new Date().toISOString(),
      })),
    });
  } catch (err: any) {
    console.error('Error fetching assistant context:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
