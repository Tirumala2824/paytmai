# HavenDex Hackathon Presentation & Demonstration Script

This document outlines the **3-minute winning presentation and live demonstration script** for hackathon judges.

---

## 1. The Hook (30 seconds)

> *"Rental housing in India is a ₹2.5 Lakh Crore market, yet it runs on WhatsApp screenshots, lost repair promises, and manual ledgers. When an AC breaks in July, the tenant complains on WhatsApp, the owner calls a random mechanic, nobody remembers what was fixed last month, and payment follow-ups get ugly.*
>
> *Introducing **HavenDex**: One AI teammate for the entire rental relationship."*

---

## 2. The Primary Live Demonstration (90 seconds)

### The Canonical Utterance
The tenant speaks (or clicks the primary demo button):
> **"My rent is paid. Please confirm it and tell the owner that my AC isn't working again."**

### What HavenDex Does in Real-Time (Watch the 9-Stage Live Agent Timeline):
1. **`UNDERSTAND` ✓**: Sarvam AI transcribes Indian English / Hindi speech and normalizes the input.
2. **`CONTEXT` ✓**: HavenDex loads the tenant's ground-truth lease at Nexus Heights (Room 101) and queries Cognee memory for historical AC issues.
3. **`INTENTS` ✓**: AI instantly detects 3 simultaneous intents: `PAYMENT_VALIDATION`, `MAINTENANCE_REPORT`, and `OWNER_NOTIFICATION`.
4. **`PAYMENT` ✓**: HavenDex checks the rent schedule: ₹18,000 for September 2026 is confirmed paid.
5. **`MAINTENANCE` ✓**: HavenDex identifies that the AC broke previously, escalates this recurring issue to `HIGH` priority, and logs it.
6. **`OWNER NOTIFIED` ✓**: Owner Rajesh Sharma receives an immediate in-app alert.
7. **`FIXED` ✓**: Click *"Simulate Repair & Verify"* — QuickFix Coliving Services completes the filter replacement and gas recharge.
8. **`VERIFIED` ✓**: Closed-loop verification is completed via `COMBINED` verification (Tenant confirmation + AI diagnostic analysis).
9. **`MEMORY UPDATED` ✓**: The verified fix is permanently committed to Cognee semantic memory graph and the PostgreSQL audit trail.

---

## 3. The Dashboards (45 seconds)

### Tenant Dashboard (`/tenant`)
- **Active Tenancy**: Room 101, ₹18,000 monthly rent.
- **Visual Lifecycle**: Clean 7-stage pipeline (`Booked` -> `Rent Due` -> `Payment` -> `Issue` -> `Action` -> `Fixed` -> `Verified`).
- **Paytm Checkout**: 1-click rent payment with receipt generation.
- **Integrated Voice Assistant**: Speak naturally in 10 Indian languages.

### Owner Dashboard (`/owner`)
- **Portfolio Health**: Occupancy rate (70%), monthly revenue (₹1,50,000).
- **Maintenance Oversight**: 7 filter tabs for contractor tracking and verification pending.
- **Recent AI Actions**: Real-time observability into autonomous AI decisions and tool latencies.

---

## 4. Key Judging Criteria Addressed

| Hackathon Criterion | How HavenDex Wins |
|---|---|
| **Technical Depth** | 10-node stateful LangGraph with parallel/sequential tool dispatch, Indic voice via Sarvam AI, semantic memory via Cognee, and Prisma ORM on Supabase PostgreSQL. |
| **Security & Zero-Trust** | Strict RBAC + ABAC server-side enforcement. Zero direct LLM database or payment access. Sanitized audit logging. |
| **Reliability** | Deterministic Demo Mode (`MockPaymentProvider`, `MockNotificationProvider`, `MockMaintenanceProvider`) guarantees zero failed live demos. |
| **User Experience** | Rich dark-mode SaaS UI, responsive mobile/desktop layout, and live 9-stage agent execution timeline. |
| **Product Vision** | Solves the fundamental fragmentation of rental housing in India. |
