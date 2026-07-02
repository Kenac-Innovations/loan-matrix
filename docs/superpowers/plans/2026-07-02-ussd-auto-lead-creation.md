# USSD Auto Lead Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create a lead for configured USSD products as soon as the queue consumer persists a new application, while keeping manual `View` and auto-create on the same conversion path.

**Architecture:** Add a tenant-scoped USSD auto-lead rule set, extract the current `/api/ussd-leads/[id]/to-lead` logic into a shared server helper, call that helper from the queue consumer as a best-effort follow-up, and annotate the USSD applications workspace with linked lead metadata so the UI shows a truthful “open existing lead” action. The queue consumer remains the ingestion entrypoint; the shared helper becomes the single source of truth for “create or reopen lead from USSD application.”

**Tech Stack:** Next.js app router, Prisma, node:test + tsx, tenant settings JSON, existing AMQP queue consumer.

---

### Task 1: Add Tenant USSD Auto-Lead Rule Contract

**Files:**
- Create: `lib/tenant-ussd-auto-lead-rules.ts`
- Create: `lib/__tests__/tenant-ussd-auto-lead-rules.test.ts`
- Modify: `shared/types/tenant.ts`

- [ ] **Step 1: Write the failing rule-parser test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

test("normalizes persisted USSD auto-lead rules from tenant settings", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules.ts");

  assert.deepEqual(
    mod.getTenantUssdAutoLeadRules({
      ussdAutoLeadRules: [
        { enabled: true, loanProductId: 12 },
        { enabled: false, loanProductId: "14" },
        { enabled: true, loanProductId: null },
      ],
    }),
    [
      { enabled: true, loanProductId: 12 },
      { enabled: false, loanProductId: 14 },
    ]
  );
});

test("matches enabled rule by loan product id", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules.ts");

  assert.deepEqual(
    mod.findMatchingUssdAutoLeadRule(
      [{ enabled: true, loanProductId: 12 }],
      12
    ),
    { enabled: true, loanProductId: 12 }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/__tests__/tenant-ussd-auto-lead-rules.test.ts`

Expected: FAIL because `tenant-ussd-auto-lead-rules.ts` and its exports do not exist yet.

- [ ] **Step 3: Add the tenant setting type and parser helper**

```ts
export interface TenantUssdAutoLeadRule {
  enabled?: boolean;
  loanProductId: number;
}

export function getTenantUssdAutoLeadRules(settings: TenantSettings | Record<string, unknown> | null | undefined): TenantUssdAutoLeadRule[] {
  // normalize settings.ussdAutoLeadRules into [{ enabled, loanProductId }]
}

export function sanitizeTenantUssdAutoLeadRulesInput(input: unknown): TenantUssdAutoLeadRule[] {
  // accept only positive numeric loanProductId values
}

export function findMatchingUssdAutoLeadRule(
  rules: TenantUssdAutoLeadRule[],
  loanProductId: number | null | undefined
): TenantUssdAutoLeadRule | null {
  // return enabled matching rule or null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/__tests__/tenant-ussd-auto-lead-rules.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/types/tenant.ts lib/tenant-ussd-auto-lead-rules.ts lib/__tests__/tenant-ussd-auto-lead-rules.test.ts
git commit -m "feat: add tenant USSD auto lead rules"
```

### Task 2: Expose Product Rules in Tenant Config API and UI

**Files:**
- Create: `app/api/tenant/ussd-auto-lead-rules/route.ts`
- Create: `app/(application)/leads/config/components/ussd-auto-lead-rules-config.tsx`
- Create: `lib/__tests__/ussd-auto-lead-rules-config-route.test.ts`
- Create: `lib/__tests__/ussd-auto-lead-rules-config-view.test.ts`
- Modify: `app/(application)/leads/config/components/piplene-config.tsx`

- [ ] **Step 1: Write failing route and view tests**

```ts
test("USSD auto-lead rules API persists tenant settings under ussdAutoLeadRules", () => {
  const source = readRepoFile("app/api/tenant/ussd-auto-lead-rules/route.ts");

  assert.match(source, /ussdAutoLeadRules/);
  assert.match(source, /sanitizeTenantUssdAutoLeadRulesInput/);
  assert.match(source, /getTenantUssdAutoLeadRules/);
});

test("pipeline config includes a USSD auto-lead rules editor", () => {
  const source = readRepoFile("app/(application)/leads/config/components/piplene-config.tsx");

  assert.match(source, /UssdAutoLeadRulesConfig/);
  assert.match(source, /USSD Auto Leads/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test lib/__tests__/ussd-auto-lead-rules-config-route.test.ts lib/__tests__/ussd-auto-lead-rules-config-view.test.ts`

Expected: FAIL because the new route/component wiring does not exist.

- [ ] **Step 3: Add the route and config component**

```ts
// app/api/tenant/ussd-auto-lead-rules/route.ts
return NextResponse.json({
  rules: getTenantUssdAutoLeadRules((tenant.settings as Record<string, unknown> | null) || null),
});

// PUT
const rules = sanitizeTenantUssdAutoLeadRulesInput(body.rules);
const updatedSettings = {
  ...currentSettings,
  ussdAutoLeadRules: rules,
};
```

```tsx
// app/(application)/leads/config/components/ussd-auto-lead-rules-config.tsx
<SearchableSelect
  value={rule.loanProductId}
  onValueChange={(value) => updateRule(rule.id, { loanProductId: value })}
  options={productOptions}
/>
<Switch
  checked={rule.enabled}
  onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
/>
```

```tsx
// app/(application)/leads/config/components/piplene-config.tsx
<TabsTrigger value="ussd-auto-leads">USSD Auto Leads</TabsTrigger>
<TabsContent value="ussd-auto-leads">
  <UssdAutoLeadRulesConfig />
</TabsContent>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test lib/__tests__/ussd-auto-lead-rules-config-route.test.ts lib/__tests__/ussd-auto-lead-rules-config-view.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/tenant/ussd-auto-lead-rules/route.ts app/(application)/leads/config/components/ussd-auto-lead-rules-config.tsx app/(application)/leads/config/components/piplene-config.tsx lib/__tests__/ussd-auto-lead-rules-config-route.test.ts lib/__tests__/ussd-auto-lead-rules-config-view.test.ts
git commit -m "feat: add tenant USSD auto lead rules config"
```

### Task 3: Extract Shared “Create or Reopen Lead” Service

**Files:**
- Create: `lib/ussd-lead-creation.ts`
- Create: `lib/__tests__/ussd-auto-lead-creation-route.test.ts`
- Modify: `app/api/ussd-leads/[id]/to-lead/route.ts`

- [ ] **Step 1: Write the failing wiring test**

```ts
test("USSD to-lead route uses the shared lead creation helper", () => {
  const source = readRepoFile("app/api/ussd-leads/[id]/to-lead/route.ts");

  assert.match(source, /ensureLeadForUssdApplication/);
  assert.match(source, /from \"@\\/lib\\/ussd-lead-creation\"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/__tests__/ussd-auto-lead-creation-route.test.ts`

Expected: FAIL because the shared helper does not exist yet.

- [ ] **Step 3: Extract the shared helper and thin the route**

```ts
// lib/ussd-lead-creation.ts
export async function ensureLeadForUssdApplication(input: {
  applicationId: number;
  currentUserId?: string | null;
}): Promise<{ leadId: string; existed: boolean }> {
  // load application
  // resolve initial stage
  // dedupe by stateMetadata.applicationId/referenceNumber/messageId
  // backfill Fineract client details if needed
  // create lead when missing
}
```

```ts
// app/api/ussd-leads/[id]/to-lead/route.ts
const session = await getSession();
const result = await ensureLeadForUssdApplication({
  applicationId,
  currentUserId: session?.user?.id || "system",
});

return NextResponse.json({ success: true, ...result });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/__tests__/ussd-auto-lead-creation-route.test.ts lib/__tests__/ussd-lead-conversion.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ussd-lead-creation.ts app/api/ussd-leads/[id]/to-lead/route.ts lib/__tests__/ussd-auto-lead-creation-route.test.ts
git commit -m "refactor: share USSD lead creation logic"
```

### Task 4: Trigger Auto Lead Creation from the Queue Consumer

**Files:**
- Create: `lib/__tests__/ussd-consumer-auto-lead.test.ts`
- Modify: `lib/amqp-queue-service.ts`
- Modify: `lib/tenant-ussd-auto-lead-rules.ts`

- [ ] **Step 1: Write the failing consumer test**

```ts
test("AMQP consumer auto-creates a lead for enabled USSD products", () => {
  const source = readRepoFile("lib/amqp-queue-service.ts");

  assert.match(source, /findMatchingUssdAutoLeadRule/);
  assert.match(source, /ensureLeadForUssdApplication/);
  assert.match(source, /Auto lead creation failed/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/__tests__/ussd-consumer-auto-lead.test.ts`

Expected: FAIL because the consumer does not yet call the shared helper.

- [ ] **Step 3: Wire best-effort auto-create after application persistence**

```ts
const rules = getTenantUssdAutoLeadRules(
  (tenant.settings as Record<string, unknown> | null) || null
);
const matchingRule = findMatchingUssdAutoLeadRule(
  rules,
  messageContent.loanMatrixLoanProductId
);

if (matchingRule) {
  try {
    await ensureLeadForUssdApplication({
      applicationId: ussdApplication.loanApplicationUssdId,
      currentUserId: "system",
    });
  } catch (error) {
    console.error("Auto lead creation failed", {
      applicationId: ussdApplication.loanApplicationUssdId,
      loanProductId: messageContent.loanMatrixLoanProductId,
      error,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/__tests__/ussd-consumer-auto-lead.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/amqp-queue-service.ts lib/tenant-ussd-auto-lead-rules.ts lib/__tests__/ussd-consumer-auto-lead.test.ts
git commit -m "feat: auto-create USSD leads from queue consumer"
```

### Task 5: Annotate USSD Applications with Linked Lead Info and Update the Live Table

**Files:**
- Create: `lib/__tests__/ussd-workspace-auto-lead-view.test.ts`
- Modify: `shared/types/ussd.ts`
- Modify: `app/actions/ussd-leads-actions.ts`
- Modify: `components/tables/UssdLoanApplicationsTable.tsx`

- [ ] **Step 1: Write the failing workspace test**

```ts
test("USSD applications table shows an open-lead action when a linked lead already exists", () => {
  const source = readRepoFile("components/tables/UssdLoanApplicationsTable.tsx");

  assert.match(source, /linkedLeadId/);
  assert.match(source, /Open Lead|View Lead/);
  assert.match(source, /preparing\\?applicationId=/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/__tests__/ussd-workspace-auto-lead-view.test.ts`

Expected: FAIL because the table does not yet know about linked leads.

- [ ] **Step 3: Add linked lead metadata and switch the action label**

```ts
// shared/types/ussd.ts
linkedLeadId?: string;

// app/actions/ussd-leads-actions.ts
const leads = await prisma.lead.findMany({
  where: {
    tenantId: tenant.id,
    OR: applications.flatMap((app) => [
      { stateMetadata: { path: ["applicationId"], equals: app.loanApplicationUssdId } },
      { stateMetadata: { path: ["referenceNumber"], equals: app.referenceNumber } },
      { stateMetadata: { path: ["messageId"], equals: app.messageId } },
    ]),
  },
  select: { id: true, stateMetadata: true },
});
```

```tsx
const linkedLeadId = app.linkedLeadId;
const actionLabel = linkedLeadId ? "Open Lead" : "View Details";
const href = linkedLeadId
  ? `/leads/${linkedLeadId}/preparing?applicationId=${app.loanApplicationUssdId}`
  : null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/__tests__/ussd-workspace-auto-lead-view.test.ts lib/__tests__/ussd-workspace-tabs.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/types/ussd.ts app/actions/ussd-leads-actions.ts components/tables/UssdLoanApplicationsTable.tsx lib/__tests__/ussd-workspace-auto-lead-view.test.ts
git commit -m "feat: surface auto-created USSD leads in workspace"
```

### Task 6: Final Verification Across the Feature Slice

**Files:**
- Test: `lib/__tests__/tenant-ussd-auto-lead-rules.test.ts`
- Test: `lib/__tests__/ussd-auto-lead-rules-config-route.test.ts`
- Test: `lib/__tests__/ussd-auto-lead-rules-config-view.test.ts`
- Test: `lib/__tests__/ussd-auto-lead-creation-route.test.ts`
- Test: `lib/__tests__/ussd-consumer-auto-lead.test.ts`
- Test: `lib/__tests__/ussd-workspace-auto-lead-view.test.ts`

- [ ] **Step 1: Run the focused test suite**

```bash
npx tsx --test \
  lib/__tests__/tenant-ussd-auto-lead-rules.test.ts \
  lib/__tests__/ussd-auto-lead-rules-config-route.test.ts \
  lib/__tests__/ussd-auto-lead-rules-config-view.test.ts \
  lib/__tests__/ussd-auto-lead-creation-route.test.ts \
  lib/__tests__/ussd-consumer-auto-lead.test.ts \
  lib/__tests__/ussd-workspace-auto-lead-view.test.ts
```

Expected: PASS

- [ ] **Step 2: Run existing USSD regression tests**

```bash
npx tsx --test \
  lib/__tests__/ussd-lead-conversion.test.ts \
  lib/__tests__/ussd-to-lead-cde-trigger.test.ts \
  lib/__tests__/ussd-workspace-tabs.test.ts
```

Expected: PASS

- [ ] **Step 3: Smoke-check the running app manually**

```text
1. Enable a `ussdAutoLeadRules` entry for product 12 in Pipeline Configuration.
2. Publish or ingest a new USSD application for product 12.
3. Confirm a lead row exists without clicking `View Details`.
4. Confirm the applications table shows `Open Lead` / `View Lead`.
5. Click it and verify navigation continues through `/leads/<id>/preparing?applicationId=<ussdId>`.
```

- [ ] **Step 4: Commit any final cleanup**

```bash
git add <all modified feature files>
git commit -m "test: verify USSD auto lead creation flow"
```
