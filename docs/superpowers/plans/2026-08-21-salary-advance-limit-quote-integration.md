# Salary Advance Limit Quote Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Call the new CDE `POST /api/v1/salary-advance/limit-quote` endpoint at the point in the *774# journey where GFL-SA-USSD-01 §6 step 3 needs to display the customer's approved limit, before a Fineract loan exists.

**Blocking question — resolve before Task 1:** does `lib/ussd-loan-processing-service.ts` in this repo own the *774# Salary Advance menu step, or does the separate `USSD` gateway repo (sibling under `KENAC/REPOS`, not scanned here) own it and call into loan-matrix? See `docs/superpowers/specs/2026-08-21-salary-advance-limit-quote-integration-design.md` for the two resulting shapes. Task 1 below assumes loan-matrix owns it (Branch A); if it's Branch B, Task 1 shrinks to a thin proxy route and Tasks 2–3 move to the `USSD` repo.

---

### Task 1 (Branch A — loan-matrix owns the *774# step): Add the limit-quote client call

**Files:**
- Create: `lib/salary-advance-limit-quote.ts`
- Test: `lib/__tests__/salary-advance-limit-quote.test.ts`

- [ ] **Step 1: Write the failing test**

Prove: a successful quote call returns the parsed `LimitQuoteResult`; a failed/timed-out call returns the fail-safe default (ZMW 500) rather than throwing; tenant resolution reuses `getFineractTenantId` the same way `lib/cde-utils.ts` does for `/api/cde/evaluate`.

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test lib/__tests__/salary-advance-limit-quote.test.ts`
Expected: FAIL because the module doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Add `getSalaryAdvanceLimitQuote(customerId, tenantId)`, calling CDE's new endpoint with the same base-URL/auth configuration as the existing CDE calls in `lib/cde-utils.ts` (don't introduce a second CDE client config). On failure, return `{ approvedLimit: 500, source: "FALLBACK_DEFAULT" }`.

- [ ] **Step 4: Run test to verify it passes**

### Task 2: Session caching for the quoted limit

**Files:**
- Modify: wherever `lib/ussd-loan-processing-service.ts` handles session state for the Salary Advance menu
- Test: extend existing USSD session tests, or add `lib/__tests__/ussd-salary-advance-limit-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Prove: the first menu render for a session calls the quote function once and caches the result; subsequent renders within the same session reuse the cached value without a second call; the cache expires in line with the existing USSD session timeout (per GFL-SA-USSD-01 §8 — reuse whatever constant/config already governs that timeout, don't add a new one).

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**

- [ ] **Step 4: Run test to verify it passes**

### Task 3: Wire into the Salary Advance menu step

**Files:**
- Modify: the Salary Advance branch of `lib/ussd-loan-processing-service.ts`

- [ ] **Step 1: Write the failing test**

Prove: the menu step that currently would need a hardcoded/placeholder limit now calls `getSalaryAdvanceLimitQuote` (via the Task 2 cache) and displays the returned amount; amount selection is validated against that ceiling.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**

- [ ] **Step 4: Run test to verify it passes**

### Task 4: Verify the integrated feature

- [ ] Run all tests added above.
- [ ] Confirm no changes were made to `lib/cde-utils.ts`, `app/api/cde/evaluate/route.ts`, `app/api/leads/[id]/call-cde/route.ts`, or `lib/team-state-machine-service.ts` — this integration is additive only, per the design doc's non-goals.
- [ ] Manually walk the *774# flow in a lower environment for one repeat customer and one first-time customer, confirming the displayed limit matches what CDE's `/limit-quote` returns directly.
