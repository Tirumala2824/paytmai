import prisma from '@/lib/db';
import { NotificationType } from '@prisma/client';
import { NotificationProvider, NotificationResult, SendNotificationParams } from './types';

/**
 * MockNotificationProvider
 * Deterministic notification adapter for hackathon demonstration.
 * Creates Prisma Notification records and in-app alerts reliably.
 */
export class MockNotificationProvider implements NotificationProvider {
  public readonly name = 'MOCK_NOTIFICATION_PROVIDER';
  public readonly isMock = true;

  async send(params: SendNotificationParams): Promise<NotificationResult> {
    try {
      const notification = await prisma.notification.create({
        data: {
          userProfileId: params.recipientUserProfileId,
          title: params.urgent ? `⚠️ ${params.title}` : params.title,
          message: params.message,
          type: params.type || NotificationType.SYSTEM,
          link: params.link || '/notifications',
        },
      });

      return {
        success: true,
        notificationId: notification.id,
        channel: 'IN_APP_MOCK',
        deliveredAt: new Date(),
        isMock: true,
      };
    } catch (err: any) {
      console.warn('MockNotificationProvider failed to save notification:', err);
      return {
        success: false,
        channel: 'IN_APP_MOCK',
        deliveredAt: new Date(),
        isMock: true,
      };
    }
  }
}
