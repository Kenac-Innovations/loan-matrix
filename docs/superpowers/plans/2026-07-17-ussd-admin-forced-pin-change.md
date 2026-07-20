# USSD Admin Forced PIN Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the admin USSD PIN reset flow so Loan Matrix flags a USSD client for a forced PIN change instead of USSD generating and sending a new PIN by SMS.

**Architecture:** USSD owns the reset-required state, the forced USSD flow, PIN update, and SMS notification. Loan Matrix keeps the admin permission, lookup screen, and audit log, but its reset action becomes "require PIN change" and treats SMS as notification-only.

**Tech Stack:** Loan Matrix Next.js/TypeScript/Prisma; GoodFellow USSD Spring Boot/JPA/JUnit/Mockito; PostgreSQL.

## Global Constraints

- Do not expose or return a generated PIN from any API.
- SMS delivery must not decide whether the reset request succeeds after the USSD user has been flagged.
- The forced reset must require NRC/National ID verification before accepting a new PIN.
- USSD production uses schema validation, so `goodfellow_users` columns must exist before deploying code that maps them.
- Do not commit changes unless explicitly requested.

---

### Task 1: USSD Reset-Required State and Admin API

**Files:**
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/model/entity/GoodfellowUser.java`
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetService.java`
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminPinResetResponse.java`
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/util/SmsTemplates.java`
- Test: `USSD/GoodFellowUssd/src/test/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetServiceTest.java`

**Interfaces:**
- Produces `GoodfellowUser.pinResetRequired: Boolean`, `pinResetRequestedAt: LocalDateTime`, `pinResetRequestedBy: String`, `pinResetReason: String`.
- Produces `AdminPinResetResponse.resetRequired: Boolean`.
- Keeps `POST /api/v1/admin/users/pin-reset` stable for Loan Matrix.

- [x] **Step 1: Write failing service tests**

Add tests asserting `resetPin` saves a flag, does not call `GoodfellowUserService.updateUserPin`, sends a notification-only SMS, returns `FLAGGED`, and returns `FLAGGED_SMS_FAILED` with `success=true` when SMS fails.

- [x] **Step 2: Run red tests**

Run: `./mvnw -Dtest=AdminPinResetServiceTest test`
Expected: FAIL because `GoodfellowUser` has no reset flag fields and the service still updates the PIN.

- [x] **Step 3: Implement state and admin behavior**

Add nullable/defaulted JPA columns to `GoodfellowUser`; update `AdminPinResetService.resetPin` to set the flag metadata and save the user; replace generated-PIN SMS with a notification template.

- [x] **Step 4: Run green tests**

Run: `./mvnw -Dtest=AdminPinResetServiceTest,AdminPinResetControllerTest test`
Expected: PASS.

### Task 2: USSD Forced Reset Flow

**Files:**
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/enums/Stages.java`
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/enums/Levels.java`
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/model/UserData.java`
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/service/flows/HomeMenuFlowService.java`
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/service/flows/RouterFlowService.java`
- Modify: `USSD/GoodFellowUssd/src/main/java/zw/co/kenac/goodfellow_ussd_app/service/flows/MyAccountFlowService.java`
- Test: create `USSD/GoodFellowUssd/src/test/java/zw/co/kenac/goodfellow_ussd_app/service/flows/ForcedPinResetFlowServiceTest.java`

**Interfaces:**
- Produces `Stages.FORCED_PIN_RESET`.
- Produces `Levels.ENTER_NATIONAL_ID`, `ENTER_NEW_PIN`, `CONFIRM_NEW_PIN` forced reset progression.
- Clears `GoodfellowUser.pinResetRequired` only after a successful PIN update.

- [x] **Step 1: Write failing flow tests**

Cover login option for flagged user prompts for NRC; wrong NRC ends safely; correct NRC asks for new PIN; mismatched confirmation ends without clearing the flag; successful confirmation updates the PIN and clears flag metadata.

- [x] **Step 2: Run red flow tests**

Run: `./mvnw -Dtest=ForcedPinResetFlowServiceTest test`
Expected: FAIL because forced-reset stage handling does not exist.

- [x] **Step 3: Implement forced flow**

Route flagged users from Home login into forced reset before normal PIN entry; implement NRC verification and new PIN confirmation in the account flow; clear flag after `updateUserPin` succeeds.

- [x] **Step 4: Run green flow tests**

Run: `./mvnw -Dtest=ForcedPinResetFlowServiceTest test`
Expected: PASS.

### Task 3: Loan Matrix Copy and Status Handling

**Files:**
- Modify: `loan-matrix/lib/ussd-admin-client.ts`
- Modify: `loan-matrix/app/api/ussd-pin-reset/reset/route.ts`
- Modify: `loan-matrix/app/(application)/ussd-pin-reset/components/ussd-pin-reset-client.tsx`
- Test: `loan-matrix/lib/__tests__/ussd-admin-pin-reset.test.ts`

**Interfaces:**
- Consumes USSD statuses `FLAGGED`, `FLAGGED_SMS_FAILED`, `NOT_FOUND`, `INVALID_PHONE`.
- Produces Loan Matrix audit statuses matching the USSD status and user-facing copy for “Require PIN change”.

- [x] **Step 1: Write failing Loan Matrix tests**

Update client tests to assert `FLAGGED_SMS_FAILED` is parsed as structured success and no PIN terms appear in the API/UI copy.

- [x] **Step 2: Run red tests**

Run: `npm test -- lib/__tests__/ussd-admin-pin-reset.test.ts`
Expected: FAIL while copy/status names still describe direct PIN reset.

- [x] **Step 3: Implement Loan Matrix copy/status changes**

Update button, toast, API messages, and audit wording from direct reset to forced PIN change.

- [x] **Step 4: Run green tests**

Run: `npm test -- lib/__tests__/ussd-admin-pin-reset.test.ts`
Expected: PASS.

### Task 4: Final Verification

**Files:**
- No new production files.

- [x] **Step 1: Run focused USSD tests**

Run: `./mvnw -Dtest=AdminPinResetServiceTest,AdminPinResetControllerTest,ForcedPinResetFlowServiceTest test`
Expected: PASS.

- [x] **Step 2: Run focused Loan Matrix tests**

Run: `npm test -- lib/__tests__/ussd-admin-pin-reset.test.ts`
Expected: PASS.

- [x] **Step 3: Review SQL needed for production**

Prepare an idempotent SQL snippet for `goodfellow_users` columns:
`pin_reset_required`, `pin_reset_requested_at`, `pin_reset_requested_by`, `pin_reset_reason`.
