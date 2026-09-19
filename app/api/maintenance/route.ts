import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import { reportMaintenanceIssue } from '@/lib/maintenance/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const isRepeated = searchParams.get('isRepeated');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const whereClause: any = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (priority) {
      whereClause.priority = priority;
    }
    if (category) {
      whereClause.category = category;
    }
    if (isRepeated !== null && isRepeated !== undefined) {
      whereClause.isRepeated = isRepeated === 'true';
    }

    const issues = await prisma.maintenanceIssue.findMany({
      where: whereClause,
      include: {
        property: true,
        tasks: {
          orderBy: { createdAt: 'asc' },
        },
        verifications: {
          orderBy: { verifiedAt: 'desc' },
        },
        tenancy: {
          include: {
            room: true,
          },
        },
        reportedBy: {
          include: {
            userProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      issues: issues.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
        priority: i.priority,
        status: i.status,
        resolution: i.resolution,
        isRepeated: i.isRepeated,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        property: {
          id: i.property.id,
          name: i.property.name,
          address: i.property.address,
        },
        room: i.tenancy.room
          ? {
              id: i.tenancy.room.id,
              roomNumber: i.tenancy.room.roomNumber,
              floor: i.tenancy.room.floor,
            }
          : null,
        reportedBy: {
          name: i.reportedBy.userProfile.name,
          email: i.reportedBy.userProfile.email,
          phone: i.reportedBy.userProfile.phone,
        },
        tasks: i.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          assignedTo: t.assignedTo,
          estimatedCost: t.estimatedCost,
          actualCost: t.actualCost,
          status: t.status,
          completedAt: t.completedAt?.toISOString(),
        })),
        verifications: i.verifications.map((v) => ({
          id: v.id,
          verificationMethod: v.verificationMethod,
          verifiedBy: v.verifiedBy,
          verifiedAt: v.verifiedAt.toISOString(),
          evidence: v.evidence,
          confidence: v.confidence,
          notes: v.notes,
        })),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching maintenance issues:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch maintenance issues' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, category, priority, tenancyId, isRepeated } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedUser();
    let userProfile = auth?.userProfile;

    if (!userProfile) {
      // Fallback to default demo tenant
      userProfile = (await prisma.userProfile.findFirst({
        where: { role: 'TENANT' },
        include: { tenant: true },
      })) || undefined;
    }

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let resolvedTenancyId = tenancyId;
    if (!resolvedTenancyId) {
      const tenant = await prisma.tenant.findUnique({
        where: { userProfileId: userProfile.id },
        include: { tenancies: { where: { isActive: true }, take: 1 } },
      });
      resolvedTenancyId = tenant?.tenancies[0]?.id;
    }

    if (!resolvedTenancyId) {
      return NextResponse.json(
        { error: 'No active tenancy found for user' },
        { status: 400 }
      );
    }

    const issue = await reportMaintenanceIssue({
      tenancyId: resolvedTenancyId,
      title,
      description,
      category: category || 'GENERAL',
      priority: priority || 'MEDIUM',
      reporterUserProfileId: userProfile.id,
      isRepeated: isRepeated ?? false,
    });

    return NextResponse.json({ success: true, issue });
  } catch (error: any) {
    console.error('Error creating maintenance issue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create maintenance issue' },
      { status: 400 }
    );
  }
}
