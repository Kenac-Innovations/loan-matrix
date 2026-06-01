-- Preview delete script for Rulethu leads linked to Fineract client ABC in loan_matrix_uat.
-- Host requested by user: 10.10.0.24
-- Suggested run command:
--   PGPASSWORD='***' psql -h 10.10.0.24 -p 30544 -U app -d loan_matrix_uat -f scripts/rulethu_abc_loan_matrix_delete_preview.sql
--
-- Target fineractClientId:
--   94 = ABC
--
-- This script is intentionally left in preview mode with ROLLBACK at the end.
-- After review, replace ROLLBACK with COMMIT.

BEGIN;

CREATE TEMP TABLE target_leads AS
SELECT
  id,
  "fineractClientId" AS fineract_client_id,
  "fineractLoanId" AS fineract_loan_id
FROM "Lead"
WHERE "tenantId" = 'cmh607k3d0000vc0k5xxjocju'
  AND "fineractClientId" = 94;

CREATE TEMP TABLE target_loans AS
SELECT DISTINCT fineract_loan_id AS id
FROM target_leads
WHERE fineract_loan_id IS NOT NULL;

CREATE TEMP TABLE target_payouts AS
SELECT id
FROM "LoanPayout"
WHERE "tenantId" = 'cmh607k3d0000vc0k5xxjocju'
  AND (
    "fineractClientId" = 94
    OR "fineractLoanId" IN (SELECT id FROM target_loans)
  );

SELECT 'target_leads' AS bucket, count(*) AS row_count FROM target_leads
UNION ALL
SELECT 'target_loans', count(*) FROM target_loans
UNION ALL
SELECT 'target_payouts', count(*) FROM target_payouts
ORDER BY bucket;

DELETE FROM "CashSettlement"
WHERE "loanPayoutId" IN (SELECT id FROM target_payouts);

DELETE FROM "RepaymentCashLink"
WHERE "tenantId" = 'cmh607k3d0000vc0k5xxjocju'
  AND "loanId" IN (SELECT id FROM target_loans);

DELETE FROM "RevolvingCreditDrawdown"
WHERE "facilityId" IN (
  SELECT id
  FROM "RevolvingCreditFacility"
  WHERE "leadId" IN (SELECT id FROM target_leads)
);

DELETE FROM "RevolvingCreditFacility"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "InvoiceDiscountingInvoice"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "InvoiceDiscountingCase"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "LeadDocument"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "LeadCommunication"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "StageApproval"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "StateTransition"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "FamilyMember"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "EntityStakeholder"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "EntityBankAccount"
WHERE "leadId" IN (SELECT id FROM target_leads);

DELETE FROM "Lead"
WHERE id IN (SELECT id FROM target_leads);

DELETE FROM "LoanPayout"
WHERE id IN (SELECT id FROM target_payouts);

SELECT 'remaining_leads' AS bucket, count(*) AS row_count
FROM "Lead"
WHERE id IN (SELECT id FROM target_leads)
UNION ALL
SELECT 'remaining_payouts', count(*)
FROM "LoanPayout"
WHERE id IN (SELECT id FROM target_payouts);

ROLLBACK;
