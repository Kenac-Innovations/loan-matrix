import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractTenantSlugFromRequest,
  getTenantBySlug,
} from "@/lib/tenant-service";
import {
  formatFineractBusinessDate,
  isFineractBusinessDateAfter,
  normalizeFineractSubmittedOnDate,
} from "@/lib/fineract-business-date";

type RequestBody = {
  templateExpectedDisbursementDate?: unknown;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leadId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const tenant = await getTenantBySlug(extractTenantSlugFromRequest(request));

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        submittedOnDate: true,
        expectedDisbursementDate: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.submittedOnDate || !lead.expectedDisbursementDate) {
      return NextResponse.json(
        {
          error:
            "Submitted On and Expected Disbursement Date are required before generating a schedule.",
        },
        { status: 422 },
      );
    }

    const templateExpectedDisbursementDate =
      typeof body.templateExpectedDisbursementDate === "string" &&
      formatFineractBusinessDate(body.templateExpectedDisbursementDate)
        ? body.templateExpectedDisbursementDate
        : undefined;
    const normalizedSubmittedOn = normalizeFineractSubmittedOnDate(
      lead.submittedOnDate,
      lead.expectedDisbursementDate,
      templateExpectedDisbursementDate,
    );
    const wasCorrected = isFineractBusinessDateAfter(
      lead.submittedOnDate,
      normalizedSubmittedOn,
    );

    const normalizedLead = wasCorrected
      ? await prisma.lead.update({
          where: { id: leadId },
          data: {
            submittedOnDate: new Date(normalizedSubmittedOn as Date | string | number),
            lastModified: new Date(),
          },
          select: {
            submittedOnDate: true,
            expectedDisbursementDate: true,
          },
        })
      : lead;

    return NextResponse.json({
      success: true,
      corrected: wasCorrected,
      data: {
        submittedOn: normalizedLead.submittedOnDate.toISOString(),
        disbursementOn: normalizedLead.expectedDisbursementDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error normalizing lead schedule dates:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
