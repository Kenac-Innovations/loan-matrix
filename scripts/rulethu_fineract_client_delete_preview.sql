-- Preview delete script for Rulethu clients in fineract_tenant_rulethu.
-- Host requested by user: 10.10.0.24
-- Suggested run command:
--   PGPASSWORD='***' psql -h 10.10.0.24 -p 30544 -U app -d fineract_tenant_rulethu -f scripts/rulethu_fineract_client_delete_preview.sql
--
-- This script is intentionally left in preview mode with ROLLBACK at the end.
-- After review, replace ROLLBACK with COMMIT.

BEGIN;

CREATE TEMP TABLE target_clients (id bigint PRIMARY KEY);

INSERT INTO target_clients (id)
VALUES
  (5),
  (134),
  (135),
  (136),
  (137),
  (138),
  (139),
  (140),
  (141),
  (142),
  (143),
  (144),
  (145),
  (146);

CREATE TEMP TABLE target_loans AS
SELECT id
FROM m_loan
WHERE client_id IN (SELECT id FROM target_clients);

CREATE TEMP TABLE target_savings AS
SELECT id
FROM m_savings_account
WHERE client_id IN (SELECT id FROM target_clients);

CREATE TEMP TABLE target_client_txns AS
SELECT id
FROM m_client_transaction
WHERE client_id IN (SELECT id FROM target_clients);

CREATE TEMP TABLE target_loan_txns AS
SELECT id
FROM m_loan_transaction
WHERE loan_id IN (SELECT id FROM target_loans);

CREATE TEMP TABLE target_loan_sched AS
SELECT id
FROM m_loan_repayment_schedule
WHERE loan_id IN (SELECT id FROM target_loans);

CREATE TEMP TABLE target_loan_charges AS
SELECT id
FROM m_loan_charge
WHERE loan_id IN (SELECT id FROM target_loans);

CREATE TEMP TABLE target_savings_txns AS
SELECT id
FROM m_savings_account_transaction
WHERE savings_account_id IN (SELECT id FROM target_savings);

CREATE TEMP TABLE target_transfer_details AS
SELECT id
FROM m_account_transfer_details
WHERE from_client_id IN (SELECT id FROM target_clients)
   OR to_client_id IN (SELECT id FROM target_clients)
   OR from_loan_account_id IN (SELECT id FROM target_loans)
   OR to_loan_account_id IN (SELECT id FROM target_loans)
   OR from_savings_account_id IN (SELECT id FROM target_savings)
   OR to_savings_account_id IN (SELECT id FROM target_savings);

-- Preview inventory
SELECT 'target_clients' AS bucket, count(*) AS row_count FROM target_clients
UNION ALL
SELECT 'target_loans', count(*) FROM target_loans
UNION ALL
SELECT 'target_savings', count(*) FROM target_savings
UNION ALL
SELECT 'target_client_txns', count(*) FROM target_client_txns
UNION ALL
SELECT 'target_loan_txns', count(*) FROM target_loan_txns
UNION ALL
SELECT 'target_loan_sched', count(*) FROM target_loan_sched
UNION ALL
SELECT 'target_loan_charges', count(*) FROM target_loan_charges
UNION ALL
SELECT 'target_savings_txns', count(*) FROM target_savings_txns
UNION ALL
SELECT 'target_transfer_details', count(*) FROM target_transfer_details
ORDER BY bucket;

-- Delete dependent rows first.
DELETE FROM m_account_transfer_transaction
WHERE account_transfer_details_id IN (SELECT id FROM target_transfer_details)
   OR from_loan_transaction_id IN (SELECT id FROM target_loan_txns)
   OR to_loan_transaction_id IN (SELECT id FROM target_loan_txns)
   OR from_savings_transaction_id IN (SELECT id FROM target_savings_txns)
   OR to_savings_transaction_id IN (SELECT id FROM target_savings_txns);

DELETE FROM m_loan_charge_paid_by
WHERE loan_charge_id IN (SELECT id FROM target_loan_charges)
   OR loan_transaction_id IN (SELECT id FROM target_loan_txns);

DELETE FROM m_loan_transaction_repayment_schedule_mapping
WHERE loan_transaction_id IN (SELECT id FROM target_loan_txns)
   OR loan_repayment_schedule_id IN (SELECT id FROM target_loan_sched);

DELETE FROM acc_gl_journal_entry
WHERE reversal_id IN (
  SELECT id
  FROM acc_gl_journal_entry
  WHERE loan_transaction_id IN (SELECT id FROM target_loan_txns)
     OR client_transaction_id IN (SELECT id FROM target_client_txns)
     OR savings_transaction_id IN (SELECT id FROM target_savings_txns)
);

DELETE FROM acc_gl_journal_entry
WHERE loan_transaction_id IN (SELECT id FROM target_loan_txns)
   OR client_transaction_id IN (SELECT id FROM target_client_txns)
   OR savings_transaction_id IN (SELECT id FROM target_savings_txns);

DELETE FROM m_loan_repayment_schedule_history
WHERE loan_id IN (SELECT id FROM target_loans);

DELETE FROM m_loan_repayment_schedule
WHERE id IN (SELECT id FROM target_loan_sched);

DELETE FROM m_loan_transaction
WHERE id IN (SELECT id FROM target_loan_txns);

DELETE FROM m_loan_charge
WHERE id IN (SELECT id FROM target_loan_charges);

DELETE FROM m_loan_officer_assignment_history
WHERE loan_id IN (SELECT id FROM target_loans);

DELETE FROM m_loan_rate
WHERE loan_id IN (SELECT id FROM target_loans);

DELETE FROM m_loan_topup
WHERE account_transfer_details_id IN (SELECT id FROM target_transfer_details)
   OR loan_id IN (SELECT id FROM target_loans)
   OR closure_loan_id IN (SELECT id FROM target_loans);

DELETE FROM credit_facility_loan
WHERE loan_id IN (SELECT id FROM target_loans);

DELETE FROM m_account_transfer_details
WHERE id IN (SELECT id FROM target_transfer_details);

DELETE FROM m_savings_account_transaction
WHERE id IN (SELECT id FROM target_savings_txns);

DELETE FROM m_client_address
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM "Additional Info"
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM client_device_registration
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM credit_facility
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_client_identifier
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_client_non_person
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_client_charge
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_client_collateral_management
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_client_transfer_details
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_family_members
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_group_client
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_group_roles
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_selfservice_user_client_mapping
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_survey_scorecards
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM request_audit_table
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM scheduled_email_messages_outbound
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM sms_messages_outbound
WHERE client_id IN (SELECT id FROM target_clients);

DELETE FROM m_note
WHERE client_id IN (SELECT id FROM target_clients)
   OR loan_id IN (SELECT id FROM target_loans)
   OR savings_account_id IN (SELECT id FROM target_savings)
   OR loan_transaction_id IN (SELECT id FROM target_loan_txns);

UPDATE m_client
SET default_savings_account = NULL
WHERE id IN (SELECT id FROM target_clients)
  AND default_savings_account IN (SELECT id FROM target_savings);

DELETE FROM m_savings_account
WHERE id IN (SELECT id FROM target_savings);

DELETE FROM m_loan
WHERE id IN (SELECT id FROM target_loans);

DELETE FROM m_client
WHERE id IN (SELECT id FROM target_clients);

-- Preview what remains if we were to commit.
SELECT 'remaining_clients' AS bucket, count(*) AS row_count
FROM m_client
WHERE id IN (SELECT id FROM target_clients)
UNION ALL
SELECT 'remaining_loans', count(*)
FROM m_loan
WHERE id IN (SELECT id FROM target_loans)
UNION ALL
SELECT 'remaining_savings', count(*)
FROM m_savings_account
WHERE id IN (SELECT id FROM target_savings);

ROLLBACK;
