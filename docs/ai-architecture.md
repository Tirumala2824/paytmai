# HavenDex AI Orchestrator Architecture

"Understand -> Decide -> Act -> Verify -> Learn"

HavenDex AI is built with **LangGraph.js** and **LangChain.js**, providing a stateful, deterministic, 10-node execution graph.

---

## 1. 10-Node Stateful LangGraph Workflow

```
[START]
   ↓
1. UNDERSTAND       -> Detect language (Indian English / Hindi), normalize input
   ↓
2. LOAD_CONTEXT     -> Retrieve active tenancy, room, rent schedules, and Cognee memory
   ↓
3. DETECT_INTENTS   -> Multi-intent decomposition (Gemini + Deterministic Rule Engine)
   ↓
4. PLAN             -> Map intents to typed domain tools, identify dependencies
   ↓
5. AUTHORIZE        -> Server-side RBAC & ABAC policy check for each tool
   ↓
6. EXECUTE          -> Parallel batch (independent tools) + Sequential batch (dependent tools)
   ↓
7. VERIFY           -> Verify tool outcomes and ensure state consistency
   ↓
8. UPDATE_STATE     -> Advance RentalLifecycle (e.g. ISSUE -> ACTION)
   ↓
9. MEMORY_EVENT     -> Store interaction and resolution in Cognee semantic graph
   ↓
10. RESPOND         -> Multilingual response synthesis (Gemini / Sarvam TTS)
   ↓
 [END]
```

---

## 2. Multi-Intent Decomposition

Tenants frequently communicate multiple requests in a single breath.
For example:
> *"My rent is paid. Please confirm it and tell the owner that my AC isn't working again."*

The AI Orchestrator decomposes this utterance into three discrete intents:
1. `PAYMENT_VALIDATION`: Validate whether rent for the current billing cycle was received.
2. `MAINTENANCE_REPORT`: Identify that the AC unit is malfunctioning, query memory to see if this is a repeated issue, and log with `HIGH` priority.
3. `OWNER_NOTIFICATION`: Dispatch an urgent alert to the property owner with technician assignment details.

---

## 3. Parallel & Sequential Tool Execution

To minimize latency, independent tools run concurrently via `Promise.allSettled`:
- **Independent Tools (Parallel)**:
  - `getRentStatus`
  - `createMaintenanceIssue`
  - `getMaintenanceIssues`
- **Dependent Tools (Sequential)**:
  - `createMaintenanceTask` (depends on `issueId` returned by `createMaintenanceIssue`)
  - `notifyOwner` (depends on issue triage priority and technician assignment)

---

## 4. Dynamic Gemini Model Selection & Safety Mode

- **Configurable Models**: Supports `gemini-1.5-flash`, `gemini-2.0-flash`, and `gemini-1.5-pro`.
- **Deterministic Fallback (Safety Mode)**: If Gemini API quota is exhausted or unconfigured, HavenDex falls back to its deterministic rule engine, ensuring 100% operational continuity during hackathon judging.
