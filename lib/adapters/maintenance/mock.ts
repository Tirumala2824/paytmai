import prisma from '@/lib/db';
import { MaintenanceStatus } from '@prisma/client';
import {
  MaintenanceProvider,
  DispatchTaskParams,
  DispatchTaskResult,
  SimulateRepairParams,
  SimulateRepairResult,
} from './types';

/**
 * MockMaintenanceProvider
 * Deterministic maintenance adapter for hackathon demonstration.
 * Dispatches vendor tasks and simulates realistic technician repairs.
 */
export class MockMaintenanceProvider implements MaintenanceProvider {
  public readonly name = 'MOCK_MAINTENANCE_PROVIDER';
  public readonly isMock = true;

  async dispatchTask(params: DispatchTaskParams): Promise<DispatchTaskResult> {
    const assignedVendor =
      params.assignedTo ||
      (params.category === 'APPLIANCE'
        ? 'QuickFix Coliving Services (Authorized HVAC Vendor)'
        : params.category === 'PLUMBING'
        ? 'Bengaluru HydroWorks Services'
        : 'UrbanFix Coliving Maintenance Hub');

    const estimatedCost = params.estimatedCost || (params.priority === 'HIGH' ? 1500 : 800);

    const task = await prisma.maintenanceTask.create({
      data: {
        issueId: params.issueId,
        title: params.title,
        description: `Automated dispatch via MockMaintenanceProvider for ${params.category} issue`,
        assignedTo: assignedVendor,
        estimatedCost,
        status: MaintenanceStatus.TASK_ASSIGNED,
      },
    });

    return {
      success: true,
      taskId: task.id,
      assignedTo: assignedVendor,
      estimatedCost,
      status: MaintenanceStatus.TASK_ASSIGNED,
      dispatchedAt: new Date(),
      isMock: true,
    };
  }

  async simulateRepair(params: SimulateRepairParams): Promise<SimulateRepairResult> {
    const resolution =
      params.resolution ||
      'Technician completed comprehensive inspection, cleaned filters, recharged refrigerant gas, and confirmed cooling at 18°C.';

    // Update issue to FIXED
    await prisma.maintenanceIssue.update({
      where: { id: params.issueId },
      data: {
        status: MaintenanceStatus.FIXED,
        resolution,
      },
    });

    // If task ID provided or find latest task
    const latestTask = await prisma.maintenanceTask.findFirst({
      where: { issueId: params.issueId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestTask) {
      await prisma.maintenanceTask.update({
        where: { id: latestTask.id },
        data: {
          status: MaintenanceStatus.FIXED,
          actualCost: params.actualCost || latestTask.estimatedCost || 1200,
          completedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      issueId: params.issueId,
      status: MaintenanceStatus.FIXED,
      resolution,
      completedAt: new Date(),
      isMock: true,
    };
  }
}
