import "server-only";

import prisma from "./prisma";
import { normalizeSmsPhoneNumber } from "./notification-service";

const FINERACT_BASE_URL =
  process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";
const SERVICE_TOKEN =
  process.env.FINERACT_SERVICE_TOKEN || "bWlmb3M6cGFzc3dvcmQ=";

export interface LoanNotificationDetails {
  clientId: number | null;
  clientName: string | null;
  currencyCode: string | null;
  externalId: string | null;
}

export interface LoanNotificationTarget {
  phone: string;
  clientName: string;
  countryCode?: string | null;
  source: "lead" | "ussd";
}

function normalizeClientId(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildClientName(
  firstname?: string | null,
  middlename?: string | null,
  lastname?: string | null
): string {
  return [firstname, middlename, lastname].filter(Boolean).join(" ").trim();
}

/**
 * Fetch loan details directly from Fineract so callers can resolve borrower
 * contact information without duplicating transport logic.
 */
export async function fetchLoanNotificationDetails(
  loanId: number,
  tenantSlug: string
): Promise<LoanNotificationDetails | null> {
  if (!Number.isFinite(loanId) || !tenantSlug) {
    return null;
  }

  try {
    const url = `${FINERACT_BASE_URL.replace(/\/$/, "")}/fineract-provider/api/v1/loans/${loanId}?associations=all`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${SERVICE_TOKEN}`,
        "Fineract-Platform-TenantId": tenantSlug,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        `[LoanNotification] Failed to fetch loan ${loanId} for tenant ${tenantSlug}: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const loan = await response.json();

    return {
      clientId: normalizeClientId(loan?.clientId),
      clientName: typeof loan?.clientName === "string" ? loan.clientName : null,
      currencyCode:
        typeof loan?.currency?.code === "string" ? loan.currency.code : null,
      externalId:
        typeof loan?.externalId === "string" ? loan.externalId : null,
    };
  } catch (error) {
    console.error("[LoanNotification] Error fetching loan details:", error);
    return null;
  }
}

/**
 * Resolve the borrower phone number and display name for a loan.
 *
 * Preference order:
 * 1. Local lead mapped to the loan
 * 2. Local USSD application mapped to the loan's client
 */
export async function resolveLoanNotificationTarget(options: {
  tenantId: string;
  tenantSlug: string;
  loanId: number;
  clientId?: number | null;
}): Promise<LoanNotificationTarget | null> {
  const { tenantId, tenantSlug, loanId, clientId } = options;
  const resolvedClientId = normalizeClientId(clientId);

  try {
    const leadSearch: Array<Record<string, number>> = [];

    if (Number.isFinite(loanId)) {
      leadSearch.push({ fineractLoanId: loanId });
    }

    if (resolvedClientId != null) {
      leadSearch.push({ fineractClientId: resolvedClientId });
    }

    if (leadSearch.length > 0) {
      const lead = await prisma.lead.findFirst({
        where: {
          tenantId,
          mobileNo: { not: null },
          OR: leadSearch,
        },
        select: {
          firstname: true,
          middlename: true,
          lastname: true,
          mobileNo: true,
          countryCode: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      if (lead?.mobileNo) {
        const phone =
          normalizeSmsPhoneNumber(lead.mobileNo, lead.countryCode) ??
          lead.mobileNo;
        return {
          phone,
          clientName:
            buildClientName(lead.firstname, lead.middlename, lead.lastname) ||
            "Customer",
          countryCode: lead.countryCode ?? null,
          source: "lead",
        };
      }
    }

    if (resolvedClientId != null) {
      const ussdApplication = await prisma.ussdLoanApplication.findFirst({
        where: {
          tenantId,
          loanMatrixClientId: resolvedClientId,
        },
        select: {
          userFullName: true,
          userPhoneNumber: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (ussdApplication?.userPhoneNumber) {
        const phone =
          normalizeSmsPhoneNumber(ussdApplication.userPhoneNumber) ??
          ussdApplication.userPhoneNumber;
        return {
          phone,
          clientName: ussdApplication.userFullName || "Customer",
          countryCode: null,
          source: "ussd",
        };
      }
    }

    // As a last resort, try fetching the loan details and re-run the USSD lookup.
    if (resolvedClientId == null) {
      const loanDetails = await fetchLoanNotificationDetails(loanId, tenantSlug);
      const fallbackClientId = loanDetails?.clientId;

      if (fallbackClientId != null) {
        const ussdApplication = await prisma.ussdLoanApplication.findFirst({
          where: {
            tenantId,
            loanMatrixClientId: fallbackClientId,
          },
          select: {
            userFullName: true,
            userPhoneNumber: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (ussdApplication?.userPhoneNumber) {
          const phone =
            normalizeSmsPhoneNumber(ussdApplication.userPhoneNumber) ??
            ussdApplication.userPhoneNumber;
          return {
            phone,
            clientName: ussdApplication.userFullName || "Customer",
            countryCode: null,
            source: "ussd",
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error("[LoanNotification] Error resolving borrower target:", error);
    return null;
  }
}
