# USSD Consumer Auto-Disbursement Design

## Goal

When the Rabbit consumer receives an eligible USSD application, process it from
application ingestion through lead creation, Fineract loan creation, CDE
evaluation, and disbursement without requiring a user to open the application.

Only a CDE decision of `APPROVED` may continue automatically. `MANUAL_REVIEW`,
declined decisions, validation failures, and downstream service failures must
stop the workflow and remain visible for human intervention.

## Current Gap

The Rabbit consumer currently persists the USSD application and, for products
enabled by `ussdAutoLeadRules`, creates or reuses a Loan Matrix lead. It then
stops.

The remaining workflow is implemented in the USSD submit HTTP route:

- create or reuse the Fineract loan
- link the Fineract loan to the lead
- call CDE
- invoke the existing state-machine auto-progression

Because this logic is route-local, consumer-created leads cannot continue until
a user triggers the route through the UI.

## Approaches Considered

### Call the HTTP route from the consumer

This requires the worker to depend on application routing, network availability,
and request behavior. It also leaves core loan-processing logic inside a web
handler, so it is not the preferred design.

### Shared idempotent processing service

Extract the route's workflow into a server-side service used by both the Rabbit
consumer and the HTTP route. This keeps one implementation for manual and
automatic processing and allows duplicate deliveries to safely resume.

This is the selected approach.

### Durable job table and separate worker

A job table would provide stronger scheduling and retry controls, but it adds a
schema migration and another worker lifecycle. That is unnecessary for the
first implementation because the existing workflow already has stable external
IDs, lead deduplication, and resumable stage transitions.

## Processing Service

Add a focused server-side service that accepts a USSD application and optional
lead ID. It must:

1. Create or reuse the corresponding lead.
2. Resolve the stable Fineract loan external ID from the lead.
3. Reuse an existing linked Fineract loan when one exists.
4. Otherwise create the Fineract loan from the live product template.
5. Backfill the lead's Fineract client and loan metadata.
6. Call CDE and store the result.
7. Invoke the existing state-machine progression only when CDE returns
   `APPROVED`.
8. Return a structured result containing the lead ID, loan ID, CDE decision,
   progression result, and final workflow status.

The existing USSD submit route becomes a thin HTTP adapter around this service.

## Consumer Behavior

After persisting or finding a USSD application, the consumer loads the tenant's
`ussdAutoLeadRules`.

- If the product has no enabled rule, preserve the current application-only
  behavior.
- If the product has an enabled rule, call the shared processing service.
- The existing `autoProgressToDisbursementRules` configuration remains the
  second product-and-stage eligibility gate inside the state machine.

The consumer must process duplicate Rabbit deliveries through the same
idempotent service instead of returning immediately when the application record
already exists. This allows an interrupted workflow to resume without creating
another application, lead, or Fineract loan.

The message is acknowledged after the workflow succeeds or reaches a terminal
business stop such as `MANUAL_REVIEW`. Transient technical failures receive a
small bounded number of in-process retries. If they still fail, the failure is
recorded and the message is acknowledged to prevent an endless poison-message
loop.

## Decision and Failure Rules

- `APPROVED`: continue through configured stage transitions to disbursement.
- `MANUAL_REVIEW`: stop and record that manual review is required.
- Declined or rejected decision: stop and record the CDE decision.
- Missing CDE decision: stop and record a CDE failure.
- Missing payment method or payout details: stop before disbursement with the
  existing state-machine reason.
- Fineract or transition failure: preserve the current stage, record the exact
  failure, and permit a later idempotent retry.
- Already disbursed: return success without repeating any financial action.

The service must never bypass existing Fineract, cashier, payout, or transition
validations.

## Audit State

Continue using `lead.stateMetadata.cdeResult` and
`lead.stateMetadata.autoDisbursement` for CDE and stage-progression history.

Use the USSD application's existing `status` and `processingNotes` fields to
record the consumer workflow outcome without a Prisma migration. Status values
should distinguish:

- automatic processing completed
- manual review required
- automatic processing stopped
- automatic processing failed

The notes should contain a concise reason and the linked lead ID.

## Idempotency

The workflow relies on existing safeguards:

- unique USSD application identifiers
- metadata-based lead lookup
- stable Fineract loan external ID
- Fineract loan lookup before creation
- duplicate-loan recovery
- state-machine checks for already-completed disbursement

Every entry point must call the same processing service so these safeguards do
not diverge.

## Testing

Add tests before implementation for:

1. Consumer invokes the full processing service for a configured product.
2. Consumer does not invoke it for an unconfigured product.
3. Duplicate application delivery resumes the workflow.
4. Shared service reuses an existing lead and Fineract loan.
5. `APPROVED` invokes auto-progression.
6. `MANUAL_REVIEW` does not invoke auto-progression.
7. Declined and missing decisions do not invoke auto-progression.
8. Completed disbursement is not repeated.
9. HTTP submit route delegates to the shared service.
10. Failure and terminal-stop outcomes update application audit fields.

## Out of Scope

- Automatically disbursing `MANUAL_REVIEW` decisions
- Replacing the existing tenant rule configuration
- Adding a new database-backed job queue
- Bypassing cashier, payout, or Fineract validation
- Changing products that are not enabled for USSD auto lead creation
