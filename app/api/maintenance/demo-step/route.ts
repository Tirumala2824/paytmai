import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { MaintenanceStatus, VerificationMethod } from '@prisma/client';
import {
  reportMaintenanceIssue,
  assignMaintenanceTask,
  notifyOwnerForIssue,
  verifyMaintenanceIssue,
} from '@/lib/maintenance/service';
import { memoryService } from '@/lib/ai/memory/service';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { step } = body;

    // Resolve default demo tenant (Arjun Mehta)
    const tenantProfile = await prisma.userProfile.findFirst({
      where: { email: 'arjun.mehta@gmail.com' },
      include: {
        tenant: {
          include: {
            tenancies: {
              where: { isActive: true },
              include: { property: true, room: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!tenantProfile || !tenantProfile.tenant?.tenancies[0]) {
      return NextResponse.json({ error: 'Demo tenant tenancy not found' }, { status: 404 });
    }

    const tenancy = tenantProfile.tenant.tenancies[0];

    switch (step) {
      case 'STEP_1_REPORT_AC': {
        // Step 1: Report AC issue ("My AC isn't working")
        const issue = await reportMaintenanceIssue({
          tenancyId: tenancy.id,
          title: 'AC not cooling',
          description: 'The Daikin 1.5T split AC in Room 101 stopped cooling; fan is running but room temperature is rising.',
          category: 'APPLIANCE',
          priority: 'HIGH',
          reporterUserProfileId: tenantProfile.id,
          isRepeated: false,
        });

        const task = await assignMaintenanceTask({
          issueId: issue.id,
          title: 'AC Compressor & Gas Pressure Service',
          description: 'Check refrigerant pressure, clean condenser coils, flush drain line.',
          assignedTo: 'CoolCare Services (Technician Ramesh: +91 98450 11223)',
          estimatedCost: 1800,
          actor: { id: tenantProfile.id, role: 'TENANT' },
        });

        await notifyOwnerForIssue({
          issueId: issue.id,
          message: `Arjun Mehta reported AC breakdown in Room 101. Technician Ramesh assigned.`,
          urgent: true,
          actor: { id: tenantProfile.id, role: 'TENANT' },
        });

        return NextResponse.json({
          step: 'STEP_1_REPORT_AC',
          message: 'AC issue reported, technician assigned, and owner notified.',
          issue,
          task,
        });
      }

      case 'STEP_2_FIX_AND_VERIFY': {
        // Step 2: Complete repair and verify resolution
        // Find latest open or reported AC issue
        const latestIssue = await prisma.maintenanceIssue.findFirst({
          where: {
            tenancyId: tenancy.id,
            category: 'APPLIANCE',
            status: { notIn: [MaintenanceStatus.CLOSED, MaintenanceStatus.VERIFIED] },
          },
          orderBy: { createdAt: 'desc' },
        });

        const targetIssueId = latestIssue ? latestIssue.id : (
          await prisma.maintenanceIssue.findFirst({
            where: { tenancyId: tenancy.id, category: 'APPLIANCE' },
            orderBy: { createdAt: 'desc' },
          })
        )?.id;

        if (!targetIssueId) {
          return NextResponse.json({ error: 'No AC issue found to verify' }, { status: 404 });
        }

        const verifyResult = await verifyMaintenanceIssue({
          issueId: targetIssueId,
          verificationMethod: VerificationMethod.COMBINED,
          verifiedBy: tenantProfile.id,
          evidence: 'Tenant confirmed 18°C cooling restored. Technician digital invoice #CC-9182 verified.',
          confidence: 0.98,
          notes: 'Combined verification: Tenant confirmation + AI image analysis of condenser coil.',
          confirmed: true,
          resolution: 'AC service completed: filter cleaned, gas pressure recharged, cooling tested at 18°C',
          actor: { id: tenantProfile.id, role: 'TENANT' },
        });

        return NextResponse.json({
          step: 'STEP_2_FIX_AND_VERIFY',
          message: 'AC repair marked as verified and closed. Stored in persistent rental memory graph.',
          verifyResult,
        });
      }

      case 'STEP_3_RECALL_TEST': {
        // Step 3: User says "The AC is broken again."
        // Execute through the AI assistant to demonstrate memory retrieval
        const response = await executeRentalAssistant({
          userMessage: 'The AC is broken again.',
          userProfile: tenantProfile,
        });

        return NextResponse.json({
          step: 'STEP_3_RECALL_TEST',
          userMessage: 'The AC is broken again.',
          response,
          demonstratesMemory: response.userResponse.includes('Previous related maintenance issue found'),
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown demo step' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error executing demo step:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute demo step' },
      { status: 500 }
    );
  }
}
