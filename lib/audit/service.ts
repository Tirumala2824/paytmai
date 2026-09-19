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
  // Observability additions
  requestId?: string;
  agentSessionId?: string;
  agentActionId?: string;
  userId?: string;
  tool?: string;
  resource?: string;
  status?: string; // 'SUCCESS' | 'FAILED' | 'PENDING' | 'REJECTED'
  timestamp?: string;
  latency?: number; // in milliseconds
  error?: string;
}

const SENSITIVE_KEY_SUBSTRINGS = [
  'password',
  'secret',
  'token',
  'apikey',
  'authorization',
  'cvv',
  'cardnumber',
  'pin',
  'idproofnumber',
  'privatekey',
  'paymentsecret',
];

/**
 * Sanitizes any object or dictionary recursively to strip secrets, keys, and tokens.
 */
function sanitizeAuditPayload(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEY_SUBSTRINGS.some((s) => lowerKey.includes(s))) {
      result[key] = '[REDACTED_SENSITIVE]';
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = sanitizeAuditPayload(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function createAuditEvent(params: CreateAuditParams) {
  try {
    // Construct structured observability metadata
    const auditMeta: Record<string, unknown> = {
      ...(params.metadata || {}),
      requestId: params.requestId,
      agentSessionId: params.agentSessionId,
      agentActionId: params.agentActionId,
      userId: params.userId || params.actorId,
      tool: params.tool,
      resource: params.resource || `${params.resourceType}:${params.resourceId}`,
      status: params.status || 'SUCCESS',
      latency: params.latency,
      error: params.error,
      timestamp: params.timestamp || new Date().toISOString(),
    };

    // Remove undefined properties
    for (const key of Object.keys(auditMeta)) {
      if (auditMeta[key] === undefined) {
        delete auditMeta[key];
      }
    }

    const sanitizedMetadata = sanitizeAuditPayload(auditMeta) as Prisma.InputJsonValue;

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
    // Observability logging should never crash primary execution threads
    console.error('Failed to create audit event:', error);
    return null;
  }
}

export async function getAuditLogs(params: {
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  tool?: string;
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
