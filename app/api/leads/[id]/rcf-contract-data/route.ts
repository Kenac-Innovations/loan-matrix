import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { fetchFineractAPI } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { extractTenantSlugFromRequest, getTenantBySlug } from "@/lib/tenant-service";
import type { RcfContractData } from "@/app/(application)/leads/new/components/rcf-contract-types";

function parseFineractDate(value: string | number[] | null | undefined): Date | null {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 3) {
    return new Date(Date.UTC(value[0], value[1] - 1, value[2]));
  }
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await context.params;
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        firstname: true,
        middlename: true,
        lastname: true,
        dateOfBirth: true,
        gender: true,
        mobileNo: true,
        officeName: true,
        requestedAmount: true,
        fineractClientId: true,
        fineractSavingsAccountId: true,
        savingsProductId: true,
        stateMetadata: true,
        stateContext: true,
        facilityType: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.facilityType !== "REVOLVING_CREDIT") {
      return NextResponse.json(
        { error: "This lead is not a revolving credit facility" },
        { status: 400 }
      );
    }

    const facility = await prisma.revolvingCreditFacility.findUnique({
      where: { leadId },
      include: { drawdowns: { include: { repayments: true } } },
    });

    const meta = (lead.stateMetadata as Record<string, any>) || {};

    // ── Client data from Fineract (authoritative source) ──────────────────────
    let clientName = [lead.firstname, lead.middlename, lead.lastname].filter(Boolean).join(" ") || "N/A";
    let dateOfBirth = lead.dateOfBirth ? format(lead.dateOfBirth, "dd/MM/yyyy") : "N/A";
    let gender = lead.gender || "N/A";
    let mobileNo = lead.mobileNo || "N/A";
    let nationalId =
      (lead.stateContext as Record<string, any>)?.nationalIdOrPassport ||
      meta.nationalId || "";
    let branch = lead.officeName || tenant?.name || "Branch";

    if (lead.fineractClientId) {
      try {
        const fc = await fetchFineractAPI(`/clients/${lead.fineractClientId}`);
        if (fc.displayName) clientName = fc.displayName;
        const dob = parseFineractDate(fc.dateOfBirth);
        if (dob) dateOfBirth = format(dob, "dd/MM/yyyy");
        if (fc.gender?.value) gender = fc.gender.value;
        if (fc.mobileNo) mobileNo = fc.mobileNo;
        if (fc.externalId) nationalId = fc.externalId;
        if (fc.officeName) branch = fc.officeName;
      } catch {
        // fall through with lead DB values
      }
    }

    // ── Currency: savings account (post-activation) or product (pre-activation) ─
    let currency = "ZMW";
    let currencySymbol = "K";
    let accountNo = "Pending activation";
    let availableBalance = lead.requestedAmount ?? 0;
    const creditLimit = facility?.creditLimit ?? lead.requestedAmount ?? 0;
    const maxDrawdowns: number = facility?.maxDrawdowns ?? meta.maxDrawdowns ?? 10;
    const activationDate = facility?.activatedAt ?? new Date();

    if (facility?.fineractSavingsAccountId) {
      // Post-activation — fetch live savings account data
      try {
        const sa = await fetchFineractAPI(`/savingsaccounts/${facility.fineractSavingsAccountId}`);
        accountNo = sa.accountNo || accountNo;
        availableBalance = sa.summary?.availableBalance ?? availableBalance;
        currency = sa.currency?.code || currency;
        currencySymbol = sa.currency?.displaySymbol || sa.currency?.code || currencySymbol;
      } catch {
        // fall through
      }
    } else if (lead.savingsProductId) {
      // Pre-activation — fetch currency from savings product
      try {
        const sp = await fetchFineractAPI(`/savingsproducts/${lead.savingsProductId}`);
        currency = sp.currency?.code || currency;
        currencySymbol = sp.currency?.displaySymbol || sp.currency?.code || currencySymbol;
      } catch {
        // fall through
      }
    }

    // ── Drawdown summary ──────────────────────────────────────────────────────
    const drawdowns = (facility as any)?.drawdowns ?? [];
    const totalDisbursed = drawdowns.reduce(
      (sum: number, d: any) => sum + (d.disbursedAmount ?? d.approvedAmount ?? d.requestedAmount ?? 0),
      0
    );
    const totalRepaid = drawdowns.reduce((sum: number, d: any) => {
      const reps: any[] = d.repayments ?? [];
      return sum + reps.reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    }, 0);
    const utilizedAmount = Math.max(0, totalDisbursed - totalRepaid);

    const now = new Date();
    const contractData: RcfContractData = {
      clientName,
      dateOfBirth,
      gender,
      mobileNo,
      nationalId,

      accountNo,
      creditLimit,
      availableBalance,
      utilizedAmount,
      tenorMonths: meta.tenorMonths ?? null,
      nominalInterestRate: meta.nominalInterestRate ?? null,
      maxDrawdowns,
      activationDate: format(activationDate, "dd MMMM yyyy"),

      drawdownSummary: { count: drawdowns.length, totalDisbursed, totalRepaid },

      branch,
      currency,
      currencySymbol,
      lenderName: tenant?.name || "Lender",
      fieldOfficerName: meta.fieldOfficerName ?? null,

      executionDate: format(now, "dd MMMM yyyy"),
      executionDay: format(now, "d"),
      executionMonth: format(now, "MMMM"),
      executionYear: format(now, "yyyy"),
    };

    return NextResponse.json({ success: true, data: contractData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch RCF contract data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
