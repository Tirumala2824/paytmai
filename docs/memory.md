# HavenDex Memory Architecture (Cognee Integration)

HavenDex implements a persistent rental memory graph using **Cognee API** and a resilient local PostgreSQL graph abstraction.

---

## 1. Why Memory Matters in Rentals

In traditional rental properties:
- A tenant complains: *"The AC is broken again."*
- A manager asks: *"When was it broken before? Who repaired it? Was it the filter or the gas?"*
- Context is lost because communication occurred over ephemeral WhatsApp threads.

HavenDex maintains a **continuous memory graph** across the entire tenancy lifecycle.

---

## 2. MemoryService Abstraction Layer

The application code interacts exclusively with `MemoryService` (`lib/ai/memory/service.ts`), decoupling the core platform from Cognee's remote API:

```typescript
export class MemoryService {
  async remember(params: RememberParams): Promise<MemoryRecord>;
  async retrieve(params: RetrieveParams): Promise<MemoryRecord[]>;
  async search(params: SearchParams): Promise<Array<MemoryRecord & { score: number }>>;
  async summarize(params: SummarizeParams): Promise<string>;
  async retrieveRelevantContext(params: RelevantContextParams): Promise<RelevantContextResult>;
}
```

---

## 3. Recurring Issue Detection (`retrieveRelevantContext`)

When a user mentions an appliance or maintenance keyword, HavenDex searches prior verified resolutions:

```typescript
const result = await memoryService.retrieveRelevantContext({
  userProfileId: tenant.id,
  tenancyId: tenancy.id,
  userMessage: "The AC is broken again.",
});

if (result.previousRelatedIssue) {
  // 1. Mark issue as repeated (isRepeated: true)
  // 2. Automatically escalate priority to HIGH
  // 3. Inform owner of historical recurrence
}
```

---

## 4. Privacy & Sanitization

HavenDex strictly filters and sanitizes all memory payloads before storage:
- Passwords, secrets, tokens, API keys, and ID numbers are replaced with `[REDACTED_SENSITIVE]`.
- Noisy conversational chatter is filtered; only concrete rental facts, agreements, and maintenance resolutions are preserved.
