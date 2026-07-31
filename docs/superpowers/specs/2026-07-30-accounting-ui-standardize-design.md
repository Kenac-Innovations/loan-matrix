# Accounting UI Standardization

## Problem

The accounting module (`components/accounting/`, `app/(application)/accounting/**`, 14 page files + 2 shared components) styles itself independently of the rest of the app. Every page hand-rolls colors instead of using the shared design system, producing:

- Hardcoded `slate-*` + manual `dark:` pairs on Cards/Inputs/Selects/Badges (e.g. `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700`) instead of the shared `Card` component's built-in `bg-card`/`text-card-foreground`/`border`, which already themes via CSS variables.
- Gradient buttons and gradient card backgrounds (`bg-gradient-to-r from-blue-600 to-purple-600`, `from-blue-50 to-indigo-50 dark:from-blue-950...`) not used anywhere else in the app.
- Arbitrary, non-semantic per-item colors (each `AccountingHome` tile gets a different hardcoded rainbow color with no meaning).
- A raw hex value (`dark:bg-[#0d121f]`) in `layout.tsx` instead of a token.
- Inconsistency even within the module — some spots (`accruals/page.tsx` header, `accounting/page.tsx` header) already correctly use `text-foreground`/`text-muted-foreground`.

Other modules (Dashboard, Loans, Clients) don't do any of this — they use the shared UI primitives at their defaults and reserve color only for real semantic meaning (status, trend), expressed as a single Tailwind color at `/20` opacity for backgrounds plus `-500` text, with no manual `dark:` pairs.

## Goal

Restyle every page under `app/(application)/accounting/**` and `components/accounting/**` to match the rest of the app's visual language, with zero behavior change. This is a pure styling/markup refactor — no data-fetching, routing, or business logic changes.

## Rules

Applied uniformly across all 14 accounting page files and the 2 shared components:

1. **Cards** — use bare `<Card>`/`<CardHeader>`/`<CardContent>` with no overrides. Remove `bg-white dark:bg-slate-800`, `border-slate-200 dark:border-slate-700`, and gradient backgrounds (`bg-gradient-to-br from-blue-50...`).
2. **Text** — `text-slate-900 dark:text-slate-100` → `text-foreground`; `text-slate-600/500 dark:text-slate-400` → `text-muted-foreground`.
3. **Inputs/Selects** — drop manual `bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900...`; rely on component defaults (matches the Loans search bar).
4. **Buttons** — remove gradient buttons; use default `<Button>` (primary) or `variant="outline"`, matching Clients/Loans.
5. **Semantic color coding** (account type badges, trend arrows, active/disabled status) — keep the meaning, re-implement using the idiom Dashboard already uses: a single Tailwind color at `/20` opacity for backgrounds + plain `-500` text, no manual `dark:` pairs.
6. **Module tiles** (`AccountingHome.tsx`) — replace the 7 arbitrary rainbow icon colors with the treatment `StatsCards.tsx` already uses correctly: `bg-primary/10` circle + `text-primary` icon.
7. **Loading skeletons** — `bg-slate-200 dark:bg-slate-700` → `bg-muted`, matching Loans' skeleton.
8. **Error states** — plain `<Card>` + `text-destructive`, no custom red card styling.
9. **`layout.tsx` wrapper** — drop the extra `bg-white dark:bg-[#0d121f] rounded-lg shadow-sm` box around all accounting pages; no other module wraps its content in an extra card-like section.

## Scope

Files in scope:

- `components/accounting/AccountingHome.tsx`
- `components/accounting/StatsCards.tsx`
- `app/(application)/accounting/layout.tsx`
- `app/(application)/accounting/page.tsx`
- `app/(application)/accounting/accounting-rules/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- `app/(application)/accounting/accruals/page.tsx`
- `app/(application)/accounting/chart-of-accounts/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- `app/(application)/accounting/closing-entries/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- `app/(application)/accounting/frequent-postings/page.tsx`
- `app/(application)/accounting/journal-entries/new/page.tsx`, `[transactionId]/page.tsx`
- `app/(application)/accounting/search-journal/page.tsx`

Out of scope: any Fineract API/data logic, routing structure, non-accounting modules.

## Verification

- `npm run build` / `tsc` type-check passes (styling-only edits, but Tailwind class typos can still break `cn()` usage or JSX).
- Manual visual pass in the browser: each accounting page in both light and dark mode, confirming it reads consistently with Loans/Clients/Dashboard and nothing regresses (search, filters, pagination, forms still functional).
