type ReportParameter = {
  parameterId: number;
  reportParameterName: string;
};

type ReportDefinition = {
  reportName: string;
  reportType: "Table";
  reportSubType: string;
  reportCategory: string;
  description: string;
  useReport: boolean;
  reportSql: string;
  reportParameters?: ReportParameter[];
};

const RECOVERY_ARREARS_REPORT = "LM_RECOVERY_ARREARS_DETAIL";
const RECOVERY_NPA_REPORT = "LM_RECOVERY_NPA_DETAIL";
const RECOVERY_SUMMARY_REPORT = "LM_RECOVERY_DASHBOARD_SUMMARY";
const RECOVERY_BRANCH_REPORT = "LM_RECOVERY_BRANCH_PERFORMANCE";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getBaseUrl(): string {
  return getRequiredEnv("FINERACT_BASE_URL").replace(/\/$/, "");
}

function getTenantId(): string {
  return getRequiredEnv("FINERACT_TENANT_ID");
}

function getAuthHeader(): string {
  const username = getRequiredEnv("FINERACT_USERNAME");
  const password = getRequiredEnv("FINERACT_PASSWORD");
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function fineractFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${getBaseUrl()}/fineract-provider/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: getAuthHeader(),
      "Fineract-Platform-TenantId": getTenantId(),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${
        data?.defaultUserMessage ||
        data?.developerMessage ||
        JSON.stringify(data)
      }`
    );
  }

  return data;
}

function getReports(): ReportDefinition[] {
  return [
    {
      reportName: RECOVERY_ARREARS_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description:
        "Recovery arrears detail based on Aging Detail, filterable by minimum and maximum days past due.",
      useReport: true,
      reportSql: `WITH base AS (
  SELECT
       ounder.id AS office_id,
       Concat(Repeat('..', ((Length(ounder.hierarchy) - Length(Replace(ounder.hierarchy , '.', '')) - 1))), ounder.name) AS office_branch,
       COALESCE(cur.display_symbol, ml.currency_code) AS currency,
       ml.currency_code,
       mc.id AS client_id,
       mc.account_no AS client_account_no,
       mc.display_name AS client_name,
       ml.id AS loan_id,
       ml.account_no AS account_no,
       COALESCE(lp.name, 'Unknown Product') AS product_name,
       ml.principal_amount AS principal_amount,
       ml.principal_disbursed_derived AS original_principal,
       ml.interest_charged_derived AS original_interest,
       ml.principal_repaid_derived AS principal_paid,
       ml.interest_repaid_derived AS interest_paid,
       COALESCE(laa.principal_overdue_derived, 0) AS principal_overdue,
       COALESCE(laa.interest_overdue_derived, 0) AS interest_overdue,
       COALESCE(laa.fee_charges_overdue_derived, 0) AS fee_charges_overdue,
       COALESCE(laa.penalty_charges_overdue_derived, 0) AS penalty_charges_overdue,
       COALESCE(laa.total_overdue_derived, 0) AS total_overdue,
       COALESCE(ml.total_outstanding_derived, 0) AS total_outstanding,
       GREATEST(Extract(day FROM (CURRENT_DATE::timestamp - laa.overdue_since_date_derived::timestamp))::int, 0) AS days_in_arrears,
       rev.enum_value AS loan_status,
       COALESCE(ml.is_npa, false) AS is_npa
  FROM m_client mc
  JOIN m_office ounder ON ounder.id = mc.office_id
       AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_loan ml ON ml.client_id = mc.id
  JOIN r_enum_value rev ON rev.enum_id = ml.loan_status_id
       AND rev.enum_name = 'loan_status_id'
  JOIN m_loan_arrears_aging laa ON laa.loan_id = ml.id
  LEFT JOIN m_product_loan lp ON lp.id = ml.product_id
  LEFT JOIN m_currency cur ON cur.code = ml.currency_code
  WHERE ml.loan_status_id = 300
)
SELECT office_id,
       office_branch AS "Office/Branch",
       currency,
       currency_code,
       client_id,
       client_account_no AS "Client Account No.",
       client_name AS "Client Name",
       loan_id,
       account_no AS "Account Number",
       product_name AS "Product Name",
       principal_amount AS "Loan Amount",
       original_principal AS "Original Principal",
       original_interest AS "Original Interest",
       principal_paid AS "Principal Paid",
       interest_paid AS "Interest Paid",
       principal_overdue AS "Principal Overdue",
       interest_overdue AS "Interest Overdue",
       fee_charges_overdue AS "Fee Charges Overdue",
       penalty_charges_overdue AS "Penalty Charges Overdue",
       total_overdue AS "Total Overdue",
       total_outstanding AS "Total Outstanding",
       days_in_arrears AS "Days in Arrears",
       CASE
         WHEN days_in_arrears < 7 THEN '<1'
         WHEN days_in_arrears < 8 THEN '1'
         WHEN days_in_arrears < 15 THEN '2'
         WHEN days_in_arrears < 22 THEN '3'
         WHEN days_in_arrears < 29 THEN '4'
         WHEN days_in_arrears < 36 THEN '5'
         WHEN days_in_arrears < 43 THEN '6'
         WHEN days_in_arrears < 50 THEN '7'
         WHEN days_in_arrears < 57 THEN '8'
         WHEN days_in_arrears < 64 THEN '9'
         WHEN days_in_arrears < 71 THEN '10'
         WHEN days_in_arrears < 78 THEN '11'
         WHEN days_in_arrears < 85 THEN '12'
         ELSE '12+'
       END AS "Weeks In Arrears Band",
       CASE
         WHEN days_in_arrears < 31 THEN '0 - 30'
         WHEN days_in_arrears < 61 THEN '30 - 60'
         WHEN days_in_arrears < 91 THEN '60 - 90'
         WHEN days_in_arrears < 181 THEN '90 - 180'
         WHEN days_in_arrears < 361 THEN '180 - 360'
         ELSE '> 360'
       END AS "Days in Arrears Band",
       CASE
         WHEN days_in_arrears >= 90 THEN '90'
         WHEN days_in_arrears >= 60 THEN '60'
         WHEN days_in_arrears >= 30 THEN '30'
         ELSE 'CURRENT'
       END AS bucket,
       loan_status,
       is_npa
FROM base
WHERE total_overdue > 0
  AND days_in_arrears >= COALESCE(NULLIF(regexp_replace('\${daysPastDue}', '[^0-9]', '', 'g'), '')::int, 0)
  AND days_in_arrears <= COALESCE(NULLIF(regexp_replace('\${maxDaysPastDue}', '[^0-9]', '', 'g'), '')::int, days_in_arrears)
ORDER BY office_branch, currency, account_no
LIMIT COALESCE(NULLIF(regexp_replace('\${pageLimit}', '[^0-9]', '', 'g'), '')::int, 26)
OFFSET COALESCE(NULLIF(regexp_replace('\${pageOffset}', '[^0-9]', '', 'g'), '')::int, 0)`,
      reportParameters: [
        { parameterId: 1026, reportParameterName: "daysPastDue" },
        { parameterId: 1027, reportParameterName: "maxDaysPastDue" },
        { parameterId: 1028, reportParameterName: "pageLimit" },
        { parameterId: 1029, reportParameterName: "pageOffset" },
      ],
    },
    {
      reportName: RECOVERY_NPA_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description: "Active loans currently marked as NPA by Fineract.",
      useReport: true,
      reportSql: `WITH base AS (
  SELECT
       ounder.id AS office_id,
       Concat(Repeat('..', ((Length(ounder.hierarchy) - Length(Replace(ounder.hierarchy , '.', '')) - 1))), ounder.name) AS office_branch,
       COALESCE(cur.display_symbol, ml.currency_code) AS currency,
       ml.currency_code,
       mc.id AS client_id,
       mc.account_no AS client_account_no,
       mc.display_name AS client_name,
       ml.id AS loan_id,
       ml.account_no AS account_no,
       COALESCE(lp.name, 'Unknown Product') AS product_name,
       ml.principal_amount AS principal_amount,
       ml.principal_disbursed_derived AS original_principal,
       ml.interest_charged_derived AS original_interest,
       ml.principal_repaid_derived AS principal_paid,
       ml.interest_repaid_derived AS interest_paid,
       COALESCE(laa.principal_overdue_derived, 0) AS principal_overdue,
       COALESCE(laa.interest_overdue_derived, 0) AS interest_overdue,
       COALESCE(laa.fee_charges_overdue_derived, 0) AS fee_charges_overdue,
       COALESCE(laa.penalty_charges_overdue_derived, 0) AS penalty_charges_overdue,
       COALESCE(laa.total_overdue_derived, 0) AS total_overdue,
       COALESCE(ml.total_outstanding_derived, 0) AS total_outstanding,
       CASE
         WHEN laa.overdue_since_date_derived IS NULL THEN 0
         ELSE GREATEST(Extract(day FROM (CURRENT_DATE::timestamp - laa.overdue_since_date_derived::timestamp))::int, 0)
       END AS days_in_arrears,
       rev.enum_value AS loan_status,
       COALESCE(ml.is_npa, false) AS is_npa
  FROM m_client mc
  JOIN m_office ounder ON ounder.id = mc.office_id
       AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_loan ml ON ml.client_id = mc.id
  JOIN r_enum_value rev ON rev.enum_id = ml.loan_status_id
       AND rev.enum_name = 'loan_status_id'
  LEFT JOIN m_loan_arrears_aging laa ON laa.loan_id = ml.id
  LEFT JOIN m_product_loan lp ON lp.id = ml.product_id
  LEFT JOIN m_currency cur ON cur.code = ml.currency_code
  WHERE ml.loan_status_id = 300
    AND COALESCE(ml.is_npa, false) = true
)
SELECT office_id,
       office_branch AS "Office/Branch",
       currency,
       currency_code,
       client_id,
       client_account_no AS "Client Account No.",
       client_name AS "Client Name",
       loan_id,
       account_no AS "Account Number",
       product_name AS "Product Name",
       principal_amount AS "Loan Amount",
       original_principal AS "Original Principal",
       original_interest AS "Original Interest",
       principal_paid AS "Principal Paid",
       interest_paid AS "Interest Paid",
       principal_overdue AS "Principal Overdue",
       interest_overdue AS "Interest Overdue",
       fee_charges_overdue AS "Fee Charges Overdue",
       penalty_charges_overdue AS "Penalty Charges Overdue",
       total_overdue AS "Total Overdue",
       total_outstanding AS "Total Outstanding",
       days_in_arrears AS "Days in Arrears",
       CASE
         WHEN days_in_arrears < 7 THEN '<1'
         WHEN days_in_arrears < 8 THEN '1'
         WHEN days_in_arrears < 15 THEN '2'
         WHEN days_in_arrears < 22 THEN '3'
         WHEN days_in_arrears < 29 THEN '4'
         WHEN days_in_arrears < 36 THEN '5'
         WHEN days_in_arrears < 43 THEN '6'
         WHEN days_in_arrears < 50 THEN '7'
         WHEN days_in_arrears < 57 THEN '8'
         WHEN days_in_arrears < 64 THEN '9'
         WHEN days_in_arrears < 71 THEN '10'
         WHEN days_in_arrears < 78 THEN '11'
         WHEN days_in_arrears < 85 THEN '12'
         ELSE '12+'
       END AS "Weeks In Arrears Band",
       CASE
         WHEN days_in_arrears < 31 THEN '0 - 30'
         WHEN days_in_arrears < 61 THEN '30 - 60'
         WHEN days_in_arrears < 91 THEN '60 - 90'
         WHEN days_in_arrears < 181 THEN '90 - 180'
         WHEN days_in_arrears < 361 THEN '180 - 360'
         ELSE '> 360'
       END AS "Days in Arrears Band",
       CASE
         WHEN days_in_arrears >= 90 THEN '90'
         WHEN days_in_arrears >= 60 THEN '60'
         WHEN days_in_arrears >= 30 THEN '30'
         ELSE 'CURRENT'
       END AS bucket,
       loan_status,
       is_npa
FROM base
ORDER BY office_branch, currency, account_no
LIMIT COALESCE(NULLIF(regexp_replace('\${pageLimit}', '[^0-9]', '', 'g'), '')::int, 26)
OFFSET COALESCE(NULLIF(regexp_replace('\${pageOffset}', '[^0-9]', '', 'g'), '')::int, 0)`,
      reportParameters: [
        { parameterId: 1028, reportParameterName: "pageLimit" },
        { parameterId: 1029, reportParameterName: "pageOffset" },
      ],
    },
    {
      reportName: RECOVERY_SUMMARY_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description:
        "Aggregate recovery dashboard totals without returning account-level rows.",
      useReport: true,
      reportSql: `WITH base AS (
  SELECT
       COALESCE(ml.total_outstanding_derived, 0) AS total_outstanding,
       COALESCE(laa.total_overdue_derived, 0) AS total_overdue,
       CASE
         WHEN laa.overdue_since_date_derived IS NULL THEN 0
         ELSE GREATEST(Extract(day FROM (CURRENT_DATE::timestamp - laa.overdue_since_date_derived::timestamp))::int, 0)
       END AS days_in_arrears,
       COALESCE(ml.is_npa, false) AS is_npa
  FROM m_client mc
  JOIN m_office ounder ON ounder.id = mc.office_id
       AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_loan ml ON ml.client_id = mc.id
  LEFT JOIN m_loan_arrears_aging laa ON laa.loan_id = ml.id
  WHERE ml.loan_status_id = 300
)
SELECT COUNT(*) AS active_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0) AS arrears_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears BETWEEN 30 AND 59) AS bucket_30_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears BETWEEN 60 AND 89) AS bucket_60_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 90) AS bucket_90_count,
       COUNT(*) FILTER (WHERE is_npa) AS npa_loan_count,
       COALESCE(SUM(total_outstanding), 0) AS total_outstanding_amount,
       COALESCE(SUM(total_overdue), 0) AS total_overdue_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30), 0) AS par30_outstanding_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 60), 0) AS par60_outstanding_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 90), 0) AS par90_outstanding_amount,
       CASE
         WHEN COALESCE(SUM(total_outstanding), 0) > 0
         THEN ((COALESCE(SUM(total_outstanding), 0) - COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30), 0)) / COALESCE(SUM(total_outstanding), 0)) * 100
         ELSE 0
       END AS current_rate
FROM base`,
    },
    {
      reportName: RECOVERY_BRANCH_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description: "Branch-level collection performance aggregates for recoveries.",
      useReport: true,
      reportSql: `WITH base AS (
  SELECT
       ounder.id AS office_id,
       ounder.name AS office_name,
       COALESCE(ml.total_outstanding_derived, 0) AS total_outstanding,
       COALESCE(laa.total_overdue_derived, 0) AS total_overdue,
       CASE
         WHEN laa.overdue_since_date_derived IS NULL THEN 0
         ELSE GREATEST(Extract(day FROM (CURRENT_DATE::timestamp - laa.overdue_since_date_derived::timestamp))::int, 0)
       END AS days_in_arrears,
       COALESCE(ml.is_npa, false) AS is_npa
  FROM m_client mc
  JOIN m_office ounder ON ounder.id = mc.office_id
       AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_loan ml ON ml.client_id = mc.id
  LEFT JOIN m_loan_arrears_aging laa ON laa.loan_id = ml.id
  WHERE ml.loan_status_id = 300
)
SELECT office_id,
       office_name,
       COUNT(*) AS active_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0) AS arrears_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30) AS par30_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 60) AS par60_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 90) AS par90_loan_count,
       COUNT(*) FILTER (WHERE is_npa) AS npa_loan_count,
       COALESCE(SUM(total_outstanding), 0) AS outstanding_amount,
       COALESCE(SUM(total_overdue), 0) AS overdue_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30), 0) AS par30_outstanding_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 60), 0) AS par60_outstanding_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 90), 0) AS par90_outstanding_amount,
       CASE
         WHEN COALESCE(SUM(total_outstanding), 0) > 0
         THEN ((COALESCE(SUM(total_outstanding), 0) - COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30), 0)) / COALESCE(SUM(total_outstanding), 0)) * 100
         ELSE 0
       END AS current_rate
FROM base
GROUP BY office_id, office_name
ORDER BY par30_outstanding_amount DESC, office_name`,
    },
  ];
}

async function main() {
  const reports = getReports();
  const existingReports = (await fineractFetch("/reports")) as Array<{
    id: number;
    reportName: string;
  }>;
  const existingMap = new Map(
    existingReports.map((report) => [report.reportName, report.id])
  );

  for (const report of reports) {
    const existingId = existingMap.get(report.reportName);

    if (existingId) {
      const { reportParameters: _ignored, ...updatePayload } = report;
      await fineractFetch(`/reports/${existingId}`, {
        method: "PUT",
        body: JSON.stringify(updatePayload),
      });
      console.log(`updated ${report.reportName} (${existingId})`);
      continue;
    }

    await fineractFetch("/reports", {
      method: "POST",
      body: JSON.stringify(report),
    });
    console.log(`created ${report.reportName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
