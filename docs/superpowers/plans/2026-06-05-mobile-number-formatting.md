# Mobile Number Formatting at Lead Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every mobile number is stored and sent to Fineract in the canonical format `260XXXXXXXXX` (12 digits, no spaces, no leading `+`) at the point of lead/client creation.

**Architecture:** A single pure utility function `formatMobileForFineract(mobileNo, countryCode)` in `lib/phone-utils.ts` handles all normalization. It is called in three places: (1) when auto-saving the lead to Prisma, (2) when creating a client in Fineract via the operations API route, and (3) when creating a client via the auth-wrapped server action.

**Tech Stack:** TypeScript, Next.js 15 server actions, Prisma, Fineract REST API

---

## File Map

| Action | File |
|---|---|
| Create | `lib/phone-utils.ts` |
| Modify | `app/actions/client-actions-with-autosave.ts` |
| Modify | `app/api/leads/operations/route.ts` |
| Modify | `app/actions/client-actions-with-auth.ts` |

---

### Task 1: Create the phone formatting utility

**Files:**
- Create: `lib/phone-utils.ts`

- [ ] **Step 1: Create `lib/phone-utils.ts`**

```typescript
/**
 * Normalizes a mobile number to the canonical Fineract format:
 * no spaces, no leading +, country code prefix included.
 * e.g. "97 123 4567" + "+260" → "26097123456 7" → "260971234567"
 *
 * Rules:
 * - Strip all whitespace
 * - Strip leading +
 * - If already starts with country code digits → return as-is
 * - Strip leading zeros
 * - If 9 digits remain → prepend country code digits
 */
export function formatMobileForFineract(
  mobileNo: string,
  countryCode: string = "+260"
): string {
  if (!mobileNo) return mobileNo;

  // Strip whitespace
  let digits = mobileNo.replace(/\s+/g, "");

  // Country code digits e.g. "+260" → "260"
  const ccDigits = countryCode.replace(/^\+/, "");

  // Strip leading +
  digits = digits.replace(/^\+/, "");

  // Already fully prefixed
  if (digits.startsWith(ccDigits)) {
    return digits;
  }

  // Strip leading zeros
  digits = digits.replace(/^0+/, "");

  // 9-digit local number → prepend country code
  if (digits.length === 9) {
    return ccDigits + digits;
  }

  return digits;
}
```

- [ ] **Step 2: Manually verify the function logic against known cases**

Open a Node.js REPL or mentally trace these:

| Input mobileNo | countryCode | Expected output |
|---|---|---|
| `"97 123 4567"` | `"+260"` | `"26097123456 7"` → `"260971234567"` |
| `"0971234567"` | `"+260"` | `"260971234567"` |
| `"260971234567"` | `"+260"` | `"260971234567"` (no-op) |
| `"+260971234567"` | `"+260"` | `"260971234567"` |
| `"97 630 2551"` | `"+260"` | `"260976302551"` |

- [ ] **Step 3: Commit**

```bash
git add lib/phone-utils.ts
git commit -m "feat: add formatMobileForFineract utility"
```

---

### Task 2: Apply formatting when auto-saving lead to Prisma

**Files:**
- Modify: `app/actions/client-actions-with-autosave.ts`

The auto-save action stores `mobileNo` into the `Lead` table (lines 166–170, 248–249, 302–303). We normalize before saving so the DB always holds the clean number.

- [ ] **Step 1: Import the utility at the top of `client-actions-with-autosave.ts`**

Add after the existing imports:

```typescript
import { formatMobileForFineract } from "@/lib/phone-utils";
```

- [ ] **Step 2: Normalize mobileNo before the Prisma update (line ~166)**

Find the block that spreads `mobileNo` into the Prisma `update` call. It looks like:

```typescript
...(validatedData.mobileNo !== undefined && {
  mobileNo: validatedData.mobileNo,
}),
...(validatedData.countryCode !== undefined && {
  countryCode: validatedData.countryCode,
}),
```

Replace with:

```typescript
...(validatedData.mobileNo !== undefined && {
  mobileNo: formatMobileForFineract(
    validatedData.mobileNo,
    validatedData.countryCode ?? "+260"
  ),
}),
...(validatedData.countryCode !== undefined && {
  countryCode: validatedData.countryCode,
}),
```

- [ ] **Step 3: Normalize mobileNo in the Prisma `create` block (line ~248)**

Find:

```typescript
mobileNo: validatedData.mobileNo || null,
countryCode: validatedData.countryCode || "+260",
```

Replace with:

```typescript
mobileNo: validatedData.mobileNo
  ? formatMobileForFineract(validatedData.mobileNo, validatedData.countryCode ?? "+260")
  : null,
countryCode: validatedData.countryCode || "+260",
```

- [ ] **Step 4: Apply the same change to the second `create` block (line ~302)**

Find the second occurrence of:

```typescript
mobileNo: validatedData.mobileNo || null,
countryCode: validatedData.countryCode || "+260",
```

Replace with:

```typescript
mobileNo: validatedData.mobileNo
  ? formatMobileForFineract(validatedData.mobileNo, validatedData.countryCode ?? "+260")
  : null,
countryCode: validatedData.countryCode || "+260",
```

- [ ] **Step 5: Commit**

```bash
git add app/actions/client-actions-with-autosave.ts
git commit -m "feat: normalize mobileNo when auto-saving lead to Prisma"
```

---

### Task 3: Apply formatting in the leads operations API route (Fineract create)

**Files:**
- Modify: `app/api/leads/operations/route.ts`

There are two `fineractService.createClient(clientData)` calls in this file. Both build a `clientData` object with raw `mobileNo`. We normalize at both points.

- [ ] **Step 1: Import the utility at the top of `app/api/leads/operations/route.ts`**

Add after the existing imports:

```typescript
import { formatMobileForFineract } from "@/lib/phone-utils";
```

- [ ] **Step 2: Normalize mobileNo in the first `clientData` build (~line 592)**

Find:

```typescript
...(validatedData.mobileNo && { mobileNo: validatedData.mobileNo }),
```

Replace with:

```typescript
...(validatedData.mobileNo && {
  mobileNo: formatMobileForFineract(
    validatedData.mobileNo,
    validatedData.countryCode ?? "+260"
  ),
}),
```

- [ ] **Step 3: Normalize mobileNo in the second `clientData` build (~line 861)**

Find:

```typescript
mobileNo: lead.mobileNo,
```

Replace with:

```typescript
mobileNo: lead.mobileNo
  ? formatMobileForFineract(lead.mobileNo, lead.countryCode ?? "+260")
  : undefined,
```

- [ ] **Step 4: Commit**

```bash
git add app/api/leads/operations/route.ts
git commit -m "feat: normalize mobileNo before sending to Fineract in operations route"
```

---

### Task 4: Apply formatting in the auth-wrapped server action

**Files:**
- Modify: `app/actions/client-actions-with-auth.ts`

`createClientAction` (line 13) and `updateClientAction` (line 61) both pass `data.mobileNo` raw to Fineract.

- [ ] **Step 1: Import the utility**

Add after the existing imports in `app/actions/client-actions-with-auth.ts`:

```typescript
import { formatMobileForFineract } from "@/lib/phone-utils";
```

- [ ] **Step 2: Normalize in `createClientAction`**

Find:

```typescript
mobileNo: data.mobileNo,
```

Replace with:

```typescript
mobileNo: data.mobileNo
  ? formatMobileForFineract(data.mobileNo, data.countryCode ?? "+260")
  : undefined,
```

- [ ] **Step 3: Normalize in `updateClientAction`**

Find:

```typescript
...(data.mobileNo && { mobileNo: data.mobileNo }),
```

Replace with:

```typescript
...(data.mobileNo && {
  mobileNo: formatMobileForFineract(data.mobileNo, data.countryCode ?? "+260"),
}),
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/client-actions-with-auth.ts
git commit -m "feat: normalize mobileNo in client create/update server actions"
```

---

### Task 5: Manual end-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Create a new lead with each of these mobile inputs and verify the value stored in Fineract**

| Input | Country code | Expected stored value |
|---|---|---|
| `97 123 4567` | +260 | `260971234567` |
| `0971234567` | +260 | `260971234567` |
| `260971234567` | +260 | `260971234567` |
| `+260971234567` | +260 | `260971234567` |

- [ ] **Step 3: Check the `m_client` table in `fineract_tenant_goodfellow` to confirm no spaces and correct prefix**

```sql
SELECT id, mobile_no FROM m_client ORDER BY id DESC LIMIT 5;
```

- [ ] **Step 4: Verify no regression on existing functionality** — edit an existing client's mobile number in the UI and confirm it saves correctly.
