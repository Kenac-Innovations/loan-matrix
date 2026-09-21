import { NextResponse } from "next/server";
import { format } from "date-fns";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { sendLoanStatusSms } from "@/lib/notification-service";
import {
  createLeadTenantContext,
  LeadTenantContextError,
} from "@/lib/lead-tenant-context";
import {
  extractTenantSlugFromRequest,
  getTenantBySlug,
} from "@/lib/tenant-service";
import {
  LeadLoanLinkingError,
  reconcileLeadLoan,
} from "@/lib/lead-loan-linking";

function isOverdueChargeLike(charge?: any) {
  const timeType = charge?.originalCharge?.chargeTimeType || charge?.chargeTimeType;
  const code = String(timeType?.code || "").toLowerCase();
  const value = String(timeType?.value || "").toLowerCase();

  if (
    code === "chargetimetype.overdueinstallment" ||
    code === "overdueinstallment" ||
    code.endsWith(".overdueinstallment") ||
    value.includes("overdue")
  ) {
    return true;
  }

  return !timeType && Boolean(charge?.originalCharge?.penalty ?? charge?.penalty);
}
function isSpecifiedDueDateCharge(charge?: any) {
  const timeType = charge?.originalCharge?.chargeTimeType || charge?.chargeTimeType;
  const code = String(timeType?.code || "").toLowerCase();
  const value = String(timeType?.value || "").toLowerCase();

  return (
    code === "chargetimetype.specifiedduedate" ||
    code === "specifiedduedate" ||
    code.endsWith(".specifiedduedate") ||
    value.includes("specified due date")
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

async function resolveLeadTenant(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new LeadLoanLinkingError("Unauthorized", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }

  const requestedSlug = extractTenantSlugFromRequest(request);
  const [requestTenant, sessionTenant] = await Promise.all([
    getTenantBySlug(requestedSlug),
    session.user.tenantId
      ? prisma.tenant.findFirst({
          where: { id: session.user.tenantId, isActive: true },
          select: { id: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  if (!requestTenant) {
    throw new LeadLoanLinkingError("Tenant not found", {
      status: 404,
      code: "TENANT_NOT_FOUND",
    });
  }

  try {
    return {
      session,
      context: createLeadTenantContext({
        sessionTenantId: session.user.tenantId,
        requestTenant,
        sessionTenant,
      }),
    };
  } catch (error) {
    if (error instanceof LeadTenantContextError) {
      throw new LeadLoanLinkingError(error.message, {
        status: 409,
        code: "TENANT_CONTEXT_CONFLICT",
      });
    }
    throw error;
  }
}

function buildLegacyFineractPayload(
  leadId: string,
  loanData: Record<string, any>
): Record<string, unknown> {
  const submittedDate = loanData.submittedOn
    ? new Date(loanData.submittedOn)
    : new Date();
  const disbursementDate = loanData.disbursementOn
    ? new Date(loanData.disbursementOn)
    : new Date();
  const firstRepaymentDate = loanData.firstRepaymentOn
    ? new Date(loanData.firstRepaymentOn)
    : null;

  const dateStr = format(submittedDate, "yyyy-MM-dd");
  const disbursementDateStr = format(disbursementDate, "yyyy-MM-dd");
  const requestedCharges = Array.isArray(loanData.charges)
    ? loanData.charges.filter((charge: any) => !isOverdueChargeLike(charge))
    : [];

  const payload: Record<string, any> = {
    clientId: loanData.clientId,
    productId: loanData.productId,
    principal: loanData.principal,
    loanTermFrequency: loanData.loanTermFrequency || 12,
    loanTermFrequencyType: 2,
    numberOfRepayments: loanData.numberOfRepayments || 12,
    repaymentEvery: loanData.repaymentEvery || 1,
    repaymentFrequencyType: 2,
    interestRatePerPeriod: loanData.interestRatePerPeriod || 7,
    interestRateFrequencyType: 2,
    interestType: 0,
    amortizationType: 1,
    interestCalculationPeriodType: 1,
    transactionProcessingStrategyCode: "creocore-strategy",
    submittedOnDate: dateStr,
    expectedDisbursementDate: disbursementDateStr,
    ...(firstRepaymentDate && {
      repaymentsStartingFromDate: format(firstRepaymentDate, "yyyy-MM-dd"),
    }),
    ...(loanData.loanScheduleType
      ? { loanScheduleType: loanData.loanScheduleType }
      : {}),
    balloonPaymentAmount: loanData.balloonRepaymentAmount ?? 0,
    allowPartialPeriodInterestCalculation:
      loanData.calculateInterestForExactDays ?? false,
    allowPartialPeriodInterestCalcualtion:
      loanData.calculateInterestForExactDays ?? false,
    inArrearsTolerance: loanData.arrearsTolerance ?? 0,
    graceOnInterestCharged: loanData.interestFreePeriod ?? 0,
    graceOnPrincipalPayment: loanData.graceOnPrincipalPayment ?? 0,
    graceOnInterestPayment: loanData.graceOnInterestPayment ?? 0,
    graceOnArrearsAgeing: loanData.onArrearsAgeing ?? 0,
    locale: "en",
    dateFormat: "yyyy-MM-dd",
    // The linking service overwrites this again immediately before POST.
    externalId: leadId,
    isEqualAmortization: false,
    charges: requestedCharges.map((charge: any) => {
      const calcCode: string =
        charge.originalCharge?.chargeCalculationType?.code ?? "";
      const isPercentage =
        calcCode.toLowerCase().includes("percent") &&
        typeof charge.originalCharge?.percentage === "number" &&
        Number.isFinite(charge.originalCharge.percentage);

      const chargePayload: Record<string, unknown> = {
        chargeId: charge.chargeId,
        amount: isPercentage
          ? charge.originalCharge.percentage
          : charge.amount,
      };

      if (charge.dueDate && isSpecifiedDueDateCharge(charge)) {
        chargePayload.dueDate = charge.dueDate;
      }

      return chargePayload;
    }),
    collateral: [],
    loanType: "individual",
    ...(loanData.isTopup && loanData.loanIdToClose
      ? { isTopup: true, loanIdToClose: parseInt(loanData.loanIdToClose, 10) }
      : {}),
  };

  if (loanData.loanPurpose) payload.loanPurposeId = loanData.loanPurpose;
  if (loanData.loanOfficer) payload.loanOfficerId = loanData.loanOfficer;
  if (loanData.fund) payload.fundId = loanData.fund;

  return payload;
}

function errorResponse(error: unknown) {
  if (error instanceof LeadLoanLinkingError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.status }
    );
  }

  return buildFineractErrorResponse(error, {
    action: "create",
    resource: "loan",
  });
}

/**
 * POST /api/leads/[id]/create-loan
 *
 * The route owns the tenant-scoped request and payload compatibility.  The
 * linking service owns the remote idempotency check and durable local write.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const { context } = await resolveLeadTenant(request);
    const loanData = (await request.json()) as Record<string, any>;
    const nestedPayload = isRecord(loanData.fineractPayload)
      ? { ...loanData.fineractPayload }
      : null;
    const source = nestedPayload || loanData;
    const clientId = toPositiveInt(source.clientId);
    const productId = toPositiveInt(source.productId);
    const principal = Number(source.principal);

    if (!clientId || !productId || !Number.isFinite(principal) || principal <= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required loan data: clientId, productId, and principal are required",
        },
        { status: 400 }
      );
    }

    const fineractPayload = nestedPayload
      ? nestedPayload
      : buildLegacyFineractPayload(leadId, loanData);
    const result = await reconcileLeadLoan({
      tenantId: context.tenantId,
      leadId,
      expectedClientId: clientId,
      fineractPayload,
      allowCreate: true,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          terminal: result.terminal,
          outcome: result.action,
          coreResponse: result.fineractResponse,
          loanId: result.loanId,
          error:
            "The matching Fineract loan is already rejected or withdrawn. The local link was saved, but the submission is not complete.",
        },
        { status: 409 }
      );
    }

    // SMS is intentionally best effort and only sent when this request
    // created/adopted a remote loan.  A local retry must not send duplicates.
    if (
      (result.action === "created" || result.action === "linked") &&
      result.lead.mobileNo
    ) {
      void sendLoanStatusSms({
        type: "pending_approval",
        clientName:
          [result.lead.firstname, result.lead.middlename, result.lead.lastname]
            .filter(Boolean)
            .join(" ") || "Customer",
        phone: String(result.lead.mobileNo),
        countryCode: result.lead.countryCode as string | undefined,
        amount: principal || 0,
        tenantId: context.tenantSlug,
      }).catch((smsError) => {
        console.error("Failed to send pending-approval SMS:", smsError);
      });
    }

    // PDFs and CDE remain client-side follow-up work after this response.
    return NextResponse.json({
      success: true,
      outcome: result.action,
      coreResponse: result.fineractResponse,
      loanId: result.loanId,
      reconciled: result.action !== "created",
    });
  } catch (error) {
    console.error("Error creating/reconciling loan from lead:", error);
    return errorResponse(error);
  }
}
