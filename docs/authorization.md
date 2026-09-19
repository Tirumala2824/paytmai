# HavenDex Authorization Architecture (RBAC + ABAC)

HavenDex enforces a dual **Role-Based Access Control (RBAC)** and **Attribute-Based Access Control (ABAC)** security layer.

All mutations and data retrievals MUST pass through server-side authorization. **Client-supplied IDs and roles are never trusted.**

---

## 1. Role-Based Access Control (RBAC)

HavenDex defines four distinct user roles in `@prisma/client`:

| Role | Permissions & Scope |
|---|---|
| `TENANT` | Can view own tenancy, rent schedules, and payment receipts. Can report maintenance issues on own room. Can confirm completed repairs. |
| `OWNER` | Can manage owned properties, inspect occupancy rates, trigger rent due notices, and oversee contractor maintenance tasks. |
| `PROPERTY_MANAGER`| Can manage assigned properties and dispatch tasks to contractors. |
| `ADMIN` | Full platform administrative oversight, system audit logs, and provider configuration. |

---

## 2. Attribute-Based Access Control (ABAC)

Even if a user possesses the correct role, **ABAC policies** ensure strict data isolation between tenants and owners:

### Tenant Isolation Policy
- A `TENANT` can **only** query or mutate resources associated with their own active lease (`Tenancy.tenantId == user.tenant.id`).
- A tenant cannot view rent schedules, payment transactions, or maintenance requests belonging to any other tenant in the same building or other properties.

### Owner Isolation Policy
- An `OWNER` can **only** access properties, rooms, tenancies, and revenue metrics where `Property.ownerId == user.owner.id`.
- An owner cannot inspect or modify properties owned by other landlords.

---

## 3. Server-Side Enforcement in Tools & APIs

Authorization is verified before any domain service or Prisma query executes:

```typescript
// lib/auth/abac.ts
export async function canAccessTenancy(userId: string, role: UserRole, tenancyId: string): Promise<boolean> {
  if (role === UserRole.ADMIN) return true;

  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: { tenant: true, property: { include: { owner: true } } },
  });

  if (!tenancy) return false;

  if (role === UserRole.TENANT) {
    return tenancy.tenant.userProfileId === userId;
  }

  if (role === UserRole.OWNER) {
    return tenancy.property.owner.userProfileId === userId;
  }

  return false;
}
```

---

## 4. AI Tool Authorization

In the LangGraph AI Orchestrator, the **`authorize` node** intercepts every proposed tool call:
- Tool parameters and target resource IDs are resolved against the authenticated caller identity.
- If unauthorized, the tool is rejected (`status: 'REJECTED'`), the rejection is audited, and the user is informed without leaking sensitive resource metadata.
