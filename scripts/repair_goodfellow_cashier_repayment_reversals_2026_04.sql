-- Repair script: backfill missing cashier counter-transactions for reversed cash repayments
--
-- Scope:
-- - Tenant: Goodfellow
-- - Teller: 31 (Loan Matrix teller id: cmko1x9g3001l3c01yk60uxli)
-- - Cashier: Fineract cashier 58 / Loan Matrix cashier id cmkws45y4053r6i011zupwp2d
-- - Repayment txns covered:
--   433981 -> loan 125267
--   434083 -> loan 121040
--   434575 -> loan 125267
--   434596 -> loan 121040
--
-- Important:
-- - 434082 is intentionally excluded. It was reversed on the loan side, but it was never
--   linked to this cashier in Loan Matrix, so it is not one of the 4 cashier rows from the screenshot.
-- - This patch inserts:
--   1. missing Fineract cashier cash-out rows so the cashier transactions page shows the reversal
--   2. matching negative Loan Matrix CashAllocation rows
--   3. RepaymentCashLink.reversedAt / reversalNotes updates
-- - The inserted timestamps match the actual reversal day/time captured from Fineract.
--
-- How to run:
-- 1. connect to fineract_tenant_goodfellow and run the FINERACT section
-- 2. connect to loan_matrix_prod and run the LOAN MATRIX section
-- 3. run the VERIFY section in both DBs afterwards
--
-- This script is intentionally idempotent:
-- - it skips rows that already exist
-- - it raises on unexpected source-state mismatches before inserting anything


-- ============================================================
-- FINERACT SECTION
-- Database: fineract_tenant_goodfellow
-- ============================================================

BEGIN;

CREATE TEMP TABLE patch_rows_fineract (
  repayment_txn_id  bigint PRIMARY KEY,
  loan_id           bigint NOT NULL,
  cashier_id        bigint NOT NULL,
  txn_amount        numeric(19,6) NOT NULL,
  txn_date          date NOT NULL,
  created_date_utc  timestamptz NOT NULL,
  txn_note          text NOT NULL,
  currency_code     text NOT NULL
) ON COMMIT DROP;

INSERT INTO patch_rows_fineract (
  repayment_txn_id,
  loan_id,
  cashier_id,
  txn_amount,
  txn_date,
  created_date_utc,
  txn_note,
  currency_code
)
VALUES
  (433981, 125267, 58, 6346.500000, DATE '2026-04-20', TIMESTAMPTZ '2026-04-20 13:47:51.155203+00', 'Repayment reversal - Loan #125267 / Txn #433981', 'ZMK'),
  (434083, 121040, 58, 6346.500000, DATE '2026-04-20', TIMESTAMPTZ '2026-04-20 13:53:14.964337+00', 'Repayment reversal - Loan #121040 / Txn #434083', 'ZMK'),
  (434575, 125267, 58, 6346.500000, DATE '2026-04-25', TIMESTAMPTZ '2026-04-25 13:03:11.104963+00', 'Repayment reversal - Loan #125267 / Txn #434575', 'ZMK'),
  (434596, 121040, 58, 6346.500000, DATE '2026-04-25', TIMESTAMPTZ '2026-04-25 13:04:16.171702+00', 'Repayment reversal - Loan #121040 / Txn #434596', 'ZMK');

DO $$
DECLARE
  missing_source_count integer;
  not_reversed_count integer;
BEGIN
  SELECT count(*)
  INTO missing_source_count
  FROM patch_rows_fineract p
  LEFT JOIN m_loan_transaction t
    ON t.id = p.repayment_txn_id
   AND t.loan_id = p.loan_id
  WHERE t.id IS NULL;

  IF missing_source_count <> 0 THEN
    RAISE EXCEPTION 'Aborting: % repayment source rows were not found in m_loan_transaction', missing_source_count;
  END IF;

  SELECT count(*)
  INTO not_reversed_count
  FROM patch_rows_fineract p
  JOIN m_loan_transaction t
    ON t.id = p.repayment_txn_id
   AND t.loan_id = p.loan_id
  WHERE coalesce(t.is_reversed, false) = false;

  IF not_reversed_count <> 0 THEN
    RAISE EXCEPTION 'Aborting: % repayment source rows are not marked reversed in Fineract', not_reversed_count;
  END IF;
END $$;

INSERT INTO m_cashier_transactions (
  cashier_id,
  txn_type,
  txn_amount,
  txn_date,
  created_date,
  entity_type,
  entity_id,
  txn_note,
  currency_code
)
SELECT
  p.cashier_id,
  102, -- Cash Out
  p.txn_amount,
  p.txn_date,
  p.created_date_utc,
  NULL,
  NULL,
  p.txn_note,
  p.currency_code
FROM patch_rows_fineract p
WHERE NOT EXISTS (
  SELECT 1
  FROM m_cashier_transactions ct
  WHERE ct.cashier_id = p.cashier_id
    AND ct.txn_type = 102
    AND ct.txn_amount = p.txn_amount
    AND ct.txn_date = p.txn_date
    AND ct.txn_note = p.txn_note
);

COMMIT;


-- ============================================================
-- LOAN MATRIX SECTION
-- Database: loan_matrix_prod
-- ============================================================

BEGIN;

CREATE TEMP TABLE patch_rows_loan_matrix (
  repayment_txn_id      bigint PRIMARY KEY,
  loan_id               bigint NOT NULL,
  tenant_id             text NOT NULL,
  teller_id             text NOT NULL,
  cashier_id            text NOT NULL,
  amount                double precision NOT NULL,
  currency              text NOT NULL,
  reversal_ts_utc       timestamptz NOT NULL,
  reversal_ts_local     timestamp NOT NULL,
  allocated_by          text NOT NULL,
  note                  text NOT NULL
) ON COMMIT DROP;

INSERT INTO patch_rows_loan_matrix (
  repayment_txn_id,
  loan_id,
  tenant_id,
  teller_id,
  cashier_id,
  amount,
  currency,
  reversal_ts_utc,
  reversal_ts_local,
  allocated_by,
  note
)
VALUES
  (433981, 125267, 'cmh607k3d0000vc0k5xxjocsi', 'cmko1x9g3001l3c01yk60uxli', 'cmkws45y4053r6i011zupwp2d', -6346.50, 'ZMW', TIMESTAMPTZ '2026-04-20 13:47:51.155203+00', TIMESTAMP '2026-04-20 15:47:51.155203', '62', 'Repayment reversal - Loan #125267 / Txn #433981'),
  (434083, 121040, 'cmh607k3d0000vc0k5xxjocsi', 'cmko1x9g3001l3c01yk60uxli', 'cmkws45y4053r6i011zupwp2d', -6346.50, 'ZMW', TIMESTAMPTZ '2026-04-20 13:53:14.964337+00', TIMESTAMP '2026-04-20 15:53:14.964337', '62', 'Repayment reversal - Loan #121040 / Txn #434083'),
  (434575, 125267, 'cmh607k3d0000vc0k5xxjocsi', 'cmko1x9g3001l3c01yk60uxli', 'cmkws45y4053r6i011zupwp2d', -6346.50, 'ZMW', TIMESTAMPTZ '2026-04-25 13:03:11.104963+00', TIMESTAMP '2026-04-25 15:03:11.104963', '62', 'Repayment reversal - Loan #125267 / Txn #434575'),
  (434596, 121040, 'cmh607k3d0000vc0k5xxjocsi', 'cmko1x9g3001l3c01yk60uxli', 'cmkws45y4053r6i011zupwp2d', -6346.50, 'ZMW', TIMESTAMPTZ '2026-04-25 13:04:16.171702+00', TIMESTAMP '2026-04-25 15:04:16.171702', '62', 'Repayment reversal - Loan #121040 / Txn #434596');

DO $$
DECLARE
  tenant_missing_count integer;
  teller_missing_count integer;
  cashier_missing_count integer;
  missing_link_count integer;
BEGIN
  SELECT count(*)
  INTO tenant_missing_count
  FROM patch_rows_loan_matrix p
  LEFT JOIN "Tenant" t ON t.id = p.tenant_id
  WHERE t.id IS NULL;

  IF tenant_missing_count <> 0 THEN
    RAISE EXCEPTION 'Aborting: % tenant rows were not found in Loan Matrix', tenant_missing_count;
  END IF;

  SELECT count(*)
  INTO teller_missing_count
  FROM patch_rows_loan_matrix p
  LEFT JOIN "Teller" t ON t.id = p.teller_id
  WHERE t.id IS NULL;

  IF teller_missing_count <> 0 THEN
    RAISE EXCEPTION 'Aborting: % teller rows were not found in Loan Matrix', teller_missing_count;
  END IF;

  SELECT count(*)
  INTO cashier_missing_count
  FROM patch_rows_loan_matrix p
  LEFT JOIN "Cashier" c ON c.id = p.cashier_id
  WHERE c.id IS NULL;

  IF cashier_missing_count <> 0 THEN
    RAISE EXCEPTION 'Aborting: % cashier rows were not found in Loan Matrix', cashier_missing_count;
  END IF;

  SELECT count(*)
  INTO missing_link_count
  FROM patch_rows_loan_matrix p
  LEFT JOIN "RepaymentCashLink" r
    ON r."tenantId" = p.tenant_id
   AND r."fineractTransactionId" = p.repayment_txn_id
   AND r."loanId" = p.loan_id
   AND r."cashierId" = p.cashier_id
  WHERE r.id IS NULL;

  IF missing_link_count <> 0 THEN
    RAISE EXCEPTION 'Aborting: % repayment cash-link rows were not found for the expected cashier', missing_link_count;
  END IF;
END $$;

INSERT INTO "CashAllocation" (
  id,
  "tenantId",
  "tellerId",
  "cashierId",
  "fineractAllocationId",
  amount,
  currency,
  "allocatedDate",
  "allocatedBy",
  notes,
  status,
  "createdAt",
  "updatedAt"
)
SELECT
  'manual-repayment-reversal-' || p.repayment_txn_id,
  p.tenant_id,
  p.teller_id,
  p.cashier_id,
  NULL,
  p.amount,
  p.currency,
  p.reversal_ts_local,
  p.allocated_by,
  p.note,
  'ACTIVE',
  p.reversal_ts_local,
  p.reversal_ts_local
FROM patch_rows_loan_matrix p
WHERE NOT EXISTS (
  SELECT 1
  FROM "CashAllocation" ca
  WHERE ca."tenantId" = p.tenant_id
    AND ca."cashierId" = p.cashier_id
    AND ca.amount = p.amount
    AND ca.notes = p.note
);

UPDATE "RepaymentCashLink" r
SET
  "reversedAt" = p.reversal_ts_utc,
  "reversalNotes" = p.note,
  "updatedAt" = p.reversal_ts_utc
FROM patch_rows_loan_matrix p
WHERE r."tenantId" = p.tenant_id
  AND r."fineractTransactionId" = p.repayment_txn_id
  AND r."loanId" = p.loan_id
  AND r."cashierId" = p.cashier_id
  AND (
    r."reversedAt" IS DISTINCT FROM p.reversal_ts_utc
    OR r."reversalNotes" IS DISTINCT FROM p.note
  );

COMMIT;


-- ============================================================
-- VERIFY SECTION
-- Run these after the patch
-- ============================================================

-- In fineract_tenant_goodfellow:
-- select id, cashier_id, txn_type, txn_amount, txn_date, created_date, txn_note
-- from m_cashier_transactions
-- where cashier_id = 58
--   and txn_note like 'Repayment reversal - Loan #%'
-- order by created_date, id;

-- In loan_matrix_prod:
-- select id, amount, currency, "allocatedDate", "allocatedBy", notes
-- from "CashAllocation"
-- where "cashierId" = 'cmkws45y4053r6i011zupwp2d'
--   and notes like 'Repayment reversal - Loan #%'
-- order by "allocatedDate", id;

-- select "fineractTransactionId", "loanId", "reversedAt", "reversalNotes"
-- from "RepaymentCashLink"
-- where "fineractTransactionId" in (433981, 434083, 434575, 434596)
-- order by "fineractTransactionId";
