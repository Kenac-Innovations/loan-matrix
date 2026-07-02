# USSD Auto Lead Creation Design

## Goal

Automatically create a CRM lead when the USSD queue consumer picks up a qualifying application, without requiring a user to click `View`, while keeping the behavior reusable across products and identical to the existing manual conversion flow.

## Problem

Today the Rabbit/AMQP consumer only persists the `UssdLoanApplication` record. A lead is created later only when a user clicks `View`, which calls `POST /api/ussd-leads/[id]/to-lead`. This creates avoidable manual work and means downstream lead automation cannot begin until a human opens the application.

We want selected products to auto-create leads as soon as the USSD application is consumed. We do not want a one-off hardcoded Yango-only behavior, and we must preserve manual workflows for products that should not auto-create.

## Approaches Considered

### 1. Hardcode eligible product IDs in the queue consumer

This is the fastest implementation, but every new product requires another code change and redeploy. It also hides business configuration in code instead of a visible tenant setting.

### 2. Auto-create for every USSD application

This is operationally simple, but it removes product-level control and would force lead creation for workflows that may still need manual triage.

### 3. Recommended: product-scoped tenant rules plus a shared conversion service

Store reusable per-product auto-create rules in tenant settings and have the queue consumer invoke the same lead-conversion service that the manual `View` path uses. This keeps behavior consistent, makes rollout controllable, and allows Yango Driver Loan to be enabled first without hardcoding it forever.

## Recommended Design

### Configuration model

Add a tenant-level rule set for USSD auto lead creation. Each rule should:

- target a `loanProductId`
- have an `enabled` flag

This should live alongside the existing tenant settings pattern already used for auto-disbursement rules so product-level behavior remains centrally configurable.

For the first rollout, only `Yango Driver Loan` should be enabled through this config.

### Shared conversion path

Extract the core logic from `app/api/ussd-leads/[id]/to-lead/route.ts` into a shared server-side service, for example `lib/ussd-lead-creation.ts`.

That shared service should:

- load the USSD application
- resolve the initial pipeline stage
- deduplicate by the existing USSD-specific metadata keys (`applicationId`, `referenceNumber`, `messageId`)
- backfill missing Fineract client metadata if the lead already exists
- create a lead if one does not already exist
- return `{ leadId, existed }`

The manual `to-lead` API route should become a thin wrapper around this shared service. The queue consumer should call the same service after persisting a new USSD application.

### Consumer behavior

In `lib/amqp-queue-service.ts`, after `prisma.ussdLoanApplication.create(...)` succeeds:

1. Load the tenant’s USSD auto-create product rules.
2. Check whether the consumed application’s `loanMatrixLoanProductId` is enabled.
3. If enabled, call the shared lead-creation service immediately.
4. If disabled, leave the application in the current manual-review behavior.

The consumer must not fail the whole queue message just because automatic lead creation fails after the application record was safely persisted. Instead:

- persist the application first
- attempt auto-create as a best-effort follow-up
- log failures clearly with product ID and USSD application ID

This avoids poison-message loops where a valid application keeps requeuing just because lead creation had a downstream problem.

### Idempotency and retry safety

The consumer path must remain safe under duplicate messages and retries:

- duplicate queue messages must continue to no-op at the `UssdLoanApplication` layer
- lead creation must remain idempotent through the existing metadata-based dedupe
- a later manual `View` click must reuse the already-created lead

This means the shared service becomes the single source of truth for “create or reopen lead from USSD application.”

### UI follow-up

The USSD applications table should recognize when an application already has a linked lead and present a `View Lead` behavior rather than acting like the lead still needs conversion.

This is not just cosmetic. It keeps the screen truthful once auto-create is enabled for a product and avoids confusing operators with an action that implies lead creation is still pending.

## Data Flow

1. Rabbit message arrives.
2. Consumer validates/deduplicates and stores `UssdLoanApplication`.
3. Consumer checks tenant USSD auto-create rules for the application product.
4. If no matching enabled rule exists, stop there.
5. If a matching rule exists, invoke shared lead-creation service.
6. Service creates or reopens the corresponding lead.
7. Existing lead-detail preparation/submission/CDE flows continue unchanged from that point onward.

## Error Handling

- Invalid or duplicate queue messages should preserve the current behavior.
- Auto-create configuration parse errors should fail closed: do not auto-create, but do not reject the persisted application.
- Lead creation failures after application persistence should be logged and surfaced for investigation, but should not cause endless message requeue.
- The shared conversion service should preserve current dedupe behavior to avoid duplicate leads.

## Testing

Add tests that cover:

- tenant rule parsing for USSD auto-create product IDs
- consumer behavior when the product is enabled
- consumer behavior when the product is disabled
- shared lead-creation service idempotency
- manual `to-lead` route reusing the shared service
- UI behavior showing a “view/open lead” path when the lead already exists

## Out of Scope

- Auto-submitting the loan just because the lead was auto-created
- Changing CDE or auto-disbursement rules
- Auto-creating leads for every USSD product by default
- Reworking unrelated Rabbit consumer infrastructure
