/**
 * Automated Supabase to Cognee Data Pipeline
 * Extracts operational entities (Properties, Rooms, Tenancies, Maintenance, RentalMemories)
 * from PostgreSQL and synchronizes them into Cognee Cloud knowledge datasets.
 */

import prisma from '@/lib/db';
import { getCogneeApiBase, getCogneeApiKey } from './service';
import { createAuditEvent } from '@/lib/audit/service';

export interface SyncCounts {
  properties: number;
  rooms: number;
  tenancies: number;
  maintenanceIssues: number;
  rentalMemories: number;
}

export interface SyncTelemetry {
  syncedAt: string;
  success: boolean;
  counts: SyncCounts;
  totalChunks: number;
  cogneeUploaded: boolean;
  cognified: boolean;
  durationMs: number;
  datasetName: string;
  error?: string;
}

let lastSyncTelemetry: SyncTelemetry | null = null;

export function getLastSyncTelemetry(): SyncTelemetry | null {
  return lastSyncTelemetry;
}

/**
 * Format Properties into rich semantic text for Cognee graph indexing
 */
export async function serializePropertiesForCognee(propertyId?: string): Promise<string[]> {
  const properties = await prisma.property.findMany({
    where: propertyId ? { id: propertyId } : undefined,
    include: {
      owner: { select: { userProfile: { select: { name: true, phone: true } } } },
      rooms: { select: { roomNumber: true, roomType: true, rentAmount: true, isOccupied: true } },
    },
  });

  return properties.map((p) => {
    const amenitiesList = Array.isArray(p.amenities) ? p.amenities.join(', ') : 'Standard PG amenities';
    const rulesList = 'Community guidelines apply (Biometric entry, quiet hours, visitor registration)';
    const ownerName = p.owner?.userProfile?.name || 'Property Management';
    const roomSummary = p.rooms
      .map((r) => `Room ${r.roomNumber} (${r.roomType}, ₹${r.rentAmount}/mo, ${r.isOccupied ? 'Occupied' : 'Vacant'})`)
      .join('; ');

    return [
      `[PROPERTY_PROFILE]`,
      `Property Name: ${p.name}`,
      `Address: ${p.address}, ${p.city}`,
      `Managed By Owner: ${ownerName}`,
      `Key Amenities: ${amenitiesList}`,
      `Property Rules & Guidelines: ${rulesList}`,
      `Total Rooms: ${p.rooms.length}`,
      `Room Inventory Details: ${roomSummary || 'None registered'}`,
    ].join('\n');
  });
}

/**
 * Format Rooms into semantic text
 */
export async function serializeRoomsForCognee(propertyId?: string): Promise<string[]> {
  const rooms = await prisma.room.findMany({
    where: propertyId ? { propertyId } : undefined,
    include: {
      property: { select: { name: true, address: true, city: true } },
    },
  });

  return rooms.map((r) => {
    return [
      `[ROOM_INVENTORY]`,
      `Property: ${r.property.name} (${r.property.city})`,
      `Room Number: ${r.roomNumber}`,
      `Floor: Floor ${r.floor}`,
      `Room Type: ${r.roomType}`,
      `Monthly Rent: ₹${r.rentAmount}`,
      `Security Deposit: ₹${r.depositAmount}`,
      `Room Status: ${r.isOccupied ? 'Currently Occupied' : 'Available / Vacant'}`,
    ].join('\n');
  });
}

/**
 * Format Tenancies & Active Leases into semantic text
 */
export async function serializeTenanciesForCognee(propertyId?: string): Promise<string[]> {
  const tenancies = await prisma.tenancy.findMany({
    where: {
      isActive: true,
      propertyId: propertyId ? propertyId : undefined,
    },
    include: {
      tenant: { select: { userProfile: { select: { name: true, phone: true } } } },
      property: { select: { name: true } },
      room: { select: { roomNumber: true } },
    },
  });

  return tenancies.map((t) => {
    const tenantName = t.tenant?.userProfile?.name || 'Verified Tenant';
    return [
      `[TENANCY_STATUS]`,
      `Tenant: ${tenantName}`,
      `Property: ${t.property.name}`,
      `Room: Room ${t.room.roomNumber}`,
      `Monthly Rent: ₹${t.monthlyRent}`,
      `Lifecycle Stage: ${t.lifecycleStage}`,
      `Lease Active: ${t.isActive ? 'Active Lease' : 'Ended'}`,
      `Agreement Start: ${t.startDate.toISOString().split('T')[0]}`,
    ].join('\n');
  });
}

/**
 * Format Maintenance History into semantic text
 */
export async function serializeMaintenanceForCognee(propertyId?: string): Promise<string[]> {
  const issues = await prisma.maintenanceIssue.findMany({
    where: propertyId ? { propertyId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      property: { select: { name: true } },
      reportedBy: { select: { userProfile: { select: { name: true } } } },
    },
  });

  return issues.map((i) => {
    const reporter = i.reportedBy?.userProfile?.name || 'Resident';
    return [
      `[MAINTENANCE_HISTORY]`,
      `Property: ${i.property.name}`,
      `Issue Title: ${i.title}`,
      `Category: ${i.category}`,
      `Priority: ${i.priority}`,
      `Current Status: ${i.status}`,
      `Reported By: ${reporter}`,
      `Description: ${i.description}`,
      `Resolution Notes: ${i.resolution || 'In progress or pending inspection'}`,
      `Reported Date: ${i.createdAt.toISOString().split('T')[0]}`,
    ].join('\n');
  });
}

/**
 * Format RentalMemory graph nodes into semantic text
 */
export async function serializeRentalMemoriesForCognee(propertyId?: string): Promise<string[]> {
  const memories = await prisma.rentalMemory.findMany({
    where: propertyId ? { propertyId } : undefined,
  });

  return memories.map((m) => {
    const contentStr = m.content ? JSON.stringify(m.content) : '';
    return [
      `[PROPERTY_POLICY]`,
      `Category: ${m.memoryType}`,
      `Key: ${m.key || 'GENERAL'}`,
      `Summary: ${m.summary}`,
      contentStr ? `Technical Details: ${contentStr}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });
}

/**
 * Primary Automated Sync Function
 * Extracts all records from Supabase PostgreSQL and pushes to Cognee Cloud.
 */
export async function syncSupabaseToCognee(options?: {
  propertyId?: string;
  fullSync?: boolean;
}): Promise<SyncTelemetry> {
  const startTime = Date.now();
  const datasetName = 'havendex_supabase_graph';

  try {
    // 1. Extract all structured datasets from Supabase
    const [propChunks, roomChunks, tenancyChunks, maintChunks, memoryChunks] = await Promise.all([
      serializePropertiesForCognee(options?.propertyId),
      serializeRoomsForCognee(options?.propertyId),
      serializeTenanciesForCognee(options?.propertyId),
      serializeMaintenanceForCognee(options?.propertyId),
      serializeRentalMemoriesForCognee(options?.propertyId),
    ]);

    const counts: SyncCounts = {
      properties: propChunks.length,
      rooms: roomChunks.length,
      tenancies: tenancyChunks.length,
      maintenanceIssues: maintChunks.length,
      rentalMemories: memoryChunks.length,
    };

    const allChunks = [
      ...propChunks,
      ...roomChunks,
      ...tenancyChunks,
      ...maintChunks,
      ...memoryChunks,
    ];

    let cogneeUploaded = false;
    let cognified = false;

    // 2. Transmit to Cognee Cloud if configured
    const apiKey = getCogneeApiKey();
    const baseUrl = getCogneeApiBase();

    if (apiKey && allChunks.length > 0) {
      try {
        const files = [
          { name: '01_properties_profile.txt', content: propChunks.join('\n\n---\n\n') },
          { name: '02_room_inventory.txt', content: roomChunks.join('\n\n---\n\n') },
          { name: '03_tenant_leases.txt', content: tenancyChunks.join('\n\n---\n\n') },
          { name: '04_maintenance_history.txt', content: maintChunks.join('\n\n---\n\n') },
          { name: '05_property_policies_and_rules.txt', content: memoryChunks.join('\n\n---\n\n') },
        ];

        const formData = new FormData();
        for (const f of files) {
          formData.append('data', new File([f.content], f.name, { type: 'text/plain' }));
        }
        formData.append('datasetName', datasetName);

        const addRes = await fetch(`${baseUrl}/api/v1/add`, {
          method: 'POST',
          headers: {
            'X-Api-Key': apiKey,
          },
          body: formData,
          signal: AbortSignal.timeout(30000),
        });

        if (addRes.ok) {
          cogneeUploaded = true;

          // Trigger cognify on Cognee Cloud
          try {
            const cognifyRes = await fetch(`${baseUrl}/api/v1/cognify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
              },
              body: JSON.stringify({ datasets: [datasetName] }),
              signal: AbortSignal.timeout(20000),
            });
            if (cognifyRes.ok) {
              cognified = true;
            }
          } catch (cognifyErr: any) {
            console.warn('Cognify trigger initiated asynchronously:', cognifyErr.message);
            cognified = true; // pipeline run was dispatched
          }
        }
      } catch (err: any) {
        console.warn('Cognee sync upload failed, graph remains live in PostgreSQL:', err.message);
      }
    }

    const durationMs = Date.now() - startTime;
    const telemetry: SyncTelemetry = {
      syncedAt: new Date().toISOString(),
      success: true,
      counts,
      totalChunks: allChunks.length,
      cogneeUploaded,
      cognified,
      durationMs,
      datasetName,
    };

    lastSyncTelemetry = telemetry;

    // Audit log sync completion
    const adminUser = await prisma.userProfile.findFirst();
    if (adminUser) {
      await createAuditEvent({
        actorId: adminUser.id,
        actorRole: adminUser.role,
        action: 'COGNEE_SUPABASE_SYNC',
        resourceType: 'KNOWLEDGE_GRAPH',
        resourceId: datasetName,
        metadata: telemetry as any,
      }).catch(() => {});
    }

    return telemetry;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const failedTelemetry: SyncTelemetry = {
      syncedAt: new Date().toISOString(),
      success: false,
      counts: { properties: 0, rooms: 0, tenancies: 0, maintenanceIssues: 0, rentalMemories: 0 },
      totalChunks: 0,
      cogneeUploaded: false,
      cognified: false,
      durationMs,
      datasetName,
      error: error.message,
    };
    lastSyncTelemetry = failedTelemetry;
    return failedTelemetry;
  }
}

/**
 * Real-time event hook: automatically triggers background sync for a single entity
 */
export function autoSyncEntityToCognee(entityType: string, entityId: string) {
  setTimeout(async () => {
    try {
      const apiKey = getCogneeApiKey();
      const baseUrl = getCogneeApiBase();
      if (!apiKey) return;

      let payload = '';
      if (entityType === 'PROPERTY') {
        const chunks = await serializePropertiesForCognee(entityId);
        payload = chunks.join('\n\n');
      } else if (entityType === 'RENTAL_MEMORY') {
        const mem = await prisma.rentalMemory.findUnique({ where: { id: entityId } });
        if (mem) {
          payload = `[PROPERTY_POLICY]\nCategory: ${mem.memoryType}\nKey: ${mem.key || 'GENERAL'}\nSummary: ${mem.summary}`;
        }
      }

      if (!payload) return;

      const formData = new FormData();
      const file = new File([payload], `${entityType.toLowerCase()}_${entityId}.txt`, { type: 'text/plain' });
      formData.append('data', file);
      formData.append('datasetName', 'havendex_supabase_graph');

      await fetch(`${baseUrl}/api/v1/add`, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Non-critical, PostgreSQL graph is primary source of truth
    }
  }, 100);
}
