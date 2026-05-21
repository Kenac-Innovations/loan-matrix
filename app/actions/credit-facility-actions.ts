"use server";

import { prisma } from "@/lib/prisma";
import {
  registerCreditFacilityDatatables,
  createFacility,
  createFacilityLoanLink,
  getActiveFacilityForClient,
  getFacilityByRef,
  getFacilityLoanLink,
  updateFacility,
  isFacilityExpired,
  type CreateFacilityData,
  type CreditFacility,
  type CreditFacilityLoan,
} from "@/lib/fineract-credit-facility";

export async function setupCreditFacilityDatatables(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await registerCreditFacilityDatatables();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to register datatables" };
  }
}

/**
 * Called after a new facility loan is created.
 * Reads fineractClientId + fineractLoanId from the lead record.
 * Creates the credit_facility datatable entry and links the loan.
 */
export async function createCreditFacilityForLead(
  leadId: string,
  facilityData: CreateFacilityData
): Promise<{ success: boolean; facilityRef?: string; error?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { fineractClientId: true, fineractLoanId: true },
  });

  if (!lead?.fineractClientId || !lead?.fineractLoanId) {
    return { success: false, error: "Lead missing Fineract IDs — submit the loan first" };
  }

  try {
    const { facilityRef } = await createFacility(lead.fineractClientId, facilityData);
    await createFacilityLoanLink(lead.fineractLoanId, facilityRef);
    return { success: true, facilityRef };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to create credit facility" };
  }
}

/**
 * Links an existing active facility to a newly created loan.
 * Validates expiry and tranche/credit-limit rules before linking.
 */
export async function linkLoanToExistingFacility(
  leadId: string,
  loanAmount: number
): Promise<{ success: boolean; error?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { fineractClientId: true, fineractLoanId: true },
  });

  if (!lead?.fineractClientId || !lead?.fineractLoanId) {
    return { success: false, error: "Lead missing Fineract IDs" };
  }

  const facility = await getActiveFacilityForClient(lead.fineractClientId);
  if (!facility) {
    return { success: false, error: "No active credit facility found for this client" };
  }

  if (isFacilityExpired(facility)) {
    return { success: false, error: "Credit facility has expired" };
  }
  const available = facility.credit_limit - facility.utilized_amount;
  if (loanAmount > available) {
    return {
      success: false,
      error: `Loan amount exceeds facility available balance ($${available.toLocaleString()})`,
    };
  }
  if (facility.disbursed_tranches >= facility.drawdown_tranches) {
    return {
      success: false,
      error: `Maximum drawdown tranches reached (${facility.disbursed_tranches} / ${facility.drawdown_tranches})`,
    };
  }

  try {
    await createFacilityLoanLink(lead.fineractLoanId, facility.facility_ref);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to link loan to facility" };
  }
}

/**
 * Fetches the active credit facility for a client.
 */
export async function getActiveFacility(
  fineractClientId: number
): Promise<CreditFacility | null> {
  return getActiveFacilityForClient(fineractClientId);
}

/**
 * Fetches the credit facility linked to a specific Fineract loan.
 * Returns null if the loan is not under a facility.
 */
export async function getFacilityForLoan(
  fineractLoanId: number,
  fineractClientId: number
): Promise<CreditFacility | null> {
  const link = await getFacilityLoanLink(fineractLoanId);
  if (!link) return null;
  return getFacilityByRef(fineractClientId, link.facility_ref);
}

/**
 * Given a client's active facility and a list of their loan IDs,
 * returns which loans are linked to the facility.
 * Used by client-facility.tsx (client component) to avoid direct lib imports.
 */
export async function getFacilityLoanLinks(
  loanIds: number[]
): Promise<Record<number, CreditFacilityLoan | null>> {
  const results: Record<number, CreditFacilityLoan | null> = {};
  await Promise.all(
    loanIds.map(async (id) => {
      results[id] = await getFacilityLoanLink(id);
    })
  );
  return results;
}

export interface CreditFacilityRow {
  id: number;
  client_id: number;
  client_name: string;
  client_external_id: string | null;
  facility_ref: string;
  credit_limit: number;
  tenor_months: number;
  drawdown_tranches: number;
  currency_code: string;
  utilized_amount: number;
  disbursed_tranches: number;
  status: "PENDING" | "ACTIVE" | "CLOSED";
  created_date: string;
}

export interface FacilityLoanRow {
  loan_id: number;
  account_no: string;
  principal_amount: number;
  approved_principal: number;
  client_id: number;
  client_name: string;
  product_name: string;
  loan_status: string;
}

/**
 * Register (or update) the two Fineract stretchy reports for credit facility listing.
 * Idempotent — safe to call multiple times.
 *
 * Parameters used (inserted into stretchy_parameter on first run):
 *   parameterId 1027 — creditFacilityClientExternalId  (text, optional client filter)
 *   parameterId 1028 — creditFacilityId                (text/number, facility ID filter)
 */
export async function setupCreditFacilityReports(): Promise<{
  success: boolean;
  error?: string;
}> {
  const { fetchFineractAPI } = await import("@/lib/api");

  const reports = [
    {
      reportName: "SEARCH_CLIENT_CREDIT_FACILITIES",
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Credit Facility",
      description: "List all credit facilities with client details. Filter by clientExternalId to scope to one client.",
      useReport: true,
      // ${clientExternalId} is optional: empty string returns all rows.
      reportSql: `SELECT cf.id,
       cf.client_id,
       mc.display_name AS client_name,
       mc.external_id AS client_external_id,
       cf.facility_ref,
       cf.credit_limit,
       cf.tenor_months,
       cf.drawdown_tranches,
       cf.currency_code,
       cf.utilized_amount,
       cf.disbursed_tranches,
       cf.status,
       TO_CHAR(cf.created_date, 'YYYY-MM-DD') AS created_date
FROM credit_facility cf
JOIN m_client mc ON mc.id = cf.client_id
WHERE ('\${clientExternalId}' = '' OR mc.external_id = '\${clientExternalId}')
ORDER BY cf.created_date DESC`,
      reportParameters: [
        {
          parameterId: 1027,
          reportParameterName: "clientExternalId",
        },
      ],
    },
    {
      reportName: "SEARCH_FACILITY_LOANS",
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Credit Facility",
      description: "List loans linked to a specific credit facility by its numeric ID.",
      useReport: true,
      reportSql: `SELECT cfl.loan_id,
       ml.account_no,
       COALESCE(ml.approved_principal, ml.principal_amount) AS approved_principal,
       ml.principal_amount,
       mc.id AS client_id,
       mc.display_name AS client_name,
       lp.name AS product_name,
       lstat.enum_value AS loan_status
FROM credit_facility_loan cfl
JOIN credit_facility cf ON cf.facility_ref = cfl.facility_ref
JOIN m_loan ml ON ml.id = cfl.loan_id
JOIN m_client mc ON mc.id = ml.client_id
JOIN m_product_loan lp ON lp.id = ml.product_id
LEFT JOIN r_enum_value lstat ON lstat.enum_name = 'loanStatus' AND lstat.enum_id = ml.loan_status_id
WHERE cf.facility_ref = '\${facilityId}'`,
      reportParameters: [
        {
          parameterId: 1028,
          reportParameterName: "facilityId",
        },
      ],
    },
  ];

  // Fetch existing reports so we can PUT (update) instead of POST if they already exist
  let existingReports: Array<{ id: number; reportName: string }> = [];
  try {
    existingReports = (await fetchFineractAPI("/reports")) ?? [];
  } catch {
    // If listing fails, fall through to POST-only with duplicate handling
  }
  const existingMap = new Map(existingReports.map((r) => [r.reportName, r.id]));

  for (const report of reports) {
    const existingId = existingMap.get(report.reportName);
    try {
      if (existingId) {
        await fetchFineractAPI(`/reports/${existingId}`, {
          method: "PUT",
          body: JSON.stringify(report),
        });
      } else {
        await fetchFineractAPI("/reports", {
          method: "POST",
          body: JSON.stringify(report),
        });
      }
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (!msg.includes("already") && !msg.includes("exist") && !msg.includes("409")) {
        return { success: false, error: `Failed to register ${report.reportName}: ${msg}` };
      }
    }
  }

  return { success: true };
}

/**
 * Run SEARCH_CLIENT_CREDIT_FACILITIES stretchy report.
 * Pass clientExternalId to scope to one client; omit (or pass "") for all.
 */
export async function getAllCreditFacilities(clientExternalId = ""): Promise<CreditFacilityRow[]> {
  const { fetchFineractAPI } = await import("@/lib/api");
  try {
    const data = await fetchFineractAPI(
      `/runreports/SEARCH_CLIENT_CREDIT_FACILITIES?genericResultSet=false&R_clientExternalId=${encodeURIComponent(clientExternalId)}`
    );
    return (data ?? []) as CreditFacilityRow[];
  } catch {
    return [];
  }
}

/**
 * Run SEARCH_FACILITY_LOANS stretchy report for a specific facility by its numeric ID.
 */
export async function getFacilityLoansByFacilityRef(facilityRef: string): Promise<FacilityLoanRow[]> {
  const { fetchFineractAPI } = await import("@/lib/api");
  try {
    const data = await fetchFineractAPI(
      `/runreports/SEARCH_FACILITY_LOANS?genericResultSet=false&R_facilityId=${encodeURIComponent(facilityRef)}`
    );
    return (data ?? []) as FacilityLoanRow[];
  } catch {
    return [];
  }
}

/**
 * Fetches Fineract loan IDs for a client's active loans.
 * Used by the client facility tab to know which loans to check for facility links.
 */
export async function getClientLoanIds(fineractClientId: number): Promise<number[]> {
  try {
    const { fetchFineractAPI } = await import("@/lib/api");
    const data = await fetchFineractAPI(
      `/clients/${fineractClientId}/accounts`
    );
    const loans: any[] = data?.loanAccounts ?? [];
    return loans.map((l: any) => l.id).filter(Boolean);
  } catch {
    return [];
  }
}
