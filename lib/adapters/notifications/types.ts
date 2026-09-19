import { NotificationType } from '@prisma/client';

export interface SendNotificationParams {
  recipientUserProfileId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  urgent?: boolean;
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  channel: string;
  deliveredAt: Date;
  isMock: boolean;
}

export interface NotificationProvider {
  name: string;
  isMock: boolean;
  send(params: SendNotificationParams): Promise<NotificationResult>;
}
