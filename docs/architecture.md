# HavenDex System Architecture

"One AI teammate for the entire rental relationship."

## 1. Executive Summary & Core Philosophy

Rental housing operations in India (PGs, coliving spaces, independent rentals) are deeply fragmented across disconnected channels: WhatsApp chats, banking apps, manual ledger books, phone calls to technicians, and lost repair history.

HavenDex transforms this fragmented lifecycle into a continuous, stateful, AI-assisted rental operating system.

### Core Rental Lifecycle
```
Booked -> Rent Due -> Payment -> Issue -> Action -> Fixed -> Verified
```

### Core AI Agent Lifecycle
```
Understand -> Decide -> Act -> Verify -> Learn
```

---

## 2. End-to-End Technical Stack

```
               [ Tenant / Owner / Property Manager ]
                                |
               Next.js 16 (React 19 + TypeScript)
               Tailwind CSS + shadcn/ui Component Kit
                                |
                   Supabase SSR Authentication
                                |
            Server-Side RBAC & ABAC Enforcement Layer
                                |
         +----------------------+----------------------+
         |                                             |
  REST API Routes                       LangGraph Orchestrator
  (Domain Services)                    (10-Node Stateful Graph)
         |                                             |
         |         +-----------------+                 |
         +-------->| Typed Toolset   |<----------------+
                   +--------+--------+
                            |
                   Domain Services Layer
          (Rental, Payments, Maintenance, Audit)
                            |
           +----------------+----------------+
           |                                 |
     Prisma ORM Client               External Adapters
           |                   (Paytm, Sarvam, Cognee)
           v
  Supabase PostgreSQL DB
```

### Technology Matrix
| Layer | Technology | Purpose |
|---|---|---|
| Frontend Framework | Next.js 16 (App Router), React 19, TypeScript | High-performance full-stack web application |
| Styling | Tailwind CSS v4, Lucide Icons, Glassmorphism | SaaS aesthetic with responsive desktop/mobile UI |
| Authentication | Supabase Auth (SSR Cookies) | Email/Password, Google OAuth, Session Management |
| Authorization | Custom RBAC + ABAC Middleware | Server-side role enforcement & tenancy isolation |
| Database & ORM | PostgreSQL (Supabase) + Prisma ORM v6 | Primary typed data access layer, relational integrity |
| AI Reasoning | Google Gemini (`gemini-1.5-flash`, `gemini-2.0-flash`) | Natural language understanding, multi-intent reasoning |
| AI Workflow | LangGraph.js + LangChain.js | 10-node state machine with parallel tool execution |
| Voice & Audio | Sarvam AI (Saaras STT, Bulbul TTS) | Indic speech recognition & multilingual synthesis |
| Memory Graph | Cognee API + PostgreSQL Local Graph | Persistent rental memory, recurring issue detection |
| Payments | Paytm PG Adapter + MockPaymentProvider | Rent collection, checksum verification, receipt logging |

---

## 3. Zero-Trust AI Security Model

HavenDex adheres to a strict principle: **Never allow an LLM direct database or payment access.**

```
User Query / Voice
        ↓
Understand (Sarvam STT)
        ↓
Context Retrieval (Prisma + Cognee)
        ↓
Multi-Intent Decomposition
        ↓
Tool Proposal (AI proposes)
        ↓
Authentication Check (Supabase Auth verified)
        ↓
RBAC Authorization (TENANT / OWNER / ADMIN checked)
        ↓
ABAC Policy Check (Is tenant assigned to this tenancy? Does owner own this property?)
        ↓
Domain Service Validation (Business rules, amount validation, state transitions)
        ↓
Prisma ORM Execution (Transactional execution in PostgreSQL)
        ↓
Result Returned & Verified
        ↓
Audit Event Created (Sanitized from passwords, secrets, tokens)
        ↓
Memory Updated (Committed to Cognee & persistent graph)
        ↓
Synthesized Response (Gemini / Sarvam TTS)
```

---

## 4. Provider Adapter Architecture (Deterministic Demo Mode)

To ensure 100% reliability during live hackathon judging and demonstrations, HavenDex implements clean provider adapters:

- **Payment Providers**:
  - `PaytmPaymentProvider`: Real Paytm Payment Gateway integration using merchant credentials (`PAYTM_MID`, `PAYTM_MERCHANT_KEY`).
  - `MockPaymentProvider`: Deterministic adapter generating valid transaction references (`TXN_MOCK_...`) and status callbacks with zero network latency.
- **Notification Providers**:
  - `MockNotificationProvider`: In-app notification creation with instant delivery across owner and tenant views.
- **Maintenance Providers**:
  - `MockMaintenanceProvider`: Simulates contractor dispatch (`QuickFix Coliving Services`) and repair completion.
