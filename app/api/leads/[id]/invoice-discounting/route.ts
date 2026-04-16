import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isInvoiceDiscountingEnabled } from "@/lib/tenant-features";

type LeadStateMetadata = {
  loanTerms?: Record<string, unknown>;
  invoiceDiscountingSummary?: Record<string, unknown>;
  [key: string]: unknown;
};

const invoiceRowSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  grossAmount: z.coerce.number().positive("Gross amount must be greater than 0"),
  currencyCode: z.string().optional(),
  fineractDocumentId: z.string().optional(),
});

const invoiceDiscountingPayloadSchema = z.object({
  debtorName: z.string().min(1, "Debtor name is required"),
  debtorRegistrationNumber: z.string().optional(),
  debtorTaxId: z.string().optional(),
  debtorContactName: z.string().optional(),
  debtorContactPhone: z.string().optional(),
  debtorContactEmail: z.string().optional(),
  advanceRate: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce
      .number()
      .min(0, "Advance rate cannot be negative")
      .max(100, "Advance rate cannot exceed 100")
  ),
  debtorTermsDays: z.coerce
    .number()
    .int("Debtor terms must be a whole number")
    .min(0, "Debtor terms cannot be negative")
    .optional(),
  notes: z.string().optional(),
  invoices: z.array(invoiceRowSchema).min(1, "At least one invoice is required"),
});

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function deriveInvoiceNumbers(row: z.infer<typeof invoiceRowSchema>, advanceRate: number) {
  const grossAmount = round2(row.grossAmount);
  const financedAmount = round2((grossAmount * advanceRate) / 100);
  const reserveAmount = round2(grossAmount - financedAmount);
  return {
    grossAmount,
    financedAmount,
    reserveAmount,
  };
}

async function getLeadWithTenant(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      tenantId: true,
      stateMetadata: true,
      tenant: {
        select: {
          settings: true,
        },
      },
      invoiceDiscountingCase: {
        include: {
          invoices: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const leadId = params.id;

    const lead = await getLeadWithTenant(leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!isInvoiceDiscountingEnabled(lead.tenant?.settings)) {
      return NextResponse.json(
        { error: "Invoice discounting is disabled for this tenant" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: lead.invoiceDiscountingCase || null,
    });
  } catch (error) {
    console.error("Error fetching invoice discounting data:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice discounting data" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const leadId = params.id;

    const lead = await getLeadWithTenant(leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!isInvoiceDiscountingEnabled(lead.tenant?.settings)) {
      return NextResponse.json(
        { error: "Invoice discounting is disabled for this tenant" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const payload = invoiceDiscountingPayloadSchema.parse(body);

    const invoicesWithDerived = payload.invoices.map((row, index) => {
      const derived = deriveInvoiceNumbers(row, payload.advanceRate);
      return {
        invoiceNumber: row.invoiceNumber.trim(),
        invoiceDate: row.invoiceDate,
        dueDate: row.dueDate,
        grossAmount: derived.grossAmount,
        eligibleAmount: null,
        financedAmount: derived.financedAmount,
        reserveAmount: derived.reserveAmount,
        currencyCode: row.currencyCode || null,
        fineractDocumentId: row.fineractDocumentId || null,
        status: "APPROVED" as const,
        sortOrder: index,
      };
    });

    const totals = invoicesWithDerived.reduce(
      (acc, row) => {
        acc.totalPresentedAmount += row.grossAmount;
        acc.totalFinancedAmount += row.financedAmount;
        acc.totalReserveAmount += row.reserveAmount;
        return acc;
      },
      {
        totalPresentedAmount: 0,
        totalFinancedAmount: 0,
        totalReserveAmount: 0,
      }
    );

    const result = await prisma.$transaction(async (tx) => {
      const invoiceCase = await tx.invoiceDiscountingCase.upsert({
        where: { leadId },
        update: {
          debtorName: payload.debtorName.trim(),
          debtorRegistrationNumber: payload.debtorRegistrationNumber || null,
          debtorTaxId: payload.debtorTaxId || null,
          debtorContactName: payload.debtorContactName || null,
          debtorContactPhone: payload.debtorContactPhone || null,
          debtorContactEmail: payload.debtorContactEmail || null,
          recourseType: null,
          advanceRate: payload.advanceRate,
          concentrationLimit: null,
          debtorTermsDays: payload.debtorTermsDays ?? null,
          reservePercent: null,
          notes: payload.notes || null,
          totalPresentedAmount: round2(totals.totalPresentedAmount),
          totalEligibleAmount: null,
          totalFinancedAmount: round2(totals.totalFinancedAmount),
          totalReserveAmount: round2(totals.totalReserveAmount),
        },
        create: {
          leadId,
          tenantId: lead.tenantId,
          debtorName: payload.debtorName.trim(),
          debtorRegistrationNumber: payload.debtorRegistrationNumber || null,
          debtorTaxId: payload.debtorTaxId || null,
          debtorContactName: payload.debtorContactName || null,
          debtorContactPhone: payload.debtorContactPhone || null,
          debtorContactEmail: payload.debtorContactEmail || null,
          recourseType: null,
          advanceRate: payload.advanceRate,
          concentrationLimit: null,
          debtorTermsDays: payload.debtorTermsDays ?? null,
          reservePercent: null,
          notes: payload.notes || null,
          totalPresentedAmount: round2(totals.totalPresentedAmount),
          totalEligibleAmount: null,
          totalFinancedAmount: round2(totals.totalFinancedAmount),
          totalReserveAmount: round2(totals.totalReserveAmount),
        },
        select: { id: true },
      });

      await tx.invoiceDiscountingInvoice.deleteMany({
        where: { caseId: invoiceCase.id },
      });

      if (invoicesWithDerived.length > 0) {
        await tx.invoiceDiscountingInvoice.createMany({
          data: invoicesWithDerived.map((row) => ({
            caseId: invoiceCase.id,
            tenantId: lead.tenantId,
            leadId,
            ...row,
          })),
        });
      }

      const currentMetadata =
        (lead.stateMetadata as LeadStateMetadata | null) || {};
      const currentLoanTerms = currentMetadata.loanTerms || {};
      const financedPrincipal = round2(totals.totalFinancedAmount);
      await tx.lead.update({
        where: { id: leadId },
        data: {
          facilityType: "INVOICE_DISCOUNTING",
          stateMetadata: {
            ...currentMetadata,
            loanTerms: {
              ...currentLoanTerms,
              principal: financedPrincipal,
            },
            invoiceDiscountingSummary: {
              debtorName: payload.debtorName.trim(),
              advanceRate: payload.advanceRate,
              invoiceCount: invoicesWithDerived.length,
              totals: {
                totalPresentedAmount: round2(totals.totalPresentedAmount),
                totalFinancedAmount: round2(totals.totalFinancedAmount),
                totalReserveAmount: round2(totals.totalReserveAmount),
              },
              updatedAt: new Date().toISOString(),
            },
          },
          lastModified: new Date(),
        },
      });

      return tx.invoiceDiscountingCase.findUnique({
        where: { leadId },
        include: {
          invoices: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error("Error saving invoice discounting data:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 }
      );
    }
    const message =
      error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray(error.issues)
        ? error.issues
            .map((issue) =>
              issue && typeof issue === "object" && "message" in issue
                ? String(issue.message)
                : "Unknown validation error"
            )
            .join(", ")
        : error instanceof Error
          ? error.message
          : "Failed to save invoice discounting data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
