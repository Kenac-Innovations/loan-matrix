import { fetchFineractAPI } from "@/lib/api";
import { formatFineractDate } from "@/lib/fineract-savings-service";
import { addMonths } from "date-fns";

export interface CreditFacility {
  id: number; // Fineract datatable row id (used for PUT)
  client_id: number;
  facility_ref: string;
  credit_limit: number;
  tenor_months: number;
  drawdown_tranches: number;
  currency_code: string;
  utilized_amount: number;
  disbursed_tranches: number;
  status: "PENDING" | "ACTIVE" | "CLOSED";
  created_date: string | number[]; // Fineract may return arrays [yyyy, m, d]
}

export interface CreditFacilityLoan {
  id: number;
  loan_id: number;
  facility_ref: string;
}

export interface CreateFacilityData {
  creditLimit: number;
  tenorMonths: number;
  drawdownTranches: number;
  currencyCode: string;
}

const DATE_FORMAT = "dd MMMM yyyy";
const LOCALE = "en";

// Parse Fineract date (may be [yyyy, m, d] array or string)
export function parseFineractDateField(d: string | number[]): Date {
  if (Array.isArray(d)) return new Date(d[0], d[1] - 1, d[2]);
  return new Date(d);
}

export async function registerCreditFacilityDatatables(): Promise<void> {
  const tables = [
    {
      datatableName: "credit_facility",
      apptableName: "m_client",
      entitySubType: "Person",
      multiRow: true,
      columns: [
        { name: "facility_ref", type: "String", length: 50, mandatory: true },
        { name: "credit_limit", type: "Decimal", mandatory: true },
        { name: "tenor_months", type: "Number", mandatory: true },
        { name: "drawdown_tranches", type: "Number", mandatory: true },
        { name: "currency_code", type: "String", length: 10, mandatory: true },
        { name: "utilized_amount", type: "Decimal", mandatory: true },
        { name: "disbursed_tranches", type: "Number", mandatory: true },
        { name: "status", type: "String", length: 10, mandatory: true },
        { name: "created_date", type: "Date", mandatory: true },
      ],
    },
    {
      datatableName: "credit_facility_loan",
      apptableName: "m_loan",
      multiRow: false,
      columns: [
        { name: "facility_ref", type: "String", length: 50, mandatory: true },
      ],
    },
  ];

  for (const table of tables) {
    try {
      await fetchFineractAPI("/datatables", {
        method: "POST",
        body: JSON.stringify(table),
      });
    } catch (e: any) {
      // Idempotent: ignore "already exists" errors
      const msg = e?.message ?? "";
      if (
        !msg.includes("already") &&
        !msg.includes("exist") &&
        !msg.includes("409")
      ) {
        throw e;
      }
    }
  }
}

export async function createFacility(
  clientId: number,
  data: CreateFacilityData
): Promise<{ datatableId: number; facilityRef: string }> {
  const facilityRef = crypto.randomUUID();
  const result = await fetchFineractAPI(
    `/datatables/credit_facility/${clientId}`,
    {
      method: "POST",
      body: JSON.stringify({
        facility_ref: facilityRef,
        credit_limit: data.creditLimit,
        tenor_months: data.tenorMonths,
        drawdown_tranches: data.drawdownTranches,
        currency_code: data.currencyCode,
        utilized_amount: 0,
        disbursed_tranches: 0,
        status: "PENDING",
        created_date: formatFineractDate(new Date()),
        dateFormat: DATE_FORMAT,
        locale: LOCALE,
      }),
    }
  );
  return { datatableId: result.resourceId, facilityRef };
}

export async function getActiveFacilityForClient(
  clientId: number
): Promise<CreditFacility | null> {
  try {
    const rows: CreditFacility[] = await fetchFineractAPI(
      `/datatables/credit_facility/${clientId}`
    );
    if (!Array.isArray(rows)) return null;
    return rows.find((r) => r.status === "ACTIVE") ?? null;
  } catch {
    return null;
  }
}

export async function getPendingFacilityForClient(
  clientId: number
): Promise<CreditFacility | null> {
  try {
    const rows: CreditFacility[] = await fetchFineractAPI(
      `/datatables/credit_facility/${clientId}`
    );
    if (!Array.isArray(rows)) return null;
    return rows.find((r) => r.status === "PENDING") ?? null;
  } catch {
    return null;
  }
}

export async function getFacilityByRef(
  clientId: number,
  facilityRef: string
): Promise<CreditFacility | null> {
  try {
    const rows: CreditFacility[] = await fetchFineractAPI(
      `/datatables/credit_facility/${clientId}`
    );
    if (!Array.isArray(rows)) return null;
    return rows.find((r) => r.facility_ref === facilityRef) ?? null;
  } catch {
    return null;
  }
}

export async function updateFacility(
  clientId: number,
  datatableId: number,
  updates: Partial<
    Pick<CreditFacility, "status" | "utilized_amount" | "disbursed_tranches">
  >
): Promise<void> {
  await fetchFineractAPI(
    `/datatables/credit_facility/${clientId}/${datatableId}`,
    {
      method: "PUT",
      body: JSON.stringify({ ...updates, locale: LOCALE }),
    }
  );
}

export async function createFacilityLoanLink(
  loanId: number,
  facilityRef: string
): Promise<void> {
  await fetchFineractAPI(`/datatables/credit_facility_loan/${loanId}`, {
    method: "POST",
    body: JSON.stringify({ facility_ref: facilityRef, locale: LOCALE }),
  });
}

export async function getFacilityLoanLink(
  loanId: number
): Promise<CreditFacilityLoan | null> {
  try {
    const result = await fetchFineractAPI(
      `/datatables/credit_facility_loan/${loanId}`
    );
    // Fineract returns an array even for non-multiRow datatables
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.facility_ref) return null;
    return row as CreditFacilityLoan;
  } catch {
    return null;
  }
}

export function isFacilityExpired(facility: CreditFacility): boolean {
  const created = parseFineractDateField(facility.created_date);
  const expiry = addMonths(created, facility.tenor_months);
  return new Date() >= expiry;
}

export function validateFacilityForDisbursement(
  facility: CreditFacility,
  loanAmount: number
): { valid: true } | { valid: false; error: string } {
  if (facility.status !== "ACTIVE") {
    return { valid: false, error: "Credit facility is not active" };
  }
  if (isFacilityExpired(facility)) {
    return { valid: false, error: "Credit facility has expired" };
  }
  const available = facility.credit_limit - facility.utilized_amount;
  if (loanAmount > available) {
    return {
      valid: false,
      error: `Disbursement exceeds facility available balance ($${available.toLocaleString()})`,
    };
  }
  if (facility.disbursed_tranches >= facility.drawdown_tranches) {
    return {
      valid: false,
      error: `Maximum drawdown tranches reached (${facility.disbursed_tranches} / ${facility.drawdown_tranches})`,
    };
  }
  return { valid: true };
}
