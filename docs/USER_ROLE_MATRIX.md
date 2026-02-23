# Loan Matrix – User Role Matrix

This document describes the **role–permission** matrix (what each system role can do). The **user–role** matrix (which user has which role) lives in the database and can be printed with:

```bash
npx tsx scripts/user-role-matrix.ts
```

(Requires `DATABASE_URL` and access to the Loan Matrix DB.)

---

## Schema (DB)

- **SystemRole** – Defines a role: `name`, `displayName`, `description`, `permissions` (JSON array).
- **UserRole** – Assigns a Fineract/Mifos user to a role: `tenantId`, `mifosUserId`, `mifosUsername`, `roleId`, `isActive`.

Roles are **per tenant**. A user can have multiple roles per tenant.

---

## Role–Permission Matrix (from seed / default)

| Role (name)     | Display Name       | Permissions |
|-----------------|--------------------|-------------|
| **BRANCH_MANAGER** | Branch Manager    | VIEW_LEADS, CREATE_LEADS, EDIT_LEADS, DELETE_LEADS, APPROVE_LEADS, VIEW_CLIENTS, CREATE_CLIENTS, EDIT_CLIENTS, VIEW_LOANS, APPROVE_LOANS, DISBURSE_LOANS, VIEW_REPORTS, MANAGE_BRANCH |
| **LOAN_OFFICER**   | Loan Officer      | VIEW_LEADS, CREATE_LEADS, EDIT_LEADS, VIEW_CLIENTS, CREATE_CLIENTS, EDIT_CLIENTS, VIEW_LOANS, CREATE_LOANS, EDIT_LOANS, VIEW_REPORTS |
| **CREDIT_OFFICER** | Credit Officer    | VIEW_LEADS, EDIT_LEADS, VIEW_CLIENTS, VIEW_LOANS, ASSESS_CREDIT, VIEW_REPORTS, RECOMMEND_LOANS |
| **COMPLIANCE**     | Compliance        | VIEW_LEADS, VIEW_CLIENTS, VIEW_LOANS, VIEW_REPORTS, COMPLIANCE_CHECK, VIEW_AUDIT_LOGS |
| **ACCOUNTANT**     | Accountant        | VIEW_LOANS, VIEW_REPORTS, VIEW_ACCOUNTING, CREATE_JOURNAL_ENTRIES, VIEW_JOURNAL_ENTRIES, RECONCILE_ACCOUNTS, VIEW_TELLERS, VIEW_CASH_MANAGEMENT |
| **AUTHORISER**     | Authoriser        | VIEW_LEADS, VIEW_CLIENTS, VIEW_LOANS, AUTHORISE_LOANS_L1, VIEW_REPORTS |
| **AUTHORISER2**    | Authoriser Level 2 | VIEW_LEADS, VIEW_CLIENTS, VIEW_LOANS, AUTHORISE_LOANS_L1, AUTHORISE_LOANS_L2, VIEW_REPORTS |

Additional roles (e.g. **SUPER_ADMIN**, **ADMIN**) may exist in the DB if created outside the seed.

---

## User–Role Matrix (from DB)

Run the script above to get a table of:

- **Mifos User ID** – Fineract user id
- **Username** – Fineract username
- **Roles** – Assigned role display names for that tenant

Example output shape:

```
### User ↔ Role assignments
| Mifos User ID | Username   | Roles                    |
|---------------|------------|--------------------------|
| 1             | mifos      | Branch Manager           |
| 2             | john.doe   | Loan Officer, Authoriser |
```

---

## How assignment is used

- **API:** `/api/users/roles` (GET = current user’s roles; POST = assign role to user).
- **Auth:** `/api/auth/user-roles` returns the current user’s role names; `isAdmin` / `isSuperAdmin` are derived from roles and username (e.g. `mifos` or SUPER_ADMIN).
- **Authorization:** Permissions from the user’s assigned roles are used for feature access (e.g. role-guard, `hasPermissionServer`).
