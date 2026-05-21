# Credit Facility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Credit Facility feature that groups multiple real Fineract loans under a shared credit limit, expiry, and drawdown tranche cap — stored entirely in Fineract datatables, enforced in Next.js server actions.

**Architecture:** Two Fineract datatables (`credit_facility` on `m_client`, multi-row; `credit_facility_loan` on `m_loan`, single-row) store all facility domain data. Server actions enforce credit limit, expiry, and tranche rules before loan creation and disbursement. No new Prisma models.

**Tech Stack:** Next.js 14 App Router, Server Actions, `fetchFineractAPI` from `lib/api.ts`, `formatFineractDate` from `lib/fineract-savings-service.ts`, `date-fns`, Radix UI + Tailwind (shadcn/ui components), Fineract REST API.

**Note on testing:** This project has no test framework. Each task ends with a TypeScript build check (`npx tsc --noEmit`) and a manual smoke test description instead of automated tests.

---

## File Map

**New files:**
- `lib/fineract-credit-facility.ts` — all Fineract datatable CRUD + validation logic
- `app/actions/credit-facility-actions.ts` — server actions wrapping the lib
- `components/credit-facility/facility-toggle.tsx` — "Link to Credit Facility" toggle UI
- `components/credit-facility/facility-banner.tsx` — banner for lead detail page
- `components/credit-facility/facility-section.tsx` — section for loan detail page
- `app/(application)/clients/[id]/components/client-facility.tsx` — Facility tab for client detail

**Modified files:**
- `app/(application)/leads/new/components/loan-terms-form.tsx` — add facility toggle
- `app/(application)/leads/new/components/new-lead-form.tsx` — call facility server action after lead creation
- `lib/team-state-machine-service.ts` — approve hook (activate facility) + disburse hook (validate + update counters)
- `app/(application)/leads/[id]/components/lead-detail-tabs.tsx` — render facility banner
- `app/(application)/clients/[id]/loans/[loanId]/components/client-loan-details.tsx` — render facility section
- `app/(application)/clients/[id]/page.tsx` — add Facility tab
- `app/(application)/organization/features/page.tsx` — add "Initialize Credit Facility" button

---

## Task 1: Fineract Credit Facility Service

**Files:**
- Create: `lib/fineract-credit-facility.ts`

- [ ] **Step 1: Create the service file**

```typescript
// lib/fineract-credit-facility.ts
import { fetchFineractAPI } from "@/lib/api";
import { formatFineractDate } from "@/lib/fineract-savings-service";
import { addMonths } from "date-fns";

export interface CreditFacility {
  id: number;           // Fineract datatable row id (used for PUT)
  client_id: number;
  facility_ref: string;
  credit_limit: number;
  tenor_months: number;
  drawdown_tranches: number;
  currency_code: string;
  utilized_amount: number;
  disbursed_tranches: number;
  status: "PENDING" | "ACTIVE" | "CLOSED";
  created_date: string | number[]; // Fineract may return arrays [yyyy, m, d]
}

export interface CreditFacilityLoan {
  id: number;
  loan_id: number;
  facility_ref: string;
}

export interface CreateFacilityData {
  creditLimit: number;
  tenorMonths: number;
  drawdownTranches: number;
  currencyCode: string;
}

const DATE_FORMAT = "dd MMMM yyyy";
const LOCALE = "en";

// Parse Fineract date (may be [yyyy, m, d] array or string)
function parseFineractDate(d: string | number[]): Date {
  if (Array.isArray(d)) return new Date(d[0], d[1] - 1, d[2]);
  return new Date(d);
}

export async function registerCreditFacilityDatatables(): Promise<void> {
  const tables = [
    {
      datatableName: "credit_facility",
      apptableName: "m_client",
      multiRow: true,
      columns: [
        { name: "facility_ref",       type: "String",  length: 50, mandatory: true },
        { name: "credit_limit",       type: "Decimal",             mandatory: true },
        { name: "tenor_months",       type: "Number",              mandatory: true },
        { name: "drawdown_tranches",  type: "Number",              mandatory: true },
        { name: "currency_code",      type: "String",  length: 10, mandatory: true },
        { name: "utilized_amount",    type: "Decimal",             mandatory: true },
        { name: "disbursed_tranches", type: "Number",              mandatory: true },
        { name: "status",             type: "String",  length: 10, mandatory: true },
        { name: "created_date",       type: "Date",                mandatory: true },
      ],
    },
    {
      datatableName: "credit_facility_loan",
      apptableName: "m_loan",
      multiRow: false,
      columns: [
        { name: "facility_ref", type: "String", length: 50, mandatory: true },
      ],
    },
  ];

  for (const table of tables) {
    try {
      await fetchFineractAPI("/datatables", {
        method: "POST",
        body: JSON.stringify(table),
      });
    } catch (e: any) {
      // Idempotent: ignore "already exists" errors
      const msg = e?.message ?? "";
      if (!msg.includes("already") && !msg.includes("exist") && !msg.includes("409")) {
        throw e;
      }
    }
  }
}

export async function createFacility(
  clientId: number,
  data: CreateFacilityData
): Promise<{ datatableId: number; facilityRef: string }> {
  const facilityRef = crypto.randomUUID();
  const result = await fetchFineractAPI(`/datatables/credit_facility/${clientId}`, {
    method: "POST",
    body: JSON.stringify({
      facility_ref: facilityRef,
      credit_limit: data.creditLimit,
      tenor_months: data.tenorMonths,
      drawdown_tranches: data.drawdownTranches,
      currency_code: data.currencyCode,
      utilized_amount: 0,
      disbursed_tranches: 0,
      status: "PENDING",
      created_date: formatFineractDate(new Date()),
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
    }),
  });
  return { datatableId: result.resourceId, facilityRef };
}

export async function getActiveFacilityForClient(
  clientId: number
): Promise<CreditFacility | null> {
  try {
    const rows: CreditFacility[] = await fetchFineractAPI(
      `/datatables/credit_facility/${clientId}`
    );
    if (!Array.isArray(rows)) return null;
    return rows.find((r) => r.status === "ACTIVE") ?? null;
  } catch {
    return null;
  }
}

export async function getFacilityByRef(
  clientId: number,
  facilityRef: string
): Promise<CreditFacility | null> {
  try {
    const rows: CreditFacility[] = await fetchFineractAPI(
      `/datatables/credit_facility/${clientId}`
    );
    if (!Array.isArray(rows)) return null;
    return rows.find((r) => r.facility_ref === facilityRef) ?? null;
  } catch {
    return null;
  }
}

export async function updateFacility(
  clientId: number,
  datatableId: number,
  updates: Partial<Pick<CreditFacility, "status" | "utilized_amount" | "disbursed_tranches">>
): Promise<void> {
  await fetchFineractAPI(`/datatables/credit_facility/${clientId}/${datatableId}`, {
    method: "PUT",
    body: JSON.stringify({ ...updates, locale: LOCALE }),
  });
}

export async function createFacilityLoanLink(
  loanId: number,
  facilityRef: string
): Promise<void> {
  await fetchFineractAPI(`/datatables/credit_facility_loan/${loanId}`, {
    method: "POST",
    body: JSON.stringify({ facility_ref: facilityRef, locale: LOCALE }),
  });
}

export async function getFacilityLoanLink(
  loanId: number
): Promise<CreditFacilityLoan | null> {
  try {
    const result = await fetchFineractAPI(`/datatables/credit_facility_loan/${loanId}`);
    if (!result || !result.facility_ref) return null;
    return result as CreditFacilityLoan;
  } catch {
    return null;
  }
}

export function isFacilityExpired(facility: CreditFacility): boolean {
  const created = parseFineractDate(facility.created_date);
  const expiry = addMonths(created, facility.tenor_months);
  return new Date() >= expiry;
}

export function validateFacilityForDisbursement(
  facility: CreditFacility,
  loanAmount: number
): { valid: true } | { valid: false; error: string } {
  if (facility.status !== "ACTIVE") {
    return { valid: false, error: "Credit facility is not active" };
  }
  if (isFacilityExpired(facility)) {
    return { valid: false, error: "Credit facility has expired" };
  }
  const available = facility.credit_limit - facility.utilized_amount;
  if (loanAmount > available) {
    return {
      valid: false,
      error: `Disbursement exceeds facility available balance ($${available.toLocaleString()})`,
    };
  }
  if (facility.disbursed_tranches >= facility.drawdown_tranches) {
    return {
      valid: false,
      error: `Maximum drawdown tranches reached (${facility.disbursed_tranches} / ${facility.drawdown_tranches})`,
    };
  }
  return { valid: true };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `lib/fineract-credit-facility.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/fineract-credit-facility.ts
git commit -m "feat: add Fineract credit facility datatable service"
```

---

## Task 2: Credit Facility Server Actions

**Files:**
- Create: `app/actions/credit-facility-actions.ts`

- [ ] **Step 1: Create the server actions file**

```typescript
// app/actions/credit-facility-actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import {
  registerCreditFacilityDatatables,
  createFacility,
  createFacilityLoanLink,
  getActiveFacilityForClient,
  getFacilityByRef,
  getFacilityLoanLink,
  updateFacility,
  isFacilityExpired,
  type CreateFacilityData,
  type CreditFacility,
} from "@/lib/fineract-credit-facility";

export async function setupCreditFacilityDatatables(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await registerCreditFacilityDatatables();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to register datatables" };
  }
}

/**
 * Called after a new facility loan is created.
 * Reads fineractClientId + fineractLoanId from the lead record.
 * Creates the credit_facility datatable entry and links the loan.
 */
export async function createCreditFacilityForLead(
  leadId: string,
  facilityData: CreateFacilityData
): Promise<{ success: boolean; facilityRef?: string; error?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { fineractClientId: true, fineractLoanId: true },
  });

  if (!lead?.fineractClientId || !lead?.fineractLoanId) {
    return { success: false, error: "Lead missing Fineract IDs — submit the loan first" };
  }

  try {
    const { facilityRef } = await createFacility(lead.fineractClientId, facilityData);
    await createFacilityLoanLink(lead.fineractLoanId, facilityRef);
    return { success: true, facilityRef };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to create credit facility" };
  }
}

/**
 * Links an existing active facility to a newly created loan.
 * Validates expiry and tranche/credit-limit rules before linking.
 * Called after loan creation when officer chose an existing facility.
 */
export async function linkLoanToExistingFacility(
  leadId: string,
  loanAmount: number
): Promise<{ success: boolean; error?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { fineractClientId: true, fineractLoanId: true },
  });

  if (!lead?.fineractClientId || !lead?.fineractLoanId) {
    return { success: false, error: "Lead missing Fineract IDs" };
  }

  const facility = await getActiveFacilityForClient(lead.fineractClientId);
  if (!facility) {
    return { success: false, error: "No active credit facility found for this client" };
  }

  // Pre-link validation (same rules as disbursement, but we use committed amount here)
  if (isFacilityExpired(facility)) {
    return { success: false, error: "Credit facility has expired" };
  }
  const available = facility.credit_limit - facility.utilized_amount;
  if (loanAmount > available) {
    return {
      success: false,
      error: `Loan amount exceeds facility available balance ($${available.toLocaleString()})`,
    };
  }
  if (facility.disbursed_tranches >= facility.drawdown_tranches) {
    return {
      success: false,
      error: `Maximum drawdown tranches reached (${facility.disbursed_tranches} / ${facility.drawdown_tranches})`,
    };
  }

  try {
    await createFacilityLoanLink(lead.fineractLoanId, facility.facility_ref);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to link loan to facility" };
  }
}

/**
 * Fetches the active credit facility for a client.
 */
export async function getActiveFacility(
  fineractClientId: number
): Promise<CreditFacility | null> {
  return getActiveFacilityForClient(fineractClientId);
}

/**
 * Fetches the credit facility linked to a specific Fineract loan.
 * Returns null if the loan is not under a facility.
 */
export async function getFacilityForLoan(
  fineractLoanId: number,
  fineractClientId: number
): Promise<CreditFacility | null> {
  const link = await getFacilityLoanLink(fineractLoanId);
  if (!link) return null;
  return getFacilityByRef(fineractClientId, link.facility_ref);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `app/actions/credit-facility-actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/actions/credit-facility-actions.ts
git commit -m "feat: add credit facility server actions"
```

---

## Task 3: Facility Toggle UI Component

**Files:**
- Create: `components/credit-facility/facility-toggle.tsx`

- [ ] **Step 1: Create the toggle component**

```tsx
// components/credit-facility/facility-toggle.tsx
"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { getActiveFacility } from "@/app/actions/credit-facility-actions";
import type { CreditFacility, CreateFacilityData } from "@/lib/fineract-credit-facility";
import { addMonths, format } from "date-fns";

interface FacilityToggleProps {
  fineractClientId: number | null | undefined;
  loanAmount: number;
  currencyCode?: string;
  onChange: (data: { mode: "create"; facility: CreateFacilityData } | { mode: "link" } | null) => void;
}

function parseFineractDate(d: string | number[]): Date {
  if (Array.isArray(d)) return new Date(d[0], d[1] - 1, d[2]);
  return new Date(d);
}

export function FacilityToggle({ fineractClientId, loanAmount, currencyCode = "USD", onChange }: FacilityToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingFacility, setExistingFacility] = useState<CreditFacility | null>(null);
  const [checked, setChecked] = useState(false);

  // New facility form state
  const [creditLimit, setCreditLimit] = useState<string>("");
  const [tenorMonths, setTenorMonths] = useState<string>("12");
  const [drawdownTranches, setDrawdownTranches] = useState<string>("5");

  useEffect(() => {
    if (!enabled || !fineractClientId || checked) return;
    setLoading(true);
    getActiveFacility(fineractClientId).then((f) => {
      setExistingFacility(f);
      setChecked(true);
      setLoading(false);
    });
  }, [enabled, fineractClientId, checked]);

  useEffect(() => {
    if (!enabled) {
      onChange(null);
      return;
    }
    if (existingFacility) {
      onChange({ mode: "link" });
      return;
    }
    const limit = parseFloat(creditLimit);
    const tenor = parseInt(tenorMonths, 10);
    const tranches = parseInt(drawdownTranches, 10);
    if (limit > 0 && tenor > 0 && tranches > 0) {
      onChange({
        mode: "create",
        facility: {
          creditLimit: limit,
          tenorMonths: tenor,
          drawdownTranches: tranches,
          currencyCode,
        },
      });
    } else {
      onChange(null);
    }
  }, [enabled, existingFacility, creditLimit, tenorMonths, drawdownTranches, currencyCode]);

  const handleToggle = (val: boolean) => {
    setEnabled(val);
    if (!val) {
      setChecked(false);
      setExistingFacility(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Switch id="facility-toggle" checked={enabled} onCheckedChange={handleToggle} />
        <Label htmlFor="facility-toggle" className="cursor-pointer font-medium">
          Link to Credit Facility
        </Label>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {enabled && !loading && existingFacility && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                {existingFacility.status}
              </Badge>
              <span className="text-sm font-medium">Active Credit Facility</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <span>Limit: <strong className="text-foreground">{existingFacility.currency_code} {existingFacility.credit_limit.toLocaleString()}</strong></span>
              <span>Available: <strong className="text-foreground">{existingFacility.currency_code} {(existingFacility.credit_limit - existingFacility.utilized_amount).toLocaleString()}</strong></span>
              <span>Tranches: <strong className="text-foreground">{existingFacility.disbursed_tranches} / {existingFacility.drawdown_tranches}</strong></span>
              <span>Expires: <strong className="text-foreground">{format(addMonths(parseFineractDate(existingFacility.created_date), existingFacility.tenor_months), "MMM yyyy")}</strong></span>
            </div>
            {loanAmount > existingFacility.credit_limit - existingFacility.utilized_amount && (
              <div className="mt-2 flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                Loan amount exceeds available balance
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {enabled && !loading && !existingFacility && checked && (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-3">No active facility — create one for this client:</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cf-limit" className="text-xs">Credit Limit ({currencyCode})</Label>
                <Input
                  id="cf-limit"
                  type="number"
                  min={0}
                  placeholder="e.g. 100000"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cf-tenor" className="text-xs">Tenor (months)</Label>
                <Input
                  id="cf-tenor"
                  type="number"
                  min={1}
                  placeholder="e.g. 12"
                  value={tenorMonths}
                  onChange={(e) => setTenorMonths(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cf-tranches" className="text-xs">Max Tranches</Label>
                <Input
                  id="cf-tranches"
                  type="number"
                  min={1}
                  placeholder="e.g. 5"
                  value={drawdownTranches}
                  onChange={(e) => setDrawdownTranches(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/credit-facility/facility-toggle.tsx
git commit -m "feat: add FacilityToggle UI component"
```

---

## Task 4: Wire Toggle into Loan Terms Form

**Files:**
- Modify: `app/(application)/leads/new/components/loan-terms-form.tsx`

The `LoanTermsForm` component needs two new optional props and a `FacilityToggle` render at the end of its form fields.

- [ ] **Step 1: Add new props to LoanTermsForm's prop interface**

Find the `LoanTermsFormProps` interface definition in `loan-terms-form.tsx`. Add two new optional props:

```typescript
// Add inside the existing LoanTermsFormProps interface (find it by searching for "interface LoanTermsFormProps" or "type LoanTermsFormProps")
fineractClientId?: number | null;
onFacilityChange?: (data: { mode: "create"; facility: import("@/lib/fineract-credit-facility").CreateFacilityData } | { mode: "link" } | null) => void;
```

- [ ] **Step 2: Import FacilityToggle at the top of the file**

Add to the imports block near the top of `loan-terms-form.tsx`:

```typescript
import { FacilityToggle } from "@/components/credit-facility/facility-toggle";
```

- [ ] **Step 3: Destructure the new props in the component function**

In the component function signature, destructure `fineractClientId` and `onFacilityChange` alongside existing props:

```typescript
// In the function parameter destructuring — add:
fineractClientId,
onFacilityChange,
```

- [ ] **Step 4: Render FacilityToggle at the bottom of the loan terms form fields**

Find the closing section of the loan terms form (before the submit/next button area). Add the toggle:

```tsx
{/* Credit Facility */}
{onFacilityChange && (
  <div className="pt-2">
    <FacilityToggle
      fineractClientId={fineractClientId}
      loanAmount={Number(form.watch("requestedAmount") ?? 0)}
      currencyCode={form.watch("currencyCode") as string | undefined}
      onChange={onFacilityChange}
    />
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/leads/new/components/loan-terms-form.tsx"
git commit -m "feat: add credit facility toggle to loan terms form"
```

---

## Task 5: Wire Facility Creation into New Lead Form

**Files:**
- Modify: `app/(application)/leads/new/components/new-lead-form.tsx`

After the existing `/api/leads/operations` call succeeds and returns a `leadId`, call the appropriate credit facility server action.

- [ ] **Step 1: Import server actions and the facility data type at the top of new-lead-form.tsx**

```typescript
import {
  createCreditFacilityForLead,
  linkLoanToExistingFacility,
} from "@/app/actions/credit-facility-actions";
import type { CreateFacilityData } from "@/lib/fineract-credit-facility";
```

- [ ] **Step 2: Add facilityIntent state to the component**

Inside the component function, add:

```typescript
const [facilityIntent, setFacilityIntent] = useState<
  | { mode: "create"; facility: CreateFacilityData }
  | { mode: "link" }
  | null
>(null);
```

- [ ] **Step 3: Pass onFacilityChange and fineractClientId to the LoanTermsForm**

Find where `<LoanTermsForm ... />` (or the loan terms step) is rendered in `new-lead-form.tsx`. Pass the new props:

```tsx
// Add these props to the existing LoanTermsForm render:
fineractClientId={(window as any).fineractClientId ?? undefined}
onFacilityChange={setFacilityIntent}
```

- [ ] **Step 4: Call facility server action after successful lead creation**

Find the `onSubmit` handler in `new-lead-form.tsx` — specifically the code after `const response = await fetch("/api/leads/operations", ...)` succeeds (around line 1134). After extracting `leadId` from the response JSON and the success toast/redirect, add:

```typescript
// After successful lead creation — call facility actions if needed
if (facilityIntent && responseData?.leadId) {
  const requestedAmount = Number(data.requestedAmount ?? 0);

  if (facilityIntent.mode === "create") {
    const facilityResult = await createCreditFacilityForLead(
      responseData.leadId,
      facilityIntent.facility
    );
    if (!facilityResult.success) {
      toast({
        title: "Loan created — facility setup failed",
        description: facilityResult.error ?? "Credit facility could not be created",
        variant: "destructive",
      });
    }
  } else if (facilityIntent.mode === "link") {
    const linkResult = await linkLoanToExistingFacility(
      responseData.leadId,
      requestedAmount
    );
    if (!linkResult.success) {
      toast({
        title: "Loan created — facility link failed",
        description: linkResult.error ?? "Could not link to credit facility",
        variant: "destructive",
      });
    }
  }
}
```

**Note:** You need to check what field the `/api/leads/operations` response returns for the lead ID. Inspect the response JSON shape — it may be `leadId`, `id`, or `data.id`. Adjust `responseData?.leadId` accordingly.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Manual smoke test**

1. Run `npm run dev`
2. Create a new term loan for a client with no active facility
3. Toggle "Link to Credit Facility" ON → should show the "create" form
4. Fill credit limit / tenor / tranches → submit
5. Verify in Fineract: `GET /datatables/credit_facility/{clientId}` returns one row with `status: "PENDING"`
6. Verify `GET /datatables/credit_facility_loan/{loanId}` returns the `facility_ref`

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/leads/new/components/new-lead-form.tsx"
git commit -m "feat: create/link credit facility on new loan submission"
```

---

## Task 6: State Machine — Approve Hook (Facility Activation)

**Files:**
- Modify: `lib/team-state-machine-service.ts`

Add facility activation logic in the `case "approve"` block.

- [ ] **Step 1: Import credit facility functions at the top of team-state-machine-service.ts**

Find the existing import block at the top of `lib/team-state-machine-service.ts`. Add:

```typescript
import {
  getFacilityLoanLink,
  getFacilityByRef,
  updateFacility,
} from "@/lib/fineract-credit-facility";
```

- [ ] **Step 2: Add facility activation after loan approval**

In the `switch (action)` block (around line 941–947), find `case "approve":`. After `await fineract.approveLoan(fineractLoanId, approveDate);` add:

```typescript
// Activate credit facility if this loan created one
try {
  const fineractClientId = (lead as any).fineractClientId;
  if (fineractLoanId && fineractClientId) {
    const link = await getFacilityLoanLink(fineractLoanId);
    if (link) {
      const facility = await getFacilityByRef(fineractClientId, link.facility_ref);
      if (facility && facility.status === "PENDING") {
        await updateFacility(fineractClientId, facility.id, { status: "ACTIVE" });
        console.log(`[CreditFacility] Activated facility ${link.facility_ref} for client ${fineractClientId}`);
      }
    }
  }
} catch (err) {
  // Non-blocking: log but don't fail the approval
  console.error("[CreditFacility] Failed to activate facility on approval:", err);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Manual smoke test**

1. Use the loan created in Task 5's smoke test
2. Move it to the approval stage in the pipeline
3. After approval, call `GET /datatables/credit_facility/{clientId}`
4. Verify the row now has `status: "ACTIVE"`

- [ ] **Step 5: Commit**

```bash
git add lib/team-state-machine-service.ts
git commit -m "feat: activate credit facility on loan approval"
```

---

## Task 7: State Machine — Disburse Hook (Validation + Counter Update)

**Files:**
- Modify: `lib/team-state-machine-service.ts`

Add pre-disbursement validation and post-disbursement counter update in `case "disburse":`.

- [ ] **Step 1: Import validateFacilityForDisbursement**

Add to the existing import from `@/lib/fineract-credit-facility` (added in Task 6):

```typescript
import {
  getFacilityLoanLink,
  getFacilityByRef,
  updateFacility,
  validateFacilityForDisbursement, // ADD THIS
} from "@/lib/fineract-credit-facility";
```

- [ ] **Step 2: Add pre-disbursement validation and post-disbursement update in case "disburse"**

In the `switch (action)` block, find `case "disburse":` (around line 949). Replace the content with:

```typescript
case "disburse": {
  // Credit facility validation — run before touching Fineract
  const fineractClientId = (lead as any).fineractClientId;
  if (fineractLoanId && fineractClientId) {
    const link = await getFacilityLoanLink(fineractLoanId);
    if (link) {
      const facility = await getFacilityByRef(fineractClientId, link.facility_ref);
      if (facility) {
        const loanDetails = await fineract.getLoanDetails(fineractLoanId);
        const loanAmount =
          loanDetails?.approvedPrincipal ??
          loanDetails?.principal ??
          loanDetails?.proposedPrincipal ??
          0;

        const validation = validateFacilityForDisbursement(facility, loanAmount);
        if (!validation.valid) {
          throw new Error(`Credit Facility: ${validation.error}`);
        }
      }
    }
  }

  // Existing disbursement logic (unchanged)
  const disburseDate = overrides?.disbursementDate
    ? formatDateForFineract(overrides.disbursementDate)
    : formatFineractDateArr(loanDetails?.timeline?.expectedDisbursementDate)
      || formatFineractDateArr(loanDetails?.timeline?.approvedOnDate);
  await fineract.disburseLoan(fineractLoanId, disburseDate, {
    paymentTypeId: overrides?.paymentTypeId,
    accountNumber: overrides?.accountNumber,
    checkNumber: overrides?.checkNumber,
    routingCode: overrides?.routingCode,
    receiptNumber: overrides?.receiptNumber,
    bankNumber: overrides?.bankNumber,
    note: overrides?.note,
  });

  // Non-blocking: disbursement succeeds even when charge application fails.
  if (lead?.tenantId) {
    try {
      await applyTopupDisbursementCharges({
        loanId: fineractLoanId,
        tenantId: String(lead.tenantId),
        source: "state-transition",
      });
    } catch (error) {
      console.error("[StateTransition] Failed to apply topup disbursement charges:", error);
    }
  }

  // Update facility counters after successful disbursement
  if (fineractClientId) {
    try {
      const link = await getFacilityLoanLink(fineractLoanId);
      if (link) {
        const facility = await getFacilityByRef(fineractClientId, link.facility_ref);
        if (facility) {
          const loanDetails2 = await fineract.getLoanDetails(fineractLoanId);
          const disbursedAmount =
            loanDetails2?.approvedPrincipal ??
            loanDetails2?.principal ??
            loanDetails2?.proposedPrincipal ??
            0;

          const newUtilized = facility.utilized_amount + disbursedAmount;
          const newTranches = facility.disbursed_tranches + 1;
          const isExhausted =
            newUtilized >= facility.credit_limit ||
            newTranches >= facility.drawdown_tranches;

          await updateFacility(fineractClientId, facility.id, {
            utilized_amount: newUtilized,
            disbursed_tranches: newTranches,
            ...(isExhausted ? { status: "CLOSED" } : {}),
          });
          console.log(`[CreditFacility] Updated facility ${link.facility_ref}: utilized=${newUtilized}, tranches=${newTranches}${isExhausted ? " → CLOSED" : ""}`);
        }
      }
    } catch (err) {
      // Non-blocking: counter update failure doesn't roll back disbursement
      console.error("[CreditFacility] Failed to update facility counters after disburse:", err);
    }
  }

  return `Fineract loan #${fineractLoanId} disbursed`;
}
```

**Note:** The `loanDetails` variable already exists earlier in the method. If `getLoanDetails` is not already called before the switch block, you may need to call it once before the switch and reuse it. Check the existing code around line 900–940 for context.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Manual smoke test**

1. Disburse the loan from the previous tasks
2. After disbursement, `GET /datatables/credit_facility/{clientId}` should show `utilized_amount` increased by the loan amount and `disbursed_tranches` incremented by 1
3. Try disbursing another loan that would exceed the credit limit → expect error in pipeline

- [ ] **Step 5: Commit**

```bash
git add lib/team-state-machine-service.ts
git commit -m "feat: validate and update credit facility counters on disbursement"
```

---

## Task 8: Lead Detail Facility Banner

**Files:**
- Create: `components/credit-facility/facility-banner.tsx`
- Modify: `app/(application)/leads/[id]/components/lead-detail-tabs.tsx`

- [ ] **Step 1: Create the facility banner component**

```tsx
// components/credit-facility/facility-banner.tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getFacilityForLoan } from "@/app/actions/credit-facility-actions";
import type { CreditFacility } from "@/lib/fineract-credit-facility";
import { addMonths, format } from "date-fns";

interface FacilityBannerProps {
  fineractLoanId: number | null | undefined;
  fineractClientId: number | null | undefined;
}

function parseFineractDate(d: string | number[]): Date {
  if (Array.isArray(d)) return new Date(d[0], d[1] - 1, d[2]);
  return new Date(d);
}

export function FacilityBanner({ fineractLoanId, fineractClientId }: FacilityBannerProps) {
  const [facility, setFacility] = useState<CreditFacility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fineractLoanId || !fineractClientId) {
      setLoading(false);
      return;
    }
    getFacilityForLoan(fineractLoanId, fineractClientId).then((f) => {
      setFacility(f);
      setLoading(false);
    });
  }, [fineractLoanId, fineractClientId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!facility) return null;

  const available = facility.credit_limit - facility.utilized_amount;
  const expiry = addMonths(parseFineractDate(facility.created_date), facility.tenor_months);

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 mb-4">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-blue-700 border-blue-300 shrink-0">
            Credit Facility
          </Badge>
          <Badge variant={facility.status === "ACTIVE" ? "default" : "secondary"} className="shrink-0">
            {facility.status}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Limit: <strong className="text-foreground">{facility.currency_code} {facility.credit_limit.toLocaleString()}</strong>
          </span>
          <span className="text-sm text-muted-foreground">
            Available: <strong className="text-foreground">{facility.currency_code} {available.toLocaleString()}</strong>
          </span>
          <span className="text-sm text-muted-foreground">
            Tranches: <strong className="text-foreground">{facility.disbursed_tranches} / {facility.drawdown_tranches}</strong>
          </span>
          <span className="text-sm text-muted-foreground">
            Expires: <strong className="text-foreground">{format(expiry, "MMM yyyy")}</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Render FacilityBanner in lead-detail-tabs.tsx**

In `lead-detail-tabs.tsx`, import the banner and add it above the tabs content:

```typescript
// Add import
import { FacilityBanner } from "@/components/credit-facility/facility-banner";
```

Find in the JSX where `<Tabs ...>` is rendered and add the banner just before the `<TabsList>` (or just after the component's outer wrapper opens):

```tsx
<FacilityBanner
  fineractLoanId={fineractLoanId}
  fineractClientId={fineractClientId}
/>
```

The props `fineractLoanId` and `fineractClientId` already exist on the `LeadDetailTabsProps` interface.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Manual smoke test**

1. Open the lead detail page for the loan linked to a facility
2. Verify the blue banner appears with the correct facility stats
3. Open a lead detail page for a regular loan → banner should not appear

- [ ] **Step 5: Commit**

```bash
git add "components/credit-facility/facility-banner.tsx" "app/(application)/leads/[id]/components/lead-detail-tabs.tsx"
git commit -m "feat: show credit facility banner on lead detail page"
```

---

## Task 9: Loan Detail Facility Section

**Files:**
- Create: `components/credit-facility/facility-section.tsx`
- Modify: `app/(application)/clients/[id]/loans/[loanId]/components/client-loan-details.tsx`

- [ ] **Step 1: Create facility-section component**

```tsx
// components/credit-facility/facility-section.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getFacilityForLoan } from "@/app/actions/credit-facility-actions";
import type { CreditFacility } from "@/lib/fineract-credit-facility";
import { addMonths, format } from "date-fns";

interface FacilitySectionProps {
  fineractLoanId: number | null | undefined;
  fineractClientId: number | null | undefined;
}

function parseFineractDate(d: string | number[]): Date {
  if (Array.isArray(d)) return new Date(d[0], d[1] - 1, d[2]);
  return new Date(d);
}

export function FacilitySection({ fineractLoanId, fineractClientId }: FacilitySectionProps) {
  const [facility, setFacility] = useState<CreditFacility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fineractLoanId || !fineractClientId) { setLoading(false); return; }
    getFacilityForLoan(fineractLoanId, fineractClientId).then((f) => {
      setFacility(f);
      setLoading(false);
    });
  }, [fineractLoanId, fineractClientId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!facility) return null;

  const available = facility.credit_limit - facility.utilized_amount;
  const expiry = addMonths(parseFineractDate(facility.created_date), facility.tenor_months);

  const rows = [
    { label: "Status",         value: <Badge variant={facility.status === "ACTIVE" ? "default" : "secondary"}>{facility.status}</Badge> },
    { label: "Credit Limit",   value: `${facility.currency_code} ${facility.credit_limit.toLocaleString()}` },
    { label: "Available",      value: `${facility.currency_code} ${available.toLocaleString()}` },
    { label: "Utilized",       value: `${facility.currency_code} ${facility.utilized_amount.toLocaleString()}` },
    { label: "Tranches Used",  value: `${facility.disbursed_tranches} / ${facility.drawdown_tranches}` },
    { label: "Expires",        value: format(expiry, "MMM yyyy") },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Credit Facility</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {rows.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add FacilitySection to client-loan-details.tsx**

In `client-loan-details.tsx`, import and render `FacilitySection`. Find where the loan overview cards are rendered (look for the Card components showing loan summary — amount, status, dates). Add `FacilitySection` after the last summary card:

```typescript
// Add import at top
import { FacilitySection } from "@/components/credit-facility/facility-section";
```

```tsx
// Add in the overview section — pass the loan's ID and client ID
<FacilitySection
  fineractLoanId={loan?.id}
  fineractClientId={client?.id}
/>
```

Check the prop names `loan` and `client` in the existing component — adjust to match whatever the actual variable names are.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add "components/credit-facility/facility-section.tsx" "app/(application)/clients/[id]/loans/[loanId]/components/client-loan-details.tsx"
git commit -m "feat: show credit facility section on loan detail page"
```

---

## Task 10: Client Detail — Facility Tab

**Files:**
- Create: `app/(application)/clients/[id]/components/client-facility.tsx`
- Modify: `app/(application)/clients/[id]/page.tsx`

- [ ] **Step 1: Create client-facility.tsx**

```tsx
// app/(application)/clients/[id]/components/client-facility.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { getActiveFacility } from "@/app/actions/credit-facility-actions";
import { getFacilityLoanLink } from "@/lib/fineract-credit-facility";
import type { CreditFacility } from "@/lib/fineract-credit-facility";
import { addMonths, format } from "date-fns";

interface FacilityLoanRow {
  loanId: number;
  accountNo: string;
  principal: number;
  status: string;
  disbursedOnDate?: string;
}

interface ClientFacilityProps {
  fineractClientId: number;
  clientLoans: Array<{ id: number; accountNo: string; principal?: number; approvedPrincipal?: number; status?: { value?: string }; timeline?: { actualDisbursementDate?: number[] } }>;
  clientId: string; // our DB client ID for building links
}

function parseFineractDate(d: string | number[]): Date {
  if (Array.isArray(d)) return new Date(d[0], d[1] - 1, d[2]);
  return new Date(d);
}

export function ClientFacility({ fineractClientId, clientLoans, clientId }: ClientFacilityProps) {
  const [facility, setFacility] = useState<CreditFacility | null>(null);
  const [facilityLoans, setFacilityLoans] = useState<FacilityLoanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const f = await getActiveFacility(fineractClientId);
      setFacility(f);

      if (f && clientLoans.length > 0) {
        const linked: FacilityLoanRow[] = [];
        for (const loan of clientLoans) {
          try {
            const link = await getFacilityLoanLink(loan.id);
            if (link && link.facility_ref === f.facility_ref) {
              linked.push({
                loanId: loan.id,
                accountNo: loan.accountNo,
                principal: loan.approvedPrincipal ?? loan.principal ?? 0,
                status: loan.status?.value ?? "Unknown",
                disbursedOnDate: loan.timeline?.actualDisbursementDate
                  ? format(parseFineractDate(loan.timeline.actualDisbursementDate), "dd MMM yyyy")
                  : undefined,
              });
            }
          } catch {
            // skip loans that error
          }
        }
        setFacilityLoans(linked);
      }
      setLoading(false);
    }
    load();
  }, [fineractClientId, clientLoans]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!facility) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      No active credit facility for this client.
    </div>
  );

  const available = facility.credit_limit - facility.utilized_amount;
  const expiry = addMonths(parseFineractDate(facility.created_date), facility.tenor_months);

  const stats = [
    { label: "Status",        value: <Badge variant={facility.status === "ACTIVE" ? "default" : "secondary"}>{facility.status}</Badge> },
    { label: "Credit Limit",  value: `${facility.currency_code} ${facility.credit_limit.toLocaleString()}` },
    { label: "Available",     value: `${facility.currency_code} ${available.toLocaleString()}` },
    { label: "Utilized",      value: `${facility.currency_code} ${facility.utilized_amount.toLocaleString()}` },
    { label: "Tranches Used", value: `${facility.disbursed_tranches} / ${facility.drawdown_tranches}` },
    { label: "Created",       value: format(parseFineractDate(facility.created_date), "dd MMM yyyy") },
    { label: "Expires",       value: format(expiry, "dd MMM yyyy") },
  ];

  return (
    <div className="space-y-6">
      {/* Facility details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facility Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            {stats.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Loans under facility */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loans Under This Facility</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {facilityLoans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No disbursed loans under this facility yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Disbursed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilityLoans.map((loan) => (
                  <TableRow key={loan.loanId}>
                    <TableCell>
                      <Link
                        href={`/clients/${clientId}/loans/${loan.loanId}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {loan.accountNo}
                      </Link>
                    </TableCell>
                    <TableCell>{facility.currency_code} {loan.principal.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{loan.status}</Badge></TableCell>
                    <TableCell>{loan.disbursedOnDate ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add Facility tab to clients/[id]/page.tsx**

In `app/(application)/clients/[id]/page.tsx`:

Add import:
```typescript
import { ClientFacility } from "./components/client-facility";
```

Find the `<TabsList>` that contains the existing tabs (Loans, Savings, Documents, etc.) and add:
```tsx
<TabsTrigger value="facility">Facility</TabsTrigger>
```

Add the corresponding `<TabsContent>`:
```tsx
<TabsContent value="facility">
  <ClientFacility
    fineractClientId={clientData.id}
    clientLoans={clientLoans ?? []}
    clientId={params.id}
  />
</TabsContent>
```

**Note:** `clientData`, `clientLoans`, and `params.id` need to match the actual variable names in `page.tsx`. Read the existing tab content blocks to confirm the variable names for client data and loans array.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Manual smoke test**

1. Open a client detail page for a client with an active facility
2. Click the "Facility" tab
3. Verify facility stats show correctly
4. Verify the loans table lists disbursed loans linked to the facility with working links

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/clients/[id]/components/client-facility.tsx" "app/(application)/clients/[id]/page.tsx"
git commit -m "feat: add Facility tab to client detail page"
```

---

## Task 11: Datatable Setup — Organization Features Page

**Files:**
- Modify: `app/(application)/organization/features/page.tsx`

Add an "Initialize Credit Facility" button that calls the `setupCreditFacilityDatatables` server action.

- [ ] **Step 1: Import server action and add state**

In `app/(application)/organization/features/page.tsx`, add import:

```typescript
import { setupCreditFacilityDatatables } from "@/app/actions/credit-facility-actions";
```

Add state inside the component:
```typescript
const [facilitySetupLoading, setFacilitySetupLoading] = useState(false);
const [facilitySetupResult, setFacilitySetupResult] = useState<{ success: boolean; message: string } | null>(null);
```

- [ ] **Step 2: Add button UI**

Find the closing area of the features page (after the feature toggles list) and add:

```tsx
{/* Credit Facility Setup */}
<Card>
  <CardHeader>
    <CardTitle className="text-base">Credit Facility</CardTitle>
    <CardDescription>
      Register the required Fineract datatables for the Credit Facility feature.
      Run this once per Fineract instance before using Credit Facilities.
    </CardDescription>
  </CardHeader>
  <CardContent className="flex items-center gap-4">
    <Button
      variant="outline"
      disabled={facilitySetupLoading}
      onClick={async () => {
        setFacilitySetupLoading(true);
        setFacilitySetupResult(null);
        const result = await setupCreditFacilityDatatables();
        setFacilitySetupResult({
          success: result.success,
          message: result.success
            ? "Datatables registered successfully."
            : result.error ?? "Setup failed.",
        });
        setFacilitySetupLoading(false);
      }}
    >
      {facilitySetupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Initialize Credit Facility
    </Button>
    {facilitySetupResult && (
      <span className={`text-sm ${facilitySetupResult.success ? "text-green-600" : "text-destructive"}`}>
        {facilitySetupResult.message}
      </span>
    )}
  </CardContent>
</Card>
```

Make sure `Button` and `Loader2` are already imported in this file — they likely are given the existing pattern. Add them to imports if not:
```typescript
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Manual smoke test**

1. Go to `/organization/features`
2. Click "Initialize Credit Facility"
3. Should show "Datatables registered successfully."
4. Verify in Fineract: `GET /datatables` lists `credit_facility` and `credit_facility_loan`
5. Click the button again — should succeed (idempotent)

- [ ] **Step 5: Final commit**

```bash
git add "app/(application)/organization/features/page.tsx"
git commit -m "feat: add Credit Facility datatable setup to organization features page"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `credit_facility` datatable on `m_client` (multi-row) | Task 1 |
| `credit_facility_loan` datatable on `m_loan` (single-row) | Task 1 |
| Registration idempotent server action | Task 2, Task 11 |
| Loan creation toggle — create new facility | Tasks 3, 4, 5 |
| Loan creation toggle — link to existing facility | Tasks 3, 4, 5 |
| Pre-creation validation (expiry, limit, tranches) | Task 2 (`linkLoanToExistingFacility`) |
| Facility PENDING → ACTIVE on loan approval | Task 6 |
| Pre-disbursement validation (4 checks) | Task 7 |
| Post-disbursement counter update + auto-close | Task 7 |
| Lead detail facility banner | Task 8 |
| Loan detail facility section | Task 9 |
| Client detail Facility tab | Task 10 |
| Admin setup button in org features | Task 11 |
