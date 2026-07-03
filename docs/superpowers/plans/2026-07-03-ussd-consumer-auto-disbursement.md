# USSD Consumer Auto-Disbursement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Process configured USSD Rabbit applications through lead creation, Fineract loan creation, CDE approval, and automatic disbursement without a UI click.

**Architecture:** Extract the route-local USSD loan submission workflow into one idempotent server service. The HTTP route and Rabbit consumer call that service; a small pure policy module classifies CDE and progression outcomes, while the consumer owns bounded retries and application-level audit status.

**Tech Stack:** TypeScript, Next.js route handlers, Prisma, RabbitMQ/amqplib, Fineract REST API, Node test runner with `tsx`.

---

### Task 1: Define automatic-processing outcomes and retry behavior

**Files:**
- Create: `lib/ussd-auto-processing-policy.ts`
- Create: `lib/__tests__/ussd-auto-processing-policy.test.ts`

- [ ] **Step 1: Write failing policy tests**

Test that:

```ts
classifyUssdAutoProcessingOutcome({
  cdeDecision: "APPROVED",
  autoProgressMessage: "Auto disbursement completed after CDE APPROVED",
})
```

returns `completed`; `MANUAL_REVIEW` returns `manual_review`; declined or
rejected decisions return `stopped`; no decision returns `failed`; and an
approved result that did not complete progression returns `stopped`.

Also test:

```ts
await runWithBoundedRetries(operation, {
  maxAttempts: 3,
  shouldRetry: () => true,
})
```

retries transient failures at most three times and returns immediately on
success.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-auto-processing-policy.test.ts
```

Expected: FAIL because `lib/ussd-auto-processing-policy.ts` does not exist.

- [ ] **Step 3: Implement the pure policy**

Export:

```ts
export type UssdAutoProcessingStatus =
  | "completed"
  | "manual_review"
  | "stopped"
  | "failed";

export function shouldAutoProgressFromCde(
  decision: string | null | undefined
): boolean {
  return decision?.trim().toUpperCase() === "APPROVED";
}

export function classifyUssdAutoProcessingOutcome(input: {
  cdeDecision?: string | null;
  autoProgressMessage?: string | null;
}): UssdAutoProcessingStatus;

export async function runWithBoundedRetries<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxAttempts: number;
    shouldRetry: (error: unknown) => boolean;
  }
): Promise<T>;
```

The classifier must treat `already_completed` and `already_disbursed` messages
as completed, and must never classify `MANUAL_REVIEW` as eligible for
progression.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-auto-processing-policy.test.ts
```

Expected: all policy tests pass.

### Task 2: Extract the shared USSD loan-processing service

**Files:**
- Create: `lib/ussd-loan-processing-service.ts`
- Modify: `app/api/ussd-leads/[id]/submit/route.ts`
- Modify: `lib/__tests__/ussd-lead-conversion.test.ts`

- [ ] **Step 1: Add failing delegation and decision-gate tests**

Add source-level regression tests asserting:

```ts
assert.match(routeSource, /processUssdApplicationToDisbursement/);
assert.doesNotMatch(routeSource, /fetchFineractAPI\\('\\/loans'/);
assert.match(serviceSource, /shouldAutoProgressFromCde/);
assert.match(serviceSource, /autoProgressToDisbursementFromCdeResult/);
```

These tests establish that the route delegates and the shared service owns the
`APPROVED` gate.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-lead-conversion.test.ts
```

Expected: FAIL because the shared service and route delegation do not exist.

- [ ] **Step 3: Implement the shared service**

Create:

```ts
export type UssdLoanProcessingResult = {
  success: boolean;
  leadId: string;
  loanId: number;
  coreResponse: Record<string, unknown> | null;
  cdeResult: Record<string, unknown> | null;
  cdeDecision: string | null;
  autoProgressMessage: string | null;
  status: UssdAutoProcessingStatus;
};

export async function processUssdApplicationToDisbursement(input: {
  application: UssdLoanApplication;
  leadId?: string | null;
  triggeredBy?: string;
}): Promise<UssdLoanProcessingResult>;
```

Move the current route logic into this service:

- create or reuse the lead through `createOrReuseLeadFromUssdApplication`
- resolve client activation and submission date
- resolve a stable loan external ID
- reuse the linked/external-ID Fineract loan before creating one
- create from the live loan-product template when needed
- backfill Fineract client and loan metadata on the lead
- call `callCDEAndStore`
- call `autoProgressToDisbursementFromCdeResult` only when
  `shouldAutoProgressFromCde(decision)` returns true
- classify and return the outcome

All Fineract calls from this background-safe service must use
`authMode: "service"`.

- [ ] **Step 4: Make the HTTP route a thin adapter**

The route must:

```ts
const application = await prisma.ussdLoanApplication.findFirst(...);
const result = await processUssdApplicationToDisbursement({
  application,
  leadId,
  triggeredBy: "system",
});
return NextResponse.json({
  success: result.success,
  coreResponse: result.coreResponse ?? { resourceId: result.loanId },
  cdeResult: result.cdeResult,
  autoProgressMessage: result.autoProgressMessage,
  status: result.status,
});
```

Preserve the existing structured Fineract error response mapping.

- [ ] **Step 5: Run the tests and verify GREEN**

Run:

```bash
node --import tsx --test \
  lib/__tests__/ussd-auto-processing-policy.test.ts \
  lib/__tests__/ussd-lead-conversion.test.ts
```

Expected: all tests pass.

### Task 3: Connect the Rabbit consumer and make duplicate delivery resumable

**Files:**
- Modify: `lib/amqp-queue-service.ts`
- Create: `lib/__tests__/ussd-consumer-auto-disbursement.test.ts`

- [ ] **Step 1: Write failing consumer integration tests**

Add source-level regression assertions that the consumer:

```ts
assert.match(source, /processUssdApplicationToDisbursement/);
assert.match(source, /runWithBoundedRetries/);
assert.match(source, /existingApp \\?\\?/);
assert.doesNotMatch(
  duplicateBranch,
  /USSD application already exists[\\s\\S]*return;/
);
assert.match(source, /processingNotes/);
```

Also assert that processing remains behind
`findMatchingUssdAutoLeadRule`.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-consumer-auto-disbursement.test.ts
```

Expected: FAIL because the consumer only creates/reuses the lead and returns on
duplicates.

- [ ] **Step 3: Implement consumer orchestration**

Change message processing to:

```ts
const ussdApplication =
  existingApp ??
  (await prisma.ussdLoanApplication.create({ data: applicationData }));

if (matchingRule) {
  const result = await runWithBoundedRetries(
    () =>
      processUssdApplicationToDisbursement({
        application: ussdApplication,
        triggeredBy: "system",
      }),
    { maxAttempts: 3, shouldRetry: isRetryableUssdProcessingError }
  );

  await prisma.ussdLoanApplication.update({
    where: { id: ussdApplication.id },
    data: buildUssdApplicationAuditUpdate(result),
  });
}
```

Use these persisted statuses:

- `AUTO_DISBURSED`
- `MANUAL_REVIEW`
- `AUTO_PROCESSING_STOPPED`
- `AUTO_PROCESSING_FAILED`

On a final thrown error, update `AUTO_PROCESSING_FAILED` and
`processingNotes`, log the failure, and return normally so Rabbit acknowledges
the persisted application rather than endlessly requeueing it.

- [ ] **Step 4: Run the consumer and regression tests**

Run:

```bash
node --import tsx --test \
  lib/__tests__/ussd-auto-processing-policy.test.ts \
  lib/__tests__/ussd-consumer-auto-disbursement.test.ts \
  lib/__tests__/ussd-lead-conversion.test.ts \
  lib/__tests__/lead-auto-disbursement-policy.test.ts \
  lib/__tests__/team-state-machine-auto-disbursement.test.ts
```

Expected: all tests pass.

### Task 4: Verify the complete change

**Files:**
- Modify only if verification reveals an in-scope defect.

- [ ] **Step 1: Run formatting and whitespace validation**

Run:

```bash
git diff --check
```

Expected: no whitespace errors in the new changes.

- [ ] **Step 2: Run focused USSD and auto-disbursement tests**

Run:

```bash
node --import tsx --test \
  lib/__tests__/ussd-auto-processing-policy.test.ts \
  lib/__tests__/ussd-consumer-auto-disbursement.test.ts \
  lib/__tests__/ussd-lead-conversion.test.ts \
  lib/__tests__/ussd-loan-submission.test.ts \
  lib/__tests__/lead-auto-disbursement-policy.test.ts \
  lib/__tests__/team-state-machine-auto-disbursement.test.ts \
  lib/__tests__/tenant-auto-disbursement-rules.test.ts
```

Expected: zero failures.

- [ ] **Step 3: Run TypeScript validation for touched files**

Run the repository type checker if a clean scoped command exists. If the global
checker reports pre-existing unrelated failures, capture those separately and
verify that no diagnostic references:

- `lib/ussd-auto-processing-policy.ts`
- `lib/ussd-loan-processing-service.ts`
- `lib/amqp-queue-service.ts`
- `app/api/ussd-leads/[id]/submit/route.ts`

- [ ] **Step 4: Review the final diff against the design**

Confirm:

- only configured USSD products start the workflow
- only `APPROVED` reaches auto-progression
- duplicate messages resume rather than create duplicates
- technical failures are bounded and audited
- no cashier, payout, Fineract, or state-machine validation is bypassed
