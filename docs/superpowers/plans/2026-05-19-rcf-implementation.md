# Revolving Credit Facility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Revolving Credit Facility product — a reusable credit limit backed by a Fineract savings account — with full lead origination, approval pipeline, and facility management UI.

**Architecture:** Hybrid separate-module approach (Approach C from design spec). The RCF wizard at `/leads/new/rcf` is a dedicated 4-tab component that imports shared step components (`ClientRegistrationForm`, `AffordabilityForm`, `LoanContracts`) but has its own shell and a new `RcfFacilityTermsForm` step. The existing term loan flow moves untouched to `/leads/new/loan`. The entire RCF surface is gated by `hasRevolvingCredit` in tenant settings (already in `TenantFeatures`, stored in `tenant.settings.features`).

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 6, Radix UI + Tailwind, React Hook Form + Zod, `lib/fineract-savings-service.ts` (existing), `lib/auth.ts` `getSession()` for auth, `useCurrency()` hook for tenant locale.

**Design spec:** `docs/superpowers/specs/2026-05-19-rcf-design.md`

---

## File Map

### Modified
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `maxDrawdowns Int @default(10)` to `RevolvingCreditFacility` |
| `app/api/tenant/locale/route.ts` | Expose `hasRevolvingCredit` in response |
| `contexts/currency-context.tsx` | Add `hasRevolvingCredit?: boolean` to `TenantLocale` |
| `app/api/leads/operations/route.ts` | Pass `facilityType` through `saveDraft` handler |
| `lib/team-state-machine-service.ts` | Read `maxDrawdowns` from lead `stateMetadata` when creating `RevolvingCreditFacility` |
| `app/(application)/leads/new/page.tsx` | Replace with product selector (gate on `hasRevolvingCredit`) |
| `app/(application)/leads/[id]/components/lead-detail-tabs.tsx` | Add Facility tab (RCF leads only) |

### Created
| File | Purpose |
|------|---------|
| `app/(application)/leads/new/loan/page.tsx` | Wraps existing `NewLeadForm` at new route |
| `app/(application)/leads/new/rcf/page.tsx` | RCF wizard entry |
| `app/(application)/leads/new/rcf/components/rcf-lead-form.tsx` | 4-tab wizard shell |
| `app/(application)/leads/new/rcf/components/rcf-facility-terms-form.tsx` | Facility Terms step (new) |
| `app/api/leads/[id]/facility-terms/route.ts` | POST — save facility terms to lead stateMetadata |
| `app/api/leads/[id]/facility/route.ts` | GET — fetch facility + live Fineract balance |
| `app/api/leads/[id]/facility/drawdown/route.ts` | POST — disburse drawdown (savings withdrawal) |
| `app/api/leads/[id]/facility/repayment/route.ts` | POST — record repayment (savings deposit) |
| `app/api/fineract/savings/[savingsId]/route.ts` | GET — proxy to Fineract `/savingsaccounts/{id}?associations=all` |
| `app/(application)/leads/[id]/components/facility-tab.tsx` | Facility tab content |
| `app/(application)/leads/[id]/components/drawdown-modal.tsx` | Drawdown request modal |
| `app/(application)/leads/[id]/components/repayment-modal.tsx` | Repayment recording modal |
| `app/(application)/clients/[id]/savings/[savingsId]/page.tsx` | Savings detail page shell |
| `app/(application)/clients/[id]/savings/[savingsId]/components/savings-overview.tsx` | Overview tab |
| `app/(application)/clients/[id]/savings/[savingsId]/components/drawdown-list.tsx` | Drawdowns tab |
| `app/(application)/clients/[id]/savings/[savingsId]/components/repayment-list.tsx` | Repayments tab |
| `app/(application)/clients/[id]/savings/[savingsId]/components/transaction-log.tsx` | Transactions tab |

---

## Task 1: Schema — Add maxDrawdowns to RevolvingCreditFacility

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the field**

In `prisma/schema.prisma`, find the `RevolvingCreditFacility` model (currently around line 1222) and add `maxDrawdowns` after `savingsProductId`:

```prisma
model RevolvingCreditFacility {
  id                       String                    @id @default(cuid())
  leadId                   String                    @unique
  tenantId                 String
  creditLimit              Float
  availableBalance         Float
  fineractSavingsAccountId Int
  fineractSavingsAccountNo String?
  savingsProductId         Int
  maxDrawdowns             Int                       @default(10)
  activatedAt              DateTime                  @default(now())
  createdAt                DateTime                  @default(now())
  updatedAt                DateTime                  @updatedAt
  lead                     Lead                      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  tenant                   Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  drawdowns                RevolvingCreditDrawdown[]

  @@index([tenantId])
}
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd "loan-matrix"
npx prisma migrate dev --name add_max_drawdowns_to_rcf
```

Expected output: `✔ Generated Prisma Client` and a new migration file under `prisma/migrations/`.

- [ ] **Step 3: Verify generated client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add maxDrawdowns to RevolvingCreditFacility schema"
```

---

## Task 2: Expose hasRevolvingCredit via Tenant Locale

**Files:**
- Modify: `app/api/tenant/locale/route.ts`
- Modify: `contexts/currency-context.tsx`

- [ ] **Step 1: Add to locale route**

In `app/api/tenant/locale/route.ts`, add `hasRevolvingCredit` to `DEFAULT_LOCALE` and parse it from settings. After the `leadAffordabilityOptional` block (around line 68), add:

```typescript
const hasRevolvingCredit =
  settings?.features?.hasRevolvingCredit ?? false;
```

Update the `locale` object (around line 69) to include it:

```typescript
const locale = {
  ...DEFAULT_LOCALE,
  ...settings?.locale,
  skipAffordabilityForCompanies: !!skipAffordabilityForCompanies,
  clientSelfieOptionalForCompanies: !!clientSelfieOptionalForCompanies,
  clientSelfieOptionalForPerson: !!clientSelfieOptionalForPerson,
  createLeadSignaturesOnContractOptional: !!createLeadSignaturesOnContractOptional,
  documentsOptional: !!documentsOptional,
  leadAffordabilityOptional: !!leadAffordabilityOptional,
  hasRevolvingCredit: !!hasRevolvingCredit,
};
```

Also add `hasRevolvingCredit: false` to `DEFAULT_LOCALE` at the top of the file:

```typescript
const DEFAULT_LOCALE = {
  countryCode: "+260",
  countryName: "Zambia",
  countryIso: "ZM",
  phoneDigits: 9,
  phoneFormat: "XX XXX XXXX",
  phonePlaceholder: "977123456",
  skipAffordabilityForCompanies: false,
  clientSelfieOptionalForCompanies: false,
  clientSelfieOptionalForPerson: false,
  createLeadSignaturesOnContractOptional: false,
  documentsOptional: false,
  leadAffordabilityOptional: false,
  hasRevolvingCredit: false,
};
```

- [ ] **Step 2: Add to TenantLocale interface in currency-context**

In `contexts/currency-context.tsx`, find the `TenantLocale` interface (around line 25) and add the field:

```typescript
interface TenantLocale {
  countryCode: string;
  countryIso: string;
  phoneDigits: number;
  phoneFormat: string;
  phonePlaceholder: string;
  emailOptional?: boolean;
  mandatoryDatatables?: string[];
  skipAffordabilityForCompanies?: boolean;
  clientSelfieOptionalForCompanies?: boolean;
  clientSelfieOptionalForPerson?: boolean;
  createLeadSignaturesOnContractOptional?: boolean;
  documentsOptional?: boolean;
  leadAffordabilityOptional?: boolean;
  hasRevolvingCredit?: boolean;   // ADD THIS LINE
}
```

Also add it to `DEFAULT_LOCALE` inside `currency-context.tsx` (around line 39):

```typescript
const DEFAULT_LOCALE: TenantLocale = {
  countryCode: "+260",
  countryName: "Zambia",
  countryIso: "ZM",
  phoneDigits: 9,
  phoneFormat: "XX XXX XXXX",
  phonePlaceholder: "977123456",
  hasRevolvingCredit: false,   // ADD THIS LINE
};
```

And parse it in the locale fetch block (around line 172):

```typescript
hasRevolvingCredit: !!localeData.hasRevolvingCredit,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `hasRevolvingCredit`.

- [ ] **Step 4: Commit**

```bash
git add app/api/tenant/locale/route.ts contexts/currency-context.tsx
git commit -m "feat: expose hasRevolvingCredit via tenant locale API and context"
```

---

## Task 3: Pass facilityType Through saveDraft Operation

**Files:**
- Modify: `app/api/leads/operations/route.ts`

- [ ] **Step 1: Find the saveDraft handler**

In `app/api/leads/operations/route.ts`, find the `handleSaveDraft` function. Locate where the lead is created (around line 539) and where it is updated (around line 486). Both paths need `facilityType` included.

In the **create** path (`prisma.lead.create`), add after `status: "DRAFT"`:

```typescript
facilityType: validatedData.facilityType ?? "TERM_LOAN",
```

In the **update** path (`prisma.lead.update`), add after `status: "DRAFT"`:

```typescript
...(validatedData.facilityType ? { facilityType: validatedData.facilityType } : {}),
```

- [ ] **Step 2: Add facilityType to the Zod schema for saveDraft**

Find the Zod schema used to validate the draft data. Search for `z.object` near the `handleSaveDraft` function. Add the field:

```typescript
facilityType: z.enum(["TERM_LOAN", "INVOICE_DISCOUNTING", "REVOLVING_CREDIT"]).optional(),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/leads/operations/route.ts
git commit -m "feat: pass facilityType through saveDraft lead operation"
```

---

## Task 4: Update activate_revolving to Write maxDrawdowns

**Files:**
- Modify: `lib/team-state-machine-service.ts`

- [ ] **Step 1: Find activateRevolvingFacility**

Search for `activateRevolvingFacility` in `lib/team-state-machine-service.ts`. Find the `prisma.revolvingCreditFacility.create` call inside it.

- [ ] **Step 2: Read maxDrawdowns from stateMetadata and write to facility**

Update the `prisma.revolvingCreditFacility.create` call to include `maxDrawdowns`:

```typescript
await prisma.revolvingCreditFacility.create({
  data: {
    leadId: lead.id,
    tenantId: lead.tenantId,
    creditLimit,
    availableBalance: creditLimit,
    fineractSavingsAccountId: savingsId,
    savingsProductId: lead.savingsProductId,
    maxDrawdowns: (lead.stateMetadata as any)?.maxDrawdowns ?? 10,
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/team-state-machine-service.ts
git commit -m "feat: read maxDrawdowns from lead stateMetadata when activating RCF"
```

---

## Task 5: Route Restructure — /leads/new/loan

**Files:**
- Create: `app/(application)/leads/new/loan/page.tsx`

The existing `app/(application)/leads/new/page.tsx` will be replaced in Task 6. First, create the loan sub-route so term loans have a home.

- [ ] **Step 1: Create the loan page**

Create `app/(application)/leads/new/loan/page.tsx`:

```typescript
import type { Metadata } from "next";
import { NewLeadForm } from "../components/new-lead-form";

export const metadata: Metadata = {
  title: "New Lead | KENAC Loan Matrix",
  description: "Create a new lead",
};

export default function NewLoanLeadPage() {
  return <NewLeadForm />;
}
```

- [ ] **Step 2: Verify the route works**

Start the dev server and navigate to `/leads/new/loan`. It should render exactly the same form as the current `/leads/new`. Confirm all tabs work.

```bash
npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add "app/(application)/leads/new/loan/page.tsx"
git commit -m "feat: add /leads/new/loan route for term loan lead creation"
```

---

## Task 6: Product Selection Page

**Files:**
- Modify: `app/(application)/leads/new/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the entire content of `app/(application)/leads/new/page.tsx` with:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/contexts/currency-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Receipt, ArrowRight } from "lucide-react";

export default function SelectProductPage() {
  const router = useRouter();
  const { locale } = useCurrency();

  useEffect(() => {
    if (!locale.hasRevolvingCredit) {
      router.replace("/leads/new/loan");
    }
  }, [locale.hasRevolvingCredit, router]);

  if (!locale.hasRevolvingCredit) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Select a Product</h1>
        <p className="text-muted-foreground text-sm">
          Choose the type of credit facility for this client.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Term Loan Card */}
        <Card
          className="cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all group"
          onClick={() => router.push("/leads/new/loan")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="secondary">Standard</Badge>
            </div>
            <CardTitle className="text-lg mt-3">Term Loan</CardTitle>
            <CardDescription>
              Fixed amount disbursed once, repaid on a set schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Fixed principal amount
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Fixed repayment schedule
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Single disbursement
              </li>
            </ul>
            <Button
              variant="ghost"
              className="w-full justify-between group-hover:bg-primary/5 mt-2"
            >
              Select Term Loan <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* RCF Card */}
        <Card
          className="cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all group"
          onClick={() => router.push("/leads/new/rcf")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-emerald-600" />
              </div>
              <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                Revolving
              </Badge>
            </div>
            <CardTitle className="text-lg mt-3">Revolving Credit Facility</CardTitle>
            <CardDescription>
              Reusable credit limit — draw, repay, and redraw within the facility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Flexible partial drawdowns
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Balance restores on repayment
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Up to 10 configurable tranches
              </li>
            </ul>
            <Button
              variant="ghost"
              className="w-full justify-between group-hover:bg-emerald-500/5 mt-2"
            >
              Select RCF <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify both paths**

With dev server running:
- If tenant has `hasRevolvingCredit: false` → navigating to `/leads/new` should instantly redirect to `/leads/new/loan`.
- If tenant has `hasRevolvingCredit: true` → navigating to `/leads/new` shows two cards. Clicking "Term Loan" goes to `/leads/new/loan`. Clicking "RCF" goes to `/leads/new/rcf` (404 for now — that's fine).

To enable RCF for testing, run in Prisma Studio or via a DB query:
```sql
UPDATE "Tenant" SET settings = jsonb_set(COALESCE(settings, '{}'), '{features,hasRevolvingCredit}', 'true') WHERE slug = 'your-tenant-slug';
```

- [ ] **Step 3: Commit**

```bash
git add "app/(application)/leads/new/page.tsx"
git commit -m "feat: add product selection page at /leads/new gated by hasRevolvingCredit"
```

---

## Task 7: RCF Facility Terms Form

**Files:**
- Create: `app/(application)/leads/new/rcf/components/rcf-facility-terms-form.tsx`
- Create: `app/api/leads/[id]/facility-terms/route.ts`

- [ ] **Step 1: Create the facility terms API route**

Create `app/api/leads/[id]/facility-terms/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlugFromRequest, getTenantBySlug } from "@/lib/tenant-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const data = await request.json();
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const currentMetadata = (lead.stateMetadata as any) || {};

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        facilityType: "REVOLVING_CREDIT",
        requestedAmount: data.creditLimit ? parseFloat(data.creditLimit) : null,
        savingsProductId: data.savingsProductId ? parseInt(data.savingsProductId, 10) : null,
        expectedDisbursementDate: data.disbursementDate ? new Date(data.disbursementDate) : null,
        stateMetadata: {
          ...currentMetadata,
          maxDrawdowns: data.maxDrawdowns ?? 10,
          tenorMonths: data.tenorMonths ?? null,
          nominalInterestRate: data.interestRate ?? null,
        },
        lastModified: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    const meta = (lead.stateMetadata as any) || {};
    return NextResponse.json({
      creditLimit: lead.requestedAmount,
      savingsProductId: lead.savingsProductId,
      disbursementDate: lead.expectedDisbursementDate,
      maxDrawdowns: meta.maxDrawdowns ?? 10,
      tenorMonths: meta.tenorMonths ?? null,
      interestRate: meta.nominalInterestRate ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the facility terms form component**

Create `app/(application)/leads/new/rcf/components/rcf-facility-terms-form.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

const schema = z.object({
  creditLimit: z.string().min(1, "Credit limit is required"),
  savingsProductId: z.string().min(1, "Savings product is required"),
  interestRate: z.string().optional(),
  tenorMonths: z.string().min(1, "Tenor is required"),
  maxDrawdowns: z.string().min(1, "Max drawdowns is required"),
  disbursementDate: z.string().min(1, "Disbursement date is required"),
});

type FormValues = z.infer<typeof schema>;

interface SavingsProduct {
  id: number;
  name: string;
  nominalAnnualInterestRate?: number;
}

interface RcfFacilityTermsFormProps {
  leadId: string;
  fineractClientId: number | null;
  onComplete: () => void;
  onBack: () => void;
}

export function RcfFacilityTermsForm({
  leadId,
  fineractClientId,
  onComplete,
  onBack,
}: RcfFacilityTermsFormProps) {
  const { currencySymbol } = useCurrency();
  const [savingsProducts, setSavingsProducts] = useState<SavingsProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      creditLimit: "",
      savingsProductId: "",
      interestRate: "",
      tenorMonths: "",
      maxDrawdowns: "10",
      disbursementDate: new Date().toISOString().split("T")[0],
    },
  });

  // Load existing data
  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/leads/${leadId}/facility-terms`)
      .then((r) => r.json())
      .then((data) => {
        if (data.creditLimit) form.setValue("creditLimit", String(data.creditLimit));
        if (data.savingsProductId) form.setValue("savingsProductId", String(data.savingsProductId));
        if (data.interestRate) form.setValue("interestRate", String(data.interestRate));
        if (data.tenorMonths) form.setValue("tenorMonths", String(data.tenorMonths));
        if (data.maxDrawdowns) form.setValue("maxDrawdowns", String(data.maxDrawdowns));
        if (data.disbursementDate)
          form.setValue("disbursementDate", new Date(data.disbursementDate).toISOString().split("T")[0]);
      })
      .catch(() => {});
  }, [leadId, form]);

  // Load savings products from template
  useEffect(() => {
    if (!fineractClientId) return;
    setLoadingProducts(true);
    fetch(`/api/leads/template`)
      .then((r) => r.json())
      .then((d) => {
        setSavingsProducts(d.data?.savingsProducts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [fineractClientId]);

  // Auto-fill interest rate from selected product
  const selectedProductId = form.watch("savingsProductId");
  useEffect(() => {
    const product = savingsProducts.find((p) => String(p.id) === selectedProductId);
    if (product?.nominalAnnualInterestRate) {
      form.setValue("interestRate", String(product.nominalAnnualInterestRate));
    }
  }, [selectedProductId, savingsProducts, form]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/facility-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditLimit: parseFloat(values.creditLimit),
          savingsProductId: parseInt(values.savingsProductId, 10),
          interestRate: values.interestRate ? parseFloat(values.interestRate) : undefined,
          tenorMonths: parseInt(values.tenorMonths, 10),
          maxDrawdowns: parseInt(values.maxDrawdowns, 10),
          disbursementDate: values.disbursementDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to save facility terms");
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="creditLimit"
            render={({ field }) => (
              <FormItem>
                <Label>Credit Limit ({currencySymbol})</Label>
                <FormControl>
                  <Input type="number" placeholder="0.00" {...field} />
                </FormControl>
                <FormDescription>Total revolving credit limit for this facility</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="savingsProductId"
            render={({ field }) => (
              <FormItem>
                <Label>Savings Product</Label>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingProducts ? "Loading..." : "Select product"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {savingsProducts.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Fineract savings product backing this facility</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="interestRate"
            render={({ field }) => (
              <FormItem>
                <Label>Interest Rate (% p.a.)</Label>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormDescription>Nominal annual interest rate</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tenorMonths"
            render={({ field }) => (
              <FormItem>
                <Label>Tenor (months)</Label>
                <FormControl>
                  <Input type="number" min="1" placeholder="12" {...field} />
                </FormControl>
                <FormDescription>Facility duration in months</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxDrawdowns"
            render={({ field }) => (
              <FormItem>
                <Label>Max Drawdowns</Label>
                <FormControl>
                  <Input type="number" min="1" max="100" {...field} />
                </FormControl>
                <FormDescription>Maximum number of drawdown tranches allowed (default 10)</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="disbursementDate"
            render={({ field }) => (
              <FormItem>
                <Label>Activation Date</Label>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormDescription>Expected date the facility becomes active</FormDescription>
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Continue
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/api/leads/[id]/facility-terms/route.ts" \
        "app/(application)/leads/new/rcf/components/rcf-facility-terms-form.tsx"
git commit -m "feat: add facility terms form and API route for RCF"
```

---

## Task 8: RCF Lead Wizard Shell

**Files:**
- Create: `app/(application)/leads/new/rcf/components/rcf-lead-form.tsx`
- Create: `app/(application)/leads/new/rcf/page.tsx`

- [ ] **Step 1: Create the wizard shell**

Create `app/(application)/leads/new/rcf/components/rcf-lead-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientRegistrationForm } from "../../components/client-registration-form";
import { SimplifiedAffordabilityForm } from "../../components/simplified-affordability-form";
import { LoanContracts } from "../../components/loan-contracts";
import { RcfFacilityTermsForm } from "./rcf-facility-terms-form";
import { useCurrency } from "@/contexts/currency-context";

const TABS = [
  { value: "client", label: "Client Details" },
  { value: "affordability", label: "Affordability" },
  { value: "facility", label: "Facility Terms" },
  { value: "contracts", label: "Contracts" },
];

export function RcfLeadForm() {
  const router = useRouter();
  const { locale } = useCurrency();
  const skipAffordability = !!locale.skipAffordabilityForCompanies;

  const [activeTab, setActiveTab] = useState("client");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [fineractClientId, setFineractClientId] = useState<number | null>(null);

  const effectiveTabs = skipAffordability
    ? TABS.filter((t) => t.value !== "affordability")
    : TABS;

  const goNext = () => {
    const currentIndex = effectiveTabs.findIndex((t) => t.value === activeTab);
    if (currentIndex < effectiveTabs.length - 1) {
      setActiveTab(effectiveTabs[currentIndex + 1].value);
    }
  };

  const goBack = () => {
    const currentIndex = effectiveTabs.findIndex((t) => t.value === activeTab);
    if (currentIndex > 0) {
      setActiveTab(effectiveTabs[currentIndex - 1].value);
    }
  };

  const handleClientComplete = (newLeadId: string, newFineractClientId: number) => {
    setLeadId(newLeadId);
    setFineractClientId(newFineractClientId);
    goNext();
  };

  const handleContractsComplete = () => {
    router.push(`/leads/${leadId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New Revolving Credit Facility</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete each section to create the facility application.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          {effectiveTabs.map((tab, i) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={
                tab.value !== "client" &&
                (tab.value === "affordability" || tab.value === "facility" || tab.value === "contracts") &&
                !leadId
              }
              className="flex-1"
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="client" className="mt-6">
          <ClientRegistrationForm
            leadId={leadId}
            facilityType="REVOLVING_CREDIT"
            onComplete={handleClientComplete}
          />
        </TabsContent>

        {!skipAffordability && (
          <TabsContent value="affordability" className="mt-6">
            <SimplifiedAffordabilityForm
              leadId={leadId ?? ""}
              onComplete={goNext}
              onBack={goBack}
            />
          </TabsContent>
        )}

        <TabsContent value="facility" className="mt-6">
          <RcfFacilityTermsForm
            leadId={leadId ?? ""}
            fineractClientId={fineractClientId}
            onComplete={goNext}
            onBack={goBack}
          />
        </TabsContent>

        <TabsContent value="contracts" className="mt-6">
          <LoanContracts
            leadId={leadId ?? ""}
            onComplete={handleContractsComplete}
            onBack={goBack}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

> **Note on `ClientRegistrationForm` props:** The existing `ClientRegistrationForm` has its own prop signature. Check `app/(application)/leads/new/components/client-registration-form.tsx` and match the props it actually accepts. The `facilityType` prop and `onComplete` callback signature may need to be threaded through or the form's existing `onLeadCreated`/`onClientCreated` callback used instead. Adapt `handleClientComplete` to match the actual callback signature.

- [ ] **Step 2: Create the RCF page**

Create `app/(application)/leads/new/rcf/page.tsx`:

```typescript
import type { Metadata } from "next";
import { RcfLeadForm } from "./components/rcf-lead-form";

export const metadata: Metadata = {
  title: "New RCF | KENAC Loan Matrix",
  description: "Create a new revolving credit facility",
};

export default function NewRcfLeadPage() {
  return <RcfLeadForm />;
}
```

- [ ] **Step 3: Check ClientRegistrationForm actual prop signatures**

Read `app/(application)/leads/new/components/client-registration-form.tsx` lines 1–80 and verify what props it accepts and what callback it fires when the client is created. Update `rcf-lead-form.tsx` to use the correct prop names.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any prop mismatches found in Step 3.

- [ ] **Step 5: Manual verify**

With dev server running, navigate to `/leads/new/rcf`. Verify:
- The wizard renders with the correct tabs
- Client tab shows the client registration form
- Tabs after client are disabled until client is created

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/leads/new/rcf/"
git commit -m "feat: add RCF lead creation wizard at /leads/new/rcf"
```

---

## Task 9: Facility API Routes

**Files:**
- Create: `app/api/leads/[id]/facility/route.ts`
- Create: `app/api/leads/[id]/facility/drawdown/route.ts`
- Create: `app/api/leads/[id]/facility/repayment/route.ts`
- Create: `app/api/fineract/savings/[savingsId]/route.ts`

- [ ] **Step 1: Create Fineract savings proxy**

Create `app/api/fineract/savings/[savingsId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ savingsId: string }> }
) {
  try {
    const { savingsId } = await context.params;
    const data = await fetchFineractAPI(
      `/savingsaccounts/${savingsId}?associations=all`
    );
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create facility GET route**

Create `app/api/leads/[id]/facility/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSavingsAccountBalance } from "@/lib/fineract-savings-service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;

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

    // Fetch live balance from Fineract
    let liveBalance = facility.availableBalance;
    try {
      const balance = await getSavingsAccountBalance(facility.fineractSavingsAccountId);
      liveBalance = balance.availableBalance;
      // Sync to DB
      await prisma.revolvingCreditFacility.update({
        where: { id: facility.id },
        data: { availableBalance: liveBalance },
      });
    } catch {
      // Fall back to cached balance on Fineract error
    }

    const drawdownCount = facility.drawdowns.length;

    return NextResponse.json({
      ...facility,
      availableBalance: liveBalance,
      utilizedAmount: facility.creditLimit - liveBalance,
      drawdownCount,
      canDrawdown:
        drawdownCount < facility.maxDrawdowns && liveBalance > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create drawdown POST route**

Create `app/api/leads/[id]/facility/drawdown/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  withdrawFromSavingsAccount,
  getSavingsAccountBalance,
  formatFineractDate,
} from "@/lib/fineract-savings-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await context.params;
    const { amount, transactionDate, note } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const facility = await prisma.revolvingCreditFacility.findUnique({
      where: { leadId },
      include: { drawdowns: true },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Validate drawdown count
    if (facility.drawdowns.length >= facility.maxDrawdowns) {
      return NextResponse.json(
        { error: `Maximum drawdowns (${facility.maxDrawdowns}) reached` },
        { status: 400 }
      );
    }

    // Validate available balance
    const balance = await getSavingsAccountBalance(facility.fineractSavingsAccountId);
    if (amount > balance.availableBalance) {
      return NextResponse.json(
        { error: `Amount exceeds available balance of ${balance.availableBalance}` },
        { status: 400 }
      );
    }

    const dateStr = transactionDate
      ? formatFineractDate(new Date(transactionDate))
      : formatFineractDate(new Date());

    // Execute withdrawal in Fineract
    const { transactionId } = await withdrawFromSavingsAccount(
      facility.fineractSavingsAccountId,
      amount,
      dateStr,
      note
    );

    // Get updated balance
    const updatedBalance = await getSavingsAccountBalance(facility.fineractSavingsAccountId);

    // Create drawdown record and sync balance
    const [drawdown] = await prisma.$transaction([
      prisma.revolvingCreditDrawdown.create({
        data: {
          facilityId: facility.id,
          tenantId: facility.tenantId,
          requestedAmount: amount,
          disbursedAmount: amount,
          status: "DISBURSED",
          requestedByUserId: session.user.id,
          requestedByUserName: session.user.name ?? null,
          disbursedByUserId: session.user.id,
          disbursedByUserName: session.user.name ?? null,
          fineractTransactionId: transactionId,
          note: note ?? null,
          disbursedAt: new Date(),
        },
      }),
      prisma.revolvingCreditFacility.update({
        where: { id: facility.id },
        data: { availableBalance: updatedBalance.availableBalance },
      }),
    ]);

    return NextResponse.json({ success: true, drawdown, availableBalance: updatedBalance.availableBalance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create repayment POST route**

Create `app/api/leads/[id]/facility/repayment/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  depositToSavingsAccount,
  getSavingsAccountBalance,
  formatFineractDate,
} from "@/lib/fineract-savings-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await context.params;
    const { amount, transactionDate, note } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const facility = await prisma.revolvingCreditFacility.findUnique({
      where: { leadId },
      include: {
        drawdowns: {
          where: { status: "DISBURSED" },
          orderBy: { disbursedAt: "asc" },
          take: 1,
        },
      },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const targetDrawdown = facility.drawdowns[0];
    if (!targetDrawdown) {
      return NextResponse.json(
        { error: "No disbursed drawdown found to repay against" },
        { status: 400 }
      );
    }

    const dateStr = transactionDate
      ? formatFineractDate(new Date(transactionDate))
      : formatFineractDate(new Date());

    const { transactionId } = await depositToSavingsAccount(
      facility.fineractSavingsAccountId,
      amount,
      dateStr,
      note
    );

    const updatedBalance = await getSavingsAccountBalance(facility.fineractSavingsAccountId);

    await prisma.$transaction([
      prisma.revolvingCreditRepayment.create({
        data: {
          drawdownId: targetDrawdown.id,
          facilityId: facility.id,
          tenantId: facility.tenantId,
          amount,
          recordedByUserId: session.user.id,
          recordedByUserName: session.user.name ?? null,
          fineractTransactionId: transactionId,
          note: note ?? null,
          repaidAt: transactionDate ? new Date(transactionDate) : new Date(),
        },
      }),
      prisma.revolvingCreditFacility.update({
        where: { id: facility.id },
        data: { availableBalance: updatedBalance.availableBalance },
      }),
    ]);

    return NextResponse.json({ success: true, availableBalance: updatedBalance.availableBalance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "app/api/leads/[id]/facility/" "app/api/fineract/savings/"
git commit -m "feat: add facility GET, drawdown, and repayment API routes"
```

---

## Task 10: Drawdown and Repayment Modals

**Files:**
- Create: `app/(application)/leads/[id]/components/drawdown-modal.tsx`
- Create: `app/(application)/leads/[id]/components/repayment-modal.tsx`

- [ ] **Step 1: Create drawdown modal**

Create `app/(application)/leads/[id]/components/drawdown-modal.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

interface DrawdownModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leadId: string;
  availableBalance: number;
}

export function DrawdownModal({
  open,
  onClose,
  onSuccess,
  leadId,
  availableBalance,
}: DrawdownModalProps) {
  const { currencySymbol, formatAmount } = useCurrency();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amountNum > availableBalance) {
      setError(`Cannot exceed available balance of ${formatAmount(availableBalance)}`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/facility/drawdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, transactionDate: date, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSuccess();
      onClose();
      setAmount("");
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process drawdown");
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
            Available: <span className="font-medium text-foreground">{formatAmount(availableBalance)}</span>
          </p>
          <div className="space-y-1.5">
            <Label>Amount ({currencySymbol})</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              max={availableBalance}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Transaction Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Disburse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create repayment modal**

Create `app/(application)/leads/[id]/components/repayment-modal.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

interface RepaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leadId: string;
}

export function RepaymentModal({ open, onClose, onSuccess, leadId }: RepaymentModalProps) {
  const { currencySymbol } = useCurrency();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/facility/repayment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, transactionDate: date, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSuccess();
      onClose();
      setAmount("");
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record repayment");
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
          <div className="space-y-1.5">
            <Label>Amount ({currencySymbol})</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Repayment Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Repayment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/(application)/leads/[id]/components/drawdown-modal.tsx" \
        "app/(application)/leads/[id]/components/repayment-modal.tsx"
git commit -m "feat: add drawdown and repayment modals for RCF facility"
```

---

## Task 11: Facility Tab Component

**Files:**
- Create: `app/(application)/leads/[id]/components/facility-tab.tsx`

- [ ] **Step 1: Create the facility tab**

Create `app/(application)/leads/[id]/components/facility-tab.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCurrency } from "@/contexts/currency-context";
import { DrawdownModal } from "./drawdown-modal";
import { RepaymentModal } from "./repayment-modal";

interface FacilityTabProps {
  leadId: string;
  fineractClientId: number | null;
}

export function FacilityTab({ leadId, fineractClientId }: FacilityTabProps) {
  const { formatAmount } = useCurrency();
  const [facility, setFacility] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drawdownOpen, setDrawdownOpen] = useState(false);
  const [repaymentOpen, setRepaymentOpen] = useState(false);

  const fetchFacility = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/facility`);
      if (res.ok) {
        setFacility(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchFacility();
  }, [fetchFacility]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Facility not yet activated. Complete the approval pipeline to activate.
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "DISBURSED": return "default";
      case "REQUESTED": return "secondary";
      case "REJECTED": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Credit Limit", value: formatAmount(facility.creditLimit) },
          { label: "Utilized", value: formatAmount(facility.utilizedAmount) },
          { label: "Available", value: formatAmount(facility.availableBalance) },
          { label: "Drawdowns", value: `${facility.drawdownCount} / ${facility.maxDrawdowns}` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Savings account link */}
      {fineractClientId && facility.fineractSavingsAccountId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Savings Account #{facility.fineractSavingsAccountId}</span>
          <Link
            href={`/clients/${fineractClientId}/savings/${facility.fineractSavingsAccountId}`}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            View full details <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Drawdowns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Drawdowns</h3>
          <Button
            size="sm"
            disabled={!facility.canDrawdown}
            onClick={() => setDrawdownOpen(true)}
            title={
              !facility.canDrawdown
                ? facility.drawdownCount >= facility.maxDrawdowns
                  ? "Maximum drawdowns reached"
                  : "No available balance"
                : undefined
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Request Drawdown
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Officer</TableHead>
                <TableHead>Fineract Ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facility.drawdowns?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                    No drawdowns yet
                  </TableCell>
                </TableRow>
              ) : (
                facility.drawdowns?.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">
                      {new Date(d.disbursedAt ?? d.requestedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">{formatAmount(d.disbursedAmount ?? d.requestedAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(d.status)}>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.disbursedByUserName ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.fineractTransactionId ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Repayments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Repayments</h3>
          <Button size="sm" variant="outline" onClick={() => setRepaymentOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Record Repayment
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead>Fineract Ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facility.drawdowns?.flatMap((d: any) => d.repayments ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">
                    No repayments yet
                  </TableCell>
                </TableRow>
              ) : (
                facility.drawdowns
                  ?.flatMap((d: any) => d.repayments ?? [])
                  .sort((a: any, b: any) => new Date(b.repaidAt).getTime() - new Date(a.repaidAt).getTime())
                  .map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{new Date(r.repaidAt).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{formatAmount(r.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.recordedByUserName ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.fineractTransactionId ?? "—"}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DrawdownModal
        open={drawdownOpen}
        onClose={() => setDrawdownOpen(false)}
        onSuccess={fetchFacility}
        leadId={leadId}
        availableBalance={facility.availableBalance}
      />

      <RepaymentModal
        open={repaymentOpen}
        onClose={() => setRepaymentOpen(false)}
        onSuccess={fetchFacility}
        leadId={leadId}
      />
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
git add "app/(application)/leads/[id]/components/facility-tab.tsx"
git commit -m "feat: add FacilityTab component with drawdown and repayment UI"
```

---

## Task 12: Wire Facility Tab into Lead Detail Tabs

**Files:**
- Modify: `app/(application)/leads/[id]/components/lead-detail-tabs.tsx`

- [ ] **Step 1: Add import**

At the top of `lead-detail-tabs.tsx`, add:

```typescript
import { FacilityTab } from "./facility-tab";
import { LayoutGrid } from "lucide-react";
```

- [ ] **Step 2: Add Facility to TABS array**

In `lead-detail-tabs.tsx`, `TABS` is defined around line 79. Do **not** add Facility to this array — it will be conditionally rendered separately to avoid polluting the standard tabs flow.

- [ ] **Step 3: Update LeadDetailTabsProps**

Add `facilityType` and `fineractClientId` is already in props. Add `facilityType`:

```typescript
interface LeadDetailTabsProps {
  leadId: string;
  fineractClientId: number | null;
  fineractLoanId: number | null;
  requestedAmount: number | null;
  currentStage: string;
  clientTypeName?: string;
  clientDatatables: any[];
  datatableData: Record<string, any>;
  clientDocuments: any[];
  loanDocuments: any[];
  readOnly: boolean;
  canEditPendingLoanApplication: boolean;
  facilityType?: string | null;   // ADD THIS
}
```

- [ ] **Step 4: Add the Facility tab to the TabsList**

Find the `<TabsList>` render and the `{TABS.map(...)}` block. After the mapped tabs, add:

```typescript
{facilityType === "REVOLVING_CREDIT" && (
  <TabsTrigger value="facility" className="...same className as others...">
    <LayoutGrid className="h-3.5 w-3.5" />
    <span className="hidden sm:inline ml-1.5">Facility</span>
    <span className="sm:hidden ml-1.5">Facility</span>
  </TabsTrigger>
)}
```

- [ ] **Step 5: Add the TabsContent**

After all the existing `{TABS.map(tab => <TabsContent ...>)}` blocks, add:

```typescript
{facilityType === "REVOLVING_CREDIT" && (
  <TabsContent value="facility" className="mt-0">
    <FacilityTab leadId={leadId} fineractClientId={fineractClientId} />
  </TabsContent>
)}
```

- [ ] **Step 6: Pass facilityType from the parent page**

Find where `LeadDetailTabs` is rendered in `app/(application)/leads/[id]/page.tsx` (or whichever server component renders it). Pass `facilityType={lead.facilityType}` to the component. You'll need to include `facilityType` in the lead query if it's not already fetched.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Manual verify**

Open a term loan lead → Facility tab should NOT appear.  
Open an RCF lead (facilityType = REVOLVING_CREDIT) → Facility tab should appear.

- [ ] **Step 9: Commit**

```bash
git add "app/(application)/leads/[id]/components/lead-detail-tabs.tsx" \
        "app/(application)/leads/[id]/page.tsx"
git commit -m "feat: add Facility tab to lead detail page for RCF leads"
```

---

## Task 13: Savings Detail Page

**Files:**
- Create: `app/(application)/clients/[id]/savings/[savingsId]/page.tsx`
- Create: `app/(application)/clients/[id]/savings/[savingsId]/components/savings-overview.tsx`
- Create: `app/(application)/clients/[id]/savings/[savingsId]/components/drawdown-list.tsx`
- Create: `app/(application)/clients/[id]/savings/[savingsId]/components/repayment-list.tsx`
- Create: `app/(application)/clients/[id]/savings/[savingsId]/components/transaction-log.tsx`

- [ ] **Step 1: Create the page shell**

Create `app/(application)/clients/[id]/savings/[savingsId]/page.tsx`:

```typescript
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SavingsOverview } from "./components/savings-overview";
import { DrawdownList } from "./components/drawdown-list";
import { RepaymentList } from "./components/repayment-list";
import { TransactionLog } from "./components/transaction-log";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string; savingsId: string }>;
}

export default async function SavingsDetailPage({ params }: PageProps) {
  const { id, savingsId } = await params;
  const clientId = parseInt(id);
  const savingsIdNum = parseInt(savingsId);

  if (isNaN(clientId) || isNaN(savingsIdNum)) {
    notFound();
  }

  const facility = await prisma.revolvingCreditFacility.findFirst({
    where: { fineractSavingsAccountId: savingsIdNum },
    select: { id: true, leadId: true, creditLimit: true, maxDrawdowns: true },
  });

  return (
    <div className="space-y-4">
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href="/clients" className="hover:text-foreground transition-colors">Clients</Link>
        <span>/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-foreground transition-colors">Client #{clientId}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Savings Account #{savingsId}</span>
      </nav>

      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-xl font-semibold">Revolving Credit Facility</h1>
          <p className="text-sm text-muted-foreground">Savings Account #{savingsId}</p>
        </div>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>}>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="drawdowns">Drawdowns</TabsTrigger>
            <TabsTrigger value="repayments">Repayments</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <SavingsOverview savingsId={savingsIdNum} facility={facility} />
          </TabsContent>
          <TabsContent value="drawdowns" className="mt-4">
            <DrawdownList facilityId={facility?.id ?? null} />
          </TabsContent>
          <TabsContent value="repayments" className="mt-4">
            <RepaymentList facilityId={facility?.id ?? null} />
          </TabsContent>
          <TabsContent value="transactions" className="mt-4">
            <TransactionLog savingsId={savingsIdNum} />
          </TabsContent>
        </Tabs>
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Create SavingsOverview**

Create `app/(application)/clients/[id]/savings/[savingsId]/components/savings-overview.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

interface SavingsOverviewProps {
  savingsId: number;
  facility: { id: string; leadId: string; creditLimit: number; maxDrawdowns: number } | null;
}

export function SavingsOverview({ savingsId, facility }: SavingsOverviewProps) {
  const { formatAmount } = useCurrency();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/fineract/savings/${savingsId}`)
      .then((r) => r.json())
      .then(setAccount)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [savingsId]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Credit Limit", value: formatAmount(facility?.creditLimit ?? 0) },
          { label: "Account Balance", value: formatAmount(account?.summary?.accountBalance ?? 0) },
          { label: "Available Balance", value: formatAmount(account?.summary?.availableBalance ?? 0) },
          { label: "Status", value: account?.status?.value ?? "—" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Account Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Account Number</span>
            <span className="font-medium">{account?.accountNo ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Product</span>
            <span>{account?.savingsProductName ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interest Rate</span>
            <span>{account?.nominalAnnualInterestRate ?? "—"}% p.a.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max Drawdowns</span>
            <span>{facility?.maxDrawdowns ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={account?.status?.active ? "default" : "secondary"}>
              {account?.status?.value ?? "—"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create DrawdownList**

Create `app/(application)/clients/[id]/savings/[savingsId]/components/drawdown-list.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

export function DrawdownList({ facilityId }: { facilityId: string | null }) {
  const { formatAmount } = useCurrency();
  const [drawdowns, setDrawdowns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!facilityId) { setLoading(false); return; }
    fetch(`/api/rcf/facilities/${facilityId}/drawdowns`)
      .then((r) => r.json())
      .then((d) => setDrawdowns(d.drawdowns ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [facilityId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Officer</TableHead>
            <TableHead>Fineract Ref</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drawdowns.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No drawdowns</TableCell></TableRow>
          ) : (
            drawdowns.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{new Date(d.disbursedAt ?? d.requestedAt).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{formatAmount(d.disbursedAmount ?? d.requestedAmount)}</TableCell>
                <TableCell><Badge>{d.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{d.disbursedByUserName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{d.fineractTransactionId ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

> **Note:** `DrawdownList` and `RepaymentList` use a `/api/rcf/facilities/[id]/drawdowns` endpoint. Create `app/api/rcf/facilities/[id]/drawdowns/route.ts` and `app/api/rcf/facilities/[id]/repayments/route.ts` that query `prisma.revolvingCreditDrawdown` and `prisma.revolvingCreditRepayment` by `facilityId`. Follow the same pattern as other API routes in the codebase (`getTenantBySlug`, `extractTenantSlugFromRequest`).

- [ ] **Step 4: Create RepaymentList**

Create `app/(application)/clients/[id]/savings/[savingsId]/components/repayment-list.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

export function RepaymentList({ facilityId }: { facilityId: string | null }) {
  const { formatAmount } = useCurrency();
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!facilityId) { setLoading(false); return; }
    fetch(`/api/rcf/facilities/${facilityId}/repayments`)
      .then((r) => r.json())
      .then((d) => setRepayments(d.repayments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [facilityId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Recorded By</TableHead>
            <TableHead>Fineract Ref</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repayments.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No repayments</TableCell></TableRow>
          ) : (
            repayments.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.repaidAt).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{formatAmount(r.amount)}</TableCell>
                <TableCell className="text-muted-foreground">{r.recordedByUserName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.fineractTransactionId ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 5: Create TransactionLog**

Create `app/(application)/clients/[id]/savings/[savingsId]/components/transaction-log.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

export function TransactionLog({ savingsId }: { savingsId: number }) {
  const { formatAmount } = useCurrency();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/fineract/savings/${savingsId}`)
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [savingsId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Running Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No transactions</TableCell></TableRow>
          ) : (
            transactions.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell>{t.date ? new Date(t.date[0], t.date[1] - 1, t.date[2]).toLocaleDateString() : "—"}</TableCell>
                <TableCell><Badge variant="outline">{t.transactionType?.value ?? "—"}</Badge></TableCell>
                <TableCell className="font-medium">{formatAmount(t.amount)}</TableCell>
                <TableCell className="text-muted-foreground">{formatAmount(t.runningBalance)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 6: Create the supporting API routes for DrawdownList and RepaymentList**

Create `app/api/rcf/facilities/[id]/drawdowns/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: facilityId } = await context.params;
    const drawdowns = await prisma.revolvingCreditDrawdown.findMany({
      where: { facilityId },
      orderBy: { requestedAt: "desc" },
    });
    return NextResponse.json({ drawdowns });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Create `app/api/rcf/facilities/[id]/repayments/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: facilityId } = await context.params;
    const repayments = await prisma.revolvingCreditRepayment.findMany({
      where: { facilityId },
      orderBy: { repaidAt: "desc" },
    });
    return NextResponse.json({ repayments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add "app/(application)/clients/[id]/savings/" "app/api/rcf/"
git commit -m "feat: add savings/facility detail page and RCF facility API routes"
```

---

## Task 14: Tenant Settings — hasRevolvingCredit Toggle

**Files:**
- Create: `app/api/tenant/features/route.ts`

The `hasRevolvingCredit` flag lives in `tenant.settings.features`. We need a PATCH endpoint so the settings UI can toggle it. The settings UI itself lives wherever tenant configuration is managed in the app — locate it and add the toggle there.

- [ ] **Step 1: Create the features PATCH route**

Create `app/api/tenant/features/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlugFromRequest, getTenantBySlug } from "@/lib/tenant-service";
import { DEFAULT_FEATURES, TenantFeatures } from "@/shared/types/tenant";

export async function PATCH(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const currentSettings = (tenant.settings as any) ?? {};
    const currentFeatures: TenantFeatures = {
      ...DEFAULT_FEATURES,
      ...(currentSettings.features ?? {}),
    };

    const updatedFeatures: TenantFeatures = {
      ...currentFeatures,
      ...body, // only allow known TenantFeatures keys
    };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        settings: {
          ...currentSettings,
          features: updatedFeatures,
        },
      },
    });

    return NextResponse.json({ success: true, features: updatedFeatures });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const currentSettings = (tenant.settings as any) ?? {};
    const features: TenantFeatures = { ...DEFAULT_FEATURES, ...(currentSettings.features ?? {}) };
    return NextResponse.json({ features });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Find and update the tenant settings UI**

Search for the page where tenant/org settings are configured in the app:

```bash
grep -r "skipAffordabilityForCompanies\|hasInvoiceDiscounting\|features.*toggle\|TenantFeatures" \
  app --include="*.tsx" -l
```

In whichever settings page manages feature flags, add a `Switch` for Revolving Credit Facility that calls `PATCH /api/tenant/features` with `{ hasRevolvingCredit: true/false }`. Follow the existing pattern for other feature toggles on that page.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/api/tenant/features/route.ts"
git commit -m "feat: add tenant features PATCH API for toggling hasRevolvingCredit"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] Navigating to `/leads/new` with `hasRevolvingCredit: false` → redirects to `/leads/new/loan` immediately
- [ ] Navigating to `/leads/new` with `hasRevolvingCredit: true` → shows product selector cards
- [ ] Clicking "Term Loan" on selector → existing form at `/leads/new/loan` works identically to before
- [ ] Clicking "RCF" → RCF wizard at `/leads/new/rcf` loads
- [ ] RCF wizard: completing client step creates a lead with `facilityType: REVOLVING_CREDIT`
- [ ] RCF wizard: Facility Terms step saves `creditLimit`, `savingsProductId`, `maxDrawdowns` to lead
- [ ] RCF lead detail page: "Facility" tab is visible only for RCF leads
- [ ] Facility tab: shows 4 stat cards (Credit Limit, Utilized, Available, Drawdowns Used)
- [ ] Drawdown modal: validates amount against available balance, calls Fineract withdrawal, creates DB record
- [ ] Repayment modal: calls Fineract deposit, creates DB record, updates available balance
- [ ] `/clients/{id}/savings/{savingsId}` loads with all 4 tabs working
- [ ] Term loan leads are completely unaffected
