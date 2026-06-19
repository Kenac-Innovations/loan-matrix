# Existing Client Transfer Gate Design

**Date:** 2026-06-19

## Goal

Prevent draft lead creation for existing clients that belong to a different branch, require a transfer before the user can continue, and make branch mismatch visible in the clients list.

## Scope

This design covers three connected behaviors:

1. Show a branch mismatch badge in the clients list for clients whose `officeId` differs from the logged-in user branch.
2. Gate existing-client selection inside the term-loan lead create flow before any draft lead is created.
3. Add a server-side guard so existing-client lead creation paths reject cross-branch clients unless the transfer has already completed.

## Current Behavior

The existing client picker in the term-loan lead form fetches clients from `/api/fineract/clients`, lets the user select a client, performs a lookup by external ID, and then saves the populated client form as a draft lead. That draft save happens before any branch-transfer confirmation, which means URLs like `/leads/new/loan?id=...` can already represent persisted draft leads.

The clients list already renders each client row with office information, but it does not compare that office to the logged-in user branch or highlight a mismatch.

## Proposed Behavior

### Clients List

The clients table will read the current session branch on the client and compare it to each client row `officeId`. When the values differ, the row will show a visible badge such as `Different Branch`. The row should remain clickable; the badge is informational and meant to set user expectations before they start a lead or open the client.

### Lead Create Gate

The term-loan client registration flow will detect when an existing client belongs to a different branch before saving a draft lead.

When that happens, the form will show a modal that:

- explains the client belongs to another branch
- states transfer is required before creating the lead
- is not dismissible through overlay click or escape key
- offers only `Transfer Now` and `Cancel`

`Cancel` will abort the selection and leave the user on the lead create page with no newly created draft lead.

`Transfer Now` will call the existing `/api/fineract/clients/[id]/transfer-office` route, which already performs `proposeTransfer` then `acceptTransfer` using the service account and rolls back with `rejectTransfer` if accept fails. Only after a successful transfer will the flow continue to hydrate the client form, save the draft, and proceed with the standard lead journey.

The same guard should apply to:

- manual selection from `Or select existing client`
- external-ID lookup / auto-search paths that find an existing Fineract client

### Server-Side Safety

Existing-client draft creation endpoints should reject cross-branch lead creation when the client still belongs to another office. This keeps the backend aligned with the UI and prevents accidental draft creation through alternate entry paths.

## Architecture

### UI State

The client registration form will gain a focused transfer-gate state that stores:

- whether the modal is open
- the selected existing client summary
- whether transfer is in progress
- a deferred continuation callback or resumable payload for continuing the selection flow after a successful transfer

The continuation should resume the existing lookup/save path rather than duplicating business logic in a second code path.

### Shared Office Logic

Office mismatch checks should reuse existing office-normalization helpers where possible. The current helper in `lib/fineract-client-office-transfer.ts` already models whether an existing client belongs to a different office than the creator. The UI can use a lightweight comparison, while server-side guards should keep using the canonical helper.

### API Contract

The transfer UI will call:

`POST /api/fineract/clients/:id/transfer-office`

with the client office ID when needed, allowing the server route to resolve the destination office from the logged-in session and perform the service-account transfer sequence.

## Error Handling

- If transfer fails, keep the modal open and show a destructive error toast/message.
- If transfer succeeds but the post-transfer client reload fails, surface an error and stop before draft creation.
- If the backend guard detects a mismatch during existing-client draft creation, return a clear message that transfer must happen first.
- `Cancel` should clear any pending selected-client/loading state introduced by the gate.

## Files

- Modify `app/(application)/clients/components/clients-table.tsx`
  Add session-aware branch mismatch badge rendering.
- Modify `app/(application)/leads/new/components/client-registration-form.tsx`
  Add transfer-gate modal, pre-draft branch checks, and transfer continuation flow.
- Modify `app/api/leads/operations/route.ts`
  Enforce server-side rejection for existing-client lead creation when branch transfer has not been completed.
- Modify `app/actions/client-actions-with-autosave.ts`
  Prevent auto-saved existing-client drafts from being created across branches without transfer.
- Add or extend tests under `lib/__tests__` and/or route-level tests
  Cover branch mismatch detection, server guard behavior, and transfer sequencing integration points.

## Testing

1. Client from same branch:
   Existing-client selection should continue without modal and draft save should still work.
2. Client from different branch:
   Modal should appear before draft save.
3. Cancel path:
   No transfer call, no draft lead creation, no navigation to `/leads/new/loan?id=...`.
4. Successful transfer path:
   Transfer route succeeds, client flow resumes, draft lead is created afterward.
5. Failed transfer path:
   No draft lead creation, user stays gated, and the error is visible.
6. Backend safety:
   Existing-client create/update paths reject mismatched-branch clients when transfer has not been completed.
