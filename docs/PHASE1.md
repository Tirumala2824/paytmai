# HavenDex Phase 1 — Secure Foundation & Core Rental Operating System

## 1. Overview & Product Vision

> **"One AI teammate for the entire rental relationship."**

HavenDex solves rental lifecycle fragmentation:
- Eliminates disconnected tools
- Eliminates manual coordination and lost context
- Unifies rent due, Paytm payments, maintenance triage, and verified resolution into a single continuous state machine.

---

## 2. Rental Lifecycle State Machine

The core rental lifecycle is modeled as a deterministic state machine:

```
BOOKED
  ↓
RENT_DUE
  ↓
PAYMENT ───→ (Next cycle: RENT_DUE)
  ↓
ISSUE
  ↓
ACTION
  ↓
FIXED
  ↓
VERIFIED ──→ (Ongoing: RENT_DUE)
```

### Transition Matrix (`lib/rental/lifecycle.ts`)
| From Stage | Allowed Target Stages | Trigger / Meaning |
|---|---|---|
| `BOOKED` | `RENT_DUE` | Tenancy confirmed; onboarding complete |
| `RENT_DUE` | `PAYMENT`, `ISSUE` | Rent payment made or issue reported before payment |
| `PAYMENT` | `ISSUE`, `RENT_DUE`, `VERIFIED` | Payment cleared; can log issue or continue to next cycle |
| `ISSUE` | `ACTION` | Task assigned to contractor/technician |
| `ACTION` | `FIXED` | Work completed by contractor |
| `FIXED` | `VERIFIED`, `ACTION` | Tenant / Owner verified resolution; or re-assigned if needed |
| `VERIFIED` | `RENT_DUE`, `ISSUE` | Verified resolution; back to normal rent cycle |

Every state transition:
1. Validates previous state.
2. Checks server-side authorization (ABAC + RBAC).
3. Executes within a database transaction.
4. Creates an immutable `AuditEvent`.
5. Sends notification to the relevant counterparty.

---

## 3. Security Architecture (RBAC & ABAC)

### Security Principle
> **Never allow an LLM or client to directly modify the database or execute sensitive operations.**

```
Client / Agent Request
  ↓
Supabase Auth Verification
  ↓
RBAC (Role-Based Access Control)
  ↓
ABAC (Attribute-Based Resource Access Control)
  ↓
Domain Service Validation
  ↓
Prisma ORM Execution
  ↓
AuditEvent Recorded
  ↓
Notification / Result Returned
```

### Roles (`lib/auth/rbac.ts`)
- **`TENANT`**: Can only access their own profile, active tenancy, payments, and reported maintenance issues.
- **`OWNER`**: Can manage owned properties, rooms, tenancies in owned properties, and view aggregate revenue.
- **`PROPERTY_MANAGER`**: Can manage assigned properties.
- **`ADMIN`**: Platform-wide audit and operations.

### ABAC Enforcement (`lib/auth/abac.ts`)
- `assertTenancyAccess(userProfile, tenancyId)`: Prevents Tenant A from accessing Tenant B's lease. Prevents Owner A from accessing Owner B's properties.
- `assertPropertyAccess(userProfile, propertyId)`: Server-side check against owner ID or active lease.

---

## 4. Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Authentication**: Supabase Auth (Google OAuth + Email/Password) with SSR cookie handling.
- **Database**: Supabase PostgreSQL with Prisma ORM (`prisma/schema.prisma`).
- **Payment Adapter**: Paytm PG & UPI adapter (`lib/payments/service.ts`).
- **Test Suite**: Vitest (`tests/rbac.test.ts`, `tests/abac.test.ts`, `tests/lifecycle.test.ts`).

---

## 5. Local Setup & Testing

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials (`NEXT_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DATABASE_URL`).

### 2. Install Dependencies & Generate Prisma Client
```bash
npm install
npx prisma generate
```

### 3. Run Automated Tests
```bash
npm test
```
All 25 unit tests for RBAC, ABAC, and Lifecycle state transitions should pass.

### 4. Seed Realistic Demo Data
```bash
npm run seed
```

### 5. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
