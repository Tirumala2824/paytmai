# HavenDex — AI-Powered PG & Rental Operating System

> **"One AI teammate for the entire rental relationship."**

HavenDex solves rental lifecycle fragmentation by unifying booking, rent schedules, Paytm payments, maintenance triage, and verified resolution into a continuous, verified, and secure operating state machine.

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Run Automated Tests (RBAC, ABAC, Lifecycle)
npm test

# 4. Start Development Server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the HavenDex application.

---

## 🏛️ Core Architecture (Phase 1)

```
Next.js 16 (App Router)
  ↓
Supabase Auth (Google OAuth & Email/Password)
  ↓
Server-Side RBAC (TENANT, OWNER, PROPERTY_MANAGER, ADMIN)
  ↓
Server-Side ABAC (Resource-level isolation: Tenant A ≠ Tenant B)
  ↓
Domain Services (Rental Lifecycle, Maintenance, Paytm Payments, Audit)
  ↓
Prisma ORM
  ↓
Supabase PostgreSQL
```

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

1. **No direct LLM or client mutations**: Every mutation passes through Supabase Auth → RBAC → ABAC → Domain Service → Prisma.
2. **Strict ABAC Isolation**: Tenants can only view and mutate their own tenancy and payments. Owners can only access their owned properties and rooms.
3. **Immutable Audit Trail**: Every lifecycle transition, payment transaction, and authorization event is recorded server-side with sanitized metadata.

---

## 🧪 Test Suite

Run the Vitest test suite covering RBAC permissions, ABAC resource isolation, and lifecycle state transition rules:

```bash
npm test
```

For full Phase 1 documentation, see [docs/PHASE1.md](docs/PHASE1.md).
