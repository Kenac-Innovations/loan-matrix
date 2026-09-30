import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasSuperAdminServer } from "@/lib/authorization";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  getInvalidTenantUssdLoanChargeIds,
  getTenantUssdAutoLeadRules,
  SALARY_ADVANCE_LOAN_PRODUCT_ID,
  sanitizeTenantUssdAutoLeadRulesInput,
} from "@/lib/tenant-ussd-auto-lead-rules";

export async function GET() {
  try {
    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      rules: getTenantUssdAutoLeadRules(
        tenant.settings as unknown as Record<string, unknown> | null
      ),
    });
  } catch (error) {
    console.error("Error fetching USSD auto-lead rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch USSD auto-lead rules" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    if (!Array.isArray(body?.rules)) {
      return NextResponse.json(
        { error: "Rules array is required" },
        { status: 400 }
      );
    }

    const rules = sanitizeTenantUssdAutoLeadRulesInput(body.rules);
    if (body.rules.length > 0 && rules.length !== body.rules.length) {
      return NextResponse.json(
        {
          error: "Each rule must include a valid loan product.",
        },
        { status: 400 }
      );
    }

    const rulesWithChargeAttachments = rules.filter(
      (rule) => rule.loanChargeAttachment !== undefined
    );
    const nonSalaryAdvanceChargeRule = rulesWithChargeAttachments.find(
      (rule) => rule.loanProductId !== SALARY_ADVANCE_LOAN_PRODUCT_ID
    );

    if (nonSalaryAdvanceChargeRule) {
      return NextResponse.json(
        {
          error:
            "Loan charge attachments are supported only for Salary Advance (product 13).",
        },
        { status: 400 }
      );
    }

    const hasSelectedCharges = rules.some(
      (rule) => rule.loanChargeAttachment?.mode === "SELECTED"
    );

    if (hasSelectedCharges) {
      let chargePool: unknown;

      try {
        chargePool = await fetchFineractAPI("/charges", {
          method: "GET",
          cache: "no-store",
          authMode: "service",
        });
      } catch (error) {
        console.error("Error validating USSD auto-lead charge settings:", error);
        return NextResponse.json(
          { error: "Could not validate selected charges against Fineract" },
          { status: 502 }
        );
      }

      const invalidChargeIds = getInvalidTenantUssdLoanChargeIds(
        rules,
        chargePool
      );

      if (invalidChargeIds.length > 0) {
        return NextResponse.json(
          {
            error:
              "Selected charges must be active loan charges with a specified due date.",
            invalidChargeIds,
          },
          { status: 400 }
        );
      }
    }

    const currentSettings =
      (tenant.settings as unknown as Record<string, unknown> | null) || {};
    const updatedSettings = {
      ...currentSettings,
      ussdAutoLeadRules: rules,
    };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: updatedSettings as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error) {
    console.error("Error updating USSD auto-lead rules:", error);
    return NextResponse.json(
      { error: "Failed to update USSD auto-lead rules" },
      { status: 500 }
    );
  }
}
