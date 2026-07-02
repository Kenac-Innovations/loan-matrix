# CDE Auto-Disbursement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically move configured leads from a trigger stage through disbursement when CDE returns an allowed decision, and show the run outcome in the CDE tab.

**Architecture:** Add a tenant-settings-backed policy layer that decides when a lead qualifies for auto-disbursement, then invoke that policy from the existing team-aware state machine after a successful transition. Reuse the current Fineract approve/disburse/payout path and expose run metadata through the existing complete-details payload to the CDE UI.

**Tech Stack:** Next.js App Router, React, Prisma, tenant JSON settings, existing CDE server utilities, `tsx --test`

---

### Task 1: Add typed policy support for tenant-configured auto-disbursement rules

**Files:**
- Modify: `shared/types/tenant.ts`
- Create: `lib/lead-auto-disbursement-policy.ts`
- Test: `lib/__tests__/lead-auto-disbursement-policy.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests that prove:

- an enabled rule matches by `loanProductId` and `triggerStageId`
- `APPROVED` and `MANUAL_REVIEW` are allowed when configured
- `DECLINED` is rejected
- completed/disbursed states are treated as ineligible

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test lib/__tests__/lead-auto-disbursement-policy.test.ts`
Expected: FAIL because the helper and types do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add the tenant types for `autoProgressToDisbursementRules` and implement a helper module that:

- reads rules from tenant settings
- finds the matching rule for a lead
- checks whether a CDE decision is allowed
- detects whether a lead should skip auto-run because it is already completed

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test lib/__tests__/lead-auto-disbursement-policy.test.ts`
Expected: PASS.

### Task 2: Add failing orchestration tests for CDE-gated auto-progression

**Files:**
- Modify: `lib/__tests__/team-state-machine-service.test.ts` or create `lib/__tests__/team-state-machine-auto-disbursement.test.ts`

- [ ] **Step 1: Write the failing test**

Add focused service tests that prove:

- entering the trigger stage calls CDE
- `APPROVED` continues forward
- `MANUAL_REVIEW` also continues forward
- `DECLINED` records a stopped status and does not progress
- missing payment type resolution records a failure

Mock only the outer dependencies needed for CDE, payment-type lookup, and transition recursion.

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test lib/__tests__/team-state-machine-auto-disbursement.test.ts`
Expected: FAIL because the auto-progression orchestration does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Extend `lib/team-state-machine-service.ts` with helpers that:

- detect eligible post-transition leads
- call `callCDEAndStore`
- resolve payment details from `preferredPaymentMethod`
- iterate through next transitions until disbursement succeeds or a blocking stop occurs
- persist `stateMetadata.autoDisbursement`

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test lib/__tests__/team-state-machine-auto-disbursement.test.ts`
Expected: PASS.

### Task 3: Expose automation metadata through the lead details payload

**Files:**
- Modify: `app/api/leads/[id]/complete-details/route.ts`
- Test: `lib/__tests__/lead-complete-details-auto-disbursement.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that proves the complete-details payload returns:

- `cdeResult`
- `autoDisbursement` metadata from `stateMetadata`

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test lib/__tests__/lead-complete-details-auto-disbursement.test.ts`
Expected: FAIL because the payload does not yet expose the new field.

- [ ] **Step 3: Write minimal implementation**

Update the route payload to include `stateMetadata.autoDisbursement` in a stable shape for the CDE UI.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test lib/__tests__/lead-complete-details-auto-disbursement.test.ts`
Expected: PASS.

### Task 4: Show auto-disbursement outcome in the CDE tab

**Files:**
- Modify: `app/(application)/leads/[id]/components/lead-cde.tsx`
- Test: `lib/__tests__/lead-cde-auto-disbursement-view.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a UI test or focused render test that proves the component shows:

- auto-disbursement status
- CDE decision used
- last completed stage
- stop reason

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test lib/__tests__/lead-cde-auto-disbursement-view.test.tsx`
Expected: FAIL because the section does not yet render.

- [ ] **Step 3: Write minimal implementation**

Update `lead-cde.tsx` to render an Auto Disbursement summary card using the new payload field, while preserving the existing CDE result display.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test lib/__tests__/lead-cde-auto-disbursement-view.test.tsx`
Expected: PASS.

### Task 5: Verify the integrated feature

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run:

```bash
./node_modules/.bin/tsx --test lib/__tests__/lead-auto-disbursement-policy.test.ts
./node_modules/.bin/tsx --test lib/__tests__/team-state-machine-auto-disbursement.test.ts
./node_modules/.bin/tsx --test lib/__tests__/lead-complete-details-auto-disbursement.test.ts
./node_modules/.bin/tsx --test lib/__tests__/lead-cde-auto-disbursement-view.test.tsx
```

Expected: All PASS.

- [ ] **Step 2: Run targeted lint/type checks for changed files**

Run:

```bash
./node_modules/.bin/eslint shared/types/tenant.ts lib/lead-auto-disbursement-policy.ts lib/team-state-machine-service.ts app/api/leads/[id]/complete-details/route.ts app/(application)/leads/[id]/components/lead-cde.tsx lib/__tests__/lead-auto-disbursement-policy.test.ts lib/__tests__/team-state-machine-auto-disbursement.test.ts lib/__tests__/lead-complete-details-auto-disbursement.test.ts lib/__tests__/lead-cde-auto-disbursement-view.test.tsx
```

Expected: No errors in the changed files.
