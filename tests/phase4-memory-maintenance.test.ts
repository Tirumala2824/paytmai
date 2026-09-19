import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/db';
import { MaintenanceStatus, RentalLifecycle, UserRole, VerificationMethod } from '@prisma/client';
import { memoryService } from '@/lib/ai/memory/service';
import {
  reportMaintenanceIssue,
  notifyOwnerForIssue,
  assignMaintenanceTask,
  updateMaintenanceStatus,
  verifyMaintenanceIssue,
  VALID_STATUS_TRANSITIONS,
} from '@/lib/maintenance/service';
import { executeRentalAssistant } from '@/lib/ai/orchestrator';

describe('HavenDex Phase 4 - Persistent Rental Context & Closed-Loop Maintenance', () => {
  let testUserProfile: any;
  let testOwnerProfile: any;
  let testTenancy: any;

  beforeAll(async () => {
    // Resolve seeded test tenant (Arjun Mehta) and owner (Rajesh Sharma)
    testUserProfile = await prisma.userProfile.findFirst({
      where: { email: 'arjun.mehta@gmail.com' },
      include: { tenant: { include: { tenancies: { where: { isActive: true }, take: 1 } } } },
    });

    testOwnerProfile = await prisma.userProfile.findFirst({
      where: { role: UserRole.OWNER },
      include: { owner: true },
    });

    if (testUserProfile?.tenant?.tenancies[0]) {
      testTenancy = testUserProfile.tenant.tenancies[0];
    }
  });

  // ==========================================================================
  // 1. COGNEE MEMORY SERVICE ABSTRACTION
  // ==========================================================================
  describe('1. MemoryService Abstraction', () => {
    it('should remember() rental context without storing sensitive information', async () => {
      const memory = await memoryService.remember({
        userProfileId: testUserProfile.id,
        tenancyId: testTenancy.id,
        memoryType: 'MAINTENANCE_RESOLUTION',
        key: 'AC_UNIT',
        summary: 'Test Memory: AC service completed in Room 101. Replaced filter.',
        content: {
          repair: 'Filter replaced',
          technician: 'CoolCare Services',
          password: 'sensitive_password_123', // Must be sanitized!
        },
      });

      expect(memory.id).toBeDefined();
      expect(memory.summary).toContain('AC service completed');
      expect(memory.content.password).toBe('[REDACTED_SENSITIVE]');
    });

    it('should retrieve() memories for a tenant and tenancy', async () => {
      const memories = await memoryService.retrieve({
        userProfileId: testUserProfile.id,
        tenancyId: testTenancy.id,
        limit: 10,
      });

      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBeGreaterThan(0);
      const types = memories.map((m) => m.memoryType);
      expect(types).toContain('MAINTENANCE_RESOLUTION');
    });

    it('should search() memories by relevant query keywords', async () => {
      const results = await memoryService.search({
        userProfileId: testUserProfile.id,
        tenancyId: testTenancy.id,
        query: 'AC cooling filter repair',
        limit: 5,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].summary.toLowerCase()).toContain('ac');
    });

    it('should summarize() rental context concisely for AI orchestration', async () => {
      const summary = await memoryService.summarize({
        userProfileId: testUserProfile.id,
        tenancyId: testTenancy.id,
      });

      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(10);
      expect(summary).toContain('Arjun Mehta');
    });
  });

  // ==========================================================================
  // 2. CONTEXT RETRIEVAL & RECURRING ISSUE DETECTION
  // ==========================================================================
  describe('2. Context Retrieval', () => {
    it('should retrieve historical AC maintenance context when user says "The AC is broken again"', async () => {
      const result = await memoryService.retrieveRelevantContext({
        userProfileId: testUserProfile.id,
        tenancyId: testTenancy.id,
        userMessage: 'The AC is broken again.',
      });

      expect(result.previousRelatedIssue).toBeDefined();
      expect(result.previousRelatedIssue?.title.toLowerCase()).toMatch(/ac|air condition/);
      expect(result.previousRelatedIssue?.isRepeated).toBe(true);
      expect(result.relevantMemories.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 3. CLOSED-LOOP MAINTENANCE RESOLUTION
  // ==========================================================================
  describe('3. Closed-Loop Maintenance Lifecycle', () => {
    let createdIssue: any;

    it('should create issue in ISSUE_REPORTED and advance rental lifecycle to ISSUE', async () => {
      createdIssue = await reportMaintenanceIssue({
        tenancyId: testTenancy.id,
        title: 'Geyser not heating water',
        description: 'Water remains ice cold even after 30 minutes of switching on geyser in bathroom.',
        category: 'ELECTRICAL',
        priority: 'HIGH',
        reporterUserProfileId: testUserProfile.id,
      });

      expect(createdIssue.id).toBeDefined();
      expect(createdIssue.status).toBe(MaintenanceStatus.ISSUE_REPORTED);
    });

    it('CRITICAL: Notifying owner should move status to OWNER_NOTIFIED and NOT close the issue', async () => {
      const result = await notifyOwnerForIssue({
        issueId: createdIssue.id,
        message: 'Tenant reported geyser not heating water.',
        urgent: true,
        actor: { id: testUserProfile.id, role: 'TENANT' },
      });

      expect(result.issueStatus).toBe(MaintenanceStatus.OWNER_NOTIFIED);

      // Verify in DB that it is NOT closed
      const inDb = await prisma.maintenanceIssue.findUnique({
        where: { id: createdIssue.id },
      });
      expect(inDb?.status).toBe(MaintenanceStatus.OWNER_NOTIFIED);
      expect(inDb?.status).not.toBe(MaintenanceStatus.CLOSED);
      expect(inDb?.status).not.toBe(MaintenanceStatus.VERIFIED);
    });

    it('should assign maintenance task and transition to TASK_ASSIGNED', async () => {
      const task = await assignMaintenanceTask({
        issueId: createdIssue.id,
        title: 'Inspect geyser heating element & thermostat',
        assignedTo: 'SparkFix Electricals (Technician Amit)',
        estimatedCost: 1200,
        actor: { id: testOwnerProfile.id, role: 'OWNER' },
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe(MaintenanceStatus.TASK_ASSIGNED);

      const inDb = await prisma.maintenanceIssue.findUnique({
        where: { id: createdIssue.id },
      });
      expect(inDb?.status).toBe(MaintenanceStatus.TASK_ASSIGNED);
    });

    it('should transition to IN_PROGRESS and then FIXED', async () => {
      const inProgress = await updateMaintenanceStatus({
        issueId: createdIssue.id,
        status: MaintenanceStatus.IN_PROGRESS,
        actor: { id: testOwnerProfile.id, role: 'OWNER' },
        notes: 'Technician Amit on site diagnosing geyser',
      });
      expect(inProgress.status).toBe(MaintenanceStatus.IN_PROGRESS);

      const fixed = await updateMaintenanceStatus({
        issueId: createdIssue.id,
        status: MaintenanceStatus.FIXED,
        actor: { id: testOwnerProfile.id, role: 'OWNER' },
        notes: 'Replaced burnt heating coil and tested hot water output',
        resolution: 'Replaced 2kW heating coil and tested water temperature at 55°C',
      });
      expect(fixed.status).toBe(MaintenanceStatus.FIXED);
      expect(fixed.resolution).toContain('Replaced 2kW heating coil');
    });

    it('should verify resolution via COMBINED method and close issue with audit event and memory update', async () => {
      const verifyResult = await verifyMaintenanceIssue({
        issueId: createdIssue.id,
        verificationMethod: VerificationMethod.COMBINED,
        verifiedBy: testUserProfile.id,
        evidence: 'Tenant confirmed steaming hot water at 55°C; Technician invoice #SF-4011 attached.',
        confidence: 0.98,
        notes: 'Combined verification: Tenant confirmed + digital thermometer sensor verified.',
        confirmed: true,
        resolution: 'Replaced 2kW heating coil and tested water temperature at 55°C',
        actor: { id: testUserProfile.id, role: 'TENANT' },
      });

      expect(verifyResult.confirmed).toBe(true);
      expect(verifyResult.issueStatus).toBe(MaintenanceStatus.CLOSED);
      expect(verifyResult.verification.verificationMethod).toBe(VerificationMethod.COMBINED);
      expect(verifyResult.verification.confidence).toBe(0.98);

      // Verify in DB
      const inDb = await prisma.maintenanceIssue.findUnique({
        where: { id: createdIssue.id },
        include: { verifications: true },
      });
      expect(inDb?.status).toBe(MaintenanceStatus.CLOSED);
      expect(inDb?.verifications.length).toBeGreaterThan(0);

      // Verify Audit Event created
      const audit = await prisma.auditEvent.findFirst({
        where: {
          resourceId: createdIssue.id,
          action: 'MAINTENANCE_VERIFIED',
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.resourceType).toBe('MAINTENANCE_ISSUE');
    });

    it('CRITICAL: Pure human confirmation must NEVER claim physical AI verification confidence', async () => {
      // Create a dummy issue to test human-only verification
      const dummyIssue = await reportMaintenanceIssue({
        tenancyId: testTenancy.id,
        title: 'Door handle loose',
        description: 'Bedroom door handle loose',
        reporterUserProfileId: testUserProfile.id,
      });

      const result = await verifyMaintenanceIssue({
        issueId: dummyIssue.id,
        verificationMethod: VerificationMethod.TENANT_CONFIRMATION,
        verifiedBy: testUserProfile.id,
        evidence: 'Tenant confirmed door handle tightened',
        confidence: 0.99, // Should be forced to null for human-only!
        confirmed: true,
        actor: { id: testUserProfile.id, role: 'TENANT' },
      });

      expect(result.verification.confidence).toBeNull();
    });
  });

  // ==========================================================================
  // 4. AI MEMORY DEMONSTRATION & HISTORICAL CONTEXT RETRIEVAL
  // ==========================================================================
  describe('4. AI Memory Demonstration', () => {
    it('should display "Previous related maintenance issue found." when user says "The AC is broken again."', async () => {
      const response = await executeRentalAssistant({
        userMessage: 'The AC is broken again.',
        userProfile: testUserProfile,
      });

      expect(response.userResponse).toContain('Previous related maintenance issue found');
      expect(response.userResponse.toLowerCase()).toMatch(/ac|air condition/);
      expect(response.previousRelatedIssue).toBeDefined();
      expect(response.previousRelatedIssue?.title.toLowerCase()).toMatch(/ac|air condition/);

      // Check that an execution step explicitly recorded the memory recall
      const memoryStep = response.executionSteps.find(
        (s) => s.label.includes('Previous related') || s.details?.includes('Previous related')
      );
      expect(memoryStep).toBeDefined();
    });
  });

  // ==========================================================================
  // 5. AGENTIC RAG SYSTEM & SEMANTIC KNOWLEDGE GRAPH RETRIEVAL
  // ==========================================================================
  describe('5. Agentic RAG System & Semantic Knowledge Graph Retrieval', () => {
    it('should searchKnowledgeGraph() for Wi-Fi credentials and return SSID/password', async () => {
      const results = await memoryService.searchKnowledgeGraph({
        query: 'What is the wifi password and network name?',
        userProfileId: testUserProfile.id,
        limit: 5,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      const wifiMatch = results.find((r) => r.category === 'PROPERTY_WIFI' || r.summary.toLowerCase().includes('wifi'));
      expect(wifiMatch).toBeDefined();
      expect(wifiMatch?.summary.toLowerCase()).toMatch(/wifi|password|ssid/);
    });

    it('should searchKnowledgeGraph() for mess timings and meal schedule', async () => {
      const results = await memoryService.searchKnowledgeGraph({
        query: 'What are the mess and food timings for breakfast and dinner?',
        userProfileId: testUserProfile.id,
        limit: 5,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      const messMatch = results.find((r) => r.category === 'MESS_SCHEDULE' || r.summary.toLowerCase().includes('mess'));
      expect(messMatch).toBeDefined();
      expect(messMatch?.summary.toLowerCase()).toMatch(/breakfast|dinner|lunch|mess/);
    });

    it('should searchKnowledgeGraph() for property rules, gate timings and visitor policy', async () => {
      const results = await memoryService.searchKnowledgeGraph({
        query: 'What are the gate closing timings and visitor rules?',
        userProfileId: testUserProfile.id,
        limit: 5,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      const rulesMatch = results.find((r) => r.category === 'PROPERTY_RULES' || r.summary.toLowerCase().includes('gate'));
      expect(rulesMatch).toBeDefined();
      expect(rulesMatch?.summary.toLowerCase()).toMatch(/gate|visitor|guest|curfew|rules/);
    });

    it('should executeRentalAssistant() with RAG tool planning for "What are the mess timings?"', async () => {
      const response = await executeRentalAssistant({
        userMessage: 'What are the mess timings?',
        userProfile: testUserProfile,
      });

      expect(response.plannedActions).toContain('searchKnowledgeBase');
      expect(response.userResponse.toLowerCase()).toMatch(/mess|breakfast|dinner|lunch|schedule/);
      expect(response.executionSteps.some((s) => s.label.includes('Knowledge graph') || s.label.includes('searchKnowledgeBase'))).toBe(true);
    });

    it('should executeRentalAssistant() with RAG tool planning for "What is the wifi password?"', async () => {
      const response = await executeRentalAssistant({
        userMessage: 'What is the wifi password?',
        userProfile: testUserProfile,
      });

      expect(response.plannedActions).toContain('searchKnowledgeBase');
      expect(response.userResponse.toLowerCase()).toMatch(/wifi|password|internet|ssid/);
    });
  });
});
