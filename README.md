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

## 🎙️ Phase 3: Multilingual Voice & Multi-Intent AI Execution

HavenDex Phase 3 introduces **multilingual Indian voice interactions** powered by **Sarvam AI (Saaras STT & Bulbul TTS)**, a **10-node stateful LangGraph workflow**, **multi-intent extraction**, and **parallel tool execution**.

### 🏛️ Phase 3 Voice Flow

```
User Microphone
  ↓ (audio/webm or audio/wav)
/api/voice/stt (Sarvam Saaras STT)
  ↓ { transcript, languageCode } (e.g., "hi-IN" or "en-IN")
10-Node Stateful LangGraph Pipeline
  ├── 1. [UNDERSTAND] Normalization & Indian language detection
  ├── 2. [LOAD_CONTEXT] Tenancy, Room, Property, RentSchedule, Maintenance
  ├── 3. [DETECT_INTENTS] Multi-intent extraction (Payment, Maintenance, Notification)
  ├── 4. [PLAN] Multi-tool planning, dependency resolution, sensitive confirmation check
  ├── 5. [AUTHORIZE] Server-side RBAC & ABAC check for all planned tools
  ├── 6. [EXECUTE] Parallel execution for independent tools, sequential for dependent tools
  ├── 7. [VERIFY] Verify database state & task consistency
  ├── 8. [UPDATE_STATE] Advance rental lifecycle state machine (e.g. to ISSUE or PAYMENT)
  ├── 9. [MEMORY_EVENT] Record Cognee memory graph event & immutable AuditEvent logs
  └── 10. [RESPOND] Multilingual response synthesis (reporting per-intent status)
  ↓
/api/voice/tts (Sarvam Bulbul TTS)
  ↓ { audioBase64, mimeType: "audio/wav" }
Voice Assistant UI (Live state machine: Idle → Listening → Processing → Executing → Completed)
```

### 🎯 Phase 3 Canonical Success Scenario (100% Working)

User speaks:
> *"My rent is paid, confirm it and tell the owner my AC isn't working."*

System executes:
1. **Sarvam STT**: Transcribes Indian English / Hindi audio.
2. **Multi-Intent Detection**:
   - `Intent 1`: Validate/confirm rent payment (`PAYMENT_VALIDATION`)
   - `Intent 2`: Report maintenance issue (`MAINTENANCE_REPORT`)
   - `Intent 3`: Notify property owner (`OWNER_NOTIFICATION`)
3. **Context Retrieval**: Resolves active tenancy at Nexus Heights (Room 101), current cycle rent schedule (₹18,000), and owner (Rajesh Sharma).
4. **Parallel Execution**:
   - `getRentStatus` + `createMaintenanceIssue` execute concurrently via `Promise.allSettled`.
   - `createMaintenanceTask` + `notifyOwner` execute with newly created issue ID.
5. **Verification & State Update**: Advances rental lifecycle to `ISSUE`, logs to Cognee memory and Prisma audit event.
6. **Transparent Status Reporting**:
   - **Payment**: `✓ Confirmed` (Rent of ₹18,000 for 2026-09 is confirmed paid).
   - **Maintenance**: `✓ Created` (Issue logged for AC malfunction with HIGH priority. Technician assigned: QuickFix Services).
   - **Owner Notification**: `✓ Sent` (Immediate notification dispatched to owner Rajesh Sharma).
7. **Sarvam TTS**: Speaks response back to the user in the detected language.

### 🛡️ Failure Handling & Confirmation Principles

- **Partial Failure Reporting**: If one intent succeeds and another fails, the system reports individual statuses accurately. E.g., `Payment: ✓ Confirmed`, `Maintenance: ✗ Could not create task`. It **never** claims both succeeded if one failed.
- **Sensitive Action Confirmation**: High-impact actions (e.g., executing rent payments) trigger a human-in-the-loop confirmation prompt:
  > *"Your outstanding rent is ₹18,000 for September 2026. Do you want to proceed with payment?"*
  The agent does not execute sensitive tools without explicit user authorization.

---

## 🧪 Test Suite

Run the complete test suite (40 tests across 6 test files):

```bash
bun test
```

| Test Suite | Coverage | Status |
| :--- | :--- | :--- |
| `phase4-memory-maintenance.test.ts` | MemoryService, Context Retrieval, 9-stage lifecycle, multi-source verification, AI memory recall | 100% PASS |
| `phase3-voice-multi-intent.test.ts` | Canonical scenario, parallel execution, partial failure, confirmation, Hindi, Sarvam | 100% PASS |
| `ai-orchestrator.test.ts` | 5 canonical rental queries, state transitions, audit logging | 100% PASS |
| `ai-tools.test.ts` | All 14 typed tools registry, execution, Zod validation | 100% PASS |
| `lifecycle.test.ts` | Rental state machine valid/invalid transitions | 100% PASS |
| `abac.test.ts` | Attribute-based access control & tenant/owner resource isolation | 100% PASS |
| `rbac.test.ts` | Role-based permissions across TENANT, OWNER, ADMIN | 100% PASS |

---

## 🧠 Phase 4: Persistent Rental Context & Closed-Loop Maintenance Resolution

HavenDex Phase 4 introduces **persistent rental memory** powered by a **Cognee MemoryService abstraction** and a **9-stage closed-loop maintenance state machine** with **multi-source verification**.

### 🏛️ MemoryService Abstraction

The `MemoryService` (`lib/ai/memory/service.ts`) decouples HavenDex from proprietary memory providers while providing dual-layer persistence:

```
                  ┌─────────────────────────────────────────┐
                  │              HavenDex AI                │
                  │   (LangGraph / Orchestrator / Tools)    │
                  └───────────────────┬─────────────────────┘
                                      │
                         MemoryService Abstraction
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
   Cognee Knowledge Graph                         PostgreSQL RentalMemory
 (api.cognee.ai / vector)                      (Prisma ORM / Supabase DB)
 - Semantic Search                              - Relational context & keys
 - Fast 1500ms timeout fallback                 - Redacts passwords/secrets
 - Dataset isolation per tenancy                - Audit trail integration
```

#### Core Memory Methods:
1. `remember(params)`: Stores tenancy relationships, room context, previous maintenance issues/resolutions, and interaction summaries with automated sensitive data redaction (`[REDACTED_SENSITIVE]`).
2. `retrieve(params)`: Queries historical memories by tenancy, user, or memory type.
3. `search(params)`: Performs semantic & keyword-scored search over rental memories.
4. `summarize(params)`: Synthesizes a natural language profile of the rental relationship for prompt context.
5. `retrieveRelevantContext(params)`: Flow: **User Request → Authenticated User → Rental Identity → Relevant Context Retrieval → AI → Tool Execution**. Detects recurring issues (e.g. "The AC is broken again").

### 🔄 9-Stage Closed-Loop Maintenance State Machine

```
ISSUE_REPORTED ──► CLASSIFIED ──► OWNER_NOTIFIED ──► TASK_ASSIGNED ──► IN_PROGRESS
                                                                            │
      CLOSED ◄─────────────── VERIFIED ◄─────────────── FIXED ◄─────────────┘
                                  ▲                        ▲
                                  │                        │
                         (Satisfactory)             (Persisting)
                                  │                        │
                        [VERIFICATION_PENDING] ────────────┘
```

#### Strict Enforcement Rules:
- **Never Close on Notification**: Notifying an owner advances the state to `OWNER_NOTIFIED` and notifies the dashboard, but **never closes the issue**.
- **Multi-Source Verification**: Supports `TENANT_CONFIRMATION`, `OWNER_CONFIRMATION`, `AI_IMAGE_ANALYSIS`, and `COMBINED`.
- **Honest AI Verification**: Pure human confirmations must **never** claim physical AI verification confidence (`confidence: null`). Confidence scores (e.g. 0.98) are only recorded when automated AI/sensor evidence is present.
- **Audit Logging**: Every state transition generates an immutable `AuditEvent` with actor, timestamps, and before/after statuses.

### 🧪 Canonical AI Memory Demonstration

1. **Step 1: Historical Repair**: Tenant Arjun reports `"My AC isn't working."` → Technician repairs coil and tests 18°C airflow → Resolution verified.
2. **Step 2: Recurring Issue**: Later, Arjun reports `"The AC is broken again."`
3. **Step 3: Context Recall & Escalation**:
   - AI retrieves previous verified AC repair memory.
   - Prepend notice: `Previous related maintenance issue found.`
   - Autonomously flags `isRepeated: true` and escalates priority to `HIGH`.
   - Dispatches emergency task to technician and alerts owner.

### 📊 Owner Maintenance Workspace (7 Filtered Views)

1. **Open Issues**: All non-closed issues requiring owner oversight.
2. **Urgent Issues**: High-priority and emergency issues.
3. **Assigned Tasks**: Issues actively assigned to technicians.
4. **In Progress**: Tasks actively being worked on by contractors.
5. **Verification Pending**: Fixed issues awaiting tenant/owner/AI verification.
6. **Resolved**: Successfully verified and closed issues with complete resolution history.
7. **Repeated Issues**: Escalated issues where identical components failed previously.



