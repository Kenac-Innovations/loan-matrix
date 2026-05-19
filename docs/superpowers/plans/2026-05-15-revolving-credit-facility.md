# Revolving Credit Facility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a revolving credit facility product backed by a Fineract savings account, with full draw-down approval workflow and repayment recording, embedded inside the existing lead origination pipeline.

**Architecture:** Add `REVOLVING_CREDIT` to `FacilityType`; reuse the existing lead wizard with surgical tab hiding; on activation open a Fineract savings account and deposit the credit limit; manage all drawdowns and repayments as sub-records under a new `RevolvingCreditFacility` model surfaced in a new "Facility" tab on the lead detail page.

**Tech Stack:** Next.js 15, Prisma 6, Fineract REST API, TypeScript, Tailwind CSS, shadcn/ui

---

## File Map

### Modified (existing files)
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add enum value + 3 models + 2 Lead fields + 1 Tenant relation |
| `shared/types/tenant.ts` | Add `hasRevolvingCredit` to `TenantFeatures` + `DEFAULT_FEATURES` |
| `lib/tenant-features.ts` | Add `isRevolvingCreditEnabled` helper |
| `lib/team-state-machine-service.ts` | Add `activate_revolving` case to `executeFineractAction` |
| `app/(application)/leads/new/components/new-lead-form.tsx` | Hide schedule tab for `REVOLVING_CREDIT` |
| `app/(application)/leads/new/components/loan-terms-form.tsx` | Relabel + hide fields for `REVOLVING_CREDIT` |
| `app/(application)/leads/[id]/components/lead-detail-tabs.tsx` | Add Facility tab when `facilityType=REVOLVING_CREDIT` |
| `app/(application)/leads/[id]/page.tsx` | Pass `facilityType` to `LeadDetailTabs` |

### Created (new files)
| File | Purpose |
|---|---|
| `lib/fineract-savings-service.ts` | Wraps all Fineract savings account API calls |
| `app/api/leads/[id]/revolving/facility/route.ts` | GET facility record + live balance sync |
| `app/api/leads/[id]/revolving/drawdowns/route.ts` | GET list + POST create drawdown |
| `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/approve/route.ts` | POST approve drawdown |
| `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/disburse/route.ts` | POST disburse (Fineract withdrawal) |
| `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/reject/route.ts` | POST reject drawdown |
| `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/repayments/route.ts` | POST record repayment (Fineract deposit) |
| `app/(application)/leads/[id]/components/revolving-facility-tab.tsx` | Full facility management UI |
| `app/(application)/leads/[id]/components/drawdown-request-modal.tsx` | Request drawdown modal |
| `app/(application)/leads/[id]/components/drawdown-approve-modal.tsx` | Approve drawdown modal |
| `app/(application)/leads/[id]/components/drawdown-disburse-modal.tsx` | Disburse drawdown modal |
| `app/(application)/leads/[id]/components/drawdown-repayment-modal.tsx` | Record repayment modal |

---

## Task 1: Prisma Schema — Add Models and Enum Value

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `REVOLVING_CREDIT` to `FacilityType` enum**

In `prisma/schema.prisma`, find the `FacilityType` enum and add the new value:

```prisma
enum FacilityType {
  TERM_LOAN
  INVOICE_DISCOUNTING
  REVOLVING_CREDIT
}
```

- [ ] **Step 2: Add `fineractSavingsAccountId` field to `Lead` model**

In the `Lead` model, after the `fineractLoanId` field (line ~277), add:

```prisma
  fineractSavingsAccountId  Int?
```

Also add the relation at the end of the `Lead` model (after `stageApprovals` and before the closing `@@index` blocks):

```prisma
  revolving                  RevolvingCreditFacility?
```

- [ ] **Step 3: Add `revolvingCreditFacilities` relation to `Tenant` model**

In the `Tenant` model, add after the `chargeProducts` relation line:

```prisma
  revolvingCreditFacilities  RevolvingCreditFacility[]
```

- [ ] **Step 4: Add the three new models at the end of `prisma/schema.prisma`**

Paste the following after the last model in the file:

```prisma
enum RevolvingCreditDrawdownStatus {
  REQUESTED
  APPROVED
  DISBURSED
  REJECTED
}

model RevolvingCreditFacility {
  id                       String                    @id @default(cuid())
  leadId                   String                    @unique
  tenantId                 String
  creditLimit              Float
  availableBalance         Float
  fineractSavingsAccountId Int
  fineractSavingsAccountNo String?
  savingsProductId         Int
  activatedAt              DateTime                  @default(now())
  createdAt                DateTime                  @default(now())
  updatedAt                DateTime                  @updatedAt
  lead                     Lead                      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  tenant                   Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  drawdowns                RevolvingCreditDrawdown[]

  @@index([tenantId])
}

model RevolvingCreditDrawdown {
  id                   String                        @id @default(cuid())
  facilityId           String
  tenantId             String
  requestedAmount      Float
  approvedAmount       Float?
  disbursedAmount      Float?
  status               RevolvingCreditDrawdownStatus @default(REQUESTED)
  requestedByUserId    String
  requestedByUserName  String?
  approvedByUserId     String?
  approvedByUserName   String?
  disbursedByUserId    String?
  note                 String?
  fineractTransactionId String?
  requestedAt          DateTime                      @default(now())
  approvedAt           DateTime?
  disbursedAt          DateTime?
  rejectedAt           DateTime?
  rejectionReason      String?
  createdAt            DateTime                      @default(now())
  updatedAt            DateTime                      @updatedAt
  facility             RevolvingCreditFacility       @relation(fields: [facilityId], references: [id], onDelete: Cascade)
  repayments           RevolvingCreditRepayment[]

  @@index([facilityId])
  @@index([tenantId])
}

model RevolvingCreditRepayment {
  id                    String                  @id @default(cuid())
  drawdownId            String
  facilityId            String
  tenantId              String
  amount                Float
  recordedByUserId      String
  recordedByUserName    String?
  fineractTransactionId String?
  note                  String?
  repaidAt              DateTime                @default(now())
  createdAt             DateTime                @default(now())
  drawdown              RevolvingCreditDrawdown @relation(fields: [drawdownId], references: [id], onDelete: Cascade)

  @@index([facilityId])
  @@index([drawdownId])
}
```

- [ ] **Step 5: Generate and run migration**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npx prisma migrate dev --name revolving_credit_facility
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 6: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client ...` with no errors.

- [ ] **Step 7: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: no errors related to schema.

- [ ] **Step 8: Commit**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add revolving credit facility prisma schema"
```

---

## Task 2: Tenant Feature Flag

**Files:**
- Modify: `shared/types/tenant.ts`
- Modify: `lib/tenant-features.ts`

- [ ] **Step 1: Add `hasRevolvingCredit` to `TenantFeatures` interface**

In `shared/types/tenant.ts`, add after the `hasInvoiceDiscounting` line (~line 24):

```ts
  /** Enable revolving credit facility product in lead origination */
  hasRevolvingCredit: boolean;
```

- [ ] **Step 2: Add default value to `DEFAULT_FEATURES`**

In `shared/types/tenant.ts`, in the `DEFAULT_FEATURES` object, add after `hasInvoiceDiscounting: false,`:

```ts
  hasRevolvingCredit: false,
```

- [ ] **Step 3: Add helper function to `lib/tenant-features.ts`**

Append to `lib/tenant-features.ts`:

```ts
export function isRevolvingCreditEnabled(settings: unknown): boolean {
  return getTenantFeatures(settings).hasRevolvingCredit === true;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add shared/types/tenant.ts lib/tenant-features.ts
git commit -m "feat: add hasRevolvingCredit tenant feature flag"
```

---

## Task 3: Fineract Savings Service

**Files:**
- Create: `lib/fineract-savings-service.ts`

- [ ] **Step 1: Create the service file**

Create `lib/fineract-savings-service.ts` with the following content:

```ts
import { getFineractServiceWithSession } from "./fineract-api";
import { fetchFineractAPI } from "./api";

export interface CreateSavingsAccountParams {
  clientId: number;
  productId: number;
  submittedOnDate: string; // "dd MMMM yyyy"
  locale?: string;
  dateFormat?: string;
}

export interface SavingsAccountBalance {
  id: number;
  accountNo: string;
  status: { id: number; code: string; value: string };
  accountBalance: number;
  availableBalance: number;
}

export async function createSavingsAccount(
  params: CreateSavingsAccountParams
): Promise<{ savingsId: number; resourceId: number }> {
  const { clientId, productId, submittedOnDate, locale = "en", dateFormat = "dd MMMM yyyy" } = params;
  const result = await fetchFineractAPI("/savingsaccounts", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      productId,
      submittedOnDate,
      locale,
      dateFormat,
    }),
  });
  return { savingsId: result.savingsId, resourceId: result.resourceId };
}

export async function approveSavingsAccount(
  savingsId: number,
  approvedOnDate: string
): Promise<void> {
  await fetchFineractAPI(`/savingsaccounts/${savingsId}?command=approve`, {
    method: "POST",
    body: JSON.stringify({
      approvedOnDate,
      locale: "en",
      dateFormat: "dd MMMM yyyy",
    }),
  });
}

export async function activateSavingsAccount(
  savingsId: number,
  activatedOnDate: string
): Promise<void> {
  await fetchFineractAPI(`/savingsaccounts/${savingsId}?command=activate`, {
    method: "POST",
    body: JSON.stringify({
      activatedOnDate,
      locale: "en",
      dateFormat: "dd MMMM yyyy",
    }),
  });
}

export async function depositToSavingsAccount(
  savingsId: number,
  amount: number,
  transactionDate: string,
  note?: string
): Promise<{ transactionId: string }> {
  const result = await fetchFineractAPI(
    `/savingsaccounts/${savingsId}/transactions?command=deposit`,
    {
      method: "POST",
      body: JSON.stringify({
        transactionDate,
        transactionAmount: amount,
        locale: "en",
        dateFormat: "dd MMMM yyyy",
        ...(note ? { note } : {}),
      }),
    }
  );
  return { transactionId: String(result.resourceId) };
}

export async function withdrawFromSavingsAccount(
  savingsId: number,
  amount: number,
  transactionDate: string,
  note?: string
): Promise<{ transactionId: string }> {
  const result = await fetchFineractAPI(
    `/savingsaccounts/${savingsId}/transactions?command=withdrawal`,
    {
      method: "POST",
      body: JSON.stringify({
        transactionDate,
        transactionAmount: amount,
        locale: "en",
        dateFormat: "dd MMMM yyyy",
        ...(note ? { note } : {}),
      }),
    }
  );
  return { transactionId: String(result.resourceId) };
}

export async function getSavingsAccountBalance(
  savingsId: number
): Promise<SavingsAccountBalance> {
  const result = await fetchFineractAPI(`/savingsaccounts/${savingsId}`);
  return {
    id: result.id,
    accountNo: result.accountNo,
    status: result.status,
    accountBalance: result.summary?.accountBalance ?? 0,
    availableBalance: result.summary?.availableBalance ?? 0,
  };
}

export function formatFineractDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/fineract-savings-service.ts
git commit -m "feat: add fineract savings service"
```

---

## Task 4: State Machine — `activate_revolving` Action

**Files:**
- Modify: `lib/team-state-machine-service.ts`

- [ ] **Step 1: Add import for the savings service**

At the top of `lib/team-state-machine-service.ts`, after the existing imports, add:

```ts
import {
  createSavingsAccount,
  approveSavingsAccount,
  activateSavingsAccount,
  depositToSavingsAccount,
  formatFineractDate,
} from "./fineract-savings-service";
```

- [ ] **Step 2: Add `activate_revolving` case to `executeFineractAction`**

Find the `executeFineractAction` private static method. It has a `switch (action)` block with cases for `"approve"`, `"disburse"`, `"reject"`. Add the new case **before** the `default:` line:

```ts
      case "activate_revolving": {
        if (!lead?.fineractClientId) {
          throw new Error("Cannot activate revolving facility: lead has no Fineract client ID");
        }
        if (!lead?.savingsProductId) {
          throw new Error("Cannot activate revolving facility: no savings product selected on lead");
        }
        const creditLimit = lead?.requestedAmount;
        if (!creditLimit || creditLimit <= 0) {
          throw new Error("Cannot activate revolving facility: credit limit (requestedAmount) must be greater than 0");
        }

        const today = formatFineractDate(new Date());

        // 1. Create savings account
        const { savingsId } = await createSavingsAccount({
          clientId: lead.fineractClientId,
          productId: lead.savingsProductId,
          submittedOnDate: today,
        });

        // 2. Approve savings account
        await approveSavingsAccount(savingsId, today);

        // 3. Activate savings account
        await activateSavingsAccount(savingsId, today);

        // 4. Deposit credit limit as opening balance
        await depositToSavingsAccount(savingsId, creditLimit, today, "Revolving credit facility opening balance");

        // 5. Persist savings account ID on lead
        await prisma.lead.update({
          where: { id: lead.id },
          data: { fineractSavingsAccountId: savingsId },
        });

        // 6. Create RevolvingCreditFacility record
        await prisma.revolvingCreditFacility.create({
          data: {
            leadId: lead.id,
            tenantId: lead.tenantId,
            creditLimit,
            availableBalance: creditLimit,
            fineractSavingsAccountId: savingsId,
            savingsProductId: lead.savingsProductId,
          },
        });

        return `Revolving facility activated, savings account #${savingsId} opened with credit limit ${creditLimit}`;
      }
```

Note: the `lead` variable is already in scope inside `executeFineractAction` — it is fetched earlier in the method as `const lead = await prisma.lead.findUnique(...)`.

- [ ] **Step 3: Verify the lead object is fetched before the switch**

Search `lib/team-state-machine-service.ts` for `executeFineractAction`. Confirm that before the `switch (action)` line there is a `const lead = await prisma.lead.findUnique(...)` call. If the lead fetch does not include `savingsProductId` and `requestedAmount`, add them to the `select`:

```ts
const lead = await prisma.lead.findUnique({
  where: { id: leadId },
  select: {
    id: true,
    tenantId: true,
    fineractClientId: true,
    fineractLoanId: true,
    savingsProductId: true,
    requestedAmount: true,
    facilityType: true,
  },
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/team-state-machine-service.ts
git commit -m "feat: add activate_revolving fineract action to state machine"
```

---

## Task 5: Lead Wizard — Hide Schedule Tab for Revolving Credit

**Files:**
- Modify: `app/(application)/leads/new/components/new-lead-form.tsx`

- [ ] **Step 1: Detect revolving credit facility type from lead data**

In `new-lead-form.tsx`, find the block that sets `hideAffordability` (around line 254). After `const isAffordabilityOptional = !!tenantLocale.leadAffordabilityOptional;`, add:

```ts
  const [isRevolvingCredit, setIsRevolvingCredit] = useState(false);
```

- [ ] **Step 2: Set `isRevolvingCredit` when lead data is loaded**

Find where lead data is loaded and loan product data is fetched. Search for where `facilityType` is checked (around line 1878 in loan-terms-form callbacks). In `new-lead-form.tsx`, find the effect/callback that handles `detailsResult.data.facilityType`. After the existing `INVOICE_DISCOUNTING` check, add:

```ts
if (detailsResult.data.facilityType === "REVOLVING_CREDIT") {
  setIsRevolvingCredit(true);
} else {
  setIsRevolvingCredit(false);
}
```

If there is no existing place where `facilityType` is set on the form level, add it in the `useEffect` that loads the lead (search for `setCurrentLeadId` and nearby data fetching). After loading the lead details response, read `facilityType` from the response and call `setIsRevolvingCredit(data.facilityType === "REVOLVING_CREDIT")`.

- [ ] **Step 3: Adjust `tabsCount` and `tabsGridClass`**

Find the block (around line 346):

```ts
  const tabsCount = hideAffordability ? 5 : 6;
  const tabsGridClass = hideAffordability
    ? "grid-cols-5 lg:grid-cols-5"
    : "grid-cols-6 lg:grid-cols-6";
```

Replace with:

```ts
  const effectiveTabCount = hideAffordability
    ? (isRevolvingCredit ? 4 : 5)
    : (isRevolvingCredit ? 5 : 6);
  const tabsGridClass = `grid-cols-${effectiveTabCount} lg:grid-cols-${effectiveTabCount}`;
```

- [ ] **Step 4: Adjust `tabOrder` to exclude `"schedule"` for revolving credit**

Find (around line 1276):

```ts
    const tabOrder = hideAffordability
      ? ["client", "loan", "terms", "schedule", "contracts"]
      : ["client", "affordability", "loan", "terms", "schedule", "contracts"];
```

Replace with:

```ts
    const tabOrder = hideAffordability
      ? (isRevolvingCredit
          ? ["client", "loan", "terms", "contracts"]
          : ["client", "loan", "terms", "schedule", "contracts"])
      : (isRevolvingCredit
          ? ["client", "affordability", "loan", "terms", "contracts"]
          : ["client", "affordability", "loan", "terms", "schedule", "contracts"]);
```

- [ ] **Step 5: Hide the Schedule tab trigger and content**

Find the `<TabsContent value="schedule"` block. Wrap both the trigger and the content in `{!isRevolvingCredit && ( ... )}`. Do the same for the schedule `TabsTrigger`.

Search for `value="schedule"` — there will be a `TabsTrigger` and a `TabsContent`. Wrap each:

```tsx
{!isRevolvingCredit && (
  <TabsTrigger value="schedule" ...>
    ...
  </TabsTrigger>
)}
```

```tsx
{!isRevolvingCredit && (
  <TabsContent value="schedule" ...>
    ...
  </TabsContent>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/leads/new/components/new-lead-form.tsx"
git commit -m "feat: hide repayment schedule tab for revolving credit leads"
```

---

## Task 6: Loan Terms Form — Field Adjustments for Revolving Credit

**Files:**
- Modify: `app/(application)/leads/new/components/loan-terms-form.tsx`

- [ ] **Step 1: Accept `facilityType` as a prop or read from lead context**

`loan-terms-form.tsx` already has access to `loanDetails?.facilityType` from the lead data it fetches. Confirm by searching for `facilityType` in the file — it already checks `loanDetails?.facilityType === "INVOICE_DISCOUNTING"`. The same pattern works for `REVOLVING_CREDIT`.

- [ ] **Step 2: Relabel the amount field as "Credit Limit" for revolving credit**

Find the JSX that renders the principal/loan amount label. Search for `"Loan Amount"` or `"Principal"` in the file. Where the label text is set, add a conditional:

```tsx
{loanDetails?.facilityType === "REVOLVING_CREDIT" ? "Credit Limit" : "Loan Amount"}
```

- [ ] **Step 3: Hide interest rate, term, and repayment frequency for revolving credit**

Find the fields for interest rate (search for `interestRatePerPeriod` or `"Interest Rate"`), number of repayments / loan term (search for `numberOfRepayments` or `"Number of Repayments"`), and repayment frequency (search for `repaymentFrequency` or `"Repayment Every"`).

Wrap each field's JSX in:

```tsx
{loanDetails?.facilityType !== "REVOLVING_CREDIT" && (
  // ... existing field JSX
)}
```

- [ ] **Step 4: Show savings product selector for revolving credit**

Find where `savingsProductId` is handled (search for `savingsProductId` in the file). If there is already a savings product dropdown, make it visible when `facilityType === "REVOLVING_CREDIT"`:

```tsx
{loanDetails?.facilityType === "REVOLVING_CREDIT" && (
  // existing savings product select JSX, or add new one
)}
```

If no savings product selector exists, add a simple select that fetches `/api/fineract/savings-products` (you will create this endpoint in Task 7 — for now add the JSX with a placeholder fetch URL, and complete the wiring in Task 7).

```tsx
{loanDetails?.facilityType === "REVOLVING_CREDIT" && (
  <div className="space-y-2">
    <Label>Savings Product</Label>
    <select
      className="w-full border rounded px-3 py-2 text-sm"
      value={savingsProductId ?? ""}
      onChange={(e) => setSavingsProductId(Number(e.target.value))}
    >
      <option value="">Select savings product...</option>
      {savingsProducts.map((p: { id: number; name: string }) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  </div>
)}
```

Add the `savingsProducts` state near other local state in the component, and a `useEffect` to fetch when `facilityType === "REVOLVING_CREDIT"`:

```ts
const [savingsProducts, setSavingsProducts] = useState<{ id: number; name: string }[]>([]);

useEffect(() => {
  if (loanDetails?.facilityType !== "REVOLVING_CREDIT") return;
  fetch("/api/fineract/savings-products")
    .then((r) => r.json())
    .then((data) => setSavingsProducts(Array.isArray(data) ? data : []))
    .catch(() => {});
}, [loanDetails?.facilityType]);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/leads/new/components/loan-terms-form.tsx"
git commit -m "feat: adjust loan terms form fields for revolving credit"
```

---

## Task 7: Fineract Savings Products API Route

**Files:**
- Create: `app/api/fineract/savings-products/route.ts`

This is needed by the loan-terms-form savings product selector from Task 6.

- [ ] **Step 1: Create the route**

```ts
// app/api/fineract/savings-products/route.ts
import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const products = await fetchFineractAPI("/savingsproducts");
    const list = Array.isArray(products) ? products : [];
    return NextResponse.json(
      list.map((p: any) => ({ id: p.id, name: p.name }))
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch savings products" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/fineract/savings-products/route.ts
git commit -m "feat: add fineract savings products endpoint"
```

---

## Task 8: API Route — Facility (GET with balance sync)

**Files:**
- Create: `app/api/leads/[id]/revolving/facility/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/leads/[id]/revolving/facility/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSavingsAccountBalance } from "@/lib/fineract-savings-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const facility = await prisma.revolvingCreditFacility.findUnique({
      where: { leadId },
      include: {
        drawdowns: {
          orderBy: { requestedAt: "desc" },
          include: { repayments: { orderBy: { repaidAt: "desc" } } },
        },
      },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Sync available balance live from Fineract
    let availableBalance = facility.availableBalance;
    try {
      const balanceData = await getSavingsAccountBalance(facility.fineractSavingsAccountId);
      availableBalance = balanceData.availableBalance;
      // Update stored balance if it drifted
      if (availableBalance !== facility.availableBalance) {
        await prisma.revolvingCreditFacility.update({
          where: { id: facility.id },
          data: { availableBalance },
        });
      }
    } catch {
      // Non-blocking: use stored balance if Fineract is unreachable
    }

    return NextResponse.json({ ...facility, availableBalance });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch facility", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/leads/[id]/revolving/facility/route.ts"
git commit -m "feat: add revolving facility GET endpoint with live balance sync"
```

---

## Task 9: API Routes — Drawdowns (List + Create)

**Files:**
- Create: `app/api/leads/[id]/revolving/drawdowns/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/leads/[id]/revolving/drawdowns/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const facility = await prisma.revolvingCreditFacility.findUnique({
      where: { leadId },
    });
    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const drawdowns = await prisma.revolvingCreditDrawdown.findMany({
      where: { facilityId: facility.id },
      orderBy: { requestedAt: "desc" },
      include: { repayments: { orderBy: { repaidAt: "desc" } } },
    });

    return NextResponse.json({ drawdowns });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch drawdowns" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { requestedAmount, note } = body;

    if (!requestedAmount || requestedAmount <= 0) {
      return NextResponse.json({ error: "requestedAmount must be greater than 0" }, { status: 400 });
    }

    const facility = await prisma.revolvingCreditFacility.findUnique({
      where: { leadId },
    });
    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    if (requestedAmount > facility.availableBalance) {
      return NextResponse.json(
        { error: `Requested amount ${requestedAmount} exceeds available balance ${facility.availableBalance}` },
        { status: 400 }
      );
    }

    const drawdown = await prisma.revolvingCreditDrawdown.create({
      data: {
        facilityId: facility.id,
        tenantId: facility.tenantId,
        requestedAmount,
        note: note || null,
        requestedByUserId: session.user.id,
        requestedByUserName: session.user.name || null,
        status: "REQUESTED",
      },
    });

    return NextResponse.json({ drawdown }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create drawdown" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/leads/[id]/revolving/drawdowns/route.ts"
git commit -m "feat: add revolving drawdowns list and create endpoints"
```

---

## Task 10: API Routes — Drawdown Actions (Approve, Reject, Disburse)

**Files:**
- Create: `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/approve/route.ts`
- Create: `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/reject/route.ts`
- Create: `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/disburse/route.ts`

- [ ] **Step 1: Create approve route**

```ts
// app/api/leads/[id]/revolving/drawdowns/[drawdownId]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; drawdownId: string }> }
) {
  try {
    const { drawdownId } = await context.params;
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { approvedAmount, note } = body;

    const drawdown = await prisma.revolvingCreditDrawdown.findUnique({
      where: { id: drawdownId },
    });
    if (!drawdown) {
      return NextResponse.json({ error: "Drawdown not found" }, { status: 404 });
    }
    if (drawdown.status !== "REQUESTED") {
      return NextResponse.json(
        { error: `Cannot approve a drawdown in status ${drawdown.status}` },
        { status: 400 }
      );
    }

    const resolvedApprovedAmount = approvedAmount ?? drawdown.requestedAmount;
    if (resolvedApprovedAmount <= 0) {
      return NextResponse.json({ error: "approvedAmount must be greater than 0" }, { status: 400 });
    }

    const updated = await prisma.revolvingCreditDrawdown.update({
      where: { id: drawdownId },
      data: {
        status: "APPROVED",
        approvedAmount: resolvedApprovedAmount,
        approvedByUserId: session.user.id,
        approvedByUserName: session.user.name || null,
        approvedAt: new Date(),
        note: note || drawdown.note,
      },
    });

    return NextResponse.json({ drawdown: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to approve drawdown" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create reject route**

```ts
// app/api/leads/[id]/revolving/drawdowns/[drawdownId]/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; drawdownId: string }> }
) {
  try {
    const { drawdownId } = await context.params;
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { reason } = body;

    const drawdown = await prisma.revolvingCreditDrawdown.findUnique({
      where: { id: drawdownId },
    });
    if (!drawdown) {
      return NextResponse.json({ error: "Drawdown not found" }, { status: 404 });
    }
    if (!["REQUESTED", "APPROVED"].includes(drawdown.status)) {
      return NextResponse.json(
        { error: `Cannot reject a drawdown in status ${drawdown.status}` },
        { status: 400 }
      );
    }

    const updated = await prisma.revolvingCreditDrawdown.update({
      where: { id: drawdownId },
      data: {
        status: "REJECTED",
        rejectionReason: reason || null,
        rejectedAt: new Date(),
      },
    });

    return NextResponse.json({ drawdown: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reject drawdown" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create disburse route**

```ts
// app/api/leads/[id]/revolving/drawdowns/[drawdownId]/disburse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { withdrawFromSavingsAccount, formatFineractDate } from "@/lib/fineract-savings-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; drawdownId: string }> }
) {
  try {
    const { drawdownId } = await context.params;
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { note } = body;

    const drawdown = await prisma.revolvingCreditDrawdown.findUnique({
      where: { id: drawdownId },
      include: { facility: true },
    });
    if (!drawdown) {
      return NextResponse.json({ error: "Drawdown not found" }, { status: 404 });
    }
    if (drawdown.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Cannot disburse a drawdown in status ${drawdown.status}` },
        { status: 400 }
      );
    }

    const disbursedAmount = drawdown.approvedAmount!;
    const today = formatFineractDate(new Date());

    const { transactionId } = await withdrawFromSavingsAccount(
      drawdown.facility.fineractSavingsAccountId,
      disbursedAmount,
      today,
      note || `Drawdown disbursement #${drawdownId}`
    );

    const updated = await prisma.revolvingCreditDrawdown.update({
      where: { id: drawdownId },
      data: {
        status: "DISBURSED",
        disbursedAmount,
        disbursedByUserId: session.user.id,
        disbursedAt: new Date(),
        fineractTransactionId: transactionId,
      },
    });

    // Sync available balance on facility
    const newBalance = drawdown.facility.availableBalance - disbursedAmount;
    await prisma.revolvingCreditFacility.update({
      where: { id: drawdown.facilityId },
      data: { availableBalance: Math.max(0, newBalance) },
    });

    return NextResponse.json({ drawdown: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to disburse drawdown", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/api/leads/[id]/revolving/drawdowns/[drawdownId]/"
git commit -m "feat: add drawdown approve, reject, and disburse endpoints"
```

---

## Task 11: API Route — Repayments

**Files:**
- Create: `app/api/leads/[id]/revolving/drawdowns/[drawdownId]/repayments/route.ts`

- [ ] **Step 1: Create repayments route**

```ts
// app/api/leads/[id]/revolving/drawdowns/[drawdownId]/repayments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { depositToSavingsAccount, formatFineractDate } from "@/lib/fineract-savings-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; drawdownId: string }> }
) {
  try {
    const { drawdownId } = await context.params;
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, note } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
    }

    const drawdown = await prisma.revolvingCreditDrawdown.findUnique({
      where: { id: drawdownId },
      include: { facility: true },
    });
    if (!drawdown) {
      return NextResponse.json({ error: "Drawdown not found" }, { status: 404 });
    }
    if (drawdown.status !== "DISBURSED") {
      return NextResponse.json(
        { error: `Can only record repayments against DISBURSED drawdowns, current status: ${drawdown.status}` },
        { status: 400 }
      );
    }

    const today = formatFineractDate(new Date());

    const { transactionId } = await depositToSavingsAccount(
      drawdown.facility.fineractSavingsAccountId,
      amount,
      today,
      note || `Repayment for drawdown #${drawdownId}`
    );

    const repayment = await prisma.revolvingCreditRepayment.create({
      data: {
        drawdownId,
        facilityId: drawdown.facilityId,
        tenantId: drawdown.tenantId,
        amount,
        recordedByUserId: session.user.id,
        recordedByUserName: session.user.name || null,
        fineractTransactionId: transactionId,
        note: note || null,
      },
    });

    // Sync available balance on facility
    const newBalance = drawdown.facility.availableBalance + amount;
    const cappedBalance = Math.min(newBalance, drawdown.facility.creditLimit);
    await prisma.revolvingCreditFacility.update({
      where: { id: drawdown.facilityId },
      data: { availableBalance: cappedBalance },
    });

    return NextResponse.json({ repayment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to record repayment", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/leads/[id]/revolving/drawdowns/[drawdownId]/repayments/route.ts"
git commit -m "feat: add repayment recording endpoint"
```

---

## Task 12: UI Modals

**Files:**
- Create: `app/(application)/leads/[id]/components/drawdown-request-modal.tsx`
- Create: `app/(application)/leads/[id]/components/drawdown-approve-modal.tsx`
- Create: `app/(application)/leads/[id]/components/drawdown-disburse-modal.tsx`
- Create: `app/(application)/leads/[id]/components/drawdown-repayment-modal.tsx`

- [ ] **Step 1: Create Request Drawdown modal**

```tsx
// app/(application)/leads/[id]/components/drawdown-request-modal.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface DrawdownRequestModalProps {
  leadId: string;
  availableBalance: number;
  currencySymbol?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DrawdownRequestModal({
  leadId, availableBalance, currencySymbol = "", open, onClose, onSuccess,
}: DrawdownRequestModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive amount", variant: "destructive" });
      return;
    }
    if (parsed > availableBalance) {
      toast({ title: "Exceeds balance", description: `Maximum available: ${currencySymbol}${availableBalance.toLocaleString()}`, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/revolving/drawdowns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedAmount: parsed, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request drawdown");
      toast({ title: "Drawdown requested" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Drawdown</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Available balance: <span className="font-semibold">{currencySymbol}{availableBalance.toLocaleString()}</span>
          </p>
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input type="number" min="1" max={availableBalance} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Submitting..." : "Submit Request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create Approve Drawdown modal**

```tsx
// app/(application)/leads/[id]/components/drawdown-approve-modal.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface DrawdownApproveModalProps {
  leadId: string;
  drawdownId: string;
  requestedAmount: number;
  currencySymbol?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DrawdownApproveModal({
  leadId, drawdownId, requestedAmount, currencySymbol = "", open, onClose, onSuccess,
}: DrawdownApproveModalProps) {
  const { toast } = useToast();
  const [approvedAmount, setApprovedAmount] = useState(String(requestedAmount));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(approvedAmount);
    if (!parsed || parsed <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/revolving/drawdowns/${drawdownId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedAmount: parsed, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      toast({ title: "Drawdown approved" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Drawdown</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Requested: <span className="font-semibold">{currencySymbol}{requestedAmount.toLocaleString()}</span>
          </p>
          <div className="space-y-1">
            <Label>Approved Amount</Label>
            <Input type="number" min="1" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Approving..." : "Approve"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create Disburse Drawdown modal**

```tsx
// app/(application)/leads/[id]/components/drawdown-disburse-modal.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface DrawdownDisburseModalProps {
  leadId: string;
  drawdownId: string;
  approvedAmount: number;
  currencySymbol?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DrawdownDisburseModal({
  leadId, drawdownId, approvedAmount, currencySymbol = "", open, onClose, onSuccess,
}: DrawdownDisburseModalProps) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/revolving/drawdowns/${drawdownId}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disburse");
      toast({ title: "Drawdown disbursed" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disburse Drawdown</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm">
            This will withdraw <span className="font-semibold">{currencySymbol}{approvedAmount.toLocaleString()}</span> from the savings account in Fineract.
          </p>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Disbursing..." : "Confirm Disburse"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create Record Repayment modal**

```tsx
// app/(application)/leads/[id]/components/drawdown-repayment-modal.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface DrawdownRepaymentModalProps {
  leadId: string;
  drawdownId: string;
  disbursedAmount: number;
  currencySymbol?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DrawdownRepaymentModal({
  leadId, drawdownId, disbursedAmount, currencySymbol = "", open, onClose, onSuccess,
}: DrawdownRepaymentModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/revolving/drawdowns/${drawdownId}/repayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record repayment");
      toast({ title: "Repayment recorded" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Repayment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Original disbursement: <span className="font-semibold">{currencySymbol}{disbursedAmount.toLocaleString()}</span>
          </p>
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input type="number" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Recording..." : "Record Repayment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/leads/[id]/components/drawdown-request-modal.tsx" \
        "app/(application)/leads/[id]/components/drawdown-approve-modal.tsx" \
        "app/(application)/leads/[id]/components/drawdown-disburse-modal.tsx" \
        "app/(application)/leads/[id]/components/drawdown-repayment-modal.tsx"
git commit -m "feat: add drawdown and repayment modals"
```

---

## Task 13: UI — Revolving Facility Tab Component

**Files:**
- Create: `app/(application)/leads/[id]/components/revolving-facility-tab.tsx`

- [ ] **Step 1: Create the facility tab component**

```tsx
// app/(application)/leads/[id]/components/revolving-facility-tab.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, ChevronDown, ChevronRight } from "lucide-react";
import { DrawdownRequestModal } from "./drawdown-request-modal";
import { DrawdownApproveModal } from "./drawdown-approve-modal";
import { DrawdownDisburseModal } from "./drawdown-disburse-modal";
import { DrawdownRepaymentModal } from "./drawdown-repayment-modal";

interface Repayment {
  id: string;
  amount: number;
  repaidAt: string;
  fineractTransactionId?: string;
  note?: string;
}

interface Drawdown {
  id: string;
  status: "REQUESTED" | "APPROVED" | "DISBURSED" | "REJECTED";
  requestedAmount: number;
  approvedAmount?: number;
  disbursedAmount?: number;
  requestedByUserName?: string;
  approvedByUserName?: string;
  disbursedByUserName?: string;
  note?: string;
  rejectionReason?: string;
  requestedAt: string;
  approvedAt?: string;
  disbursedAt?: string;
  repayments: Repayment[];
}

interface Facility {
  id: string;
  creditLimit: number;
  availableBalance: number;
  fineractSavingsAccountNo?: string;
  drawdowns: Drawdown[];
}

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DISBURSED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface RevolvingFacilityTabProps {
  leadId: string;
  currencySymbol?: string;
  readOnly?: boolean;
}

export function RevolvingFacilityTab({ leadId, currencySymbol = "", readOnly = false }: RevolvingFacilityTabProps) {
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDrawdowns, setExpandedDrawdowns] = useState<Set<string>>(new Set());

  const [requestOpen, setRequestOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Drawdown | null>(null);
  const [disburseTarget, setDisburseTarget] = useState<Drawdown | null>(null);
  const [repayTarget, setRepayTarget] = useState<Drawdown | null>(null);

  const fetchFacility = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/leads/${leadId}/revolving/facility`);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to load facility");
        return;
      }
      const data = await res.json();
      setFacility(data);
      setError(null);
    } catch {
      setError("Failed to load facility");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchFacility(); }, [fetchFacility]);

  const toggleDrawdown = (id: string) => {
    setExpandedDrawdowns((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (error) return <div className="text-sm text-destructive py-4">{error}</div>;
  if (!facility) return <div className="text-sm text-muted-foreground py-4">Facility not yet activated.</div>;

  const drawnAmount = facility.creditLimit - facility.availableBalance;
  const utilizationPct = facility.creditLimit > 0 ? Math.round((drawnAmount / facility.creditLimit) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Revolving Credit Facility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Credit Limit</p>
              <p className="text-lg font-semibold">{currencySymbol}{facility.creditLimit.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-lg font-semibold text-green-600">{currencySymbol}{facility.availableBalance.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Drawn</p>
              <p className="text-lg font-semibold text-orange-600">{currencySymbol}{drawnAmount.toLocaleString()}</p>
            </div>
          </div>
          {/* Utilisation bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all"
              style={{ width: `${utilizationPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{utilizationPct}% utilized</p>
          {facility.fineractSavingsAccountNo && (
            <p className="text-xs text-muted-foreground mt-2">Account: <span className="font-mono">{facility.fineractSavingsAccountNo}</span></p>
          )}
        </CardContent>
      </Card>

      {/* Drawdowns */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Drawdowns</h3>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
            <PlusCircle className="h-3.5 w-3.5 mr-1" />
            Request Drawdown
          </Button>
        )}
      </div>

      {facility.drawdowns.length === 0 && (
        <p className="text-sm text-muted-foreground">No drawdowns yet.</p>
      )}

      <div className="space-y-2">
        {facility.drawdowns.map((d) => (
          <Card key={d.id} className="overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/40"
              onClick={() => toggleDrawdown(d.id)}
            >
              <div className="flex items-center gap-3">
                {expandedDrawdowns.has(d.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium text-sm">{currencySymbol}{d.requestedAmount.toLocaleString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</span>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(d.requestedAt).toLocaleDateString()}</span>
            </div>

            {expandedDrawdowns.has(d.id) && (
              <div className="px-4 pb-4 border-t space-y-3">
                <div className="grid grid-cols-2 gap-2 pt-3 text-xs">
                  <div><span className="text-muted-foreground">Requested by: </span>{d.requestedByUserName || "—"}</div>
                  {d.approvedAmount && <div><span className="text-muted-foreground">Approved: </span>{currencySymbol}{d.approvedAmount.toLocaleString()}</div>}
                  {d.disbursedAmount && <div><span className="text-muted-foreground">Disbursed: </span>{currencySymbol}{d.disbursedAmount.toLocaleString()}</div>}
                  {d.rejectionReason && <div className="col-span-2"><span className="text-muted-foreground">Rejection reason: </span>{d.rejectionReason}</div>}
                  {d.note && <div className="col-span-2"><span className="text-muted-foreground">Note: </span>{d.note}</div>}
                </div>

                {/* Repayments */}
                {d.status === "DISBURSED" && d.repayments.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Repayments</p>
                    <div className="space-y-1">
                      {d.repayments.map((r) => (
                        <div key={r.id} className="flex justify-between text-xs bg-muted/40 rounded px-2 py-1">
                          <span>{currencySymbol}{r.amount.toLocaleString()}</span>
                          <span className="text-muted-foreground">{new Date(r.repaidAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!readOnly && (
                  <div className="flex gap-2 flex-wrap">
                    {d.status === "REQUESTED" && (
                      <>
                        <Button size="sm" onClick={() => setApproveTarget(d)}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={async () => {
                          await fetch(`/api/leads/${leadId}/revolving/drawdowns/${d.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
                          fetchFacility();
                        }}>Reject</Button>
                      </>
                    )}
                    {d.status === "APPROVED" && (
                      <Button size="sm" onClick={() => setDisburseTarget(d)}>Disburse</Button>
                    )}
                    {d.status === "DISBURSED" && (
                      <Button size="sm" variant="outline" onClick={() => setRepayTarget(d)}>Record Repayment</Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Modals */}
      <DrawdownRequestModal
        leadId={leadId}
        availableBalance={facility.availableBalance}
        currencySymbol={currencySymbol}
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSuccess={fetchFacility}
      />
      {approveTarget && (
        <DrawdownApproveModal
          leadId={leadId}
          drawdownId={approveTarget.id}
          requestedAmount={approveTarget.requestedAmount}
          currencySymbol={currencySymbol}
          open={!!approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={() => { fetchFacility(); setApproveTarget(null); }}
        />
      )}
      {disburseTarget && (
        <DrawdownDisburseModal
          leadId={leadId}
          drawdownId={disburseTarget.id}
          approvedAmount={disburseTarget.approvedAmount!}
          currencySymbol={currencySymbol}
          open={!!disburseTarget}
          onClose={() => setDisburseTarget(null)}
          onSuccess={() => { fetchFacility(); setDisburseTarget(null); }}
        />
      )}
      {repayTarget && (
        <DrawdownRepaymentModal
          leadId={leadId}
          drawdownId={repayTarget.id}
          disbursedAmount={repayTarget.disbursedAmount!}
          currencySymbol={currencySymbol}
          open={!!repayTarget}
          onClose={() => setRepayTarget(null)}
          onSuccess={() => { fetchFacility(); setRepayTarget(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(application)/leads/[id]/components/revolving-facility-tab.tsx"
git commit -m "feat: add revolving facility tab UI component"
```

---

## Task 14: Wire Facility Tab into Lead Detail Page

**Files:**
- Modify: `app/(application)/leads/[id]/components/lead-detail-tabs.tsx`
- Modify: `app/(application)/leads/[id]/page.tsx`

- [ ] **Step 1: Add `facilityType` and `currencySymbol` props to `LeadDetailTabs`**

In `lead-detail-tabs.tsx`, find the `LeadDetailTabsProps` interface and add:

```ts
  facilityType?: string | null;
  currencySymbol?: string;
```

- [ ] **Step 2: Add the Facility tab to the TABS array conditionally**

In `lead-detail-tabs.tsx`, in the `LeadDetailTabs` function body, add a computed tabs array:

```tsx
  const tabs = facilityType === "REVOLVING_CREDIT"
    ? [...TABS, { value: "facility", label: "Facility", shortLabel: "Facility" }]
    : TABS;
```

Replace all usages of `TABS` inside the component with `tabs`.

- [ ] **Step 3: Import and render the facility tab content**

Add the import at the top of `lead-detail-tabs.tsx`:

```ts
import { RevolvingFacilityTab } from "./revolving-facility-tab";
```

Inside the `<Tabs>` content section, after the last existing `<TabsContent>`, add:

```tsx
{facilityType === "REVOLVING_CREDIT" && (
  <TabsContent value="facility" className="mt-0">
    <RevolvingFacilityTab
      leadId={leadId}
      currencySymbol={currencySymbol}
      readOnly={readOnly}
    />
  </TabsContent>
)}
```

Also add the tab trigger inside `<TabsList>` (after existing triggers, conditional on `facilityType`):

```tsx
{facilityType === "REVOLVING_CREDIT" && (
  <TabsTrigger value="facility">Facility</TabsTrigger>
)}
```

- [ ] **Step 4: Pass `facilityType` from `page.tsx` to `LeadDetailTabs`**

In `app/(application)/leads/[id]/page.tsx`, find the `<LeadDetailTabs ...>` component and add the `facilityType` prop:

```tsx
<LeadDetailTabs
  ...
  facilityType={lead.facilityType ?? null}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

1. Start the dev server: `npm run dev`
2. Navigate to an existing active lead (term loan) — confirm the Facility tab does NOT appear
3. Create a new lead, select a REVOLVING_CREDIT product — confirm the Schedule tab is hidden
4. After activation, confirm the Facility tab appears on the lead detail page with the credit limit and `Request Drawdown` button

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/leads/[id]/components/lead-detail-tabs.tsx" \
        "app/(application)/leads/[id]/page.tsx"
git commit -m "feat: wire revolving facility tab into lead detail page"
```

---

## Self-Review Checklist

- [x] All spec sections covered: schema, feature flag, savings service, state machine, wizard tab hiding, loan terms adjustments, API routes (facility, drawdowns, approve, reject, disburse, repayments), UI tab and modals
- [x] No TBD or TODO placeholders in any step
- [x] `formatFineractDate` defined in Task 3 and used consistently in Tasks 4, 10, 11
- [x] `RevolvingCreditFacility`, `RevolvingCreditDrawdown`, `RevolvingCreditRepayment` defined in Task 1 and referenced correctly in all API routes
- [x] `facilityType` prop threaded from `page.tsx` → `LeadDetailTabs` → conditional render
- [x] `fineractSavingsAccountId` persisted on `Lead` in state machine (Task 4) and read from `RevolvingCreditFacility` in disburse/repayment routes
