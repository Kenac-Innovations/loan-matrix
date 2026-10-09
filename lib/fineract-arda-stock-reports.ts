export type FineractReportParameter = {
  parameterId: number;
  reportParameterName: string;
};

export type FineractReportDefinition = {
  reportName: string;
  reportType: "Table";
  reportSubType: string;
  reportCategory: string;
  description: string;
  useReport: boolean;
  reportSql: string;
  reportParameters?: FineractReportParameter[];
};

export const ARDA_STOCK_ITEM_OPTIONS_REPORT =
  "ARDA Stock Item Options";

export const ARDA_STOCK_REPORT_NAMES = [
  "ARDA Stock Disbursement Report",
  "ARDA Stock Repayment Report",
  "ARDA Stock Item Performance",
] as const;

const reportParameters = (stockItemParameterId: number) => [
  { parameterId: 1, reportParameterName: "startDate" },
  { parameterId: 2, reportParameterName: "endDate" },
  { parameterId: 5, reportParameterName: "officeId" },
  { parameterId: 10, reportParameterName: "currencyId" },
  { parameterId: 25, reportParameterName: "loanProductId" },
  { parameterId: stockItemParameterId, reportParameterName: "stockItemId" },
];

const optionSql = `SELECT DISTINCT
       asd.stock_item_id AS id,
       asd.stock_item_name AS name
FROM arda_stock_details asd
JOIN m_loan ml ON ml.id = asd.loan_id
JOIN m_client mc ON mc.id = ml.client_id
JOIN m_office o ON o.id = mc.office_id
  AND o.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
WHERE asd.stock_item_id IS NOT NULL
ORDER BY asd.stock_item_name`;

const disbursementSql = `SELECT
       o.name AS "Office",
       mc.account_no AS "Client Account",
       mc.display_name AS "Client Name",
       ml.account_no AS "Loan Account",
       lp.name AS "Loan Product",
       lt.transaction_date AS "Disbursement Date",
       ml.currency_code AS "Currency",
       COALESCE(asd.stock_item_id, 'Not captured') AS "Stock Item ID",
       COALESCE(asd.stock_item_name, 'Not captured') AS "Stock Item",
       COALESCE(asd.unit_of_measure, 'Not captured') AS "Unit",
       asd.quantity AS "Quantity",
       asd.unit_value AS "Unit Value",
       COALESCE(asd.total_stock_value, lt.amount) AS "Stock Value",
       lt.amount AS "Disbursed Amount",
       COALESCE(ml.principal_repaid_derived, 0) AS "Principal Repaid",
       COALESCE(ml.total_outstanding_derived, 0) AS "Outstanding Amount",
       COALESCE(ls.enum_value, 'Unknown') AS "Loan Status",
       COALESCE(asd.stock_issue_reference, 'Not captured') AS "Stock Issue Reference"
FROM m_loan_transaction lt
JOIN m_loan ml ON ml.id = lt.loan_id
JOIN m_client mc ON mc.id = ml.client_id
JOIN m_office o ON o.id = mc.office_id
  AND o.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
LEFT JOIN m_product_loan lp ON lp.id = ml.product_id
LEFT JOIN arda_stock_details asd ON asd.loan_id = ml.id
LEFT JOIN r_enum_value ls ON ls.enum_id = ml.loan_status_id
  AND ls.enum_name = 'loan_status_id'
WHERE lt.transaction_type_enum = 1
  AND lt.is_reversed = false
  AND lt.transaction_date::date BETWEEN '\${startDate}'::date AND '\${endDate}'::date
  AND ('\${officeId}' = '-1' OR o.hierarchy LIKE concat((SELECT hierarchy FROM m_office WHERE id = '\${officeId}'::bigint), '%'))
  AND ('\${currencyId}' = '-1' OR ml.currency_code = '\${currencyId}')
  AND ('\${loanProductId}' = '-1' OR ml.product_id = '\${loanProductId}'::bigint)
  AND ('\${stockItemId}' = '-1' OR asd.stock_item_id = '\${stockItemId}')
ORDER BY lt.transaction_date DESC, ml.account_no`;

const repaymentSql = `SELECT
       o.name AS "Office",
       mc.account_no AS "Client Account",
       mc.display_name AS "Client Name",
       ml.account_no AS "Loan Account",
       lp.name AS "Loan Product",
       lt.transaction_date AS "Repayment Date",
       lt.id AS "Transaction ID",
       ml.currency_code AS "Currency",
       COALESCE(asd.stock_item_id, 'Not captured') AS "Stock Item ID",
       COALESCE(asd.stock_item_name, 'Not captured') AS "Stock Item",
       COALESCE(asd.unit_of_measure, 'Not captured') AS "Unit",
       asd.quantity AS "Quantity",
       asd.unit_value AS "Unit Value",
       COALESCE(asd.total_stock_value, ml.principal_disbursed_derived) AS "Stock Value",
       lt.amount AS "Repayment Amount",
       COALESCE(lt.principal_portion_derived, 0) AS "Principal Allocation",
       COALESCE(lt.interest_portion_derived, 0) AS "Interest Allocation",
       COALESCE(lt.fee_charges_portion_derived, 0) AS "Fee Allocation",
       COALESCE(lt.penalty_charges_portion_derived, 0) AS "Penalty Allocation",
       COALESCE(lt.outstanding_loan_balance_derived, 0) AS "Post Transaction Balance",
       COALESCE(pt.value, 'Not captured') AS "Repayment Type",
       COALESCE(au.username, 'Not captured') AS "Cashier Name"
FROM m_loan_transaction lt
JOIN m_loan ml ON ml.id = lt.loan_id
JOIN m_client mc ON mc.id = ml.client_id
JOIN m_office o ON o.id = mc.office_id
  AND o.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
LEFT JOIN m_product_loan lp ON lp.id = ml.product_id
LEFT JOIN arda_stock_details asd ON asd.loan_id = ml.id
LEFT JOIN m_payment_detail pd ON pd.id = lt.payment_detail_id
LEFT JOIN m_payment_type pt ON pt.id = pd.payment_type_id
LEFT JOIN m_appuser au ON au.id = lt.created_by
WHERE lt.transaction_type_enum = 2
  AND lt.is_reversed = false
  AND lt.transaction_date::date BETWEEN '\${startDate}'::date AND '\${endDate}'::date
  AND ('\${officeId}' = '-1' OR o.hierarchy LIKE concat((SELECT hierarchy FROM m_office WHERE id = '\${officeId}'::bigint), '%'))
  AND ('\${currencyId}' = '-1' OR ml.currency_code = '\${currencyId}')
  AND ('\${loanProductId}' = '-1' OR ml.product_id = '\${loanProductId}'::bigint)
  AND ('\${stockItemId}' = '-1' OR asd.stock_item_id = '\${stockItemId}')
ORDER BY lt.transaction_date DESC, ml.account_no`;

const performanceSql = `WITH monthly AS (
  SELECT
         date_trunc('month', lt.transaction_date) AS month,
         asd.stock_item_id,
         COALESCE(asd.stock_item_name, 'Not captured') AS stock_item_name,
         COALESCE(asd.unit_of_measure, 'Not captured') AS unit_of_measure,
         ml.currency_code,
         COUNT(DISTINCT lt.id) AS disbursement_count,
         SUM(COALESCE(asd.quantity, 0)) AS total_quantity,
         SUM(COALESCE(asd.total_stock_value, lt.amount)) AS total_stock_value,
         AVG(asd.quantity) AS average_quantity,
         AVG(asd.unit_value) AS average_unit_value,
         AVG(COALESCE(asd.total_stock_value, lt.amount)) AS average_stock_value
  FROM m_loan_transaction lt
  JOIN m_loan ml ON ml.id = lt.loan_id
  JOIN m_client mc ON mc.id = ml.client_id
  JOIN m_office o ON o.id = mc.office_id
    AND o.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  LEFT JOIN arda_stock_details asd ON asd.loan_id = ml.id
  WHERE lt.transaction_type_enum = 1
    AND lt.is_reversed = false
    AND lt.transaction_date::date BETWEEN '\${startDate}'::date AND '\${endDate}'::date
    AND ('\${officeId}' = '-1' OR o.hierarchy LIKE concat((SELECT hierarchy FROM m_office WHERE id = '\${officeId}'::bigint), '%'))
    AND ('\${currencyId}' = '-1' OR ml.currency_code = '\${currencyId}')
    AND ('\${loanProductId}' = '-1' OR ml.product_id = '\${loanProductId}'::bigint)
    AND ('\${stockItemId}' = '-1' OR asd.stock_item_id = '\${stockItemId}')
  GROUP BY date_trunc('month', lt.transaction_date), asd.stock_item_id,
           COALESCE(asd.stock_item_name, 'Not captured'),
           COALESCE(asd.unit_of_measure, 'Not captured'), ml.currency_code
)
SELECT month AS "Month",
       stock_item_id AS "Stock Item ID",
       stock_item_name AS "Stock Item",
       unit_of_measure AS "Unit",
       currency_code AS "Currency",
       disbursement_count AS "Number of Disbursements",
       total_quantity AS "Quantity Disbursed",
       total_stock_value AS "Stock Value Disbursed",
       average_quantity AS "Average Quantity per Disbursement",
       average_unit_value AS "Average Unit Value",
       average_stock_value AS "Average Stock Value per Disbursement",
       CASE
         WHEN stock_item_id IS NULL THEN NULL
         ELSE DENSE_RANK() OVER (PARTITION BY month ORDER BY total_quantity DESC)
       END AS "Monthly Sales Rank"
FROM monthly
ORDER BY month DESC, "Monthly Sales Rank" NULLS LAST, stock_item_name`;

export function buildArdaStockReportDefinitions(
  stockItemParameterId: number
): FineractReportDefinition[] {
  if (!Number.isInteger(stockItemParameterId) || stockItemParameterId <= 0) {
    throw new Error("A positive stock item parameter ID is required.");
  }

  const common = {
    reportType: "Table" as const,
    reportSubType: "",
    reportCategory: "Loans",
  };

  return [
    {
      ...common,
      reportName: ARDA_STOCK_ITEM_OPTIONS_REPORT,
      description: "Stock items captured for ARDA loan reporting filters.",
      useReport: false,
      reportSql: optionSql,
    },
    {
      ...common,
      reportName: ARDA_STOCK_REPORT_NAMES[0],
      description:
        "ARDA stock loan disbursements with quantities, values, repayments, and balances.",
      useReport: true,
      reportSql: disbursementSql,
      reportParameters: reportParameters(stockItemParameterId),
    },
    {
      ...common,
      reportName: ARDA_STOCK_REPORT_NAMES[1],
      description:
        "ARDA stock loan repayments with allocation, payment type, and cashier detail.",
      useReport: true,
      reportSql: repaymentSql,
      reportParameters: reportParameters(stockItemParameterId),
    },
    {
      ...common,
      reportName: ARDA_STOCK_REPORT_NAMES[2],
      description:
        "Monthly ARDA stock item sales, quantities, values, averages, and rank.",
      useReport: true,
      reportSql: performanceSql,
      reportParameters: reportParameters(stockItemParameterId),
    },
  ];
}
