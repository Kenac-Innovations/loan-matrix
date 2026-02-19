-- Fix: 30,000 ZMK reversal (Fineract txn 8765) not reflected in Kasama teller vault
-- Fineract: Reversal of FLOAT TO MOFFAT - funds returned to vault on 2026-02-17
-- Loan Matrix vault was missing this +30,000 allocation

-- Run with: PGPASSWORD='P@ssw0rd' psql -h 10.10.0.143 -U postgres -d loan_matrix_dev -f scripts/fix-kasama-reversal-vault.sql

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
) VALUES (
  'cml' || replace(gen_random_uuid()::text, '-', ''),
  'cmh607k3d0000vc0k5xxjocsi',
  'cmko3j6ob000x3u01hg6jp332',
  NULL,  -- vault allocation
  NULL,
  30000,
  'ZMK',
  '2026-02-17 06:28:59.41431',  -- match Fineract reversal timestamp
  'SYSTEM-REVERSAL',
  'Reversal of FLOAT TO MOFFAT - funds returned to vault (Fineract cashier txn 8765)',
  'ACTIVE',
  now(),
  now()
);
