import { NotificationProvider } from './types';
import { MockNotificationProvider } from './mock';

export * from './types';
export * from './mock';

let currentNotificationProvider: NotificationProvider | null = null;

export function getNotificationProvider(): NotificationProvider {
  if (!currentNotificationProvider) {
    currentNotificationProvider = new MockNotificationProvider();
  }
  return currentNotificationProvider;
}
