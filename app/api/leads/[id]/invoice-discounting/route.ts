import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isInvoiceDiscountingEnabled } from "@/lib/tenant-features";

const recourseTypeSchema = z.enum(["WITH_RECOURSE", "WITHOUT_RECOURSE"]);

const invoiceRowSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  grossAmount: z.coerce.number().positive("Gross amount must be greater than 0"),
  eligibleAmount: z.coerce.number().nonnegative().optional(),
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
  recourseType: recourseTypeSchema.default("WITH_RECOURSE"),
  advanceRate: z.coerce
    .number()
    .min(0, "Advance rate cannot be negative")
    .max(100, "Advance rate cannot exceed 100"),
  concentrationLimit: z.coerce
    .number()
    .min(0, "Concentration limit cannot be negative")
    .max(100, "Concentration limit cannot exceed 100")
    .optional(),
  debtorTermsDays: z.coerce
    .number()
    .int("Debtor terms must be a whole number")
    .min(0, "Debtor terms cannot be negative")
    .optional(),
  reservePercent: z.coerce
    .number()
    .min(0, "Reserve percent cannot be negative")
    .max(100, "Reserve percent cannot exceed 100")
    .optional(),
  notes: z.string().optional(),
  invoices: z.array(invoiceRowSchema).min(1, "At least one invoice is required"),
});

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function deriveInvoiceNumbers(row: z.infer<typeof invoiceRowSchema>, advanceRate: number) {
  const grossAmount = round2(row.grossAmount);
  const eligibleRaw = row.eligibleAmount == null ? grossAmount : row.eligibleAmount;
  const eligibleAmount = round2(Math.max(0, Math.min(eligibleRaw, grossAmount)));
  const financedAmount = round2((eligibleAmount * advanceRate) / 100);
  const reserveAmount = round2(eligibleAmount - financedAmount);
  return {
    grossAmount,
    eligibleAmount,
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
        eligibleAmount: derived.eligibleAmount,
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
        acc.totalEligibleAmount += row.eligibleAmount;
        acc.totalFinancedAmount += row.financedAmount;
        acc.totalReserveAmount += row.reserveAmount;
        return acc;
      },
      {
        totalPresentedAmount: 0,
        totalEligibleAmount: 0,
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
          recourseType: payload.recourseType,
          advanceRate: payload.advanceRate,
          concentrationLimit: payload.concentrationLimit ?? null,
          debtorTermsDays: payload.debtorTermsDays ?? null,
          reservePercent: payload.reservePercent ?? 0,
          notes: payload.notes || null,
          totalPresentedAmount: round2(totals.totalPresentedAmount),
          totalEligibleAmount: round2(totals.totalEligibleAmount),
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
          recourseType: payload.recourseType,
          advanceRate: payload.advanceRate,
          concentrationLimit: payload.concentrationLimit ?? null,
          debtorTermsDays: payload.debtorTermsDays ?? null,
          reservePercent: payload.reservePercent ?? 0,
          notes: payload.notes || null,
          totalPresentedAmount: round2(totals.totalPresentedAmount),
          totalEligibleAmount: round2(totals.totalEligibleAmount),
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

      const currentMetadata = (lead.stateMetadata as any) || {};
      await tx.lead.update({
        where: { id: leadId },
        data: {
          facilityType: "INVOICE_DISCOUNTING",
          stateMetadata: {
            ...currentMetadata,
            invoiceDiscountingSummary: {
              debtorName: payload.debtorName.trim(),
              recourseType: payload.recourseType,
              advanceRate: payload.advanceRate,
              invoiceCount: invoicesWithDerived.length,
              totals: {
                totalPresentedAmount: round2(totals.totalPresentedAmount),
                totalEligibleAmount: round2(totals.totalEligibleAmount),
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
  } catch (error: any) {
    console.error("Error saving invoice discounting data:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 }
      );
    }
    const message = error?.issues
      ? error.issues.map((issue: any) => issue.message).join(", ")
      : error?.message || "Failed to save invoice discounting data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
