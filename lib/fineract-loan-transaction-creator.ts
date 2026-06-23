import "server-only";

import { fetchFineractAPI } from "@/lib/api";
import { resolveLoanTransactionCreatorName } from "@/lib/loan-transaction-creator";

export const LOAN_TRANSACTION_CREATOR_REPORT =
  "LM_LOAN_TRANSACTION_CREATOR_LOOKUP_V2";

const LOAN_TRANSACTION_CREATOR_PARAMETER_ID = 1006;

let reportSetupPromise: Promise<void> | null = null;

function isAlreadyExistsError(error: unknown): boolean {
  const err = error as { message?: string; status?: number; errorData?: unknown };
  const message = [
    err?.message,
    typeof err?.errorData === "object" && err.errorData
      ? JSON.stringify(err.errorData)
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    err?.status === 409 ||
    message.includes("already") ||
    message.includes("exist")
  );
}

async function setupLoanTransactionCreatorReport(): Promise<void> {
  const report = {
    reportName: LOAN_TRANSACTION_CREATOR_REPORT,
    reportType: "Table",
    reportSubType: "",
    reportCategory: "Loans",
    description:
      "Lookup the Fineract user who created a specific loan transaction.",
    useReport: true,
    reportSql: `SELECT lt.id AS loan_transaction_id,
       lt.loan_id,
       COALESCE(NULLIF(TRIM(CONCAT(COALESCE(au.firstname, ''), ' ', COALESCE(au.lastname, ''))), ''), au.username) AS created_by_user_name,
       au.username AS created_by_username
FROM m_loan_transaction lt
JOIN m_appuser au ON au.id = lt.created_by
WHERE lt.id = COALESCE(NULLIF(regexp_replace('\${transactionId}', '[^0-9]', '', 'g'), '')::bigint, -1)`,
    reportParameters: [
      {
        parameterId: LOAN_TRANSACTION_CREATOR_PARAMETER_ID,
        reportParameterName: "transactionId",
      },
    ],
  };

  let existingReports: Array<{ id: number; reportName: string }> = [];

  try {
    existingReports =
      (await fetchFineractAPI("/reports", {
        authMode: "service",
        cache: "no-store",
      })) ?? [];
  } catch {
    existingReports = [];
  }

  const existingId = existingReports.find(
    (existing) => existing.reportName === report.reportName
  )?.id;

  try {
    if (existingId) {
      await fetchFineractAPI(`/reports/${existingId}`, {
        authMode: "service",
        method: "PUT",
        body: JSON.stringify(report),
      });
      return;
    }

    await fetchFineractAPI("/reports", {
      authMode: "service",
      method: "POST",
      body: JSON.stringify(report),
    });
  } catch (error: unknown) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }
}

async function ensureLoanTransactionCreatorReport(): Promise<void> {
  if (!reportSetupPromise) {
    reportSetupPromise = setupLoanTransactionCreatorReport().catch((error) => {
      reportSetupPromise = null;
      throw error;
    });
  }

  await reportSetupPromise;
}

export async function getLoanTransactionCreator(options: {
  loanTransactionId: number;
}): Promise<{ name: string | null; source: "report" | "none" }> {
  await ensureLoanTransactionCreatorReport();

  const reportPayload = await fetchFineractAPI(
    `/runreports/${LOAN_TRANSACTION_CREATOR_REPORT}?genericResultSet=false&R_transactionId=${encodeURIComponent(
      String(options.loanTransactionId)
    )}`,
    {
      authMode: "service",
      cache: "no-store",
    }
  );

  const creatorName = resolveLoanTransactionCreatorName({
    reportPayload,
  });

  return {
    name: creatorName,
    source: creatorName ? "report" : "none",
  };
}
