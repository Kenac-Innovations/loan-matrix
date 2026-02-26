-- Reverse two cash-out transactions so the money goes back to the respective cashiers.
-- 349967/16/1 - Mocris Muma   - ZMK 600
-- 167803/18/1 - Chiteta Chinyama - ZMK 5000
--
-- These are CashAllocation records (cash out from cashier). Setting status = 'REVERSED'
-- makes Loan Matrix treat them as reversed so the cashier balance effectively gets the money back.
--
-- Run with: psql -h 10.10.0.143 -U app -d loan_matrix_dev -f scripts/reverse-cashier-transactions-349967-167803.sql
-- (Or use your DB connection; set PGPASSWORD if required.)

BEGIN;

-- Show current rows
SELECT id, "fineractAllocationId", "cashierId", "tellerId", amount, currency, notes, status
FROM "CashAllocation"
WHERE "fineractAllocationId" IN (349967, 167803);

-- Reverse: set status to REVERSED so money is effectively returned to cashiers
UPDATE "CashAllocation"
SET status = 'REVERSED',
    "updatedAt" = now()
WHERE "fineractAllocationId" IN (349967, 167803)
  AND status = 'ACTIVE';

-- Show updated rows
SELECT id, "fineractAllocationId", "cashierId", "tellerId", amount, currency, notes, status
FROM "CashAllocation"
WHERE "fineractAllocationId" IN (349967, 167803);

COMMIT;
