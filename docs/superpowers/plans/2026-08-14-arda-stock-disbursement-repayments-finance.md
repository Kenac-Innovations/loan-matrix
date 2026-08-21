# ARDA Stock Disbursement, Repayments, and Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the local ARDA in-kind lending inventory module so users can receive stock by branch name, issue stock to borrowers, collect money repayments against issued stock value, and reconcile inventory finances.

**Architecture:** Keep the ARDA module local to Loan Matrix and use Fineract only as the source for tenant branches/offices. The inventory ledger remains the source for stock quantities and values, while a new repayment ledger records money collected against issued stock. The user interface stays business-friendly by showing branch names, unit dropdowns, currency dropdowns, stock issue forms, repayment forms, and a finance summary page.

**Tech Stack:** Next.js App Router, React client components, Prisma, PostgreSQL, existing shadcn-style UI components, existing Fineract helper layer, Node test runner through `tsx --test`.

## Global Constraints

- ARDA inventory records remain local to Loan Matrix.
- Branch names are shown to users; Fineract office IDs are retained internally for joins and future reconciliation.
- Unit selection is configurable through a dropdown, starting with: `bag`, `kg`, `tonne`, `litre`, `box`, `unit`.
- Currency selection is configurable through a dropdown, starting with: `USD`, `ZMW`, `ZWL`.
- Stock issues reduce available inventory immediately.
- Repayments are money-only and are recorded against the value of stock issues.
- Repayments must not increase stock quantity.
- A stock issue cannot be repaid above its outstanding issued value.
- The finance page must show received stock value, issued stock value, repayments collected, outstanding recovery value, current stock value, and a reconciliation difference.
- Preserve existing inventory receipt behavior while improving labels and captured metadata.

---

## File Structure

- `prisma/schema.prisma`: Add branch name, currency, borrower-facing issue fields, and the new stock repayment model.
- `prisma/migrations/20260814090000_extend_arda_inventory_finance/migration.sql`: Persist the database changes in a reviewable migration.
- `lib/inventory/inventory-config.ts`: Central source for unit and currency dropdown options.
- `lib/inventory/inventory-branch-service.ts`: Fetch Fineract offices and normalize them into `{ id, name }` branch options.
- `lib/inventory/inventory-ledger-service.ts`: Extend ledger requests so receipts and issues capture branch name and currency.
- `lib/inventory/inventory-issue-service.ts`: Create stock issues, issue stock from a branch balance, and record issue lines.
- `lib/inventory/inventory-repayment-service.ts`: Record money repayments against stock issues and prevent overpayment.
- `lib/inventory/inventory-finance-service.ts`: Produce finance summaries from inventory movements, issues, and repayments.
- `app/api/inventory/config/route.ts`: Return dropdown options for branches, units, and currencies.
- `app/api/inventory/items/route.ts`: Accept and return `currencyCode`.
- `app/api/inventory/balances/route.ts`: Return branch names and currency.
- `app/api/inventory/movements/route.ts`: Return branch names and currency.
- `app/api/inventory/receipts/route.ts`: Accept branch name and currency.
- `app/api/inventory/issues/route.ts`: Create and list stock issues.
- `app/api/inventory/repayments/route.ts`: Create stock issue repayments.
- `app/api/inventory/finances/route.ts`: Return inventory finance summary data.
- `app/(application)/inventory/page.tsx`: Replace branch ID input with dropdown, replace unit input with dropdown, add currency dropdown, add stock issue and repayment areas.
- `app/(application)/inventory/finances/page.tsx`: New finance page for reconciliation.
- `app/(application)/inventory/components/inventory-format.ts`: Shared formatting helpers for quantities, money, and dates.
- `lib/__tests__/inventory-phase-two-schema.test.ts`: Schema guard for the new data shape.
- `lib/__tests__/inventory-config.test.ts`: Dropdown defaults and config API shape.
- `lib/__tests__/inventory-stock-issue-service.test.ts`: Issue stock behavior.
- `lib/__tests__/inventory-repayment-service.test.ts`: Money repayment behavior.
- `lib/__tests__/inventory-finance-service.test.ts`: Finance summary behavior.

---

### Task 1: Extend the Inventory Data Model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260814090000_extend_arda_inventory_finance/migration.sql`
- Create: `lib/__tests__/inventory-phase-two-schema.test.ts`

**Interfaces:**
- Produces Prisma fields:
  - `InventoryItem.currencyCode: string`
  - `InventoryBalance.fineractOfficeName: string | null`
  - `InventoryBalance.currencyCode: string`
  - `InventoryMovement.fineractOfficeName: string | null`
  - `InventoryMovement.currencyCode: string`
  - `StockLoanIssue.leadId: string | null`
  - `StockLoanIssue.fineractOfficeName: string | null`
  - `StockLoanIssue.borrowerName: string | null`
  - `StockLoanIssue.loanAccountNo: string | null`
  - `StockLoanIssue.externalReference: string | null`
  - `StockLoanIssue.currencyCode: string`
  - `StockLoanIssue.notes: string | null`
  - `StockLoanIssueLine.currencyCode: string`
  - `StockLoanRepayment` model
- Consumed by Tasks 2, 4, 5, 6, and 7.

- [ ] **Step 1: Write the schema guard test**

Create `lib/__tests__/inventory-phase-two-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const schema = readFileSync("prisma/schema.prisma", "utf8");

test("ARDA inventory phase two schema supports branch names, currency, issues, and repayments", () => {
  assert.match(schema, /model InventoryItem[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model InventoryBalance[\s\S]*fineractOfficeName\s+String\?/);
  assert.match(schema, /model InventoryBalance[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model InventoryMovement[\s\S]*fineractOfficeName\s+String\?/);
  assert.match(schema, /model InventoryMovement[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model StockLoanIssue[\s\S]*leadId\s+String\?/);
  assert.match(schema, /model StockLoanIssue[\s\S]*borrowerName\s+String\?/);
  assert.match(schema, /model StockLoanIssue[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model StockLoanIssueLine[\s\S]*currencyCode\s+String\s+@default\("USD"\)/);
  assert.match(schema, /model StockLoanRepayment/);
  assert.match(schema, /stockLoanRepayments\s+StockLoanRepayment\[\]/);
});
```

- [ ] **Step 2: Run the schema guard and confirm it fails**

Run:

```bash
npx tsx --test lib/__tests__/inventory-phase-two-schema.test.ts
```

Expected: failure because the new fields and model are not present yet.

- [ ] **Step 3: Update `Tenant` relations in Prisma**

In `prisma/schema.prisma`, inside `model Tenant`, add:

```prisma
  stockLoanRepayments     StockLoanRepayment[]
```

- [ ] **Step 4: Update `InventoryItem`**

In `model InventoryItem`, add:

```prisma
  currencyCode      String @default("USD")
```

- [ ] **Step 5: Update `InventoryBalance`**

In `model InventoryBalance`, add:

```prisma
  fineractOfficeName String?
  currencyCode       String @default("USD")
```

Change the uniqueness rule from:

```prisma
  @@unique([tenantId, fineractOfficeId, inventoryItemId])
```

to:

```prisma
  @@unique([tenantId, fineractOfficeId, inventoryItemId, currencyCode])
```

- [ ] **Step 6: Update `StockLoanIssue`**

Change:

```prisma
  leadId           String @unique
```

to:

```prisma
  leadId           String?
```

Add these fields inside `model StockLoanIssue`:

```prisma
  fineractOfficeName String?
  borrowerName       String?
  loanAccountNo      String?
  externalReference  String?
  currencyCode       String @default("USD")
  notes              String?
  repayments         StockLoanRepayment[]
```

Change the lead relation from:

```prisma
  lead             Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
```

to:

```prisma
  lead             Lead? @relation(fields: [leadId], references: [id], onDelete: SetNull)
```

Add this index:

```prisma
  @@index([tenantId, borrowerName])
```

- [ ] **Step 7: Update `StockLoanIssueLine`**

Add this field inside `model StockLoanIssueLine`:

```prisma
  currencyCode     String @default("USD")
```

- [ ] **Step 8: Update `InventoryMovement`**

Add these fields inside `model InventoryMovement`:

```prisma
  fineractOfficeName String?
  currencyCode       String @default("USD")
```

- [ ] **Step 9: Add `StockLoanRepayment` model**

Add this model near the stock issue models:

```prisma
model StockLoanRepayment {
  id               String   @id @default(cuid())
  tenantId         String
  stockLoanIssueId String
  amount           Decimal  @db.Decimal(18, 2)
  currencyCode     String   @default("USD")
  paymentDate      DateTime
  reference        String?
  notes            String?
  actorUserId      String
  actorUserName    String?
  idempotencyKey   String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  stockLoanIssue   StockLoanIssue @relation(fields: [stockLoanIssueId], references: [id], onDelete: Cascade)

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, paymentDate])
  @@index([stockLoanIssueId])
}
```

- [ ] **Step 10: Create the migration SQL**

Create `prisma/migrations/20260814090000_extend_arda_inventory_finance/migration.sql`:

```sql
ALTER TABLE "InventoryItem"
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "InventoryBalance"
ADD COLUMN "fineractOfficeName" TEXT,
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "InventoryMovement"
ADD COLUMN "fineractOfficeName" TEXT,
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "StockLoanIssue"
DROP CONSTRAINT IF EXISTS "StockLoanIssue_leadId_fkey",
DROP CONSTRAINT IF EXISTS "StockLoanIssue_leadId_key",
ALTER COLUMN "leadId" DROP NOT NULL,
ADD COLUMN "fineractOfficeName" TEXT,
ADD COLUMN "borrowerName" TEXT,
ADD COLUMN "loanAccountNo" TEXT,
ADD COLUMN "externalReference" TEXT,
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "notes" TEXT;

ALTER TABLE "StockLoanIssueLine"
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';

CREATE TABLE "StockLoanRepayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "stockLoanIssueId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'USD',
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "actorUserId" TEXT NOT NULL,
  "actorUserName" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockLoanRepayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockLoanRepayment"
ADD CONSTRAINT "StockLoanRepayment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockLoanRepayment"
ADD CONSTRAINT "StockLoanRepayment_stockLoanIssueId_fkey"
FOREIGN KEY ("stockLoanIssueId") REFERENCES "StockLoanIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "StockLoanRepayment_tenantId_idempotencyKey_key"
ON "StockLoanRepayment"("tenantId", "idempotencyKey");

CREATE INDEX "StockLoanRepayment_tenantId_paymentDate_idx"
ON "StockLoanRepayment"("tenantId", "paymentDate");

CREATE INDEX "StockLoanRepayment_stockLoanIssueId_idx"
ON "StockLoanRepayment"("stockLoanIssueId");

CREATE INDEX "StockLoanIssue_tenantId_borrowerName_idx"
ON "StockLoanIssue"("tenantId", "borrowerName");

ALTER TABLE "StockLoanIssue"
ADD CONSTRAINT "StockLoanIssue_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 11: Run Prisma validation and generate the client**

Run:

```bash
npx prisma validate
npx prisma generate
```

Expected: both commands pass.

- [ ] **Step 12: Run the schema guard and confirm it passes**

Run:

```bash
npx tsx --test lib/__tests__/inventory-phase-two-schema.test.ts
```

Expected: pass.

- [ ] **Step 13: Commit**

Run:

```bash
git add prisma/schema.prisma prisma/migrations/20260814090000_extend_arda_inventory_finance/migration.sql lib/__tests__/inventory-phase-two-schema.test.ts app/generated/prisma
git commit -m "feat: extend ARDA inventory schema for issues and repayments"
```

---

### Task 2: Add Inventory Dropdown Configuration

**Files:**
- Create: `lib/inventory/inventory-config.ts`
- Create: `lib/inventory/inventory-branch-service.ts`
- Create: `app/api/inventory/config/route.ts`
- Create: `lib/__tests__/inventory-config.test.ts`

**Interfaces:**
- Produces:
  - `INVENTORY_UNITS: Array<{ value: string; label: string }>`
  - `INVENTORY_CURRENCIES: Array<{ value: string; label: string }>`
  - `getInventoryBranches(): Promise<Array<{ id: number; name: string }>>`
  - `GET /api/inventory/config`
- Consumed by Task 7 UI forms.

- [ ] **Step 1: Write the config test**

Create `lib/__tests__/inventory-config.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { INVENTORY_CURRENCIES, INVENTORY_UNITS, normalizeInventoryBranches } from "../inventory/inventory-config";

test("inventory config exposes beginner-friendly unit and currency dropdowns", () => {
  assert.deepEqual(
    INVENTORY_UNITS.map((unit) => unit.value),
    ["bag", "kg", "tonne", "litre", "box", "unit"]
  );
  assert.deepEqual(
    INVENTORY_CURRENCIES.map((currency) => currency.value),
    ["USD", "ZMW", "ZWL"]
  );
});

test("inventory config normalizes Fineract office responses into branch options", () => {
  const branches = normalizeInventoryBranches([
    { id: 1, name: "Head Office" },
    { id: 2, name: "Mutare" },
    { id: null, name: "Broken Office" },
  ]);

  assert.deepEqual(branches, [
    { id: 1, name: "Head Office" },
    { id: 2, name: "Mutare" },
  ]);
});
```

- [ ] **Step 2: Run the config test and confirm it fails**

Run:

```bash
npx tsx --test lib/__tests__/inventory-config.test.ts
```

Expected: failure because the config module does not exist yet.

- [ ] **Step 3: Create `lib/inventory/inventory-config.ts`**

Add:

```ts
export const INVENTORY_UNITS = [
  { value: "bag", label: "Bag" },
  { value: "kg", label: "Kilogram" },
  { value: "tonne", label: "Tonne" },
  { value: "litre", label: "Litre" },
  { value: "box", label: "Box" },
  { value: "unit", label: "Unit" },
] as const;

export const INVENTORY_CURRENCIES = [
  { value: "USD", label: "United States Dollar" },
  { value: "ZMW", label: "Zambian Kwacha" },
  { value: "ZWL", label: "Zimbabwe Dollar" },
] as const;

export type InventoryBranchOption = {
  id: number;
  name: string;
};

export function normalizeInventoryBranches(offices: unknown): InventoryBranchOption[] {
  if (!Array.isArray(offices)) return [];

  return offices
    .map((office) => {
      const value = office as Record<string, unknown>;
      const id = Number(value.id);
      const name = String(value.name ?? "").trim();
      return Number.isInteger(id) && id > 0 && name ? { id, name } : null;
    })
    .filter((office): office is InventoryBranchOption => office !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}
```

- [ ] **Step 4: Create `lib/inventory/inventory-branch-service.ts`**

Add:

```ts
import { fetchFineractAPI } from "@/lib/api";
import { normalizeInventoryBranches, type InventoryBranchOption } from "./inventory-config";

export async function getInventoryBranches(): Promise<InventoryBranchOption[]> {
  const offices = await fetchFineractAPI("/offices");
  return normalizeInventoryBranches(offices);
}
```

- [ ] **Step 5: Create `app/api/inventory/config/route.ts`**

Add:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { INVENTORY_CURRENCIES, INVENTORY_UNITS } from "@/lib/inventory/inventory-config";
import { getInventoryBranches } from "@/lib/inventory/inventory-branch-service";

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const branches = await getInventoryBranches().catch(() => []);

    return NextResponse.json({
      units: INVENTORY_UNITS,
      currencies: INVENTORY_CURRENCIES,
      branches,
    });
  } catch (error) {
    console.error("Error loading inventory config:", error);
    return NextResponse.json(
      {
        error: "Failed to load inventory configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: Run the config test**

Run:

```bash
npx tsx --test lib/__tests__/inventory-config.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add lib/inventory/inventory-config.ts lib/inventory/inventory-branch-service.ts app/api/inventory/config/route.ts lib/__tests__/inventory-config.test.ts
git commit -m "feat: add ARDA inventory dropdown configuration"
```

---

### Task 3: Capture Branch Names and Currency on Existing Stock Receipts

**Files:**
- Modify: `lib/inventory/inventory-ledger-service.ts`
- Modify: `app/api/inventory/items/route.ts`
- Modify: `app/api/inventory/balances/route.ts`
- Modify: `app/api/inventory/movements/route.ts`
- Modify: `app/api/inventory/receipts/route.ts`
- Modify: `lib/__tests__/inventory-ledger-service.test.ts`

**Interfaces:**
- Consumes Task 1 schema fields.
- Produces:
  - `MovementRequest.fineractOfficeName?: string`
  - `MovementRequest.currencyCode?: string`
  - Items, balances, movements, and receipts API responses include `currencyCode`.

- [ ] **Step 1: Add a failing service test for receipt metadata**

In `lib/__tests__/inventory-ledger-service.test.ts`, add:

```ts
test("receiveInventory stores branch name and currency on balances and movements", async () => {
  const db = createInventoryDbStub({
    item: { id: "item-1", tenantId: "tenant-1", isActive: true },
    balance: null,
  });

  const result = await receiveInventory(db, {
    tenantId: "tenant-1",
    inventoryItemId: "item-1",
    fineractOfficeId: 7,
    fineractOfficeName: "Mutare Branch",
    currencyCode: "USD",
    quantity: "10",
    value: "250",
    idempotencyKey: "receipt-branch-currency",
    actorUserId: "user-1",
    actorUserName: "App Administrator",
    reason: "Opening stock",
  });

  assert.equal(result.idempotentReplay, false);
  assert.equal(db.createdBalances[0].fineractOfficeName, "Mutare Branch");
  assert.equal(db.createdBalances[0].currencyCode, "USD");
  assert.equal(db.createdMovements[0].fineractOfficeName, "Mutare Branch");
  assert.equal(db.createdMovements[0].currencyCode, "USD");
});
```

- [ ] **Step 2: Run the ledger service test and confirm it fails**

Run:

```bash
npx tsx --test lib/__tests__/inventory-ledger-service.test.ts
```

Expected: failure because the request type and stub do not yet include branch name and currency.

- [ ] **Step 3: Extend `MovementRequest`**

In `lib/inventory/inventory-ledger-service.ts`, add fields:

```ts
  fineractOfficeName?: string;
  currencyCode?: string;
```

- [ ] **Step 4: Update balance lookup and creation**

In `findOrCreateBalance`, include currency in the lookup and persisted data:

```ts
      currencyCode: request.currencyCode ?? "USD",
```

When creating a balance, also set:

```ts
      fineractOfficeName: request.fineractOfficeName,
      currencyCode: request.currencyCode ?? "USD",
```

- [ ] **Step 5: Update balance metadata after movement**

In the `tx.inventoryBalance.update` data block, add:

```ts
        fineractOfficeName: request.fineractOfficeName,
        currencyCode: request.currencyCode ?? "USD",
```

- [ ] **Step 6: Update movement creation**

In the `tx.inventoryMovement.create` data block, add:

```ts
        fineractOfficeName: request.fineractOfficeName,
        currencyCode: request.currencyCode ?? "USD",
```

- [ ] **Step 7: Update item serialization**

In `app/api/inventory/items/route.ts`, include `currencyCode` in the serializer type and accept:

```ts
const currencyCode = String(body.currencyCode ?? "USD").trim().toUpperCase();
```

Store it in `prisma.inventoryItem.create`:

```ts
currencyCode,
```

- [ ] **Step 8: Update balances API serialization**

In `app/api/inventory/balances/route.ts`, return:

```ts
fineractOfficeName: balance.fineractOfficeName,
currencyCode: balance.currencyCode,
```

Also include `currencyCode` under `item` select.

- [ ] **Step 9: Update movements API serialization**

In `app/api/inventory/movements/route.ts`, return:

```ts
fineractOfficeName: movement.fineractOfficeName,
currencyCode: movement.currencyCode,
```

- [ ] **Step 10: Update receipts API request parsing**

In `app/api/inventory/receipts/route.ts`, parse:

```ts
const fineractOfficeName = String(body.fineractOfficeName ?? "").trim();
const currencyCode = String(body.currencyCode ?? "USD").trim().toUpperCase();
```

Pass these to `receiveInventory`.

- [ ] **Step 11: Run receipt metadata tests**

Run:

```bash
npx tsx --test lib/__tests__/inventory-ledger-service.test.ts
```

Expected: pass.

- [ ] **Step 12: Commit**

Run:

```bash
git add lib/inventory/inventory-ledger-service.ts app/api/inventory/items/route.ts app/api/inventory/balances/route.ts app/api/inventory/movements/route.ts app/api/inventory/receipts/route.ts lib/__tests__/inventory-ledger-service.test.ts
git commit -m "feat: store branch names and currency on ARDA stock movements"
```

---

### Task 4: Implement Stock Issue Service and API

**Files:**
- Create: `lib/inventory/inventory-issue-service.ts`
- Create: `app/api/inventory/issues/route.ts`
- Create: `lib/__tests__/inventory-stock-issue-service.test.ts`

**Interfaces:**
- Consumes:
  - `InventoryDb` from `lib/inventory/inventory-ledger-service.ts`
  - `applyInventoryMovement` from `lib/inventory/inventory-ledger.ts`
- Produces:
  - `issueInventoryStock(db, request): Promise<{ issue; line; movement; balance; idempotentReplay: boolean }>`
  - `GET /api/inventory/issues`
  - `POST /api/inventory/issues`

- [ ] **Step 1: Write the stock issue test**

Create `lib/__tests__/inventory-stock-issue-service.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/app/generated/prisma";
import { issueInventoryStock } from "../inventory/inventory-issue-service";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function createIssueDbStub() {
  const db = {
    createdIssues: [] as Record<string, unknown>[],
    createdLines: [] as Record<string, unknown>[],
    createdMovements: [] as Record<string, unknown>[],
    updatedBalances: [] as Record<string, unknown>[],
    inventoryItem: {
      findFirst: async () => ({ id: "item-1", tenantId: "tenant-1", isActive: true }),
    },
    inventoryBalance: {
      findFirst: async () => ({
        id: "balance-1",
        tenantId: "tenant-1",
        inventoryItemId: "item-1",
        fineractOfficeId: 3,
        fineractOfficeName: "Head Office",
        currencyCode: "USD",
        quantityOnHand: decimal("20"),
        quantityReserved: decimal("0"),
        stockValue: decimal("500"),
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        db.updatedBalances.push(data);
        return { id: "balance-1", ...data };
      },
    },
    inventoryMovement: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.createdMovements.push(data);
        return { id: "movement-1", ...data };
      },
    },
    stockLoanIssue: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.createdIssues.push(data);
        return { id: "issue-1", ...data };
      },
    },
    stockLoanIssueLine: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.createdLines.push(data);
        return { id: "line-1", ...data };
      },
    },
    $transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db),
  };

  return db;
}

test("issueInventoryStock reduces branch stock and creates a money recovery issue", async () => {
  const db = createIssueDbStub();

  const result = await issueInventoryStock(db as never, {
    tenantId: "tenant-1",
    inventoryItemId: "item-1",
    fineractOfficeId: 3,
    fineractOfficeName: "Head Office",
    quantity: "4",
    unitValue: "25",
    currencyCode: "USD",
    borrowerName: "ARDA Farmer One",
    loanAccountNo: "LN-001",
    externalReference: "ARDA-ISSUE-001",
    actorUserId: "user-1",
    actorUserName: "App Administrator",
    notes: "Seed issued to borrower",
    idempotencyKey: "issue-001",
  });

  assert.equal(result.idempotentReplay, false);
  assert.equal(db.createdIssues[0].totalValue, "100");
  assert.equal(db.createdIssues[0].borrowerName, "ARDA Farmer One");
  assert.equal(db.createdLines[0].lineValue, "100");
  assert.equal(db.createdMovements[0].type, "RESERVATION");
  assert.equal(db.createdMovements[0].quantityDelta, "4");
  assert.equal(db.createdMovements[0].valueDelta, "0");
  assert.equal(db.createdMovements[1].type, "ISSUE");
  assert.equal(db.createdMovements[1].quantityDelta, "-4");
  assert.equal(db.createdMovements[1].valueDelta, "-100");
  assert.equal(db.updatedBalances[0].quantityOnHand, "16");
  assert.equal(db.updatedBalances[0].quantityReserved, "0");
  assert.equal(db.updatedBalances[0].stockValue, "400");
});
```

- [ ] **Step 2: Run the stock issue test and confirm it fails**

Run:

```bash
npx tsx --test lib/__tests__/inventory-stock-issue-service.test.ts
```

Expected: failure because `inventory-issue-service.ts` does not exist yet.

- [ ] **Step 3: Create `lib/inventory/inventory-issue-service.ts`**

Add:

```ts
import { Prisma } from "@/app/generated/prisma";
import { applyInventoryMovement, InventoryLedgerError } from "./inventory-ledger";
import { InventoryLedgerServiceError, type InventoryDb } from "./inventory-ledger-service";

type IssueRequest = {
  tenantId: string;
  inventoryItemId: string;
  fineractOfficeId: number;
  fineractOfficeName?: string;
  quantity: string;
  unitValue: string;
  currencyCode: string;
  borrowerName?: string;
  loanAccountNo?: string;
  externalReference?: string;
  leadId?: string;
  fineractLoanId?: number;
  actorUserId: string;
  actorUserName?: string;
  notes?: string;
  idempotencyKey: string;
};

function decimalString(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toString();
  return String(value ?? "0");
}

function multiplyDecimal(left: string, right: string) {
  return new Prisma.Decimal(left).mul(new Prisma.Decimal(right)).toFixed(2);
}

function normalizeBalance(balance: Record<string, unknown>) {
  return {
    quantityOnHand: decimalString(balance.quantityOnHand),
    quantityReserved: decimalString(balance.quantityReserved),
    stockValue: decimalString(balance.stockValue),
  };
}

export async function issueInventoryStock(db: InventoryDb, request: IssueRequest) {
  return db.$transaction(async (tx) => {
    const existingMovement = await tx.inventoryMovement.findFirst({
      where: { tenantId: request.tenantId, idempotencyKey: request.idempotencyKey },
    });

    if (existingMovement) {
      const existingIssue = await tx.stockLoanIssue.findFirst({
        where: { tenantId: request.tenantId, reference: request.idempotencyKey },
      });
      return { issue: existingIssue, movement: existingMovement, idempotentReplay: true };
    }

    const item = await tx.inventoryItem.findFirst({
      where: { id: request.inventoryItemId, tenantId: request.tenantId },
    });

    if (!item || item.isActive === false) {
      throw new InventoryLedgerServiceError(
        "INVENTORY_ITEM_NOT_FOUND",
        "The selected stock item is not available for this tenant."
      );
    }

    const balance = await tx.inventoryBalance.findFirst({
      where: {
        tenantId: request.tenantId,
        inventoryItemId: request.inventoryItemId,
        fineractOfficeId: request.fineractOfficeId,
        currencyCode: request.currencyCode,
      },
    });

    if (!balance) {
      throw new InventoryLedgerServiceError(
        "INSUFFICIENT_STOCK",
        "This branch does not have stock for the selected item and currency."
      );
    }

    const lineValue = multiplyDecimal(request.quantity, request.unitValue);
    let reservedBalance;
    let nextBalance;
    try {
      reservedBalance = applyInventoryMovement(normalizeBalance(balance), {
        type: "RESERVATION",
        quantity: request.quantity,
        value: "0",
      });
      nextBalance = applyInventoryMovement(reservedBalance, {
        type: "ISSUE",
        quantity: request.quantity,
        value: lineValue,
      });
    } catch (error) {
      if (error instanceof InventoryLedgerError) {
        throw new InventoryLedgerServiceError(error.code, error.message);
      }
      throw error;
    }

    const issue = await tx.stockLoanIssue.create({
      data: {
        tenantId: request.tenantId,
        leadId: request.leadId,
        fineractLoanId: request.fineractLoanId,
        fineractOfficeId: request.fineractOfficeId,
        fineractOfficeName: request.fineractOfficeName,
        reference: request.idempotencyKey,
        status: "ISSUED",
        totalValue: lineValue,
        issuedAt: new Date(),
        issuedByUserId: request.actorUserId,
        issuedByUserName: request.actorUserName,
        borrowerName: request.borrowerName,
        loanAccountNo: request.loanAccountNo,
        externalReference: request.externalReference,
        currencyCode: request.currencyCode,
        notes: request.notes,
      },
    });

    const line = await tx.stockLoanIssueLine.create({
      data: {
        stockLoanIssueId: issue.id,
        inventoryItemId: request.inventoryItemId,
        quantity: request.quantity,
        issuedQuantity: request.quantity,
        unitValue: request.unitValue,
        lineValue,
        currencyCode: request.currencyCode,
      },
    });

    const updatedBalance = await tx.inventoryBalance.update({
      where: { id: balance.id },
      data: {
        quantityOnHand: nextBalance.quantityOnHand,
        quantityReserved: nextBalance.quantityReserved,
        stockValue: nextBalance.stockValue,
        fineractOfficeName: request.fineractOfficeName,
        currencyCode: request.currencyCode,
      },
    });

    const reservationMovement = await tx.inventoryMovement.create({
      data: {
        tenantId: request.tenantId,
        inventoryItemId: request.inventoryItemId,
        fineractOfficeId: request.fineractOfficeId,
        fineractOfficeName: request.fineractOfficeName,
        stockLoanIssueId: issue.id,
        fineractLoanId: request.fineractLoanId,
        type: "RESERVATION",
        quantityDelta: request.quantity,
        valueDelta: "0",
        currencyCode: request.currencyCode,
        idempotencyKey: `${request.idempotencyKey}:reservation`,
        reason: request.notes ?? "Stock reserved for borrower issue",
        actorUserId: request.actorUserId,
        actorUserName: request.actorUserName,
      },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId: request.tenantId,
        inventoryItemId: request.inventoryItemId,
        fineractOfficeId: request.fineractOfficeId,
        fineractOfficeName: request.fineractOfficeName,
        stockLoanIssueId: issue.id,
        fineractLoanId: request.fineractLoanId,
        type: "ISSUE",
        quantityDelta: `-${request.quantity}`,
        valueDelta: `-${lineValue}`,
        currencyCode: request.currencyCode,
        idempotencyKey: request.idempotencyKey,
        reason: request.notes ?? "Stock issued to borrower",
        actorUserId: request.actorUserId,
        actorUserName: request.actorUserName,
      },
    });

    return { issue, line, reservationMovement, movement, balance: updatedBalance, idempotentReplay: false };
  });
}
```

- [ ] **Step 4: Extend `InventoryTx` type**

In `lib/inventory/inventory-ledger-service.ts`, add these tables to `InventoryTx`:

```ts
  stockLoanIssue: InventoryTable;
  stockLoanIssueLine: InventoryTable;
  stockLoanRepayment: InventoryTable;
```

Also broaden `InventoryTable.findFirst` so service tests can use `include` where needed:

```ts
findFirst(args: {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
}): Promise<Record<string, unknown> | null>;
```

- [ ] **Step 5: Create `app/api/inventory/issues/route.ts`**

Add a route that:

```ts
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { issueInventoryStock } from "@/lib/inventory/inventory-issue-service";
import { InventoryLedgerServiceError, type InventoryDb } from "@/lib/inventory/inventory-ledger-service";

function sessionUserValue(session: Awaited<ReturnType<typeof getSession>>, key: string) {
  return (session?.user as Record<string, unknown> | undefined)?.[key];
}

function stringValue(value: unknown) {
  return value == null ? "0" : String(value);
}

export async function GET() {
  const tenant = await getTenantFromHeaders();
  const session = await getSession();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const issues = await prisma.stockLoanIssue.findMany({
    where: { tenantId: tenant.id },
    include: { lines: { include: { inventoryItem: true } }, repayments: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    issues.map((issue) => {
      const repaid = issue.repayments.reduce((sum, repayment) => sum + Number(repayment.amount), 0);
      const total = Number(issue.totalValue);
      return {
        id: issue.id,
        reference: issue.reference,
        borrowerName: issue.borrowerName,
        loanAccountNo: issue.loanAccountNo,
        externalReference: issue.externalReference,
        fineractOfficeId: issue.fineractOfficeId,
        fineractOfficeName: issue.fineractOfficeName,
        status: issue.status,
        totalValue: stringValue(issue.totalValue),
        totalRepaid: repaid.toFixed(2),
        outstandingValue: Math.max(total - repaid, 0).toFixed(2),
        currencyCode: issue.currencyCode,
        issuedAt: issue.issuedAt?.toISOString() ?? null,
        notes: issue.notes,
        lines: issue.lines.map((line) => ({
          id: line.id,
          quantity: stringValue(line.quantity),
          unitValue: stringValue(line.unitValue),
          lineValue: stringValue(line.lineValue),
          currencyCode: line.currencyCode,
          item: {
            id: line.inventoryItem.id,
            sku: line.inventoryItem.sku,
            name: line.inventoryItem.name,
            unitOfMeasure: line.inventoryItem.unitOfMeasure,
          },
        })),
      };
    })
  );
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : `inventory-issue:${tenant.id}:${randomUUID()}`;

    const result = await issueInventoryStock(prisma as unknown as InventoryDb, {
      tenantId: tenant.id,
      inventoryItemId: String(body.inventoryItemId ?? "").trim(),
      fineractOfficeId: Number(body.fineractOfficeId),
      fineractOfficeName: String(body.fineractOfficeName ?? "").trim(),
      quantity: String(body.quantity ?? "").trim(),
      unitValue: String(body.unitValue ?? "").trim(),
      currencyCode: String(body.currencyCode ?? "USD").trim().toUpperCase(),
      borrowerName: String(body.borrowerName ?? "").trim(),
      loanAccountNo: String(body.loanAccountNo ?? "").trim(),
      externalReference: String(body.externalReference ?? "").trim(),
      actorUserId: String(sessionUserValue(session, "userId") ?? session.user.id),
      actorUserName: String(sessionUserValue(session, "name") ?? session.user.name ?? ""),
      notes: String(body.notes ?? "").trim(),
      idempotencyKey,
    });

    return NextResponse.json(result, { status: result.idempotentReplay ? 200 : 201 });
  } catch (error) {
    console.error("Error issuing inventory stock:", error);
    if (error instanceof InventoryLedgerServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: "Failed to issue inventory stock",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: Run the stock issue test**

Run:

```bash
npx tsx --test lib/__tests__/inventory-stock-issue-service.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add lib/inventory/inventory-issue-service.ts app/api/inventory/issues/route.ts lib/inventory/inventory-ledger-service.ts lib/__tests__/inventory-stock-issue-service.test.ts
git commit -m "feat: issue ARDA stock to borrowers"
```

---

### Task 5: Implement Money Repayments Against Stock Issues

**Files:**
- Create: `lib/inventory/inventory-repayment-service.ts`
- Create: `app/api/inventory/repayments/route.ts`
- Create: `lib/__tests__/inventory-repayment-service.test.ts`

**Interfaces:**
- Consumes:
  - `StockLoanIssue.totalValue`
  - `StockLoanIssue.repayments`
- Produces:
  - `recordStockIssueRepayment(db, request): Promise<{ repayment; issue; outstandingValue; idempotentReplay: boolean }>`
  - `POST /api/inventory/repayments`

- [ ] **Step 1: Write the repayment service test**

Create `lib/__tests__/inventory-repayment-service.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/app/generated/prisma";
import { recordStockIssueRepayment } from "../inventory/inventory-repayment-service";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function createRepaymentDbStub(existingRepayments = ["40"]) {
  const db = {
    createdRepayments: [] as Record<string, unknown>[],
    stockLoanIssue: {
      findFirst: async () => ({
        id: "issue-1",
        tenantId: "tenant-1",
        totalValue: decimal("100"),
        currencyCode: "USD",
        repayments: existingRepayments.map((amount, index) => ({
          id: `repayment-${index}`,
          amount: decimal(amount),
          currencyCode: "USD",
        })),
      }),
    },
    stockLoanRepayment: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.createdRepayments.push(data);
        return { id: "repayment-new", ...data };
      },
    },
    $transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db),
  };
  return db;
}

test("recordStockIssueRepayment accepts money repayment within outstanding stock issue value", async () => {
  const db = createRepaymentDbStub(["40"]);

  const result = await recordStockIssueRepayment(db as never, {
    tenantId: "tenant-1",
    stockLoanIssueId: "issue-1",
    amount: "50",
    currencyCode: "USD",
    paymentDate: new Date("2026-08-14T00:00:00.000Z"),
    reference: "cash-receipt-001",
    notes: "Partial recovery",
    actorUserId: "user-1",
    actorUserName: "App Administrator",
    idempotencyKey: "repayment-001",
  });

  assert.equal(result.idempotentReplay, false);
  assert.equal(result.outstandingValue, "10.00");
  assert.equal(db.createdRepayments[0].amount, "50");
  assert.equal(db.createdRepayments[0].currencyCode, "USD");
});

test("recordStockIssueRepayment blocks overpayment against stock issue value", async () => {
  const db = createRepaymentDbStub(["90"]);

  await assert.rejects(
    () =>
      recordStockIssueRepayment(db as never, {
        tenantId: "tenant-1",
        stockLoanIssueId: "issue-1",
        amount: "20",
        currencyCode: "USD",
        paymentDate: new Date("2026-08-14T00:00:00.000Z"),
        actorUserId: "user-1",
        idempotencyKey: "repayment-overpay",
      }),
    /Repayment is greater than the outstanding stock issue value/
  );
});
```

- [ ] **Step 2: Run the repayment test and confirm it fails**

Run:

```bash
npx tsx --test lib/__tests__/inventory-repayment-service.test.ts
```

Expected: failure because the repayment service does not exist yet.

- [ ] **Step 3: Create `lib/inventory/inventory-repayment-service.ts`**

Add:

```ts
import { Prisma } from "@/app/generated/prisma";
import { InventoryLedgerServiceError, type InventoryDb } from "./inventory-ledger-service";

type RepaymentRequest = {
  tenantId: string;
  stockLoanIssueId: string;
  amount: string;
  currencyCode: string;
  paymentDate: Date;
  reference?: string;
  notes?: string;
  actorUserId: string;
  actorUserName?: string;
  idempotencyKey: string;
};

function decimalString(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toString();
  return String(value ?? "0");
}

function sumRepayments(repayments: Array<{ amount: unknown }>) {
  return repayments.reduce(
    (sum, repayment) => sum.add(new Prisma.Decimal(decimalString(repayment.amount))),
    new Prisma.Decimal(0)
  );
}

export async function recordStockIssueRepayment(db: InventoryDb, request: RepaymentRequest) {
  return db.$transaction(async (tx) => {
    const existing = await tx.stockLoanRepayment.findFirst({
      where: { tenantId: request.tenantId, idempotencyKey: request.idempotencyKey },
    });

    const issue = await tx.stockLoanIssue.findFirst({
      where: { id: request.stockLoanIssueId, tenantId: request.tenantId },
      include: { repayments: true },
    });

    if (!issue) {
      throw new InventoryLedgerServiceError(
        "INVALID_REQUEST",
        "The selected stock issue could not be found."
      );
    }

    const totalValue = new Prisma.Decimal(decimalString(issue.totalValue));
    const alreadyRepaid = sumRepayments((issue.repayments ?? []) as Array<{ amount: unknown }>);
    const amount = new Prisma.Decimal(request.amount);

    if (request.currencyCode !== String(issue.currencyCode ?? "USD")) {
      throw new InventoryLedgerServiceError(
        "INVALID_REQUEST",
        "Repayment currency must match the stock issue currency."
      );
    }

    if (existing) {
      return {
        repayment: existing,
        issue,
        outstandingValue: totalValue.sub(alreadyRepaid).toFixed(2),
        idempotentReplay: true,
      };
    }

    const nextRepaid = alreadyRepaid.add(amount);
    if (nextRepaid.gt(totalValue)) {
      throw new InventoryLedgerServiceError(
        "INVALID_REQUEST",
        "Repayment is greater than the outstanding stock issue value."
      );
    }

    const repayment = await tx.stockLoanRepayment.create({
      data: {
        tenantId: request.tenantId,
        stockLoanIssueId: request.stockLoanIssueId,
        amount: request.amount,
        currencyCode: request.currencyCode,
        paymentDate: request.paymentDate,
        reference: request.reference,
        notes: request.notes,
        actorUserId: request.actorUserId,
        actorUserName: request.actorUserName,
        idempotencyKey: request.idempotencyKey,
      },
    });

    return {
      repayment,
      issue,
      outstandingValue: totalValue.sub(nextRepaid).toFixed(2),
      idempotentReplay: false,
    };
  });
}
```

- [ ] **Step 4: Create `app/api/inventory/repayments/route.ts`**

Add:

```ts
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { recordStockIssueRepayment } from "@/lib/inventory/inventory-repayment-service";
import { InventoryLedgerServiceError, type InventoryDb } from "@/lib/inventory/inventory-ledger-service";

function sessionUserValue(session: Awaited<ReturnType<typeof getSession>>, key: string) {
  return (session?.user as Record<string, unknown> | undefined)?.[key];
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : `inventory-repayment:${tenant.id}:${randomUUID()}`;

    const result = await recordStockIssueRepayment(prisma as unknown as InventoryDb, {
      tenantId: tenant.id,
      stockLoanIssueId: String(body.stockLoanIssueId ?? "").trim(),
      amount: String(body.amount ?? "").trim(),
      currencyCode: String(body.currencyCode ?? "USD").trim().toUpperCase(),
      paymentDate: body.paymentDate ? new Date(String(body.paymentDate)) : new Date(),
      reference: String(body.reference ?? "").trim(),
      notes: String(body.notes ?? "").trim(),
      actorUserId: String(sessionUserValue(session, "userId") ?? session.user.id),
      actorUserName: String(sessionUserValue(session, "name") ?? session.user.name ?? ""),
      idempotencyKey,
    });

    return NextResponse.json(result, { status: result.idempotentReplay ? 200 : 201 });
  } catch (error) {
    console.error("Error recording stock issue repayment:", error);
    if (error instanceof InventoryLedgerServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: "Failed to record stock issue repayment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Run the repayment test**

Run:

```bash
npx tsx --test lib/__tests__/inventory-repayment-service.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/inventory/inventory-repayment-service.ts app/api/inventory/repayments/route.ts lib/__tests__/inventory-repayment-service.test.ts
git commit -m "feat: record ARDA stock issue repayments"
```

---

### Task 6: Build Inventory Finance Summary

**Files:**
- Create: `lib/inventory/inventory-finance-service.ts`
- Create: `app/api/inventory/finances/route.ts`
- Create: `lib/__tests__/inventory-finance-service.test.ts`

**Interfaces:**
- Produces:
  - `summarizeInventoryFinances(db, request): Promise<InventoryFinanceSummary>`
  - `GET /api/inventory/finances?currencyCode=USD`
- Consumed by Task 8 finance page.

- [ ] **Step 1: Write the finance summary test**

Create `lib/__tests__/inventory-finance-service.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/app/generated/prisma";
import { summarizeInventoryFinances } from "../inventory/inventory-finance-service";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

test("summarizeInventoryFinances reconciles received, issued, repayments, outstanding, and stock value", async () => {
  const db = {
    inventoryMovement: {
      findMany: async () => [
        { type: "RECEIPT", valueDelta: decimal("1000"), currencyCode: "USD" },
        { type: "ISSUE", valueDelta: decimal("-300"), currencyCode: "USD" },
      ],
    },
    inventoryBalance: {
      findMany: async () => [
        { stockValue: decimal("700"), currencyCode: "USD" },
      ],
    },
    stockLoanIssue: {
      findMany: async () => [
        {
          id: "issue-1",
          totalValue: decimal("300"),
          currencyCode: "USD",
          borrowerName: "ARDA Farmer",
          repayments: [{ amount: decimal("125"), currencyCode: "USD" }],
        },
      ],
    },
  };

  const summary = await summarizeInventoryFinances(db as never, {
    tenantId: "tenant-1",
    currencyCode: "USD",
  });

  assert.equal(summary.receivedStockValue, "1000.00");
  assert.equal(summary.issuedStockValue, "300.00");
  assert.equal(summary.repaymentsCollected, "125.00");
  assert.equal(summary.outstandingRecoveryValue, "175.00");
  assert.equal(summary.currentStockValue, "700.00");
  assert.equal(summary.reconciliationDifference, "0.00");
});
```

- [ ] **Step 2: Run the finance test and confirm it fails**

Run:

```bash
npx tsx --test lib/__tests__/inventory-finance-service.test.ts
```

Expected: failure because the finance service does not exist yet.

- [ ] **Step 3: Create `lib/inventory/inventory-finance-service.ts`**

Add:

```ts
import { Prisma } from "@/app/generated/prisma";

type FinanceRequest = {
  tenantId: string;
  currencyCode?: string;
};

type FinanceDb = {
  inventoryMovement: {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  inventoryBalance: {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  stockLoanIssue: {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
};

function decimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(String(value ?? "0"));
}

function money(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function sum(values: unknown[]) {
  return values.reduce((total, value) => total.add(decimal(value)), new Prisma.Decimal(0));
}

export async function summarizeInventoryFinances(db: FinanceDb, request: FinanceRequest) {
  const currencyCode = request.currencyCode ?? "USD";
  const where = { tenantId: request.tenantId, currencyCode };

  const [movements, balances, issues] = await Promise.all([
    db.inventoryMovement.findMany({ where }),
    db.inventoryBalance.findMany({ where }),
    db.stockLoanIssue.findMany({
      where,
      include: { repayments: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const receivedStockValue = sum(
    movements
      .filter((movement) => movement.type === "RECEIPT" || movement.type === "ADJUSTMENT_IN")
      .map((movement) => movement.valueDelta)
  );

  const issuedStockValue = sum(
    movements
      .filter((movement) => movement.type === "ISSUE")
      .map((movement) => decimal(movement.valueDelta).abs())
  );

  const currentStockValue = sum(balances.map((balance) => balance.stockValue));
  const repaymentsCollected = sum(
    issues.flatMap((issue) =>
      ((issue.repayments ?? []) as Array<Record<string, unknown>>).map((repayment) => repayment.amount)
    )
  );
  const issueTotal = sum(issues.map((issue) => issue.totalValue));
  const outstandingRecoveryValue = issueTotal.sub(repaymentsCollected);
  const expectedPosition = receivedStockValue.sub(issuedStockValue).add(outstandingRecoveryValue).add(repaymentsCollected);
  const actualPosition = currentStockValue.add(outstandingRecoveryValue).add(repaymentsCollected);

  return {
    currencyCode,
    receivedStockValue: money(receivedStockValue),
    issuedStockValue: money(issuedStockValue),
    repaymentsCollected: money(repaymentsCollected),
    outstandingRecoveryValue: money(outstandingRecoveryValue),
    currentStockValue: money(currentStockValue),
    reconciliationDifference: money(actualPosition.sub(expectedPosition)),
    openIssues: issues.map((issue) => {
      const repaid = sum(
        ((issue.repayments ?? []) as Array<Record<string, unknown>>).map((repayment) => repayment.amount)
      );
      const total = decimal(issue.totalValue);
      return {
        id: String(issue.id),
        borrowerName: String(issue.borrowerName ?? ""),
        loanAccountNo: String(issue.loanAccountNo ?? ""),
        totalValue: money(total),
        repaidValue: money(repaid),
        outstandingValue: money(total.sub(repaid)),
        currencyCode,
      };
    }),
  };
}
```

- [ ] **Step 4: Create `app/api/inventory/finances/route.ts`**

Add:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { summarizeInventoryFinances } from "@/lib/inventory/inventory-finance-service";

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currencyCode = request.nextUrl.searchParams.get("currencyCode") ?? "USD";
    const summary = await summarizeInventoryFinances(prisma, {
      tenantId: tenant.id,
      currencyCode: currencyCode.toUpperCase(),
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error loading inventory finances:", error);
    return NextResponse.json(
      {
        error: "Failed to load inventory finances",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Run the finance test**

Run:

```bash
npx tsx --test lib/__tests__/inventory-finance-service.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/inventory/inventory-finance-service.ts app/api/inventory/finances/route.ts lib/__tests__/inventory-finance-service.test.ts
git commit -m "feat: summarize ARDA inventory finances"
```

---

### Task 7: Update Inventory Control User Interface

**Files:**
- Modify: `app/(application)/inventory/page.tsx`
- Create: `app/(application)/inventory/components/inventory-format.ts`

**Interfaces:**
- Consumes:
  - `GET /api/inventory/config`
  - `POST /api/inventory/items`
  - `POST /api/inventory/receipts`
  - `GET /api/inventory/issues`
  - `POST /api/inventory/issues`
  - `POST /api/inventory/repayments`
- Produces a single business-facing stock control page with:
  - branch dropdown by name
  - unit dropdown
  - currency dropdown
  - receive stock form
  - issue stock form
  - repayment form
  - branch stock balances by name
  - movement history by name

- [ ] **Step 1: Create shared formatting helpers**

Create `app/(application)/inventory/components/inventory-format.ts`:

```ts
export function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export function formatQuantity(value: string, unit: string) {
  return `${numberValue(value).toLocaleString()} ${unit}`;
}

export function formatMoney(value: string | number, currencyCode = "USD") {
  return `${currencyCode} ${numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
```

- [ ] **Step 2: Extend page types**

In `app/(application)/inventory/page.tsx`, add these types:

```ts
type InventoryOption = { value: string; label: string };
type InventoryBranch = { id: number; name: string };
type InventoryConfig = {
  units: InventoryOption[];
  currencies: InventoryOption[];
  branches: InventoryBranch[];
};
type StockIssue = {
  id: string;
  reference: string;
  borrowerName: string | null;
  loanAccountNo: string | null;
  externalReference: string | null;
  fineractOfficeId: number;
  fineractOfficeName: string | null;
  status: string;
  totalValue: string;
  totalRepaid: string;
  outstandingValue: string;
  currencyCode: string;
  issuedAt: string | null;
  notes: string | null;
  lines: Array<{
    id: string;
    quantity: string;
    unitValue: string;
    lineValue: string;
    currencyCode: string;
    item: { id: string; sku: string; name: string; unitOfMeasure: string };
  }>;
};
```

- [ ] **Step 3: Add page state**

Add state:

```ts
const [config, setConfig] = useState<InventoryConfig>({
  units: [],
  currencies: [],
  branches: [],
});
const [issues, setIssues] = useState<StockIssue[]>([]);
const [issuingStock, setIssuingStock] = useState(false);
const [recordingRepayment, setRecordingRepayment] = useState(false);
const [issue, setIssue] = useState({
  inventoryItemId: "",
  fineractOfficeId: "",
  borrowerName: "",
  loanAccountNo: "",
  externalReference: "",
  quantity: "",
  unitValue: "",
  currencyCode: "USD",
  notes: "",
});
const [repayment, setRepayment] = useState({
  stockLoanIssueId: "",
  amount: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  reference: "",
  notes: "",
});
```

- [ ] **Step 4: Load config and issues**

Extend `loadInventory` to fetch:

```ts
fetch("/api/inventory/config")
fetch("/api/inventory/issues")
```

Set:

```ts
setConfig(configData);
setIssues(issuesData);
```

- [ ] **Step 5: Replace the unit free-text input**

Replace the stock item `Unit` `<Input />` with:

```tsx
<Select
  value={newItem.unitOfMeasure}
  onValueChange={(value) =>
    setNewItem((current) => ({ ...current, unitOfMeasure: value }))
  }
>
  <SelectTrigger>
    <SelectValue placeholder="Select unit" />
  </SelectTrigger>
  <SelectContent>
    {config.units.map((unit) => (
      <SelectItem key={unit.value} value={unit.value}>
        {unit.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **Step 6: Add currency dropdown to stock item form**

Add a `Currency` select next to unit value:

```tsx
<Select
  value={newItem.currencyCode}
  onValueChange={(value) =>
    setNewItem((current) => ({ ...current, currencyCode: value }))
  }
>
  <SelectTrigger>
    <SelectValue placeholder="Select currency" />
  </SelectTrigger>
  <SelectContent>
    {config.currencies.map((currency) => (
      <SelectItem key={currency.value} value={currency.value}>
        {currency.value}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **Step 7: Replace branch office ID with branch name dropdown**

For receive stock, replace the numeric branch input with:

```tsx
<Select
  value={receipt.fineractOfficeId}
  onValueChange={(value) => {
    const branch = config.branches.find((option) => String(option.id) === value);
    setReceipt((current) => ({
      ...current,
      fineractOfficeId: value,
      fineractOfficeName: branch?.name ?? "",
    }));
  }}
>
  <SelectTrigger>
    <SelectValue placeholder="Select branch" />
  </SelectTrigger>
  <SelectContent>
    {config.branches.map((branch) => (
      <SelectItem key={branch.id} value={String(branch.id)}>
        {branch.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **Step 8: Add stock issue form**

Add a new card titled `Issue Stock To Borrower` with fields:

```tsx
<Input placeholder="Borrower name" value={issue.borrowerName} onChange={(event) => setIssue((current) => ({ ...current, borrowerName: event.target.value }))} />
<Input placeholder="Loan account or reference" value={issue.loanAccountNo} onChange={(event) => setIssue((current) => ({ ...current, loanAccountNo: event.target.value }))} />
<Input placeholder="External reference" value={issue.externalReference} onChange={(event) => setIssue((current) => ({ ...current, externalReference: event.target.value }))} />
```

Use the same branch, item, quantity, unit value, and currency controls as receipt.

- [ ] **Step 9: Add `issueStock` action**

Add:

```ts
async function issueStock() {
  setIssuingStock(true);
  setError(null);
  setSuccess(null);
  try {
    const branch = config.branches.find((option) => String(option.id) === issue.fineractOfficeId);
    const response = await fetch("/api/inventory/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...issue,
        fineractOfficeName: branch?.name ?? "",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Could not issue stock.");
    setSuccess("Stock issued to borrower.");
    setIssue((current) => ({
      ...current,
      borrowerName: "",
      loanAccountNo: "",
      externalReference: "",
      quantity: "",
      notes: "",
    }));
    await loadInventory();
  } catch (issueError) {
    setError(issueError instanceof Error ? issueError.message : "Stock issue failed.");
  } finally {
    setIssuingStock(false);
  }
}
```

- [ ] **Step 10: Add repayment form**

Add a card titled `Record Stock Repayment` with:

```tsx
<Select
  value={repayment.stockLoanIssueId}
  onValueChange={(value) =>
    setRepayment((current) => ({ ...current, stockLoanIssueId: value }))
  }
>
  <SelectTrigger>
    <SelectValue placeholder="Select issued stock" />
  </SelectTrigger>
  <SelectContent>
    {issues
      .filter((stockIssue) => Number(stockIssue.outstandingValue) > 0)
      .map((stockIssue) => (
        <SelectItem key={stockIssue.id} value={stockIssue.id}>
          {stockIssue.borrowerName || stockIssue.reference} - {stockIssue.currencyCode} {stockIssue.outstandingValue} outstanding
        </SelectItem>
      ))}
  </SelectContent>
</Select>
```

- [ ] **Step 11: Add `recordRepayment` action**

Add:

```ts
async function recordRepayment() {
  setRecordingRepayment(true);
  setError(null);
  setSuccess(null);
  try {
    const selectedIssue = issues.find((stockIssue) => stockIssue.id === repayment.stockLoanIssueId);
    const response = await fetch("/api/inventory/repayments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...repayment,
        currencyCode: selectedIssue?.currencyCode ?? "USD",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Could not record repayment.");
    setSuccess("Money repayment recorded against issued stock.");
    setRepayment((current) => ({
      ...current,
      amount: "",
      reference: "",
      notes: "",
    }));
    await loadInventory();
  } catch (repaymentError) {
    setError(repaymentError instanceof Error ? repaymentError.message : "Repayment failed.");
  } finally {
    setRecordingRepayment(false);
  }
}
```

- [ ] **Step 12: Update tables to show branch names and currency**

Change headings:

```tsx
<th className="py-3">Branch</th>
```

Render:

```tsx
{balance.fineractOfficeName ?? `Office ${balance.fineractOfficeId}`}
```

Render money values with:

```tsx
{formatMoney(balance.stockValue, balance.currencyCode)}
```

- [ ] **Step 13: Add a finance page link**

Add a button near the page heading:

```tsx
<Button asChild variant="outline">
  <a href="/inventory/finances">Inventory Finances</a>
</Button>
```

- [ ] **Step 14: Manually test the page route**

Run the app and open:

```text
http://omama.localhost:3004/inventory
```

Confirm:
- The Unit field is a dropdown.
- The Currency field is a dropdown.
- The Receive Stock branch field shows branch names.
- The Branch Stock Balances table shows branch names.
- A stock issue can be created after stock exists.
- A money repayment can be recorded against an issued stock item.

- [ ] **Step 15: Commit**

Run:

```bash
git add app/'(application)'/inventory/page.tsx app/'(application)'/inventory/components/inventory-format.ts
git commit -m "feat: update ARDA inventory control workflow"
```

---

### Task 8: Add Inventory Finances Page

**Files:**
- Create: `app/(application)/inventory/finances/page.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/inventory/config`
  - `GET /api/inventory/finances?currencyCode=USD`
- Produces a finance dashboard with reconciliation cards and open issue table.

- [ ] **Step 1: Create the finance page**

Create `app/(application)/inventory/finances/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "../components/inventory-format";

type CurrencyOption = { value: string; label: string };
type FinanceSummary = {
  currencyCode: string;
  receivedStockValue: string;
  issuedStockValue: string;
  repaymentsCollected: string;
  outstandingRecoveryValue: string;
  currentStockValue: string;
  reconciliationDifference: string;
  openIssues: Array<{
    id: string;
    borrowerName: string;
    loanAccountNo: string;
    totalValue: string;
    repaidValue: string;
    outstandingValue: string;
    currencyCode: string;
  }>;
};

export default function InventoryFinancesPage() {
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFinances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResponse, financesResponse] = await Promise.all([
        fetch("/api/inventory/config"),
        fetch(`/api/inventory/finances?currencyCode=${currencyCode}`),
      ]);

      if (!configResponse.ok || !financesResponse.ok) {
        throw new Error("Inventory finances could not be loaded.");
      }

      const [configData, financesData] = await Promise.all([
        configResponse.json(),
        financesResponse.json(),
      ]);

      setCurrencies(configData.currencies ?? []);
      setSummary(financesData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Inventory finances failed.");
    } finally {
      setLoading(false);
    }
  }, [currencyCode]);

  useEffect(() => {
    loadFinances();
  }, [loadFinances]);

  const cards = summary
    ? [
        ["Stock Received", summary.receivedStockValue],
        ["Stock Issued", summary.issuedStockValue],
        ["Repayments Collected", summary.repaymentsCollected],
        ["Outstanding Recovery", summary.outstandingRecoveryValue],
        ["Current Stock Value", summary.currentStockValue],
        ["Reconciliation Difference", summary.reconciliationDifference],
      ]
    : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-3 px-0">
            <Link href="/inventory">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Stock Control
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">Inventory Finances</h1>
          <p className="text-sm text-muted-foreground">
            Track stock received, stock issued, repayments collected, and outstanding recovery.
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={currencyCode} onValueChange={setCurrencyCode}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={loadFinances} variant="outline" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label} className="bg-[#1d2838]">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {formatMoney(value, summary?.currencyCode ?? currencyCode)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#1d2838]">
        <CardHeader>
          <CardTitle className="text-white">Open Stock Recoveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-muted-foreground">
                <tr>
                  <th className="py-3">Borrower</th>
                  <th>Loan Reference</th>
                  <th>Issued Value</th>
                  <th>Repaid</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.openIssues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No stock recoveries have been recorded yet.
                    </td>
                  </tr>
                ) : (
                  summary.openIssues.map((issue) => (
                    <tr key={issue.id} className="border-b border-white/5">
                      <td className="py-3">{issue.borrowerName || "-"}</td>
                      <td>{issue.loanAccountNo || "-"}</td>
                      <td>{formatMoney(issue.totalValue, issue.currencyCode)}</td>
                      <td>{formatMoney(issue.repaidValue, issue.currencyCode)}</td>
                      <td>{formatMoney(issue.outstandingValue, issue.currencyCode)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Manually test the finance route**

Run the app and open:

```text
http://omama.localhost:3004/inventory/finances
```

Confirm:
- The page loads.
- Currency dropdown appears.
- Cards show values after stock is received, issued, and repaid.
- Open Stock Recoveries table shows borrowers with outstanding issued stock value.

- [ ] **Step 3: Commit**

Run:

```bash
git add app/'(application)'/inventory/finances/page.tsx
git commit -m "feat: add ARDA inventory finance dashboard"
```

---

### Task 9: Final Verification

**Files:**
- Verify all files changed in Tasks 1 through 8.

**Interfaces:**
- Confirms all local ARDA inventory routes and tests work together.

- [ ] **Step 1: Run targeted inventory tests**

Run:

```bash
npx tsx --test \
  lib/__tests__/inventory-visible-module.test.ts \
  lib/__tests__/inventory-ledger.test.ts \
  lib/__tests__/inventory-ledger-schema.test.ts \
  lib/__tests__/inventory-ledger-service.test.ts \
  lib/__tests__/inventory-phase-two-schema.test.ts \
  lib/__tests__/inventory-config.test.ts \
  lib/__tests__/inventory-stock-issue-service.test.ts \
  lib/__tests__/inventory-repayment-service.test.ts \
  lib/__tests__/inventory-finance-service.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run Prisma validation**

Run:

```bash
npx prisma validate
```

Expected: validation passes.

- [ ] **Step 3: Run Prisma migration locally**

Run:

```bash
npx prisma migrate dev --name extend_arda_inventory_finance
```

Expected: migration applies to the local ARDA database.

- [ ] **Step 4: Start the local app**

Run:

```bash
pnpm exec next dev -p 3004 -H 0.0.0.0
```

Expected: app starts on port `3004`.

- [ ] **Step 5: Smoke test inventory control**

Open:

```text
http://omama.localhost:3004/inventory
```

Use the page to:
- Create a stock item with unit `bag`, currency `USD`, and unit value `25`.
- Receive `100` units into a branch selected by name.
- Issue `10` units to a borrower.
- Record a money repayment against that issued stock.

Expected:
- Branch tables show branch names, not branch IDs.
- Stock on hand decreases after issuing stock.
- Repayment reduces outstanding recovery value.

- [ ] **Step 6: Smoke test inventory finances**

Open:

```text
http://omama.localhost:3004/inventory/finances
```

Expected:
- Received stock value reflects received stock.
- Issued stock value reflects issued stock.
- Repayments collected reflects money repayments.
- Outstanding recovery value equals issued stock value minus repayments.
- Current stock value equals remaining stock on hand value.

- [ ] **Step 7: Final commit**

Run:

```bash
git status --short
git add app lib prisma
git commit -m "feat: complete ARDA stock issue repayment finance flow"
```

If there is nothing new to commit because every task was committed already, keep the earlier task commits and do not create an empty commit.
