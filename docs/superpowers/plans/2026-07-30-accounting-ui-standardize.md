# Accounting UI Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every accounting page/component to match the rest of the app's design system (Dashboard, Loans, Clients), with zero behavior change — pure Tailwind class edits only.

**Architecture:** This is a styling-only refactor. No component is restructured, no data-fetching or route logic changes, no new dependencies. Each task edits one subsystem's files (grouped by accounting sub-feature) by applying the class-mapping rules below, then verifies with `tsc` and a diff review confirming only `className` values changed.

**Tech Stack:** Next.js (App Router), Tailwind CSS, shadcn/ui (`components/ui/*`), TypeScript. No test framework is configured for this app (`package.json` has no `test` script) — verification is `npx tsc --noEmit` (type-check) plus a manual visual check.

Spec: `docs/superpowers/specs/2026-07-30-accounting-ui-standardize-design.md`

## Global Constraints

Apply this exact class mapping everywhere it appears, across every task in this plan. This table **is** the spec — do not invent new mappings.

| Find (pattern) | Replace with |
|---|---|
| `bg-white dark:bg-slate-800` on a `<Card>` | remove entirely (bare `<Card>` already uses `bg-card`) |
| `border-slate-200 dark:border-slate-700` / `border-slate-600` on a `<Card>`/`Input`/`Select` | remove entirely (component default `border` already themes) |
| `bg-gradient-to-br from-X-50 to-Y-50 dark:from-X-950 dark:to-Y-950` (card backgrounds) | remove entirely — bare `<Card>` |
| `bg-gradient-to-r from-X-600 to-Y-600 hover:from-X-700 hover:to-Y-700 text-white shadow-lg` (buttons) | remove — use default `<Button>` (or `variant="outline"` if it was a secondary action) |
| `text-slate-900 dark:text-slate-100` | `text-foreground` |
| `text-slate-700 dark:text-slate-300` / `text-slate-600 dark:text-slate-400` / `text-slate-500 dark:text-slate-400` | `text-muted-foreground` |
| `bg-white dark:bg-slate-700` / `dark:bg-slate-800` on `Input`/`Select`/`SelectContent`/`SelectTrigger`/`SelectItem` | remove entirely (component defaults) |
| `text-slate-400 dark:text-slate-500` (icon colors inside inputs) | `text-muted-foreground` |
| `bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300` (plain/neutral Badge) | remove custom classes — use `<Badge variant="secondary">` |
| Per-category color pair, e.g. `text-emerald-600 dark:text-emerald-400` / `bg-emerald-50 dark:bg-emerald-950` / `bg-emerald-100 dark:bg-emerald-900` (account type, trend, status colors) | single color, no dark pair: text → `text-{color}-500`; background → `bg-{color}-500/20`. Keep the same color family (emerald/green→green, amber→amber or yellow, blue→blue, purple→purple, red→red) so the semantic meaning is unchanged — only the token pair collapses to the Dashboard idiom. |
| `bg-slate-200 dark:bg-slate-700` (skeleton loading blocks) | `bg-muted` |
| `border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950` (error Card) | remove — bare `<Card>`; error text → `text-destructive` |
| Rainbow per-item icon backgrounds (`bg-blue-500`, `bg-green-500`, `bg-purple-500`, `bg-orange-500`, `bg-red-500`, `bg-indigo-500`, `bg-teal-500` used only for visual variety, not semantic status) | `bg-primary/10` container + `text-primary` icon (see `StatsCards.tsx` icon treatment) |
| `dark:bg-[#0d121f]` (raw hex) | remove — delete the wrapping `<section>` entirely (see Task 1) |

**Do not touch:** any non-styling code — data fetching (`useSWR`, `fetch`), state (`useState`, `useMemo`), form handlers, validation, routing (`Link href`), or component logic. If a line mixes a style class with logic, only the class list changes.

**Verification command available in every task:** `npx tsc --noEmit` (run from `loan-matrix/`). No `test` script exists in this repo; do not invent one.

---

## Task 1: Shared components — AccountingHome, StatsCards, layout wrapper

**Files:**
- Modify: `components/accounting/AccountingHome.tsx`
- Modify: `components/accounting/StatsCards.tsx`
- Modify: `app/(application)/accounting/layout.tsx`

**Interfaces:**
- Consumes: nothing new — these are presentational components already wired into `app/(application)/accounting/page.tsx`.
- Produces: no exported signatures change. `AccountingHome`, `StatsCards({ stats })`, `AccountingLayout({ children })` keep identical props/exports.

- [ ] **Step 1: Read the three files**

Read `components/accounting/AccountingHome.tsx`, `components/accounting/StatsCards.tsx`, `app/(application)/accounting/layout.tsx` in full before editing.

- [ ] **Step 2: Fix `AccountingHome.tsx`**

In the `features` array (lines ~18-75), delete the `color: 'bg-...-500'` property from every entry — it's no longer used.

Replace the icon container (around line 101):
```tsx
<div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center`}>
  <Icon className="h-5 w-5 text-white" />
</div>
```
with:
```tsx
<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
  <Icon className="h-5 w-5 text-primary" />
</div>
```
(then remove `icon: Icon, color` destructuring's now-unused `color` from the `.map(({ title, href, icon: Icon, description, badge, color })` call — becomes `.map(({ title, href, icon: Icon, description, badge })`).

Apply the Global Constraints text/border mapping to the rest of the file: `text-slate-900 dark:text-slate-100` → `text-foreground` (h2, CardTitle), `text-slate-600 dark:text-slate-400` → `text-muted-foreground` (p, CardDescription, "Access module" text, ArrowRight icon, Shield row), `border-slate-200 dark:border-slate-700` and `bg-white dark:bg-slate-800` on the `<Card>` → remove, `bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300` on the badge → remove custom classes, keep `variant="secondary"`.

- [ ] **Step 3: Fix `StatsCards.tsx`**

Apply Global Constraints mapping:
- `<Card>` className: remove `border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md bg-white dark:bg-slate-800`, keep `hover:shadow-lg transition-all duration-200`.
- `text-slate-700 dark:text-slate-200` (CardTitle) → `text-muted-foreground`.
- `text-slate-900 dark:text-slate-100` (value) → `text-foreground`.
- `text-slate-600 dark:text-slate-400` (description) → `text-muted-foreground`.

In `getTrendColor`, collapse each branch to the Global Constraints per-category mapping:
```tsx
const getTrendColor = (trend?: "up" | "down" | "neutral") => {
  switch (trend) {
    case "up":
      return "text-green-500 bg-green-500/20";
    case "down":
      return "text-red-500 bg-red-500/20";
    default:
      return "text-muted-foreground bg-muted";
  }
};
```
`getTrendIcon` already uses reasonable semantic colors (`text-green-600 dark:text-green-400` etc.) — simplify to match: `text-green-500`, `text-red-500`, `text-gray-400` → `text-muted-foreground`.

- [ ] **Step 4: Fix `layout.tsx`**

Replace the whole file body — delete the wrapping section with the raw hex background:
```tsx
import React from 'react';

interface AccountingLayoutProps {
  children: React.ReactNode;
}

export default function AccountingLayout({ children }: AccountingLayoutProps) {
  return <div className="space-y-6">{children}</div>;
}
```

- [ ] **Step 5: Type-check**

Run: `cd "loan-matrix" && npx tsc --noEmit`
Expected: no new errors introduced by these 3 files (pre-existing unrelated errors, if any, are out of scope — confirm by checking the error list doesn't mention `AccountingHome.tsx`, `StatsCards.tsx`, or `accounting/layout.tsx`).

- [ ] **Step 6: Diff review**

Run: `git diff components/accounting/AccountingHome.tsx components/accounting/StatsCards.tsx "app/(application)/accounting/layout.tsx"`
Confirm every changed line is a `className` value, JSX attribute, or the one destructuring/prop removal described above — no logic, no removed functionality.

- [ ] **Step 7: Commit**

```bash
git add components/accounting/AccountingHome.tsx components/accounting/StatsCards.tsx "app/(application)/accounting/layout.tsx"
git commit -m "Standardize shared accounting components to app design system"
```

---

## Task 2: Accounting dashboard page

**Files:**
- Modify: `app/(application)/accounting/page.tsx`

**Interfaces:**
- Consumes: `AccountingLayout`, `StatsCards`, `AccountingHome` from Task 1 (unchanged props).
- Produces: nothing new consumed elsewhere — this is the route entry point.

- [ ] **Step 1: Read the file**

Read `app/(application)/accounting/page.tsx` in full. Its header (`text-3xl font-bold text-foreground` / `text-muted-foreground`) already matches the design system — leave it as-is.

- [ ] **Step 2: Verify no remaining violations**

Run: `grep -n "slate-\|dark:bg-\[#\|gradient" "app/(application)/accounting/page.tsx"`
Expected: no output. If any lines match, apply the Global Constraints mapping to them.

- [ ] **Step 3: Type-check**

Run: `cd "loan-matrix" && npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 4: Commit** (only if Step 2 required changes; otherwise skip — nothing to commit)

```bash
git add "app/(application)/accounting/page.tsx"
git commit -m "Standardize accounting dashboard page styling"
```

---

## Task 3: Chart of Accounts (list, new, view, edit)

**Files:**
- Modify: `app/(application)/accounting/chart-of-accounts/page.tsx`
- Modify: `app/(application)/accounting/chart-of-accounts/new/page.tsx`
- Modify: `app/(application)/accounting/chart-of-accounts/[id]/page.tsx`
- Modify: `app/(application)/accounting/chart-of-accounts/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `Card`, `Badge`, `Button`, `Input`, `Select*` from `@/components/ui/*` (unchanged imports).
- Produces: nothing new.

- [ ] **Step 1: Read all four files** before editing any of them, to catch shared patterns (this subsystem reuses the same account-type color scheme across list/view/edit).

- [ ] **Step 2: Fix `chart-of-accounts/page.tsx`**

This file has already been read in full during design. Apply exactly:

- Error Card (~line 84): `border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950` → remove (bare `<Card>`); `text-red-600 dark:text-red-400` / `text-red-500 dark:text-red-300` → `text-destructive`.
- Loading skeleton Cards (~lines 100-117): `border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800` → remove; `bg-slate-200 dark:bg-slate-700` (skeleton bars) → `bg-muted`.
- `typeConfig` map (~lines 124-155): collapse every entry to the Global Constraints per-category mapping, e.g.:
  ```tsx
  const typeConfig: Record<string, { color: string; bgColor: string; icon: any }> = {
    ASSET: { color: 'text-emerald-500', bgColor: 'bg-emerald-500/20', icon: TrendingUp },
    LIABILITY: { color: 'text-amber-500', bgColor: 'bg-amber-500/20', icon: TrendingDown },
    INCOME: { color: 'text-blue-500', bgColor: 'bg-blue-500/20', icon: TrendingUp },
    REVENUE: { color: 'text-blue-500', bgColor: 'bg-blue-500/20', icon: TrendingUp },
    EQUITY: { color: 'text-purple-500', bgColor: 'bg-purple-500/20', icon: Circle },
    EXPENSE: { color: 'text-red-500', bgColor: 'bg-red-500/20', icon: TrendingDown },
  };
  ```
- Header text (~line 162-165): `text-slate-900 dark:text-slate-100` → `text-foreground`; `text-slate-600 dark:text-slate-400` → `text-muted-foreground`.
- "New Account" button (~line 168): `bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg` → remove, bare `<Button>`.
- Stats Cards (~lines 177-231): each has `border border-slate-200 dark:border-slate-700 shadow-sm bg-gradient-to-br from-X-50 to-Y-50 dark:from-X-950 dark:to-Y-950` → remove entirely, bare `<Card>`. Inner text/icon colors (`text-blue-600 dark:text-blue-400`, `text-blue-900 dark:text-blue-100`, `bg-blue-100 dark:bg-blue-900`) → collapse to single-color-with-opacity per Global Constraints (e.g. `text-blue-500` for label+icon, `text-foreground` for the big number instead of `text-blue-900 dark:text-blue-100`, `bg-blue-500/20` for the icon circle).
- Filters Card (~line 235): `border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800` → remove. Search icon `text-slate-400 dark:text-slate-500` → `text-muted-foreground`. Input `bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100` → remove (keep `pl-10`). Select trigger/content/items: remove all `bg-white dark:bg-slate-700/800`, `border-slate-200 dark:border-slate-600`, `text-slate-900 dark:text-slate-100` — use bare `SelectTrigger`/`SelectContent`/`SelectItem`.
- Account row Cards (~line 280): `border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700` → remove (keep `group hover:shadow-lg hover:scale-[1.02] transition-all duration-300`). Title `text-slate-900 dark:text-slate-100` → `text-foreground`. Description `text-slate-500 dark:text-slate-400` → `text-muted-foreground`. GL code hash icon and text `text-slate-400 dark:text-slate-500` / `text-slate-600 dark:text-slate-300` → `text-muted-foreground`; its pill background `bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600` → `bg-muted`.
- Type badge (~line 314): keep `variant="outline"` and the per-type `config.color`, but simplify className to `` `text-xs h-6 px-3 ${config.color} border-current ${config.bgColor} hover:shadow-sm transition-all duration-200` `` (drop `bg-gradient-to-r` prefix — `config.bgColor` is now a flat class).
- Usage badge (~line 323): `bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600` → remove custom classes, keep `variant="secondary"`.
- Status badge (~line 336): replace the inline ternary with Global Constraints colors: disabled → `text-red-500 bg-red-500/20 border-red-500/30`, active → `text-green-500 bg-green-500/20 border-green-500/30`.
- Action button (~line 349): `text-slate-600 dark:text-slate-400` → `text-muted-foreground`.
- Pagination Card and its buttons (~lines 366-421): same `border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800` removal; `text-slate-600 dark:text-slate-400` → `text-muted-foreground`; button `border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700` → remove (bare `variant="outline"` already handles this). Page-size Select: same Select cleanup as the filters Select above.

- [ ] **Step 3: Fix `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`**

Read each file. Apply the same Global Constraints mapping found in Step 2 wherever the same patterns recur (headers, Cards, Inputs, Selects, Badges, buttons). These forms will have Label/Input pairs and multi-step or single-form layouts not present in the list page — map every `slate-*`/gradient occurrence using the Global Constraints table; there is no new pattern type here (chart-of-accounts detail/edit/new pages use the same Card/Input/Select/Badge/Button primitives as the list page).

- [ ] **Step 4: Confirm no violations remain**

Run: `grep -rn "slate-\|gradient-to-" "app/(application)/accounting/chart-of-accounts/"`
Expected: no output.

- [ ] **Step 5: Type-check**

Run: `cd "loan-matrix" && npx tsc --noEmit`
Expected: no new errors from these 4 files.

- [ ] **Step 6: Diff review**

Run: `git diff "app/(application)/accounting/chart-of-accounts/"`
Confirm only `className` values changed — no logic (filtering, pagination math, fetch calls, form submit handlers) touched.

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/accounting/chart-of-accounts/"
git commit -m "Standardize chart of accounts pages styling"
```

---

## Task 4: Accounting Rules (list, new, view, edit)

**Files:**
- Modify: `app/(application)/accounting/accounting-rules/page.tsx`
- Modify: `app/(application)/accounting/accounting-rules/new/page.tsx`
- Modify: `app/(application)/accounting/accounting-rules/[id]/page.tsx`
- Modify: `app/(application)/accounting/accounting-rules/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `@/components/ui/*` primitives (unchanged imports).
- Produces: nothing new.

- [ ] **Step 1: Read all four files** before editing.

- [ ] **Step 2: Apply the Global Constraints mapping** to every file — headers (`text-slate-900 dark:text-slate-100` → `text-foreground`, etc.), Cards (strip `border-slate-*`/`bg-white dark:bg-slate-800`/gradients), Inputs/Selects (strip manual bg/border/text slate classes), Badges (strip custom slate classes on non-semantic badges; collapse any status/type color pairs to the single-color-with-opacity idiom), buttons (strip gradients), skeletons (`bg-slate-200 dark:bg-slate-700` → `bg-muted`), error states (`text-destructive`, bare `Card`).

- [ ] **Step 3: Confirm no violations remain**

Run: `grep -rn "slate-\|gradient-to-" "app/(application)/accounting/accounting-rules/"`
Expected: no output.

- [ ] **Step 4: Type-check**

Run: `cd "loan-matrix" && npx tsc --noEmit`
Expected: no new errors from these 4 files.

- [ ] **Step 5: Diff review**

Run: `git diff "app/(application)/accounting/accounting-rules/"`
Confirm only styling changed.

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/accounting/accounting-rules/"
git commit -m "Standardize accounting rules pages styling"
```

---

## Task 5: Closing Entries (list, new, view, edit)

**Files:**
- Modify: `app/(application)/accounting/closing-entries/page.tsx`
- Modify: `app/(application)/accounting/closing-entries/new/page.tsx`
- Modify: `app/(application)/accounting/closing-entries/[id]/page.tsx`
- Modify: `app/(application)/accounting/closing-entries/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `@/components/ui/*` primitives (unchanged imports).
- Produces: nothing new.

- [ ] **Step 1: Read all four files** before editing.

- [ ] **Step 2: Apply the Global Constraints mapping** to every file, same categories as Task 4 (headers, Cards, Inputs/Selects, Badges, buttons, skeletons, error states). Closing entries typically show a status (e.g. pending/posted/reversed) — collapse any such status badge coloring to the single-color-with-opacity idiom, preserving which status maps to which color family.

- [ ] **Step 3: Confirm no violations remain**

Run: `grep -rn "slate-\|gradient-to-" "app/(application)/accounting/closing-entries/"`
Expected: no output.

- [ ] **Step 4: Type-check**

Run: `cd "loan-matrix" && npx tsc --noEmit`
Expected: no new errors from these 4 files.

- [ ] **Step 5: Diff review**

Run: `git diff "app/(application)/accounting/closing-entries/"`
Confirm only styling changed.

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/accounting/closing-entries/"
git commit -m "Standardize closing entries pages styling"
```

---

## Task 6: Journal Entries (new, view by transaction)

**Files:**
- Modify: `app/(application)/accounting/journal-entries/new/page.tsx`
- Modify: `app/(application)/accounting/journal-entries/[transactionId]/page.tsx`

**Interfaces:**
- Consumes: `@/components/ui/*` primitives (unchanged imports).
- Produces: nothing new.

- [ ] **Step 1: Read both files** before editing. These are the two largest accounting files (664 and 549 lines) — likely a multi-line-item journal entry form and a transaction detail view.

- [ ] **Step 2: Apply the Global Constraints mapping** to both files (headers, Cards, Inputs/Selects, Badges, buttons, skeletons, error states). Pay particular attention to any debit/credit or balanced/unbalanced indicator coloring — preserve the semantic distinction (e.g. debit vs. credit, balanced vs. unbalanced) using the single-color-with-opacity idiom rather than dropping the distinction.

- [ ] **Step 3: Confirm no violations remain**

Run: `grep -rn "slate-\|gradient-to-" "app/(application)/accounting/journal-entries/"`
Expected: no output.

- [ ] **Step 4: Type-check**

Run: `cd "loan-matrix" && npx tsc --noEmit`
Expected: no new errors from these 2 files.

- [ ] **Step 5: Diff review**

Run: `git diff "app/(application)/accounting/journal-entries/"`
Confirm only styling changed — these forms likely have running-total/balance-validation logic; verify none of it moved or changed.

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/accounting/journal-entries/"
git commit -m "Standardize journal entries pages styling"
```

---

## Task 7: Search Journal, Frequent Postings, Accruals

**Files:**
- Modify: `app/(application)/accounting/search-journal/page.tsx`
- Modify: `app/(application)/accounting/frequent-postings/page.tsx`
- Modify: `app/(application)/accounting/accruals/page.tsx`

**Interfaces:**
- Consumes: `@/components/ui/*` primitives (unchanged imports).
- Produces: nothing new.

- [ ] **Step 1: Read `search-journal/page.tsx` and `frequent-postings/page.tsx`** before editing (not yet read during design).

- [ ] **Step 2: Fix `accruals/page.tsx`**

This file has already been read in full during design. Apply exactly:

- Card (~line 98): `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg` → remove, bare `<Card>` (keep no extra classes).
- CardTitle (~line 100): `text-slate-900 dark:text-slate-100` → remove (CardTitle already defaults to foreground text via `text-card-foreground` on the parent `Card`) — just drop the className override.
- CardDescription (~line 103): `text-slate-600 dark:text-slate-400` → remove (CardDescription already defaults to `text-muted-foreground`).
- Label (~line 110): `text-slate-900 dark:text-slate-100` → remove className override (Label defaults are fine).
- Date Input (~line 119): `bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500` → keep only `pl-10` (rely on Input defaults; drop the custom indigo focus ring to match every other Input in the app).
- Calendar icon (~line 122): `text-slate-400` → `text-muted-foreground`.
- Cancel button (~line 131): `bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600` → remove, bare `<Button variant="outline">`.
- Submit button (~line 139): `bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed` → `disabled:opacity-50 disabled:cursor-not-allowed` only (bare `<Button>` for primary color).

- [ ] **Step 3: Apply the Global Constraints mapping to `search-journal/page.tsx` and `frequent-postings/page.tsx`** — same categories as prior tasks (headers, Cards, Inputs/Selects, Badges, buttons, skeletons, error states). Search Journal likely has a results table/list — if any row striping or status coloring uses `slate-*`, replace backgrounds/borders per the Global Constraints table; leave table structure and data logic untouched.

- [ ] **Step 4: Confirm no violations remain**

Run: `grep -rn "slate-\|gradient-to-" "app/(application)/accounting/search-journal/" "app/(application)/accounting/frequent-postings/" "app/(application)/accounting/accruals/"`
Expected: no output.

- [ ] **Step 5: Type-check**

Run: `cd "loan-matrix" && npx tsc --noEmit`
Expected: no new errors from these 3 files.

- [ ] **Step 6: Diff review**

Run: `git diff "app/(application)/accounting/search-journal/" "app/(application)/accounting/frequent-postings/" "app/(application)/accounting/accruals/"`
Confirm only styling changed — accruals' `handleRunAccruals` fetch/date-formatting logic must be byte-identical.

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/accounting/search-journal/" "app/(application)/accounting/frequent-postings/" "app/(application)/accounting/accruals/"
git commit -m "Standardize search journal, frequent postings, and accruals pages styling"
```

---

## Task 8: Full-module verification

**Files:** none modified — verification only.

**Interfaces:** N/A.

- [ ] **Step 1: Repo-wide grep for leftover violations**

Run: `grep -rn "slate-\|dark:bg-\[#\|gradient-to-" "app/(application)/accounting/" components/accounting/`
Expected: no output. If anything remains, go back to the owning task and fix it (do not patch ad hoc here — keep the fix attributed to its subsystem's commit history by amending that task's work before moving on).

- [ ] **Step 2: Full type-check**

Run: `cd "loan-matrix" && npx tsc --noEmit`
Expected: no errors in any `app/(application)/accounting/**` or `components/accounting/**` file. (Pre-existing errors elsewhere in the app, unrelated to this refactor, are out of scope.)

- [ ] **Step 3: Production build**

Run: `cd "loan-matrix" && npm run build`
Expected: build succeeds (confirms no broken JSX/Tailwind syntax across all touched files, since `next build --webpack` runs the full TypeScript + bundling pipeline).

- [ ] **Step 4: Manual visual pass**

Run `npm run dev`, then visit each of these routes in the browser in both light and dark mode (toggle via the app's theme switcher), confirming: (a) it visually reads consistently with `/loans` and `/clients` — no stray slate panels, no gradients, no rainbow icon colors; (b) all interactive elements still work — search, filters, pagination, form submission, navigation links:
  - `/accounting`
  - `/accounting/chart-of-accounts`, `/accounting/chart-of-accounts/new`, and one existing account's view/edit pages
  - `/accounting/accounting-rules`, `/accounting/accounting-rules/new`, and one existing rule's view/edit pages
  - `/accounting/closing-entries`, `/accounting/closing-entries/new`, and one existing entry's view/edit pages
  - `/accounting/journal-entries/new` and one existing transaction's view page
  - `/accounting/search-journal`
  - `/accounting/frequent-postings`
  - `/accounting/accruals`

- [ ] **Step 5: Report results**

Summarize pass/fail per route. If any route regresses functionally (not just visually), stop and fix before proceeding — this plan guarantees zero behavior change.
