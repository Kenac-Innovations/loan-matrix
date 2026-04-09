import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { isInvoiceDiscountingEnabled } from "@/lib/tenant-features";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("Saving loan details for leadId:", leadId);

    const data = await request.json();
    console.log("=== API RECEIVED DATA ===");
    console.log("Full data object:", JSON.stringify(data, null, 2));
    console.log("productName:", data.productName);
    console.log("productId:", data.productId);
    console.log("loanPurpose:", data.loanPurpose);
    console.log("loanOfficer:", data.loanOfficer);
    console.log("fund:", data.fund);
    console.log("=== END API DATA ===");

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get the lead first
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

    // Update the lead with loan details
    console.log("Updating lead with data:", data);
    console.log("ProductId from request:", data.productId);

    const productId =
      data.productId && data.productId !== ""
        ? parseInt(data.productId, 10)
        : null;

    console.log("Parsed productId:", productId);

    // Get current stateMetadata
    const currentMetadata = (lead.stateMetadata as any) || {};

    if (
      data.facilityType === "INVOICE_DISCOUNTING" &&
      !isInvoiceDiscountingEnabled(tenant.settings)
    ) {
      return NextResponse.json(
        { success: false, error: "Invoice discounting is disabled for this tenant" },
        { status: 403 }
      );
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        facilityType: data.facilityType || undefined,
        loanProductName: data.productName || null,
        loanProductId: productId,
        loanPurpose: data.loanPurposeName || null,
        loanPurposeId: data.loanPurpose ? parseInt(data.loanPurpose) : null,
        loanOfficerId: data.loanOfficer ? parseInt(data.loanOfficer) : null,
        fundId: data.fund ? parseInt(data.fund) : null,
        submittedOnDate: data.submittedOn ? new Date(data.submittedOn) : null,
        expectedDisbursementDate: data.disbursementOn
          ? new Date(data.disbursementOn)
          : null,
        linkSavingsAccount: data.linkSavings || null,
        createStandingInstructions: data.createStandingInstructions || false,
        stateMetadata: {
          ...currentMetadata,
          firstRepaymentOn: data.firstRepaymentOn || null,
        },
        lastModified: new Date(),
      },
    });

    console.log("Successfully updated lead with loan details:", updatedLead.id);

    return NextResponse.json({
      success: true,
      lead: updatedLead,
    });
  } catch (error) {
    console.error("Error saving loan details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to save loan details: ${errorMessage}`,
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
    console.log("GET loan details for leadId:", leadId);

    // Fetch lead data with loan details
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        facilityType: true,
        loanProductName: true,
        loanProductId: true,
        loanPurpose: true,
        loanPurposeId: true,
        loanOfficerId: true,
        fundId: true,
        submittedOnDate: true,
        expectedDisbursementDate: true,
        linkSavingsAccount: true,
        createStandingInstructions: true,
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

    console.log("Found lead loan details:", lead);

    const metadata = (lead.stateMetadata as any) || {};
    const firstRepaymentOn = metadata.firstRepaymentOn
      ? new Date(metadata.firstRepaymentOn).toISOString()
      : null;

    return NextResponse.json({
      success: true,
      data: {
        facilityType: lead.facilityType || "TERM_LOAN",
        productName: lead.loanProductName || "",
        productId: lead.loanProductId?.toString() || "",
        loanPurpose: lead.loanPurposeId?.toString() || "",
        loanPurposeName: lead.loanPurpose || "",
        loanOfficer: lead.loanOfficerId?.toString() || "",
        fund: lead.fundId?.toString() || "",
        submittedOn: lead.submittedOnDate
          ? new Date(lead.submittedOnDate).toISOString()
          : null,
        disbursementOn: lead.expectedDisbursementDate
          ? new Date(lead.expectedDisbursementDate).toISOString()
          : null,
        firstRepaymentOn: firstRepaymentOn,
        linkSavings: lead.linkSavingsAccount || "",
        createStandingInstructions: lead.createStandingInstructions || false,
      },
    });
  } catch (error) {
    console.error("Error fetching loan details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch loan details: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
