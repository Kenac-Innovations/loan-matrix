# Rulethu delete preview

Source host used for this preview: `10.10.0.24:30544`

## Fineract clients found

| client_id | account_no | display_name | loans | savings | local_rulethu_leads |
| --- | --- | --- | ---: | ---: | ---: |
| 5 | 000000005 | Amos Amos | 18 | 5 | 22 |
| 134 | 000000134 | Pete Pete | 1 | 0 | 2 |
| 135 | 000000135 | Kenn Kenn | 0 | 0 | 0 |
| 136 | 000000136 | Simon Simon | 0 | 0 | 0 |
| 137 | 000000137 | enock enock | 1 | 0 | 0 |
| 138 | 000000138 | Trio Trio | 0 | 0 | 0 |
| 139 | 000000139 | SUN | 0 | 0 | 0 |
| 140 | 000000140 | CHOP | 0 | 1 | 0 |
| 141 | 000000141 | SOLO | 0 | 1 | 0 |
| 142 | 000000142 | SAMBA | 1 | 0 | 0 |
| 143 | 000000143 | SEAN SEAN | 1 | 0 | 2 |
| 144 | 000000144 | DERUL DERUL | 0 | 0 | 0 |
| 145 | 000000145 | KAWASAKI KAWASAKI | 1 | 0 | 0 |
| 146 | 000000146 | Tadiwanashe n Chaduka | 2 | 0 | 2 |

## Fineract impact counts

Only tables with live rows for these clients are listed here.

| table | rows |
| --- | ---: |
| acc_gl_journal_entry (loan transactions) | 193 |
| credit_facility | 3 |
| credit_facility_loan | 4 |
| m_account_transfer_details | 4 |
| m_account_transfer_transaction | 4 |
| m_client | 14 |
| m_client_address | 10 |
| m_loan | 25 |
| m_loan_charge | 26 |
| m_loan_charge_paid_by | 24 |
| m_loan_topup | 4 |
| m_loan_repayment_schedule | 317 |
| m_loan_repayment_schedule_history | 24 |
| m_loan_transaction | 90 |
| m_loan_transaction_repayment_schedule_mapping | 38 |
| m_savings_account | 7 |
| m_savings_account_transaction | 29 |

Savings accounts found:

| client_id | display_name | savings_id | account_no | status_enum |
| --- | --- | ---: | --- | ---: |
| 5 | Amos Amos | 1 | 000000001 | 300 |
| 5 | Amos Amos | 2 | 000000002 | 300 |
| 5 | Amos Amos | 11 | 000000011 | 300 |
| 5 | Amos Amos | 12 | 000000012 | 300 |
| 5 | Amos Amos | 13 | 000000013 | 100 |
| 140 | CHOP | 19 | 000000019 | 300 |
| 141 | SOLO | 18 | 000000018 | 300 |

## Loan Matrix UAT impact counts

Only tables with live rows for the matched Rulethu leads are listed here.

| table | rows |
| --- | ---: |
| InvoiceDiscountingCase | 7 |
| InvoiceDiscountingInvoice | 7 |
| Lead | 28 |
| LoanPayout | 19 |
| RepaymentCashLink | 1 |
| StateTransition | 34 |

Matched Rulethu lead groups:

| fineractClientId | lead_count | notes |
| --- | ---: | --- |
| 5 | 22 | Amos Amos / Amos Amon |
| 134 | 2 | Pete Pete |
| 143 | 2 | SEAN SEAN |
| 146 | 2 | Tadiwanashe n Chaduka |

## SQL files

- `scripts/rulethu_fineract_client_delete_preview.sql`
- `scripts/rulethu_loan_matrix_lead_delete_preview.sql`

Both scripts were validated live against `10.10.0.24:30544` and end with `ROLLBACK`.
