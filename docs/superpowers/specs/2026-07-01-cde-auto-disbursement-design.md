# CDE Auto-Disbursement Design

**Date:** 2026-07-01

## Goal

Automatically progress a lead for a configured loan product from a configured trigger stage through approval, disbursement, and payout when the Credit Decision Engine returns an allowed recommendation.

## Scope

This design covers:

1. Product-and-stage-scoped auto-progression configuration.
2. Server-side CDE evaluation and decision gating.
3. Automatic stage progression through the existing state machine.
4. CDE tab visibility for the automation attempt and outcome.

This design does not introduce a new queue worker, a new manual action, or a new Prisma table.

## Current Behavior

The system already:

- stores CDE results in `lead.stateMetadata.cdeResult`
- renders the CDE decision in the lead header and CDE tab
- performs manual stage transitions through `app/api/leads/[id]/transition/route.ts`
- executes Fineract actions like `approve`, `disburse`, and combined payout inside `lib/team-state-machine-service.ts`

CDE is currently advisory only. The lead state manager explicitly treats it as manual-review guidance, and no existing flow auto-continues a lead all the way to disbursement based on a CDE result.

## Proposed Behavior

When a lead enters a configured trigger stage for a configured loan product:

1. The backend calls CDE using the existing server utility.
2. The latest CDE result is stored on the lead.
3. If the decision is `APPROVED` or `MANUAL_REVIEW`, the backend automatically advances the lead through the remaining pipeline stages until the disbursement path completes or a blocking failure occurs.
4. If the decision is `DECLINED`, the auto-run stops immediately and records that reason.
5. If any transition, Fineract action, payment resolution, or payout validation fails, the auto-run stops and records the failure without retrying blindly.

The automation should be transparent in the CDE tab, including whether it ran, how far it progressed, and why it stopped.

## Configuration Model

The first version should store rules in tenant settings instead of adding a new table.

Add an optional `autoProgressToDisbursementRules` array to `TenantSettings`. Each rule should contain:

- `enabled`
- `loanProductId`
- `triggerStageId`
- `allowedCdeDecisions`

For this feature, `allowedCdeDecisions` should support `APPROVED` and `MANUAL_REVIEW`. The initial target configuration will enable both for the selected product and trigger stage.

This keeps the rule tenant-scoped and avoids changing the generic pipeline-stage schema for behavior that only applies to specific products.

## Architecture

### Auto-Disbursement Policy Helper

Add a focused helper module to resolve:

- whether the tenant has a matching enabled rule
- whether the lead matches that rule by product and current stage
- whether the CDE decision is allowed
- whether the lead is already completed or otherwise ineligible for another run

This module should stay pure where possible so it is easy to test.

### Transition Orchestration

The orchestration belongs in `lib/team-state-machine-service.ts`, because that is already the canonical place for:

- validating transitions
- executing Fineract lifecycle actions
- combining disbursement and payout
- recording state transitions and lead metadata

After a normal transition succeeds, the service should check whether the updated lead now matches an auto-progression rule. If it does, the service should:

1. call CDE and store the result
2. decide whether the run may continue
3. iteratively move the lead forward using the same transition engine

The auto-run should reuse the existing transition execution path rather than duplicating approval, disbursement, or payout logic in a second service.

### Payment Resolution

The auto-run must resolve `paymentTypeId` on the server from the lead’s `preferredPaymentMethod`. Reuse `lib/payment-method-resolution.ts` to map:

- `CASH`
- `MOBILE_MONEY`
- `BANK_TRANSFER`

to a concrete Fineract payment type from the available payment types.

If the lead cannot resolve to a valid payment type, the auto-run stops and records the reason. Existing cashier and payout safety checks remain in force.

### Lead Metadata

Store a compact audit object under `lead.stateMetadata.autoDisbursement`, including:

- matched rule summary
- latest CDE decision used
- status
- triggered timestamp
- attempted stages
- last completed stage
- stop reason
- actor

The existing `stateTransitions` trail should also record auto-run events so the pipeline history remains readable.

## CDE Tab Behavior

The CDE tab should continue showing the raw CDE result and gain a new auto-disbursement summary section with:

- status
- trigger stage
- CDE decision used
- last attempted time
- last completed stage
- stop reason, when present

This makes the tab the single place to inspect both the recommendation and what the system did with it.

## Safeguards

- Do not run when the lead already has a disbursed loan or completed payout state.
- Do not re-run completed automation on repeated visits or repeated transitions into the same stage.
- Stop immediately on `DECLINED`.
- Stop on CDE call failure and record the failure.
- Stop on missing payment type resolution or payout restrictions.
- Stop on any failed downstream Fineract action and preserve the exact error message.

## Files

- Modify `shared/types/tenant.ts`
  Add tenant settings types for auto-disbursement rules.
- Add `lib/lead-auto-disbursement-policy.ts`
  Encapsulate rule matching, decision gating, and metadata helpers.
- Modify `lib/team-state-machine-service.ts`
  Trigger CDE-backed auto-progression after eligible stage entry.
- Modify `app/api/leads/[id]/complete-details/route.ts`
  Expose auto-disbursement metadata to the CDE UI.
- Modify `app/(application)/leads/[id]/components/lead-cde.tsx`
  Show automation status and stop reason.
- Add tests under `lib/__tests__`
  Cover rule matching, decision gating, and transition orchestration behavior.

## Testing

1. Matching rule:
   lead product and trigger stage match, rule is enabled, and decision is allowed.
2. Non-matching rule:
   no auto-run happens.
3. CDE decision `APPROVED`:
   lead progresses through approval/disbursement path.
4. CDE decision `MANUAL_REVIEW`:
   lead also progresses.
5. CDE decision `DECLINED`:
   automation stops and records the reason.
6. Missing payment type:
   automation stops before disbursement.
7. Already disbursed loan:
   automation does nothing.
8. CDE tab:
   UI displays automation status and stop reason from the payload.
