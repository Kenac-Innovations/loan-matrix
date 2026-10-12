# Salary Advance Limit Quote — Integration Design

**Date:** 2026-08-21
**Related:** GFL-SA-USSD-01 §6 (Customer Journey), `docs/superpowers/specs/2026-08-21-cde-salary-advance-limit-formula-design.md`, and `SALARY_ADVANCE_LIMIT_ENGINE_PLAN.md` in the `cde` repo
**Status:** Draft — for review before any code is written

## Branch note

Read against `origin/main` @ `742d5c6`. loan-matrix has no `dev` branch — `main` is the only shared trunk (the local checkout at scan time was actually a detached `origin/fix/journal-search-gl-account-search`, but everything below was read via `git show origin/main:...`, not from that checkout). Like the `cde` repo, this sandbox can't `git fetch`, so this reflects the last locally-fetched state of `origin/main` — run `git fetch` before starting if you want a guaranteed-current read.

## Why this is needed

GFL-SA-USSD-01 §6 step 3 requires the *774# menu to display the customer's approved limit before they pick an amount, and before any loan exists in Fineract. Today, `lib/cde-utils.ts`'s `buildCDEPayload` and the `/api/cde/evaluate` → `call-cde` route only ever validate a `requestedAmount` that already exists on a Fineract loan (`fineractLoan.principal`/`approvedPrincipal`/`proposedPrincipal`, or `lead.requestedAmount`). There's no existing call in this repo that asks "what's this customer's ceiling" ahead of loan creation — that's a new capability, provided by the new `POST /api/v1/salary-advance/limit-quote` endpoint being added to the `cde` repo (see the companion plan there).

This document covers only the loan-matrix side: calling that new endpoint at the right point in the journey. It does not touch `lib/cde-utils.ts`, `app/api/cde/evaluate/route.ts`, `app/api/leads/[id]/call-cde/route.ts`, or `lib/team-state-machine-service.ts` — none of them need to change for this.

## Open question that blocks a precise task list

`lib/ussd-loan-processing-service.ts` exists in this repo, but a separate `USSD` repo also exists as a sibling under the user's `KENAC/REPOS` folder and was not in scope for this scan. Before writing tasks, confirm: does loan-matrix's `ussd-loan-processing-service.ts` own the *774# session/menu logic for Salary Advance, or does the `USSD` gateway repo render menus and call into loan-matrix (or directly into CDE) at the relevant step? The integration point differs depending on the answer:

- **If loan-matrix owns it:** add a new function (e.g. `getSalaryAdvanceLimitQuote(customerId, tenantId)`) alongside the existing CDE call helpers in `lib/cde-utils.ts` or a new `lib/salary-advance-limit-quote.ts`, and call it from wherever `ussd-loan-processing-service.ts` currently handles the Salary Advance menu step, before creating the Fineract loan.
- **If the `USSD` repo owns it:** loan-matrix's job shrinks to just exposing a thin proxy route (e.g. `app/api/salary-advance/limit-quote/route.ts`) that forwards to CDE's new endpoint with tenant resolution, and the `USSD` repo calls that route. That's a much smaller change here, with the session-caching question (below) living in the `USSD` repo instead.

## Design (once the above is confirmed)

1. New server-side call, alongside the existing `callCDEAndStore`-style helpers, to `POST {CDE_BASE_URL}/api/v1/salary-advance/limit-quote` — same auth/tenant-resolution pattern already used for `/api/cde/evaluate` (reuse `getFineractTenantId` and the existing CDE base URL config; don't introduce a second CDE client configuration).
2. Session caching: recommend caching the quoted limit for the duration of the USSD session (keyed on mobile number + session/application reference), rather than re-quoting on every menu render, so the customer sees a stable number as they navigate the menu and so CDE isn't hit on every keypress. TTL should match the existing USSD session timeout referenced in GFL-SA-USSD-01 §8 ("Session timeout and retry limits apply in line with existing USSD platform standards") rather than inventing a new one.
3. First-time/unscored customers: the CDE endpoint already returns the flat default limit (500) for these per its own spec — no special-casing needed on this side.
4. Failure handling: if the quote call fails or times out, GFL-SA-USSD-01 doesn't define a fallback explicitly. Recommend defaulting to the ZMW 500 base tier (fail-safe to the guaranteed floor) rather than blocking the whole USSD session or exposing an error to the customer — flagging this as a decision for whoever owns the USSD error-handling conventions, since it's a product/UX call, not a technical one.

## Non-goals

- No changes to the existing post-application `LoanDecisionService`/`call-cde` validation flow — that continues to run unchanged once the customer has picked an amount and the Fineract loan is created.
- No changes to Nano Loan's limit progression, which is unrelated and unaffected.
