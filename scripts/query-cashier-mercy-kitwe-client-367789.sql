-- Cashier: Mercy - Kitwe (CHANSA, MERCY @ Kitwe Branch)
-- Client: 367789/67/1 = WISDOM CHANSA (fineractClientId 21128)
-- Run: PGPASSWORD='P@ssw0rd' psql -h 10.10.0.143 -p 5432 -U postgres -d loan_matrix_dev -f scripts/query-cashier-mercy-kitwe-client-367789.sql

\echo '=== Cashier Mercy - Kitwe: IDs ==='
SELECT c.id AS cashier_id, c."staffName", t.name AS teller_name, t."officeName"
FROM "Cashier" c
JOIN "Teller" t ON t.id = c."tellerId"
WHERE c."staffName" ILIKE '%CHANSA%MERCY%' AND t."officeName" ILIKE '%Kitwe%';

\echo ''
\echo '=== All transactions for this cashier for client WISDOM CHANSA (21128) ==='

\echo '--- Loan payouts (client paid via this cashier) ---'
SELECT 'Payout' AS tx_type, lp."loanAccountNo", lp.amount, lp.currency, lp.status, lp."paymentMethod", lp."paidAt", lp."paidBy"
FROM "LoanPayout" lp
WHERE lp."fineractClientId" = 21128
  AND lp."cashierId" IN (
    SELECT c.id FROM "Cashier" c
    JOIN "Teller" t ON t.id = c."tellerId"
    WHERE c."staffName" ILIKE '%CHANSA%MERCY%' AND t."officeName" ILIKE '%Kitwe%'
  )
ORDER BY lp."paidAt" DESC;

\echo '--- Cash settlements (disbursements) for this client at this cashier ---'
SELECT cs.id, lp."loanAccountNo", cs."cashOut" AS amount, cs."settlementDate", cs.status, cs."settledBy"
FROM "CashSettlement" cs
JOIN "LoanPayout" lp ON lp.id = cs."loanPayoutId"
WHERE cs."cashierId" IN (
  SELECT c.id FROM "Cashier" c JOIN "Teller" t ON t.id = c."tellerId"
  WHERE c."staffName" ILIKE '%CHANSA%MERCY%' AND t."officeName" ILIKE '%Kitwe%'
)
AND lp."fineractClientId" = 21128
ORDER BY cs."settlementDate" DESC;

\echo '--- Cash allocations (e.g. reversals) at this cashier referencing this client/loan ---'
SELECT ca.id, ca.amount, ca.currency, ca.status, ca."allocatedDate", ca."allocatedBy", ca.notes
FROM "CashAllocation" ca
WHERE ca."cashierId" IN (
  SELECT c.id FROM "Cashier" c JOIN "Teller" t ON t.id = c."tellerId"
  WHERE c."staffName" ILIKE '%CHANSA%MERCY%' AND t."officeName" ILIKE '%Kitwe%'
)
AND ca.notes IS NOT NULL
AND (ca.notes ILIKE '%21128%' OR ca.notes ILIKE '%WISDOM%' OR ca.notes ILIKE '%104582%' OR ca.notes ILIKE '%000104582%')
ORDER BY ca."allocatedDate" DESC;
