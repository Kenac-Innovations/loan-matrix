# Invoice Discounting Module Plan (Integrated Lead Flow)

## Goal
Implement invoice discounting as a **first-class option inside the existing `/leads/new` wizard**, so users keep one lead creation journey and do not switch to a separate flow.

## Tenant Feature Gate (Required)
Invoice discounting must be **conditional per tenant** using tenant settings JSON:
- Source of truth: `tenant.settings.features.hasInvoiceDiscounting`
- Rule: module is enabled **only when** `hasInvoiceDiscounting === true`
- If missing/false: invoice-discounting UI, endpoints, and actions remain hidden/blocked.

## Current Codebase Findings
- Lead onboarding is centralized in [`app/(application)/leads/new/components/new-lead-form.tsx`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/(application)/leads/new/components/new-lead-form.tsx).
- Client creation/update and draft save run through [`app/api/leads/operations/route.ts`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/api/leads/operations/route.ts) plus server actions in [`app/actions/client-actions.ts`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/actions/client-actions.ts).
- Loan capture is split across:
  - [`components/loan-details-form.tsx`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/components/loan-details-form.tsx)
  - [`app/(application)/leads/new/components/loan-terms-form.tsx`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/(application)/leads/new/components/loan-terms-form.tsx)
  - [`app/(application)/leads/new/components/repayment-schedule-form.tsx`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/(application)/leads/new/components/repayment-schedule-form.tsx)
  - [`app/(application)/leads/new/components/loan-contracts.tsx`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/(application)/leads/new/components/loan-contracts.tsx)
- Lead DB model currently has no invoice-discounting-specific structure in [`prisma/schema.prisma`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/prisma/schema.prisma).
- There is no existing invoice/factoring implementation in the repo.
- The app already supports tenant feature flags via:
  - [`shared/types/tenant.ts`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/shared/types/tenant.ts)
  - [`app/api/tenant/features/route.ts`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/api/tenant/features/route.ts)

## Proposed Approach (Single Flow, Conditional Sections)
### 1) Add Product Mode on Lead (Term Loan vs Invoice Discounting)
- Add a lead-level discriminator (e.g., `facilityType`) to identify deal type.
- Keep default as current behavior (term loan) for backward compatibility.
- Use one wizard path; render invoice sections conditionally when `facilityType=INVOICE_DISCOUNTING`.

### 1.1) Add Tenant Feature Flag Wiring
- Extend `TenantFeatures` with `hasInvoiceDiscounting: boolean`.
- Set default in `DEFAULT_FEATURES` to `false` (safe default).
- Surface through existing feature-flag fetch path (`/api/tenant/features`) and `useFeatureFlags` consumers.
- UI rule:
  - `hasInvoiceDiscounting=false`: hide Invoice Discounting tab/sections completely.
  - `hasInvoiceDiscounting=true`: allow invoice-discounting capture in the lead wizard.

### 2) Capture Invoice Discounting Data in Structured Storage
- Add normalized invoice-discounting models in Prisma (recommended for reporting/querying), for example:
  - `InvoiceDiscountingCase` (1:1 with `Lead`)
  - `InvoiceDiscountingInvoice` (1:N with case)
  - optional `InvoiceDiscountingDebtor` if multiple debtors per lead are required
- Keep a compact summary in `Lead.stateMetadata` for existing UI patterns and transition history compatibility.

### 3) Extend Existing APIs (No Parallel Lead Creation API)
- Extend existing lead endpoints instead of creating a second lead-creation route:
  - enhance [`app/api/leads/[id]/loan-details/route.ts`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/api/leads/[id]/loan-details/route.ts) with `facilityType`.
  - add module endpoint(s) under existing lead namespace, e.g. `/api/leads/[id]/invoice-discounting`.
  - include invoice-discounting payload in [`app/api/leads/[id]/complete-details/route.ts`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/api/leads/[id]/complete-details/route.ts).
- Ensure draft/autosave and `createLeadWithClient` flows continue using the same lead id.
- Enforce tenant gate server-side:
  - For invoice-discounting routes/actions, return `403` when `hasInvoiceDiscounting !== true`.
  - Prevent bypass by direct API calls from disabled tenants.

### 4) Integrate UI into Existing `/leads/new` Wizard
- Keep current tab sequence and add a conditional invoice section/tab after Loan Details (or inside Loan Details, based on UX density).
- Update:
  - [`app/(application)/leads/new/components/new-lead-form.tsx`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/(application)/leads/new/components/new-lead-form.tsx)
  - [`components/loan-details-form.tsx`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/components/loan-details-form.tsx)
  - new component `invoice-discounting-form.tsx` under `app/(application)/leads/new/components/`.
- Maintain one completion state machine (`formCompletionStatus`) and one lead id lifecycle.
- Guard all invoice UI branches with `hasInvoiceDiscounting`.

### 5) Validation, Terms, and Submission Hooks
- Add invoice-discounting validations (required fields, totals, date rules, advance-rate caps).
- Update schedule/terms submission behavior to support invoice-based principal derivation where needed.
- Keep loan submission entrypoint unchanged (still through current loan creation flow), but enrich payload preparation from invoice data.

### 6) Lead Details Read Model
- Add invoice-discounting display blocks in lead details page so operations teams see all captured fields in one place:
  - [`app/(application)/leads/[id]/components/comprehensive-lead-details.tsx`](/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix/app/(application)/leads/[id]/components/comprehensive-lead-details.tsx)
- Only render these blocks when:
  - tenant has `hasInvoiceDiscounting=true`, and
  - lead is `facilityType=INVOICE_DISCOUNTING`.

## Invoice Discounting Data Set (MVP)
- Facility-level:
  - facility type, tenor, advance rate, recourse type, concentration limit, debtor terms
- Per-invoice:
  - invoice number, debtor name/id, invoice date, due date, gross amount, eligible amount, financed amount, status
- Controls:
  - total presented amount, total eligible amount, total financed amount, reserve/withhold amount
- Documents:
  - invoice copy, supporting delivery/PO proof, debtor acknowledgement/assignment (mapped via existing lead documents)

## Implementation Phases
1. **Schema + migration**
   - Add lead discriminator and invoice models.
   - Add `hasInvoiceDiscounting` to tenant feature typing/defaults.
2. **API contracts**
   - Add/extend lead endpoints; zod validation and transactional saves.
   - Add server-side feature gate checks (`403` when disabled).
3. **UI integration**
   - Conditional invoice section/tab in existing wizard with autosave and completion.
   - Hide module completely when `hasInvoiceDiscounting=false`.
4. **Submission integration**
   - Feed invoice-derived values into existing loan submission path.
5. **Lead details + reporting surface**
   - Display invoice module data in lead details and list context where useful.
6. **Testing + rollout**
   - Regression checks for non-invoice flow, backfill defaults, tenant-safe release.

## Test Plan
- Unit tests for payload validation and calculation helpers.
- API integration tests for:
  - create/update draft with `facilityType=INVOICE_DISCOUNTING`
  - invoice line CRUD + totals
  - compatibility with existing non-invoice leads
  - `403` behavior when tenant `hasInvoiceDiscounting=false`
- Manual E2E:
  - enabled tenant: create client -> save invoice module -> generate terms/schedule -> complete contracts -> submit loan.
  - disabled tenant: invoice module should not appear, and invoice API should reject direct calls.

## Risks & Mitigations
- Risk: breaking current loan flow.
  - Mitigation: default `facilityType=TERM_LOAN`, guarded conditional rendering, regression test checklist.
- Risk: partial persistence across multiple tabs.
  - Mitigation: transactional API writes + explicit completion guards.
- Risk: Fineract product mismatch.
  - Mitigation: configurable product eligibility list in tenant settings and validation before submission.
- Risk: UI hidden but API still writable.
  - Mitigation: mandatory backend feature checks in all invoice-discounting endpoints.

## Confirmed Build Decisions
- Debtor model: **single debtor** per invoice-discounting lead (MVP).
- Financed amount: **derived** from configured advance-rate rules (not manually entered as source of truth).
- Documentation: include a **required invoice-discounting document set** for compliance.
- Contracts: use the **existing current contract template** for now (no separate invoice-specific template in this phase).
- Tenant feature default: `hasInvoiceDiscounting` defaults to **false** unless explicitly enabled.

## Approval Gate
No implementation has been started yet.  
Once approved, I will execute this in phases and keep each phase backward-compatible with the current lead creation path.
