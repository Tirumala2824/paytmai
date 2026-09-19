# HavenDex Database Architecture

HavenDex uses **Supabase PostgreSQL** as its relational data store and **Prisma ORM** as the primary typed data-access layer.

---

## 1. Core Database Entities

| Model | Description | Key Relationships |
|---|---|---|
| `UserProfile` | Canonical user identity tied to Supabase Auth `auth.users.id`. | 1:1 `Tenant`, 1:1 `Owner`, 1:N `Notification`, 1:N `AuditEvent` |
| `Tenant` | Tenant-specific metadata (emergency contacts, ID proof). | 1:1 `UserProfile`, 1:N `Tenancy`, 1:N `MaintenanceIssue` |
| `Owner` | Property owner profile (company name, tax ID, bank details). | 1:1 `UserProfile`, 1:N `Property` |
| `Property` | Building or facility (PG, Coliving, Apartment). | N:1 `Owner`, 1:N `Room`, 1:N `Tenancy`, 1:N `MaintenanceIssue` |
| `Room` | Specific room or unit in a property. | N:1 `Property`, 1:N `Tenancy` |
| `Tenancy` | The active lease agreement between a Tenant and Room. | N:1 `Tenant`, N:1 `Room`, N:1 `Property`, 1:N `RentSchedule` |
| `RentSchedule` | Monthly rent billing cycle (e.g. `2026-09`). | N:1 `Tenancy`, 1:N `Payment` |
| `Payment` | Immutable payment records (Paytm, UPI, Bank Transfer). | N:1 `RentSchedule` |
| `MaintenanceIssue` | Reported physical issues (AC, plumbing, electrical). | N:1 `Tenancy`, N:1 `Property`, N:1 `Tenant`, 1:N `MaintenanceTask` |
| `MaintenanceTask` | Contractor/technician work orders assigned for an issue. | N:1 `MaintenanceIssue` |
| `MaintenanceVerification` | Closed-loop proof of fix (Tenant, Owner, AI Image). | N:1 `MaintenanceIssue` |
| `RentalMemory` | Persistent rental memory graph nodes. | N:1 `UserProfile`, N:1 `Tenancy`, N:1 `Property` |
| `Notification` | In-app alerts for rent, payments, and maintenance. | N:1 `UserProfile` |
| `AgentSession` | Stateful conversational sessions with HavenDex AI. | N:1 `UserProfile`, 1:N `AgentAction` |
| `AgentAction` | Specific tool proposals, executions, and statuses. | N:1 `AgentSession` |
| `AuditEvent` | Immutable security audit trail with observability metadata. | N:1 `UserProfile` |

---

## 2. Relational Enums

### `RentalLifecycle`
```prisma
enum RentalLifecycle {
  BOOKED
  RENT_DUE
  PAYMENT
  ISSUE
  ACTION
  FIXED
  VERIFIED
}
```

### `MaintenanceStatus`
```prisma
enum MaintenanceStatus {
  ISSUE_REPORTED
  CLASSIFIED
  OWNER_NOTIFIED
  TASK_ASSIGNED
  IN_PROGRESS
  FIXED
  VERIFICATION_PENDING
  VERIFIED
  CLOSED
}
```

### `PaymentStatus`
```prisma
enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
  REFUNDED
}
```

### `VerificationMethod`
```prisma
enum VerificationMethod {
  TENANT_CONFIRMATION
  OWNER_CONFIRMATION
  AI_IMAGE_ANALYSIS
  COMBINED
}
```

---

## 3. Database Indexes & Performance Optimization

All foreign keys, status fields, and query filters are indexed:
- `UserProfile`: `authUserId`, `email`, `role`
- `Tenancy`: `tenantId`, `roomId`, `propertyId`, `lifecycleStage`, `isActive`
- `RentSchedule`: `tenancyId`, `dueDate`, `status`
- `Payment`: `rentScheduleId`, `status`, `transactionRef`
- `MaintenanceIssue`: `tenancyId`, `propertyId`, `reportedById`, `status`, `isRepeated`
- `RentalMemory`: `userProfileId`, `tenancyId`, `memoryType`, `key`
- `AuditEvent`: `actorId`, `action`, `resourceType + resourceId`, `createdAt`

---

## 4. Seed Data

To populate the database with realistic demo data:
```bash
npm run seed
```
This generates:
- 2 Owners: Rajesh Sharma (`rajesh@nexusliving.in`) and Priya Patel (`priya@urbannest.in`).
- 3 Tenants: Arjun Mehta (`arjun.mehta@gmail.com`), Sneha Rao, Rohan Gupta.
- 3 Properties: Nexus Heights (Koramangala), Nexus Studio Suites (Indiranagar), UrbanNest (HSR).
- Active tenancies, historical rent payments, and prior AC maintenance records for memory demonstration.
