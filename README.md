# HavenDex — AI-Powered PG & Rental Operating System

> **"One AI teammate for the entire rental relationship."**

HavenDex solves rental lifecycle fragmentation by unifying booking, rent schedules, Paytm payments, maintenance triage, and verified resolution into a continuous, verified, and secure operating state machine.

---

## ⚡ Quick Start (Bun Runtime)

```bash
# 1. Install dependencies
bun install

# 2. Generate Prisma Client
bunx prisma generate

# 3. Run Automated Tests (RBAC, ABAC, Lifecycle, AI Tools, AI Orchestrator)
bun test

# 4. Start Development Server
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/assistant](http://localhost:3000/assistant) to access HavenDex.

---

## 🤖 Phase 2: AI-Powered Rental Assistant

HavenDex Phase 2 introduces **stateful AI orchestration** using **LangGraph.js**, **LangChain.js**, and **Gemini**, turning the rental dashboard into an autonomous AI teammate.

### 🏛️ AI Orchestrator Architecture

```
User Prompt (e.g., "Is my rent paid?" or "My AC isn't working.")
  ↓
Next.js Route Handler (/api/assistant/chat)
  ↓
Authentication (Server-side getAuthenticatedUser() - never trusts client IDs)
  ↓
AgentSession Created / Resumed in Prisma
  ↓
LangGraph Stateful Orchestration
  ├── 1. [Understand Intent] (PAYMENT_STATUS, RENT_DUE, MAINTENANCE_REPORT, etc.)
  ├── 2. [Retrieve Rental Context] (Active Tenancy, Room, Property, RentSchedule)
  ├── 3. [Plan Actions & Tool Selection] (Propose typed tools)
  ├── 4. [Execute Authorized Tools]
  │       ├── Validate input with Zod
  │       ├── Verify server-side RBAC & ABAC
  │       ├── Call Domain Service (rental, maintenance, payments)
  │       ├── Prisma executes mutation / query
  │       ├── Log AgentAction (PROPOSED → EXECUTED / REJECTED)
  │       └── Log AuditEvent (sanitized metadata)
  └── 5. [Synthesize Response] (Structured output without chain-of-thought)
  ↓
Structured JSON Response to /assistant UI
  ├── Live execution steppers (Understanding → Context → Action → Complete)
  └── Live Rental Context card updates
```

---

## 🛠️ The 14 Typed AI Tools

| Tool Name | Purpose | RBAC / ABAC Verification |
| :--- | :--- | :--- |
| `getTenantProfile` | Tenant details, emergency contacts, KYC | Self or authorized owner |
| `getTenancy` | Active lease, room, property, dates, stage | Tenancy ownership verified |
| `getRentStatus` | Current cycle due date, amount, payment status | Tenancy ownership verified |
| `getPaymentHistory` | Past payments, transaction refs, methods | Tenancy ownership verified |
| `validatePayment` | Validate payment transaction status | Payment ownership verified |
| `getProperty` | Property info, amenities, address, rules | Property access verified |
| `getRoom` | Room number, floor, type, rent amount | Property/room access verified |
| `getMaintenanceIssues` | List maintenance issues for tenant/property | Filtered strictly to caller's records |
| `getMaintenanceStatus` | Real-time status, technician, and tasks | Issue ownership verified |
| `createMaintenanceIssue`| Reports issue, classifies, advances lifecycle | Tenant only (self tenancy) |
| `createMaintenanceTask` | Assigns technician, advances lifecycle | Owner / authorized manager |
| `notifyOwner` | Dispatches instant notification to owner | Resolved server-side from tenancy |
| `updateMaintenanceTask` | Updates task status / costs / fixed state | Owner / authorized manager |
| `verifyMaintenanceResolution` | Verifies fix, advances lifecycle to VERIFIED | Tenant or owner confirmation |

---

## 🎯 Phase 2 Core Test Cases (100% Working)

These 5 canonical rental scenarios execute real domain tools and record database audit events:

1. **"Is my rent paid?"** → Checks current billing cycle rent schedule, returns amount, due date, and payment status.
2. **"My rent is due when?"** → Retrieves active tenancy rent schedule and returns exact due date.
3. **"My AC isn't working."** → Autonomously creates a maintenance issue (`APPLIANCE` / `HIGH`), dispatches a technician task, notifies the owner, and transitions lifecycle to `ISSUE`.
4. **"Show my maintenance issues."** → Retrieves all open and historical maintenance issues for the tenant.
5. **"Tell the owner my AC is broken."** → Dispatches an immediate notification to the property owner's dashboard and audit log.

---

## 🔄 The Continuous Rental Lifecycle

```
BOOKED → RENT_DUE → PAYMENT → ISSUE → ACTION → FIXED → VERIFIED
```

- **Booked**: Tenancy confirmed and ready for move-in.
- **Rent Due**: Automated invoice generation and notification.
- **Payment**: Paytm / UPI instant settlement and reconciliation.
- **Issue**: Autonomous maintenance triage and categorization.
- **Action**: Task assigned to vendor or technician.
- **Fixed**: Technician completion logged with cost details.
- **Verified**: Tenant sign-off, closing the loop and returning to active rent cycle.

---

## 🔒 Security Principles

1. **No Direct LLM Access to Prisma**: The LLM / agent never touches the database directly. It must propose typed tools that pass through RBAC and ABAC checks.
2. **Never Trust Client/AI IDs**: `userId`, `tenantId`, `propertyId`, and `ownerId` are always resolved or verified server-side from the authenticated session.
3. **Immutable Audit Trail**: Every AI invocation, tool execution, lifecycle transition, and payment is recorded in `AgentSession`, `AgentAction`, and `AuditEvent` tables with sanitized metadata.

---

## 🧪 Test Suite

Run the complete test suite (34 tests across 5 test files):

```bash
bun test
```

