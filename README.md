# HavenDex — AI-Powered PG & Rental Operating System

> **"One AI teammate for the entire rental relationship."**

HavenDex turns the fragmented rental housing lifecycle into a continuous, verified, and secure operating state machine. It brings together lease management, rent schedules, Paytm payments, Indic voice assistants, persistent memory, and closed-loop maintenance into a unified full-stack system.

---

## 🏛️ System Architecture

```
Tenant / Owner / Manager
          │
Next.js 16 (React 19 + TypeScript + Tailwind CSS)
          │
Supabase Auth (SSR Cookies, No Firebase)
          │
Server-Side RBAC + ABAC Policy Layer
          │
LangGraph AI Orchestrator (10-Node Stateful Graph)
          │
Typed AI Tools (14 Domain Tools with Zod Validation)
          │
Domain Services (Rental, Payments, Maintenance, Audit)
          │
Prisma ORM Client v6
          │
Supabase PostgreSQL Database
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Database**: Supabase PostgreSQL database URL

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Tirumala2824/paytmai.git
cd paytmai

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your configuration:
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: From your Supabase project.
- `DATABASE_URL` & `DIRECT_URL`: From Supabase PostgreSQL connection settings.
- `GEMINI_API_KEY`: Google Gemini API key (optional in demo mode).
- `SARVAM_API_KEY`: Sarvam AI key for Indic voice STT/TTS (optional in demo mode).
- `COGNEE_API_KEY`: Cognee key for semantic memory graph (optional in demo mode).
- `PAYTM_MID` & `PAYTM_MERCHANT_KEY`: Paytm PG credentials (optional in demo mode).
- `DEMO_MODE=true`: Enables deterministic hackathon demo mode with zero external dependency.

### 4. Database Setup & Seed
```bash
# Generate Prisma Client
npx prisma generate

# Apply database schema
npx prisma db push

# Seed initial properties, users, and historical memory records
npm run seed
```

### 5. Start Development Server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000).

---

## 👥 Demo Accounts (Seeded Data)

| Role | Name | Email | Password | Details |
|---|---|---|---|---|
| **TENANT** | Arjun Mehta | `arjun.mehta@gmail.com` | `password123` | Active lease in Nexus Heights (Room 101), ₹18,000 rent |
| **TENANT** | Sneha Rao | `sneha.rao@gmail.com` | `password123` | Active lease in Nexus Studio Suites (Room 301) |
| **OWNER** | Rajesh Sharma | `rajesh@nexusliving.in` | `password123` | Owner of Nexus Heights & Nexus Studio Suites |
| **OWNER** | Priya Patel | `priya@urbannest.in` | `password123` | Owner of UrbanNest Coliving |
| **ADMIN** | System Admin | `admin@havendex.io` | `password123` | Platform oversight & full audit inspection |

---

## 🎙️ The Main Hackathon Demo

### Canonical Utterance
The tenant speaks (or clicks the primary demo button):
> **"My rent is paid. Please confirm it and tell the owner that my AC isn't working again."**

### 9-Stage Live Agent Execution Timeline
Watch HavenDex execute the 9 closed-loop stages in real-time:
1. **`UNDERSTAND` ✓**: Sarvam AI transcribes Indian English / Hindi speech and normalizes the input.
2. **`CONTEXT` ✓**: HavenDex loads the tenant's ground-truth lease at Nexus Heights (Room 101) and queries Cognee memory for historical AC issues.
3. **`INTENTS` ✓**: AI detects 3 simultaneous intents: `PAYMENT_VALIDATION`, `MAINTENANCE_REPORT`, and `OWNER_NOTIFICATION`.
4. **`PAYMENT` ✓**: HavenDex checks the rent schedule: ₹18,000 for September 2026 is confirmed paid.
5. **`MAINTENANCE` ✓**: HavenDex identifies that the AC broke previously, escalates this recurring issue to `HIGH` priority, and logs it.
6. **`OWNER NOTIFIED` ✓**: Owner Rajesh Sharma receives an immediate in-app alert.
7. **`FIXED` ✓**: Click *"Simulate Repair & Verify"* — QuickFix Coliving Services completes the filter replacement and gas recharge.
8. **`VERIFIED` ✓**: Closed-loop verification is completed via `COMBINED` verification (Tenant confirmation + AI diagnostic analysis).
9. **`MEMORY UPDATED` ✓**: The verified fix is permanently committed to Cognee semantic memory graph and the PostgreSQL audit trail.

---

## 🛡️ Security & Zero-Trust Architecture

- **No Direct LLM Database Access**: LLMs only propose actions; typed domain services execute them.
- **No Direct LLM Payment Access**: High-impact financial transactions require strict validation or confirmation.
- **Server-Side Authorization**: Every mutation passes RBAC (role check) and ABAC (ownership policy check).
- **Tenant & Owner Isolation**: Tenants cannot query or modify other tenants' leases. Landlords cannot view other landlords' properties.
- **Sanitized Observability**: Audit logs record `requestId`, `agentSessionId`, `tool`, `latency`, and `status`, while stripping passwords, API keys, tokens, and payment secrets.
- **No Firebase**: 100% Supabase Auth & PostgreSQL.

---

## 🧪 Automated Testing Suite

HavenDex includes comprehensive automated tests:

```bash
# Run all tests via Vitest
npm test
```

### Test Coverage Summary
- `phase5-acceptance.test.ts`: Primary hackathon scenario, provider adapters, closed-loop verification, observability.
- `phase4-memory-maintenance.test.ts`: Cognee memory abstraction, recurring issue recall, multi-source verification.
- `phase3-voice-multi-intent.test.ts`: Sarvam STT/TTS, multi-intent decomposition, parallel tool execution.
- `ai-orchestrator.test.ts`: Canonical rental queries, state transitions.
- `ai-tools.test.ts`: All 14 typed AI tools registry, Zod schema validation.
- `lifecycle.test.ts`: 7-stage rental lifecycle transitions.
- `abac.test.ts`: Attribute-based tenant and owner isolation.
- `rbac.test.ts`: Role-based access control.

---

## 📂 Documentation Suite

- [`docs/architecture.md`](docs/architecture.md): Full system architecture, layer diagrams, and data flows.
- [`docs/database.md`](docs/database.md): Prisma schema, entities, relational enums, and indexes.
- [`docs/authentication.md`](docs/authentication.md): Supabase Auth setup, session cookies, and route guards.
- [`docs/authorization.md`](docs/authorization.md): RBAC roles, ABAC policies, and server-side enforcement.
- [`docs/ai-architecture.md`](docs/ai-architecture.md): LangGraph 10-node stateful workflow and model fallback.
- [`docs/voice.md`](docs/voice.md): Sarvam AI Indic STT/TTS and supported Indian languages.
- [`docs/memory.md`](docs/memory.md): Cognee semantic memory graph and recurring issue recall.
- [`docs/api.md`](docs/api.md): Complete REST API reference.
- [`docs/deployment.md`](docs/deployment.md): Production deployment guide and environment checklist.
- [`docs/hackathon-demo.md`](docs/hackathon-demo.md): 3-minute hackathon presentation script and judging guide.

---

## ⚠️ Known Limitations & Future Work

1. **Hardware Telemetry**: Physical IoT smart locks and AC power sensors are currently simulated via the `COMBINED` verification method.
2. **Payment Gateway Webhooks**: In local development, Paytm callbacks are simulated through `MockPaymentProvider`; in production, webhook endpoints require a publicly accessible URL (e.g. ngrok or Vercel).
3. **Indic Speech Synthesis Chunks**: For very long responses, Sarvam TTS splits text into 500-character segments.
