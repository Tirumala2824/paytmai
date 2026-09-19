import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

export interface CreateAuditParams {
  actorId: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditEvent(params: CreateAuditParams) {
  try {
    // Sanitize metadata to never store passwords or secrets
    let sanitizedMetadata: Prisma.InputJsonValue | undefined = undefined;
    if (params.metadata) {
      const copy = { ...params.metadata };
      const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'authorization'];
      for (const key of Object.keys(copy)) {
        if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
          copy[key] = '[REDACTED]';
        }
      }
      sanitizedMetadata = copy as Prisma.InputJsonValue;
    }

    return await prisma.auditEvent.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: sanitizedMetadata,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    // Audit logging should not crash the main thread, but log error
    console.error('Failed to create audit event:', error);
    return null;
  }
}

export async function getAuditLogs(params: {
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const { actorId, resourceType, resourceId, action, limit = 50, offset = 0 } = params;

  return await prisma.auditEvent.findMany({
    where: {
      ...(actorId ? { actorId } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(resourceId ? { resourceId } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      userProfile: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
}
