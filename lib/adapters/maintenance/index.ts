import { MaintenanceProvider } from './types';
import { MockMaintenanceProvider } from './mock';

export * from './types';
export * from './mock';

let currentMaintenanceProvider: MaintenanceProvider | null = null;

export function getMaintenanceProvider(): MaintenanceProvider {
  if (!currentMaintenanceProvider) {
    currentMaintenanceProvider = new MockMaintenanceProvider();
  }
  return currentMaintenanceProvider;
}
