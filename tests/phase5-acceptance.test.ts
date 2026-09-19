import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '@/lib/db';
import {
  MaintenanceStatus,
  PaymentStatus,
  RentalLifecycle,
  UserRole,
  VerificationMethod,
} from '@prisma/client';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';
import { getPaymentProvider, MockPaymentProvider, PaytmPaymentProvider } from '@/lib/adapters/payment';
import { getNotificationProvider, MockNotificationProvider } from '@/lib/adapters/notifications';
import { getMaintenanceProvider, MockMaintenanceProvider } from '@/lib/adapters/maintenance';
import { processPayment } from '@/lib/payments/service';
import {
  reportMaintenanceIssue,
  notifyOwnerForIssue,
  assignMaintenanceTask,
  simulateRepairForIssue,
  verifyMaintenanceIssue,
} from '@/lib/maintenance/service';
import { memoryService } from '@/lib/ai/memory/service';
import { createAuditEvent, getAuditLogs } from '@/lib/audit/service';

describe('HavenDex Phase 5 - Final Acceptance & Hackathon Demo Test Suite', () => {
  let tenantProfile: any;
  let ownerProfile: any;
  let otherTenantProfile: any;
  let tenancy: any;
  let rentSchedule: any;

  beforeAll(async () => {
    // Resolve seeded test profiles
    tenantProfile = await prisma.userProfile.findFirst({
      where: { email: 'arjun.mehta@gmail.com' },
      include: {
        tenant: {
          include: {
            tenancies: {
              where: { isActive: true },
              take: 1,
              include: {
                property: { include: { owner: { include: { userProfile: true } } } },
                room: true,
                rentSchedules: { orderBy: { dueDate: 'desc' }, take: 1 },
              },
            },
          },
        },
      },
    });

    ownerProfile = await prisma.userProfile.findFirst({
      where: { role: UserRole.OWNER },
      include: { owner: { include: { properties: true } } },
    });

    otherTenantProfile = await prisma.userProfile.findFirst({
      where: { email: 'sneha.rao@gmail.com' },
      include: { tenant: { include: { tenancies: { take: 1 } } } },
    });

    if (tenantProfile?.tenant?.tenancies[0]) {
      tenancy = tenantProfile.tenant.tenancies[0];
      rentSchedule = tenancy.rentSchedules[0];
    }
  });

  // ==========================================================================
  // 1. MAIN HACKATHON DEMO SCENARIO (END-TO-END)
  // ==========================================================================
  describe('1. Main Hackathon Demo Scenario', () => {
    it('should process: "My rent is paid. Please confirm it and tell the owner that my AC isn\'t working again."', async () => {
      const canonicalPrompt =
        "My rent is paid. Please confirm it and tell the owner that my AC isn't working again.";

      const response = await executeRentalAssistant({
        userMessage: canonicalPrompt,
        userProfile: tenantProfile,
        languageCode: 'en-IN',
        modelName: 'gemini-1.5-flash',
      });

      // 1. Verify Multi-Intent Detection
      expect(response.detectedIntents).toBeDefined();
      expect(response.detectedIntents!.length).toBeGreaterThanOrEqual(2);
      const intentTypes = response.detectedIntents!.map((i) => i.intent);
      expect(intentTypes).toContain('PAYMENT_VALIDATION');
      expect(intentTypes).toContain('MAINTENANCE_REPORT');

      // 2. Verify Context Retrieval (Previous related issue found)
      expect(response.previousRelatedIssue).toBeDefined();
      expect(response.isRepeatedIssue).toBe(true);

      // 3. Verify Payment Status Validation
      const paymentIntent = response.intentBreakdown?.find((i) => i.intent === 'PAYMENT_VALIDATION');
      expect(paymentIntent).toBeDefined();
      expect(paymentIntent?.status).toBe('SUCCESS');

      // 4. Verify Maintenance Issue Creation (Repeated issue detected)
      const maintenanceIntent = response.intentBreakdown?.find((i) => i.intent === 'MAINTENANCE_REPORT');
      expect(maintenanceIntent).toBeDefined();
      expect(maintenanceIntent?.status).toBe('SUCCESS');

      // 5. Verify Owner Notification
      const ownerIntent = response.intentBreakdown?.find((i) => i.intent === 'OWNER_NOTIFICATION');
      expect(ownerIntent).toBeDefined();
      expect(ownerIntent?.status).toBe('SUCCESS');

      // 6. Verify Synthesized Response
      expect(typeof response.userResponse).toBe('string');
      expect(response.userResponse.length).toBeGreaterThan(20);
    });
  });

  // ==========================================================================
  // 2. DETERMINISTIC DEMO MODE & ADAPTERS
  // ==========================================================================
  describe('2. Provider Adapters (Deterministic Demo Mode)', () => {
    it('should return MockPaymentProvider when forced or in demo mode', () => {
      const provider = getPaymentProvider(true);
      expect(provider).toBeInstanceOf(MockPaymentProvider);
      expect(provider.isMock).toBe(true);
      expect(provider.name).toBe('MOCK_PAYMENT_PROVIDER');
    });

    it('should process payment deterministically via MockPaymentProvider', async () => {
      const provider = new MockPaymentProvider();
      const result = await provider.processPayment({
        rentScheduleId: rentSchedule?.id || 'mock-sched-id',
        amount: 18000,
        payerId: tenantProfile.id,
        tenancyId: tenancy?.id || 'mock-tenancy-id',
        propertyId: tenancy?.propertyId || 'mock-prop-id',
        billingMonth: '2026-09',
      });

      expect(result.success).toBe(true);
      expect(result.transactionRef).toContain('TXN_MOCK_');
      expect(result.status).toBe('SUCCESS');
    });

    it('should support PaytmPaymentProvider adapter interface', () => {
      const paytm = new PaytmPaymentProvider();
      expect(paytm.name).toBe('PAYTM');
      expect(paytm.isMock).toBe(false);
      expect(typeof paytm.processPayment).toBe('function');
      expect(typeof paytm.verifyPayment).toBe('function');
    });

    it('should dispatch notifications via MockNotificationProvider', async () => {
      const notifProvider = getNotificationProvider();
      expect(notifProvider).toBeInstanceOf(MockNotificationProvider);

      const res = await notifProvider.send({
        recipientUserProfileId: ownerProfile.id,
        title: 'Acceptance Test Notification',
        message: 'Testing notification provider adapter',
      });

      expect(res.success).toBe(true);
      expect(res.channel).toBe('IN_APP_MOCK');
    });

    it('should dispatch tasks and simulate repair via MockMaintenanceProvider', async () => {
      const maintProvider = getMaintenanceProvider();
      expect(maintProvider).toBeInstanceOf(MockMaintenanceProvider);

      // Create a test issue first
      const issue = await reportMaintenanceIssue({
        tenancyId: tenancy.id,
        title: 'Acceptance Test: AC Not Cooling',
        description: 'Test issue for maintenance provider',
        category: 'APPLIANCE',
        priority: 'HIGH',
        reporterUserProfileId: tenantProfile.id,
      });

      const dispatchRes = await maintProvider.dispatchTask({
        issueId: issue.id,
        title: 'Dispatch QuickFix for AC',
        category: 'APPLIANCE',
        priority: 'HIGH',
      });

      expect(dispatchRes.success).toBe(true);
      expect(dispatchRes.assignedTo).toContain('QuickFix');

      const repairRes = await maintProvider.simulateRepair({
        issueId: issue.id,
        resolution: 'AC filter cleaned, gas refilled, tested at 18°C',
      });

      expect(repairRes.success).toBe(true);
      expect(repairRes.status).toBe(MaintenanceStatus.FIXED);
    });
  });

  // ==========================================================================
  // 3. CLOSED-LOOP VERIFICATION & STATE MACHINE
  // ==========================================================================
  describe('3. Closed-Loop Verification Workflow', () => {
    it('should complete closed-loop verification via COMBINED method and advance to VERIFIED', async () => {
      const issue = await reportMaintenanceIssue({
        tenancyId: tenancy.id,
        title: 'AC unit thermal cutoff failure',
        description: 'Compressor trips after 10 mins',
        category: 'APPLIANCE',
        priority: 'HIGH',
        reporterUserProfileId: tenantProfile.id,
      });

      // Simulate repair
      await simulateRepairForIssue({
        issueId: issue.id,
        resolution: 'Thermal sensor replaced and tested functional',
        actor: { id: tenantProfile.id, role: 'TENANT' },
      });

      // Verify issue
      const verifyRes = await verifyMaintenanceIssue({
        issueId: issue.id,
        verificationMethod: VerificationMethod.COMBINED,
        verifiedBy: tenantProfile.id,
        evidence: 'Sensor readings normal, cooling confirmed at 18°C',
        confidence: 0.98,
        confirmed: true,
        actor: { id: tenantProfile.id, role: 'TENANT' },
      });

      expect(verifyRes.confirmed).toBe(true);
      expect(verifyRes.issueStatus).toBe(MaintenanceStatus.CLOSED);

      // Verify memory record was created
      const memories = await memoryService.retrieve({
        userProfileId: tenantProfile.id,
        tenancyId: tenancy.id,
        memoryTypes: ['MAINTENANCE_RESOLUTION'],
        limit: 5,
      });

      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].memoryType).toBe('MAINTENANCE_RESOLUTION');
    });
  });

  // ==========================================================================
  // 4. OBSERVABILITY & ERROR HANDLING
  // ==========================================================================
  describe('4. Audit Observability & Sanitization', () => {
    it('should create audit events with structured observability fields and sanitize secrets', async () => {
      const audit = await createAuditEvent({
        actorId: tenantProfile.id,
        actorRole: 'TENANT',
        action: 'TEST_OBSERVABILITY_ACTION',
        resourceType: 'TEST_RESOURCE',
        resourceId: 'res-123',
        requestId: 'req-abc-999',
        agentSessionId: 'sess-xyz-888',
        tool: 'testTool',
        status: 'SUCCESS',
        latency: 125,
        metadata: {
          testParam: 'safe_value',
          password: 'super_secret_password',
          apiKey: 'secret_key_123',
          token: 'jwt_token_secret',
        },
      });

      expect(audit).not.toBeNull();
      expect(audit?.action).toBe('TEST_OBSERVABILITY_ACTION');

      const meta = audit?.metadata as any;
      expect(meta.requestId).toBe('req-abc-999');
      expect(meta.agentSessionId).toBe('sess-xyz-888');
      expect(meta.latency).toBe(125);
      expect(meta.status).toBe('SUCCESS');

      // Verify strict sanitization
      expect(meta.password).toBe('[REDACTED_SENSITIVE]');
      expect(meta.apiKey).toBe('[REDACTED_SENSITIVE]');
      expect(meta.token).toBe('[REDACTED_SENSITIVE]');
    });

    it('should handle payment failure cleanly without claiming success', async () => {
      const provider = new MockPaymentProvider();
      const failResult = await provider.processPayment({
        rentScheduleId: 'invalid-id',
        amount: -500, // Invalid amount
        payerId: tenantProfile.id,
        tenancyId: 't-1',
        propertyId: 'p-1',
        billingMonth: '2026-09',
      });

      expect(failResult.success).toBe(false);
      expect(failResult.status).toBe(PaymentStatus.FAILED);
      expect(failResult.error).toBeDefined();
    });
  });
});
