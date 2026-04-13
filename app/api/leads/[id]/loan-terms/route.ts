import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import {
  getLeadAccessProfile,
  PENDING_APPROVAL_EDITABLE_LOAN_TERM_FIELDS,
} from "@/lib/lead-permissions";
import { SpecificPermission } from "@/shared/types/auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("Saving loan terms for leadId:", leadId);

    const data = await request.json();
    console.log("Loan terms data:", data);

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      include: {
        currentStage: {
          select: {
            name: true,
            fineractStatus: true,
          },
        },
      },
    });

    if (!lead) {
      console.error("Lead not found:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    const currentMetadata = (lead.stateMetadata as any) || {};
    const existingLoanTerms = (currentMetadata.loanTerms as any) || {};

    const accessProfile = await getLeadAccessProfile({
      tenantId: tenant.id,
      lead,
      session,
    });

    const requestedLoanTerms = {
      principal: data.principal,
      loanTerm: data.loanTerm,
      termFrequency: data.termFrequency,
      numberOfRepayments: data.numberOfRepayments,
      repaymentEvery: data.repaymentEvery,
      repaymentFrequency: data.repaymentFrequency,
      repaymentFrequencyNthDay: data.repaymentFrequencyNthDay,
      repaymentFrequencyDayOfWeek: data.repaymentFrequencyDayOfWeek,
      nominalInterestRate: data.nominalInterestRate,
      interestRateFrequency: data.interestRateFrequency,
      interestMethod: data.interestMethod,
      amortization: data.amortization,
      isEqualAmortization: data.isEqualAmortization,
      repaymentStrategy: data.repaymentStrategy,
      interestCalculationPeriod: data.interestCalculationPeriod,
      calculateInterestForExactDays: data.calculateInterestForExactDays,
      arrearsTolerance: data.arrearsTolerance,
      interestFreePeriod: data.interestFreePeriod,
      graceOnPrincipalPayment: data.graceOnPrincipalPayment,
      graceOnInterestPayment: data.graceOnInterestPayment,
      onArrearsAgeing: data.onArrearsAgeing,
      firstRepaymentOn: data.firstRepaymentOn,
      interestChargedFrom: data.interestChargedFrom,
      balloonRepaymentAmount: data.balloonRepaymentAmount,
      collaterals: data.collaterals,
      charges: data.charges || [],
      isTopup: data.isTopup || false,
      loanIdToClose: data.loanIdToClose || "",
    };

    const isRestrictedPendingApprovalEdit =
      accessProfile.isPendingApproval &&
      !accessProfile.canFullyEditPendingApprovalLoanTerms;

    if (
      accessProfile.isPendingApproval &&
      !accessProfile.canRestrictedEditPendingApprovalLoanTerms
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pending Approval applications can only be updated by Credit Analysts or administrators.",
        },
        { status: 403 }
      );
    }

    if (isRestrictedPendingApprovalEdit && !accessProfile.isCreditAnalyst) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pending Approval loan-term edits are restricted to Credit Analysts.",
        },
        { status: 403 }
      );
    }

    const loanTerms = isRestrictedPendingApprovalEdit
      ? {
          ...existingLoanTerms,
          ...Object.fromEntries(
            PENDING_APPROVAL_EDITABLE_LOAN_TERM_FIELDS
              .filter((fieldName) => requestedLoanTerms[fieldName] !== undefined)
              .map((fieldName) => [fieldName, requestedLoanTerms[fieldName]])
          ),
        }
      : requestedLoanTerms;

    const updatedMetadata = {
      ...currentMetadata,
      loanTerms,
    };

    if (isRestrictedPendingApprovalEdit) {
      const changes = Object.fromEntries(
        PENDING_APPROVAL_EDITABLE_LOAN_TERM_FIELDS.filter(
          (fieldName) => existingLoanTerms[fieldName] !== loanTerms[fieldName]
        ).map((fieldName) => [
          fieldName,
          {
            from: existingLoanTerms[fieldName] ?? null,
            to: loanTerms[fieldName] ?? null,
          },
        ])
      );

      if (Object.keys(changes).length > 0) {
        const currentHistory = Array.isArray(currentMetadata.pendingApprovalEditHistory)
          ? currentMetadata.pendingApprovalEditHistory
          : [];

        updatedMetadata.pendingApprovalEditHistory = [
          ...currentHistory,
          {
            editedAt: new Date().toISOString(),
            editedByUserId: session?.user?.userId ?? null,
            editedByName: session?.user?.name ?? null,
            roleNames: accessProfile.roleNames,
            scope: "pending-approval-credit-analyst",
            changes,
          },
        ];
      }
    }
    
    console.log("Saving loan terms with charges:", data.charges);

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        stateMetadata: updatedMetadata,
        requestedAmount:
          typeof loanTerms.principal === "number"
            ? loanTerms.principal
            : lead.requestedAmount,
        loanTerm:
          typeof loanTerms.loanTerm === "number"
            ? loanTerms.loanTerm
            : lead.loanTerm,
        lastModified: new Date(),
      },
    });

    console.log("Successfully updated lead with loan terms:", updatedLead.id);

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: "Loan terms saved successfully.",
    });
  } catch (error) {
    console.error("Error saving loan terms:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to save loan terms: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("GET loan terms for leadId:", leadId);

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        stateMetadata: true,
        currentStage: {
          select: {
            name: true,
            fineractStatus: true,
          },
        },
      },
    });

    if (!lead) {
      console.error("Lead not found:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    const metadata = (lead.stateMetadata as any) || {};
    const loanTerms = metadata.loanTerms || null;
    const accessProfile = await getLeadAccessProfile({
      tenantId: tenant.id,
      lead,
      session,
    });

    console.log("Found loan terms data:", loanTerms);

    return NextResponse.json({
      success: true,
      data: loanTerms,
      permissions: {
        canEditAllLoanTerms:
          !!session?.user?.permissions?.includes(SpecificPermission.ALL_FUNCTIONS) ||
          accessProfile.canFullyEditPendingApprovalLoanTerms,
        canEditPendingApprovalRestrictedTerms:
          accessProfile.canRestrictedEditPendingApprovalLoanTerms &&
          !accessProfile.canFullyEditPendingApprovalLoanTerms,
        editableFields: accessProfile.canRestrictedEditPendingApprovalLoanTerms
          ? [...PENDING_APPROVAL_EDITABLE_LOAN_TERM_FIELDS]
          : [],
        isPendingApproval: accessProfile.isPendingApproval,
      },
    });
  } catch (error) {
    console.error("Error fetching loan terms:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch loan terms: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
