-- Loan Matrix: all paid-out loans for client 367789/67/1 (NRC) -> WISDOM CHANSA
-- DB: loan_matrix_dev has LoanPayout; loan_matrix does not.
-- Run: PGPASSWORD='P@ssw0rd' psql -h 10.10.0.143 -p 5432 -U postgres -d loan_matrix_dev -f scripts/query-paid-payouts-367789.sql

-- Option A: by client name (NRC 367789/67/1 = WISDOM CHANSA in Lead.externalId)
SELECT
  "loanAccountNo",
  "fineractLoanId",
  "fineractClientId",
  "clientName",
  amount,
  currency,
  status,
  "paidAt",
  "paidBy",
  "paymentMethod",
  "cashierId",
  "createdAt"
FROM "LoanPayout"
WHERE status = 'PAID'
  AND "clientName" ILIKE '%WISDOM%CHANSA%'
ORDER BY "paidAt" DESC NULLS LAST, "createdAt" DESC;

-- Option B: by Fineract client ID (21128 for this client)
-- SELECT ... FROM "LoanPayout" WHERE status = 'PAID' AND "fineractClientId" = 21128 ORDER BY "paidAt" DESC;
