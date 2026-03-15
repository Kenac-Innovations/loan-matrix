import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

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

    const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
    });

    if (!lead) {
      console.error("Lead not found:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    // Store loan terms in stateMetadata
    const currentMetadata = (lead.stateMetadata as any) || {};
    const updatedMetadata = {
      ...currentMetadata,
      loanTerms: {
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
        // Include charges in saved loan terms
        charges: data.charges || [],
      },
    };
    
    console.log("Saving loan terms with charges:", data.charges);

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        stateMetadata: updatedMetadata,
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

    const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        stateMetadata: true,
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

    console.log("Found loan terms data:", loanTerms);

    return NextResponse.json({
      success: true,
      data: loanTerms,
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
