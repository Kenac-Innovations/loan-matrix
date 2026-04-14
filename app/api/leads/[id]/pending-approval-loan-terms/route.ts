import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import type { FineractLoan } from "@/lib/fineract-api";
import {
  canUserEditPendingLoanApplication,
  isPendingLoanApplicationEditTenant,
  isPendingApprovalLoanStatus,
} from "@/lib/pending-loan-application-edit";

const FINERACT_BASE_URL =
  process.env.FINERACT_BASE_URL || "http://mifos-be.kenac.co.zw";

type LoanTermsMetadata = Record<string, unknown> & {
  repaymentStrategy?: string;
  termFrequency?: number;
  repaymentEvery?: number;
  repaymentFrequency?: number;
  interestRateFrequency?: number;
  amortization?: number;
  interestMethod?: number;
  interestCalculationPeriod?: number;
};

type LeadStateMetadata = Record<string, unknown> & {
  loanTerms?: LoanTermsMetadata;
};

type FineractErrorBody = {
  defaultUserMessage?: string;
  developerMessage?: string;
  errors?: Array<{ defaultUserMessage?: string }>;
};

const pendingLoanTermsSchema = z.object({
  principal: z.coerce.number().positive("Loan amount must be greater than zero"),
  loanTermFrequency: z.coerce.number().int().positive("Loan term is required"),
  numberOfRepayments: z.coerce
    .number()
    .int()
    .positive("Number of repayments is required"),
  interestRatePerPeriod: z.coerce
    .number()
    .min(0, "Interest rate cannot be negative"),
});

function formatFineractDate(
  value: string | number[] | Date | null | undefined
): string {
  const date = toDate(value);

  if (!date) {
    throw new Error("Expected disbursement date is required to modify the loan");
  }

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function toDate(value: string | number[] | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (Array.isArray(value)) {
    const [year, month, day] = value;
    const parsed = new Date(year, (month || 1) - 1, day || 1);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveTransactionProcessingStrategyCode(
  loan: FineractLoan & { transactionProcessingStrategyCode?: string },
  stateMetadata: LeadStateMetadata
): string {
  return (
    loan.transactionProcessingStrategyCode ||
    stateMetadata?.loanTerms?.repaymentStrategy ||
    "creocore-strategy"
  );
}

async function fineractRequest<T>(
  endpoint: string,
  authToken: string,
  init?: RequestInit
): Promise<T> {
  const fineractTenantId = await getFineractTenantId();
  const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1${endpoint}`;
  const headers: HeadersInit = {
    Accept: "application/json",
    Authorization: `Basic ${authToken}`,
    "Fineract-Platform-TenantId": fineractTenantId,
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers || {}),
  };

  let response: Response;

  if (url.startsWith("http://")) {
    response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  } else {
    response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      // @ts-expect-error Node fetch accepts agent in this runtime.
      agent: new https.Agent({ rejectUnauthorized: false }),
    });
  }

  if (!response.ok) {
    let errorMessage = `Fineract request failed (${response.status})`;
    let errorDetails: FineractErrorBody | null = null;

    try {
      errorDetails = await response.json();
      errorMessage =
        errorDetails?.defaultUserMessage ||
        errorDetails?.errors?.[0]?.defaultUserMessage ||
        errorDetails?.developerMessage ||
        errorMessage;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) {
        errorMessage = text;
      }
    }

    const error = new Error(errorMessage);
    (error as Error & { status?: number; details?: FineractErrorBody | null }).status =
      response.status;
    (
      error as Error & { status?: number; details?: FineractErrorBody | null }
    ).details = errorDetails;
    throw error;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const tenantSlug = extractTenantSlugFromRequest(request);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPendingLoanApplicationEditTenant(tenantSlug)) {
      return NextResponse.json(
        { error: "Pending loan application editing is only enabled for Omama." },
        { status: 403 }
      );
    }

    if (!canUserEditPendingLoanApplication(session)) {
      return NextResponse.json(
        { error: "You do not have permission to edit pending loan applications." },
        { status: 403 }
      );
    }

    const authToken =
      session.base64EncodedAuthenticationKey || session.accessToken;

    if (!authToken) {
      return NextResponse.json(
        { error: "Missing Fineract session token." },
        { status: 401 }
      );
    }

    const { id: leadId } = await context.params;
    const parsedBody = pendingLoanTermsSchema.parse(await request.json());

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        fineractLoanId: true,
        expectedDisbursementDate: true,
        requestedAmount: true,
        loanTerm: true,
        lastModified: true,
        stateMetadata: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.fineractLoanId) {
      return NextResponse.json(
        { error: "This lead does not have a linked Fineract loan." },
        { status: 400 }
      );
    }

    const fineractLoan = await fineractRequest<
      FineractLoan & { transactionProcessingStrategyCode?: string }
    >(`/loans/${lead.fineractLoanId}`, authToken);

    if (!isPendingApprovalLoanStatus(fineractLoan.status?.value)) {
      return NextResponse.json(
        {
          error:
            "Loan terms can only be edited while the application is Submitted and pending approval.",
        },
        { status: 409 }
      );
    }

    const currentMetadata = (lead.stateMetadata as LeadStateMetadata | null) || {};
    const currentLoanTerms = currentMetadata.loanTerms || {};

    const payload = {
      locale: "en",
      dateFormat: "dd MMMM yyyy",
      productId: fineractLoan.loanProductId,
      principal: parsedBody.principal,
      loanTermFrequency: parsedBody.loanTermFrequency,
      loanTermFrequencyType:
        fineractLoan.termPeriodFrequencyType?.id ||
        currentLoanTerms.termFrequency ||
        2,
      numberOfRepayments: parsedBody.numberOfRepayments,
      repaymentEvery: fineractLoan.repaymentEvery || currentLoanTerms.repaymentEvery || 1,
      repaymentFrequencyType:
        fineractLoan.repaymentFrequencyType?.id ||
        currentLoanTerms.repaymentFrequency ||
        2,
      interestRatePerPeriod: parsedBody.interestRatePerPeriod,
      amortizationType:
        fineractLoan.amortizationType?.id || currentLoanTerms.amortization || 1,
      interestType:
        fineractLoan.interestType?.id || currentLoanTerms.interestMethod || 0,
      interestCalculationPeriodType:
        fineractLoan.interestCalculationPeriodType?.id ||
        currentLoanTerms.interestCalculationPeriod ||
        1,
      expectedDisbursementDate: formatFineractDate(
        fineractLoan.timeline?.expectedDisbursementDate ||
          lead.expectedDisbursementDate
      ),
      transactionProcessingStrategyCode: resolveTransactionProcessingStrategyCode(
        fineractLoan,
        currentMetadata
      ),
    };

    const fineractResult = await fineractRequest(`/loans/${lead.fineractLoanId}`, authToken, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    const updatedLoanTerms = {
      ...currentLoanTerms,
      principal: parsedBody.principal,
      loanTerm: parsedBody.loanTermFrequency,
      termFrequency:
        currentLoanTerms.termFrequency || fineractLoan.termPeriodFrequencyType?.id || 2,
      numberOfRepayments: parsedBody.numberOfRepayments,
      repaymentEvery:
        currentLoanTerms.repaymentEvery || fineractLoan.repaymentEvery || 1,
      repaymentFrequency:
        currentLoanTerms.repaymentFrequency || fineractLoan.repaymentFrequencyType?.id || 2,
      nominalInterestRate: parsedBody.interestRatePerPeriod,
      interestRateFrequency:
        currentLoanTerms.interestRateFrequency ||
        fineractLoan.interestRateFrequencyType?.id ||
        2,
      amortization:
        currentLoanTerms.amortization || fineractLoan.amortizationType?.id || 1,
      interestMethod:
        currentLoanTerms.interestMethod || fineractLoan.interestType?.id || 0,
      interestCalculationPeriod:
        currentLoanTerms.interestCalculationPeriod ||
        fineractLoan.interestCalculationPeriodType?.id ||
        1,
      repaymentStrategy: resolveTransactionProcessingStrategyCode(
        fineractLoan,
        currentMetadata
      ),
    };

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        requestedAmount: parsedBody.principal,
        loanTerm: parsedBody.loanTermFrequency,
        lastModified: new Date(),
        stateMetadata: {
          ...currentMetadata,
          signatures: null,
          contractsSigned: false,
          contractsSignedAt: null,
          loanTerms: updatedLoanTerms,
        },
      },
    });

    return NextResponse.json({
      success: true,
      result: fineractResult,
      updatedLoanTerms,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid request payload" },
        { status: 400 }
      );
    }

    console.error("Error updating pending approval loan terms:", error);

    const status =
      (error as Error & { status?: number }).status || 500;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update pending approval loan terms";

    return NextResponse.json({ error: message }, { status });
  }
}
