# User Signature Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload a personal signature on their profile page, which is then automatically pre-populated as the loan officer signature when they create a lead contract.

**Architecture:** Add a `UserSignature` Prisma model keyed by Fineract user ID (`Int`) to store the base64 image in the database (S3 later). Three server actions handle CRUD. The profile page gets a new Signature card. The `LoanContracts` component fetches the saved signature on mount and pre-fills `loanOfficerSignature` state; if no signature is found, the existing upload UI renders unchanged.

**Tech Stack:** Next.js 14 server actions, Prisma (PostgreSQL), React `useState`/`useEffect`, existing shadcn/ui Card/Button/Input/Label/Badge components.

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `prisma/schema.prisma` | Add `UserSignature` model |
| Create | `app/actions/user-signature-actions.ts` | Server actions: get/save/delete my signature |
| Modify | `app/(application)/profile/page.tsx` | Add Signature card section |
| Modify | `app/(application)/leads/new/components/loan-contracts.tsx` | Fetch & pre-populate loan officer signature |

---

## Task 1: Add UserSignature Prisma Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model to schema.prisma**

Open `prisma/schema.prisma` and add this model at the end of the file (before the last closing brace if any, or just append):

```prisma
model UserSignature {
  id              String   @id @default(cuid())
  fineractUserId  Int      @unique
  signatureData   String   @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([fineractUserId])
}
```

- [ ] **Step 2: Run the Prisma migration**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npx prisma migrate dev --name add-user-signature
```

Expected output: `Your database is now in sync with your schema.` and a new file under `prisma/migrations/`.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected output: `Generated Prisma Client ... to ./app/generated/prisma`

---

## Task 2: Create Server Actions for User Signature

**Files:**
- Create: `app/actions/user-signature-actions.ts`

These actions read the session internally so callers don't pass a user ID.

- [ ] **Step 1: Create the file**

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function resolveUserId(): Promise<number> {
  const session = await getSession();
  const userId = (session?.user as any)?.userId as number | undefined;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function getMySignature(): Promise<{ signatureData: string | null }> {
  const fineractUserId = await resolveUserId();
  const record = await prisma.userSignature.findUnique({
    where: { fineractUserId },
    select: { signatureData: true },
  });
  return { signatureData: record?.signatureData ?? null };
}

export async function saveMySignature(
  signatureData: string
): Promise<{ success: boolean; error?: string }> {
  if (!signatureData || !signatureData.startsWith("data:image/")) {
    return { success: false, error: "Invalid image data" };
  }
  const fineractUserId = await resolveUserId();
  await prisma.userSignature.upsert({
    where: { fineractUserId },
    create: { fineractUserId, signatureData },
    update: { signatureData },
  });
  return { success: true };
}

export async function deleteMySignature(): Promise<{ success: boolean }> {
  const fineractUserId = await resolveUserId();
  await prisma.userSignature.deleteMany({ where: { fineractUserId } });
  return { success: true };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npx tsc --noEmit 2>&1 | grep "user-signature-actions"
```

Expected: no output (no errors in that file).

---

## Task 3: Add Signature Section to Profile Page

**Files:**
- Modify: `app/(application)/profile/page.tsx`

The profile page is a `"use client"` component. Server actions can be imported and called directly from client components in Next.js 14.

- [ ] **Step 1: Add the server action imports**

At the top of `app/(application)/profile/page.tsx`, after the existing imports (around line 24), add:

```typescript
import { PenLine } from "lucide-react";
import {
  getMySignature,
  saveMySignature,
  deleteMySignature,
} from "@/app/actions/user-signature-actions";
```

Also add `PenLine` to the existing `lucide-react` import block — or add it as a separate import if easier.

- [ ] **Step 2: Add signature state variables**

Inside `ProfilePage()`, after the password state block (around line 61), add:

```typescript
// Signature state
const [signatureData, setSignatureData] = useState<string | null>(null);
const [signatureLoading, setSignatureLoading] = useState(true);
const [signatureSaving, setSignatureSaving] = useState(false);
const [signatureError, setSignatureError] = useState<string | null>(null);
const [signatureSuccess, setSignatureSuccess] = useState(false);
```

- [ ] **Step 3: Add useEffect to load signature on mount**

After the `fetchLocalRoles` useEffect block (ends around line 94), add:

```typescript
// Load saved signature
useEffect(() => {
  if (status !== "authenticated") return;
  setSignatureLoading(true);
  getMySignature()
    .then(({ signatureData }) => setSignatureData(signatureData))
    .catch(() => {})
    .finally(() => setSignatureLoading(false));
}, [status]);
```

- [ ] **Step 4: Add signature upload handler**

After the `handlePasswordChange` function (around line 144), add:

```typescript
const handleSignatureUpload = async (file: File) => {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  if (!validTypes.includes(file.type)) {
    setSignatureError("Please upload a JPG, PNG, or GIF image");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    setSignatureError("Please upload an image smaller than 2MB");
    return;
  }

  setSignatureSaving(true);
  setSignatureError(null);
  setSignatureSuccess(false);

  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64 = reader.result as string;
    const result = await saveMySignature(base64);
    if (result.success) {
      setSignatureData(base64);
      setSignatureSuccess(true);
      setTimeout(() => setSignatureSuccess(false), 4000);
    } else {
      setSignatureError(result.error ?? "Failed to save signature");
    }
    setSignatureSaving(false);
  };
  reader.onerror = () => {
    setSignatureError("Failed to read file");
    setSignatureSaving(false);
  };
  reader.readAsDataURL(file);
};

const handleSignatureDelete = async () => {
  setSignatureSaving(true);
  setSignatureError(null);
  await deleteMySignature();
  setSignatureData(null);
  setSignatureSaving(false);
};
```

- [ ] **Step 5: Add the Signature Card to the JSX**

In the return JSX, inside `<div className="grid gap-6 md:grid-cols-2">` (around line 174), add this card **after** the Change Password card (after the closing `</Card>` around line 449, but before `</div>`):

```tsx
{/* Signature Card */}
<Card className="p-6 md:col-span-2">
  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
    <PenLine className="h-5 w-5" />
    My Signature
  </h2>
  <p className="text-sm text-muted-foreground mb-4">
    Your signature will be automatically used as the loan officer signature when creating contracts.
  </p>

  {signatureLoading ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <div className="space-y-4">
      <div className="border-2 border-dashed rounded-lg p-6 text-center">
        {signatureData ? (
          <div className="space-y-3">
            <img
              src={signatureData}
              alt="Your signature"
              className="max-h-32 mx-auto border rounded bg-white p-2"
            />
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={signatureSaving}
                onClick={handleSignatureDelete}
              >
                {signatureSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Remove Signature
              </Button>
              <Label
                htmlFor="profile-signature-upload"
                className="cursor-pointer inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                Replace
              </Label>
              <Input
                id="profile-signature-upload"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={signatureSaving}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSignatureUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        ) : (
          <div>
            <PenLine className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">No signature saved yet</p>
            <Label
              htmlFor="profile-signature-upload"
              className="cursor-pointer text-sm text-blue-600 hover:underline"
            >
              {signatureSaving ? "Saving..." : "Upload Signature"}
            </Label>
            <Input
              id="profile-signature-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={signatureSaving}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSignatureUpload(file);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>

      {signatureError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{signatureError}</p>
        </div>
      )}

      {signatureSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">Signature saved successfully!</p>
        </div>
      )}
    </div>
  )}
</Card>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npx tsc --noEmit 2>&1 | grep "profile"
```

Expected: no output.

---

## Task 4: Pre-populate Loan Officer Signature in LoanContracts

**Files:**
- Modify: `app/(application)/leads/new/components/loan-contracts.tsx`

The `LoanContracts` component is a `"use client"` component (~3335 lines). We add one `useEffect` and modify the loan officer signature UI section (lines 2490–2558) to distinguish between a pre-filled saved signature and a freshly uploaded one.

- [ ] **Step 1: Import the server action**

At the top of `loan-contracts.tsx`, find the existing import block. Add after the last import:

```typescript
import { getMySignature } from "@/app/actions/user-signature-actions";
```

- [ ] **Step 2: Add a state flag for pre-filled signature**

After the `loanOfficerSignature` state at line ~132:

```typescript
const [loanOfficerSignature, setLoanOfficerSignature] = useState<
  string | null
>(null);
const [officerSignatureIsFromProfile, setOfficerSignatureIsFromProfile] =
  useState(false);
```

Replace the existing declaration at lines 132-134 with this block (same `useState` for `loanOfficerSignature`, just add the new state below it).

- [ ] **Step 3: Add useEffect to fetch and pre-populate officer signature**

After the `useEffect` that loads the tenant contract template (ends around line 201), add:

```typescript
// Pre-populate loan officer signature from user's saved profile signature
useEffect(() => {
  let cancelled = false;
  getMySignature()
    .then(({ signatureData }) => {
      if (!cancelled && signatureData && !loanOfficerSignature) {
        setLoanOfficerSignature(signatureData);
        setOfficerSignatureIsFromProfile(true);
      }
    })
    .catch(() => {});
  return () => {
    cancelled = true;
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Update the Remove button to clear the profile flag**

The existing Remove button at line ~2526-2533:

```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => setLoanOfficerSignature(null)}
>
  Remove
</Button>
```

Replace with:

```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => {
    setLoanOfficerSignature(null);
    setOfficerSignatureIsFromProfile(false);
  }}
>
  Remove
</Button>
```

- [ ] **Step 5: Add the "pre-filled from profile" badge in the loan officer signature UI**

In the loan officer signature section (lines 2490–2558), find the block starting with:

```tsx
{/* Loan Officer Signature */}
<div className="space-y-2">
  <Label htmlFor="officer-signature">
    Loan Officer Signature{!signaturesOptional ? " *" : ""}
  </Label>
```

Add a badge below the Label when the signature came from the profile:

```tsx
{/* Loan Officer Signature */}
<div className="space-y-2">
  <Label htmlFor="officer-signature">
    Loan Officer Signature{!signaturesOptional ? " *" : ""}
  </Label>
  {officerSignatureIsFromProfile && loanOfficerSignature && (
    <p className="text-xs text-green-600 dark:text-green-400">
      Pre-filled from your profile signature
    </p>
  )}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npx tsc --noEmit 2>&1 | grep "loan-contracts"
```

Expected: no output.

- [ ] **Step 7: Full compile check**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|-------------|-----------|
| Upload signature on profile page | Task 3 |
| Save signature in DB (S3 later) | Task 1 + Task 2 (base64 in `UserSignature.signatureData`) |
| Pre-populate loan officer signature in contract tab | Task 4 Step 3 |
| Show upload UI if no saved signature found | Task 4 Step 3 — condition `!loanOfficerSignature` means existing upload UI renders as-is |
| Rest of contract saving remains unchanged | Tasks 1-4 don't touch `handleSignatureUpload`, `handleComplete`, or the signatures API route |

### No Placeholders
- All code blocks are complete.
- No "TBD" or "TODO" in steps.

### Type Consistency
- `signatureData: string | null` used consistently across server actions, profile page state, and loan-contracts state.
- `officerSignatureIsFromProfile: boolean` only used in Task 4 — no cross-task type mismatch.
- `getMySignature()` returns `{ signatureData: string | null }` — consumed correctly in both Task 3 and Task 4.
