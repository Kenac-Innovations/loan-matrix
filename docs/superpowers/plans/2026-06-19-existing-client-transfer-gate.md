# Existing Client Transfer Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent cross-branch existing clients from creating draft leads until transfer succeeds, while clearly highlighting branch mismatch in the clients list.

**Architecture:** Add a lightweight session-aware mismatch badge to the clients table, then gate the lead form’s existing-client flow before the draft-save step. Backstop the UI with server-side guards in the existing-client autosave and lead-creation paths so cross-branch drafts cannot be created through alternate routes.

**Tech Stack:** Next.js App Router, React, SWR, NextAuth session data, server actions, Prisma, existing Fineract transfer route, `tsx --test`

---

### Task 1: Document and expose branch mismatch in the clients list

**Files:**
- Modify: `app/(application)/clients/components/clients-table.tsx`

- [ ] **Step 1: Write the failing test**

Create a focused pure helper test for office mismatch detection if no reusable helper exists yet. Prefer a new helper under `lib/` if needed so the comparison is testable without rendering the full table.

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test lib/__tests__/client-office-mismatch.test.ts`
Expected: FAIL because the helper or expected behavior does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add session-aware mismatch detection to the clients table. Read the logged-in branch from `useSession()`, compare it to each client `officeId`, and render a visible `Different Branch` badge in the client row when the office differs.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test lib/__tests__/client-office-mismatch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(application)/clients/components/clients-table.tsx lib/__tests__/client-office-mismatch.test.ts
git commit -m "feat: highlight cross-branch clients in clients list"
```

### Task 2: Gate existing-client lead creation before draft save

**Files:**
- Modify: `app/(application)/leads/new/components/client-registration-form.tsx`
- Test: `lib/__tests__/existing-client-transfer-gate.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for the gate decision logic:

- same-branch clients do not require transfer
- different-branch clients require transfer
- cancel path does not continue to draft creation
- successful transfer resumes continuation

Keep the tests focused on extracted logic/helpers so they can run without mounting the entire form.

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test lib/__tests__/existing-client-transfer-gate.test.ts`
Expected: FAIL because the helper or flow coordinator is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Add:

- a non-dismissible modal in the existing-client flow
- state for pending transfer candidate and in-progress transfer
- a guarded continuation path that calls `/api/fineract/clients/:id/transfer-office`
- resume logic that only continues to client hydration and draft save after successful transfer

Ensure the guard is checked before `handleSaveDraft()` is called in the existing-client lookup path.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test lib/__tests__/existing-client-transfer-gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(application)/leads/new/components/client-registration-form.tsx lib/__tests__/existing-client-transfer-gate.test.ts
git commit -m "feat: require transfer before cross-branch existing-client leads"
```

### Task 3: Enforce server-side rejection for cross-branch existing-client drafts

**Files:**
- Modify: `app/actions/client-actions-with-autosave.ts`
- Modify: `app/api/leads/operations/route.ts`
- Test: `lib/__tests__/existing-client-branch-guard.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests that prove:

- autosave rejects an existing Fineract client that belongs to another office
- existing-client lead creation route rejects a cross-branch client before draft creation
- same-branch clients still pass

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test lib/__tests__/existing-client-branch-guard.test.ts`
Expected: FAIL because the server-side guard does not yet reject the mismatched client.

- [ ] **Step 3: Write minimal implementation**

Use `ensureExistingClientInCreatorOffice()` in both paths and reject when `clientBelongsToDifferentOffice` is true. Return a clear error message instructing the caller to transfer the client before creating the lead.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test lib/__tests__/existing-client-branch-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/actions/client-actions-with-autosave.ts app/api/leads/operations/route.ts lib/__tests__/existing-client-branch-guard.test.ts
git commit -m "fix: block cross-branch existing-client draft creation"
```

### Task 4: Verify integrated behavior

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run:

```bash
./node_modules/.bin/tsx --test lib/__tests__/client-office-mismatch.test.ts
./node_modules/.bin/tsx --test lib/__tests__/existing-client-transfer-gate.test.ts
./node_modules/.bin/tsx --test lib/__tests__/existing-client-branch-guard.test.ts
```

Expected: All PASS.

- [ ] **Step 2: Run targeted lint for changed files**

Run:

```bash
./node_modules/.bin/eslint app/(application)/clients/components/clients-table.tsx app/(application)/leads/new/components/client-registration-form.tsx app/actions/client-actions-with-autosave.ts app/api/leads/operations/route.ts lib/__tests__/client-office-mismatch.test.ts lib/__tests__/existing-client-transfer-gate.test.ts lib/__tests__/existing-client-branch-guard.test.ts
```

Expected: No errors in the changed files.

- [ ] **Step 3: Commit**

```bash
git add app/(application)/clients/components/clients-table.tsx app/(application)/leads/new/components/client-registration-form.tsx app/actions/client-actions-with-autosave.ts app/api/leads/operations/route.ts lib/__tests__/client-office-mismatch.test.ts lib/__tests__/existing-client-transfer-gate.test.ts lib/__tests__/existing-client-branch-guard.test.ts docs/superpowers/specs/2026-06-19-existing-client-transfer-gate-design.md docs/superpowers/plans/2026-06-19-existing-client-transfer-gate.md
git commit -m "feat: gate cross-branch existing-client lead creation"
```
