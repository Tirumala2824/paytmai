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
| `phase3-voice-multi-intent.test.ts` | Canonical scenario, parallel execution, partial failure, confirmation, Hindi, Sarvam | 100% PASS |
| `ai-orchestrator.test.ts` | 5 canonical rental queries, state transitions, audit logging | 100% PASS |
| `ai-tools.test.ts` | All 14 typed tools registry, execution, Zod validation | 100% PASS |
| `lifecycle.test.ts` | Rental state machine valid/invalid transitions | 100% PASS |
| `abac.test.ts` | Attribute-based access control & tenant/owner resource isolation | 100% PASS |
| `rbac.test.ts` | Role-based permissions across TENANT, OWNER, ADMIN | 100% PASS |


