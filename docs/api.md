# HavenDex API Reference

All API routes are served through Next.js App Router API handlers (`app/api/*`).

---

## 1. AI Assistant & Voice

### `POST /api/assistant/chat`
Invokes the 10-node LangGraph orchestrator.
- **Request Body**:
  ```json
  {
    "message": "My rent is paid. Please confirm it and tell the owner that my AC isn't working again.",
    "sessionId": "optional-uuid",
    "modelName": "gemini-1.5-flash",
    "languageCode": "en-IN",
    "generateAudio": true,
    "confirmedAction": false
  }
  ```
- **Response**: `AIExecutionResponse` containing `userResponse`, `intentBreakdown`, `executionSteps`, `toolCalls`, and optional `audioBase64`.

### `GET /api/assistant/context`
Retrieves ground-truth context for the authenticated caller (active tenancy, room, rent schedules, open maintenance, available models).

### `POST /api/voice/stt`
Converts uploaded audio to text using Sarvam Saaras.
- **Form Data**: `file` (audio blob), `languageCode` (e.g. `en-IN` or `hi-IN`).
- **Response**: `{ "transcript": "...", "languageCode": "en-IN", "confidence": 0.98 }`

### `POST /api/voice/tts`
Synthesizes speech from text using Sarvam Bulbul.
- **Request Body**: `{ "text": "...", "targetLanguageCode": "en-IN" }`
- **Response**: `{ "audioBase64": "...", "mimeType": "audio/wav" }`

---

## 2. Payments

### `POST /api/payments/process`
Initiates rent payment through the configured payment provider (Paytm or Mock).
- **Request Body**:
  ```json
  {
    "rentScheduleId": "sched-sep-2026",
    "amount": 18000,
    "paymentMethod": "PAYTM"
  }
  ```
- **Response**: `{ "success": true, "payment": { "id": "...", "transactionRef": "TXN_...", "status": "SUCCESS" } }`

---

## 3. Maintenance & Verification

### `POST /api/maintenance/report`
Reports a new maintenance issue and transitions lifecycle to `ISSUE`.
- **Request Body**:
  ```json
  {
    "tenancyId": "tenancy-101-nexus",
    "title": "Air Conditioning malfunction reported",
    "description": "AC unit not blowing cold air",
    "category": "APPLIANCE",
    "priority": "HIGH"
  }
  ```

### `POST /api/maintenance/verify`
Submits closed-loop verification for a completed repair.
- **Request Body**:
  ```json
  {
    "issueId": "issue-123",
    "verificationMethod": "COMBINED",
    "evidence": "Filter replaced, cooling tested at 18°C",
    "confidence": 0.98,
    "confirmed": true
  }
  ```

### `POST /api/maintenance/demo-step`
Deterministic hackathon demonstration step trigger.
- **Request Body**: `{ "step": "STEP_2_FIX_AND_VERIFY" }`

---

## 4. Lifecycle & Audit

### `POST /api/lifecycle/transition`
Transitions a tenancy across the rental lifecycle state machine.
- **Request Body**:
  ```json
  {
    "tenancyId": "tenancy-101-nexus",
    "targetStage": "ACTION",
    "reason": "Contractor assigned to repair AC"
  }
  ```

### `GET /api/audit`
Returns paginated, sanitized audit logs with observability fields (`requestId`, `agentSessionId`, `tool`, `latency`, `status`).
