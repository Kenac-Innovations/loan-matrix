import assert from "node:assert/strict";
import {
  buildTellerVaultTransactions,
  shouldIncludeInVaultHistory,
  TellerAllocationHistoryInput,
} from "./teller-vault-transactions";

function run() {
  // Test 1: EXPENSE with note "Return to Vault" is excluded
  {
    const allocation: TellerAllocationHistoryInput = {
      id: "test-1",
      allocatedDate: new Date("2024-01-01"),
      amount: 100,
      currency: "ZMW",
      notes: "Return to Vault",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: "cashier-1",
      fineractAllocationId: null,
      transactionType: "EXPENSE",
    };

    assert.equal(
      shouldIncludeInVaultHistory(allocation),
      false,
      "EXPENSE with transactionType should be excluded regardless of notes"
    );
  }

  // Test 2: RETURN_TO_VAULT with custom note "cash back" is included as +amount SETTLEMENT_RETURN
  {
    const allocation: TellerAllocationHistoryInput = {
      id: "test-2",
      allocatedDate: new Date("2024-01-01"),
      amount: -150,
      currency: "ZMW",
      notes: "cash back",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: "cashier-1",
      fineractAllocationId: 123,
      transactionType: "RETURN_TO_VAULT",
    };

    assert.equal(
      shouldIncludeInVaultHistory(allocation),
      true,
      "RETURN_TO_VAULT should be included"
    );

    const transactions = buildTellerVaultTransactions([allocation]);
    assert.equal(transactions.length, 1, "Should have one transaction");
    assert.equal(
      transactions[0].type,
      "SETTLEMENT_RETURN",
      "Should be SETTLEMENT_RETURN type"
    );
    assert.equal(
      transactions[0].amount,
      150,
      "Amount should be positive regardless of input"
    );
  }

  // Test 3: Legacy null-type "Return to Vault" negative cashier row → +amount SETTLEMENT_RETURN
  {
    const allocation: TellerAllocationHistoryInput = {
      id: "test-3",
      allocatedDate: new Date("2024-01-01"),
      amount: -200,
      currency: "ZMW",
      notes: "Return to Vault",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: "cashier-1",
      fineractAllocationId: null,
      transactionType: null,
    };

    assert.equal(
      shouldIncludeInVaultHistory(allocation),
      true,
      "Legacy 'Return to Vault' note should be included"
    );

    const transactions = buildTellerVaultTransactions([allocation]);
    assert.equal(transactions.length, 1, "Should have one transaction");
    assert.equal(
      transactions[0].type,
      "SETTLEMENT_RETURN",
      "Should be SETTLEMENT_RETURN type"
    );
    assert.equal(
      transactions[0].amount,
      200,
      "Amount should be positive"
    );
  }

  // Test 4: Legacy null-type negative "Expense" note row → excluded
  {
    const allocation: TellerAllocationHistoryInput = {
      id: "test-4",
      allocatedDate: new Date("2024-01-01"),
      amount: -100,
      currency: "ZMW",
      notes: "Expense",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: "cashier-1",
      fineractAllocationId: null,
      transactionType: null,
    };

    // Legacy note "Expense" doesn't match any inclusion pattern, so it falls through to isCashierReturnToVault
    // which should return false, so this should be excluded
    assert.equal(
      shouldIncludeInVaultHistory(allocation),
      false,
      "Legacy 'Expense' note without transactionType should be excluded"
    );
  }

  // Test 5: Legacy null-type teller-to-cashier "float" allocation → negative CASHIER_ALLOCATION
  {
    const allocation: TellerAllocationHistoryInput = {
      id: "test-5",
      allocatedDate: new Date("2024-01-01"),
      amount: 50,
      currency: "ZMW",
      notes: "float",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: "cashier-1",
      fineractAllocationId: 456,
      transactionType: null,
    };

    assert.equal(
      shouldIncludeInVaultHistory(allocation),
      true,
      "Teller-to-cashier float allocation should be included"
    );

    const transactions = buildTellerVaultTransactions([allocation]);
    assert.equal(transactions.length, 1, "Should have one transaction");
    assert.equal(
      transactions[0].type,
      "CASHIER_ALLOCATION",
      "Should be CASHIER_ALLOCATION type"
    );
    assert.equal(
      transactions[0].amount,
      -50,
      "Amount should be negative for outflow"
    );
  }

  // Test 6: DISBURSEMENT with transactionType should be excluded
  {
    const allocation: TellerAllocationHistoryInput = {
      id: "test-6",
      allocatedDate: new Date("2024-01-01"),
      amount: 300,
      currency: "ZMW",
      notes: "Loan Disbursement",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: "cashier-1",
      fineractAllocationId: null,
      transactionType: "DISBURSEMENT",
    };

    assert.equal(
      shouldIncludeInVaultHistory(allocation),
      false,
      "DISBURSEMENT should be excluded"
    );
  }

  // Test 7: CREDIT_BALANCE_REFUND should be excluded
  {
    const allocation: TellerAllocationHistoryInput = {
      id: "test-7",
      allocatedDate: new Date("2024-01-01"),
      amount: 250,
      currency: "ZMW",
      notes: "Refund",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: "cashier-1",
      fineractAllocationId: null,
      transactionType: "CREDIT_BALANCE_REFUND",
    };

    assert.equal(
      shouldIncludeInVaultHistory(allocation),
      false,
      "CREDIT_BALANCE_REFUND should be excluded"
    );
  }

  // Test 8: Direct vault allocation (no cashierId) should be included
  {
    const allocation: TellerAllocationHistoryInput = {
      id: "test-8",
      allocatedDate: new Date("2024-01-01"),
      amount: 500,
      currency: "ZMW",
      notes: "Bank deposit",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: null,
      fineractAllocationId: null,
      transactionType: null,
    };

    assert.equal(
      shouldIncludeInVaultHistory(allocation),
      true,
      "Direct vault allocation should be included"
    );

    const transactions = buildTellerVaultTransactions([allocation]);
    assert.equal(transactions.length, 1, "Should have one transaction");
    assert.equal(transactions[0].amount, 500, "Amount should be unchanged");
  }

  // Test 9: Multiple allocations with running balance
  {
    const allocations: TellerAllocationHistoryInput[] = [
      {
        id: "test-9-1",
        allocatedDate: new Date("2024-01-01"),
        amount: 1000,
        currency: "ZMW",
        notes: "Opening",
        allocatedBy: "user1",
        status: "ACTIVE",
        cashierId: null,
        fineractAllocationId: null,
        transactionType: null,
      },
      {
        id: "test-9-2",
        allocatedDate: new Date("2024-01-02"),
        amount: -100,
        currency: "ZMW",
        notes: "Return to Vault",
        allocatedBy: "user1",
        status: "ACTIVE",
        cashierId: "cashier-1",
        fineractAllocationId: null,
        transactionType: "RETURN_TO_VAULT",
      },
      {
        id: "test-9-3",
        allocatedDate: new Date("2024-01-03"),
        amount: -50,
        currency: "ZMW",
        notes: "Expense",
        allocatedBy: "user1",
        status: "ACTIVE",
        cashierId: "cashier-1",
        fineractAllocationId: null,
        transactionType: "EXPENSE",
      },
    ];

    const transactions = buildTellerVaultTransactions(allocations);
    // Should only include first two (third is EXPENSE and excluded)
    assert.equal(transactions.length, 2, "Should have two transactions");
    assert.equal(transactions[0].runningBalance, 1000, "First balance is 1000");
    assert.equal(transactions[1].runningBalance, 1100, "Second balance is 1100 (1000 + 100)");
  }

  // Reconcile-modal returns: legacy note-only rows were excluded; typed rows now count as vault inflows
  {
    const base = {
      allocatedDate: new Date("2024-01-04"),
      amount: -300,
      currency: "ZMW",
      notes: "End of day reconciliation - Return to teller safe",
      allocatedBy: "user1",
      status: "ACTIVE",
      cashierId: "cashier-1",
      fineractAllocationId: null,
    };
    assert.equal(
      buildTellerVaultTransactions([{ ...base, id: "legacy-reconcile", transactionType: null }]).length,
      0,
      "Legacy reconcile return keeps its old (excluded) behaviour"
    );
    const typed = buildTellerVaultTransactions([
      { ...base, id: "typed-reconcile", transactionType: "RETURN_TO_VAULT" },
    ]);
    assert.equal(typed.length, 1);
    assert.equal(typed[0].amount, 300);
    assert.equal(typed[0].type, "SETTLEMENT_RETURN");
  }
}

run();
