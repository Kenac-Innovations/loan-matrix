import assert from "node:assert/strict";
// Import only pure functions to avoid server-side dependencies during testing
import {
  resolveSettleTransactionType,
  validateExpenseGlAccount,
  pickMainVaultGlAccountId,
} from "./cashier-expense-gl.pure";

function run() {
  // Test resolveSettleTransactionType
  assert.equal(
    resolveSettleTransactionType("EXPENSE"),
    "EXPENSE",
    "Should resolve EXPENSE"
  );

  assert.equal(
    resolveSettleTransactionType("RETURN_TO_VAULT"),
    "RETURN_TO_VAULT",
    "Should resolve RETURN_TO_VAULT"
  );

  assert.equal(
    resolveSettleTransactionType("DISBURSEMENT"),
    "DISBURSEMENT",
    "Should resolve DISBURSEMENT"
  );

  assert.equal(
    resolveSettleTransactionType("CREDIT_BALANCE_REFUND"),
    "CREDIT_BALANCE_REFUND",
    "Should resolve CREDIT_BALANCE_REFUND"
  );

  assert.equal(
    resolveSettleTransactionType(undefined),
    "RETURN_TO_VAULT",
    "Should default to RETURN_TO_VAULT when undefined"
  );

  assert.equal(
    resolveSettleTransactionType(null),
    "RETURN_TO_VAULT",
    "Should default to RETURN_TO_VAULT when null"
  );

  assert.equal(
    resolveSettleTransactionType(""),
    "RETURN_TO_VAULT",
    "Should default to RETURN_TO_VAULT when empty"
  );

  assert.equal(
    resolveSettleTransactionType("  "),
    "RETURN_TO_VAULT",
    "Should default to RETURN_TO_VAULT when whitespace"
  );

  assert.equal(
    resolveSettleTransactionType("expense"),
    "EXPENSE",
    "Should be case-insensitive"
  );

  assert.equal(
    resolveSettleTransactionType("INVALID"),
    null,
    "Should return null for invalid type"
  );

  assert.equal(
    resolveSettleTransactionType("random"),
    null,
    "Should return null for random string"
  );

  // Test validateExpenseGlAccount
  assert.equal(
    validateExpenseGlAccount(null),
    "GL account not found",
    "Should error when account is null"
  );

  assert.equal(
    validateExpenseGlAccount(undefined),
    "GL account not found",
    "Should error when account is undefined"
  );

  assert.equal(
    validateExpenseGlAccount({ disabled: true }),
    "GL account is disabled",
    "Should error when account is disabled"
  );

  assert.equal(
    validateExpenseGlAccount({
      type: { id: 1 },
      usage: { id: 1 },
      manualEntriesAllowed: true,
    }),
    "GL account type must be EXPENSE, got 1",
    "Should error when account type is not EXPENSE (by id)"
  );

  assert.equal(
    validateExpenseGlAccount({
      type: { value: "ASSET" },
      usage: { id: 1 },
      manualEntriesAllowed: true,
    }),
    "GL account type must be EXPENSE, got ASSET",
    "Should error when account type is not EXPENSE (by value)"
  );

  assert.equal(
    validateExpenseGlAccount({
      type: { id: 5 },
      usage: { id: 2 }, // header usage, not detail
      manualEntriesAllowed: true,
    }),
    "GL account must be a detail account (usage = 1), not a header",
    "Should error when usage is not 1 (detail)"
  );

  assert.equal(
    validateExpenseGlAccount({
      type: { id: 5 },
      usage: { id: 1 },
      manualEntriesAllowed: false,
    }),
    "GL account does not allow manual entries",
    "Should error when manual entries are not allowed"
  );

  assert.equal(
    validateExpenseGlAccount({
      type: { id: 5 },
      usage: { id: 1 },
      manualEntriesAllowed: true,
    }),
    null,
    "Should pass for valid EXPENSE account by id"
  );

  assert.equal(
    validateExpenseGlAccount({
      type: { value: "EXPENSE" },
      usage: { id: 1 },
      manualEntriesAllowed: true,
    }),
    null,
    "Should pass for valid EXPENSE account by value"
  );

  assert.equal(
    validateExpenseGlAccount({
      type: { code: "EXPENSE" },
      usage: { id: 1 },
      manualEntriesAllowed: true,
    }),
    null,
    "Should pass for valid EXPENSE account by code"
  );

  // Test pickMainVaultGlAccountId
  assert.equal(
    pickMainVaultGlAccountId(null),
    null,
    "Should return null when input is not an array"
  );

  assert.equal(
    pickMainVaultGlAccountId(undefined),
    null,
    "Should return null when input is undefined"
  );

  assert.equal(
    pickMainVaultGlAccountId([]),
    null,
    "Should return null for empty array"
  );

  assert.equal(
    pickMainVaultGlAccountId([
      { financialActivityData: { id: 100 }, glAccountData: { id: 50 } },
      { financialActivityData: { id: 102 }, glAccountData: { id: 51 } },
    ]),
    null,
    "Should return null when CASH_AT_MAINVAULT (101) not found"
  );

  assert.equal(
    pickMainVaultGlAccountId([
      { financialActivityData: { id: 100 }, glAccountData: { id: 50 } },
      { financialActivityData: { id: 101 }, glAccountData: { id: 9999 } },
      { financialActivityData: { id: 102 }, glAccountData: { id: 51 } },
    ]),
    9999,
    "Should return GL account ID when CASH_AT_MAINVAULT (101) found"
  );

  assert.equal(
    pickMainVaultGlAccountId([
      { financialActivityData: { id: 101 }, glAccountData: { id: 123 } },
    ]),
    123,
    "Should pick first matching CASH_AT_MAINVAULT"
  );

  assert.equal(
    pickMainVaultGlAccountId([
      { financialActivityData: { id: 101 } }, // no glAccountData
    ]),
    null,
    "Should return null if glAccountData is missing"
  );

  assert.equal(
    pickMainVaultGlAccountId([
      { financialActivityData: { id: 101 }, glAccountData: { id: "not-a-number" } },
    ]),
    null,
    "Should return null if GL account ID is not a number"
  );

  console.log("All tests passed!");
}

run();
