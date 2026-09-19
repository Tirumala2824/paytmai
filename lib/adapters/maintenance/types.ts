import { MaintenanceStatus, VerificationMethod } from '@prisma/client';

export interface DispatchTaskParams {
  issueId: string;
  title: string;
  category: string;
  priority: string;
  assignedTo?: string;
  estimatedCost?: number;
}

export interface DispatchTaskResult {
  success: boolean;
  taskId: string;
  assignedTo: string;
  estimatedCost: number;
  status: MaintenanceStatus;
  dispatchedAt: Date;
  isMock: boolean;
}

export interface SimulateRepairParams {
  issueId: string;
  taskId?: string;
  resolution: string;
  actualCost?: number;
}

export interface SimulateRepairResult {
  success: boolean;
  issueId: string;
  status: MaintenanceStatus;
  resolution: string;
  completedAt: Date;
  isMock: boolean;
}

export interface MaintenanceProvider {
  name: string;
  isMock: boolean;
  dispatchTask(params: DispatchTaskParams): Promise<DispatchTaskResult>;
  simulateRepair(params: SimulateRepairParams): Promise<SimulateRepairResult>;
}
