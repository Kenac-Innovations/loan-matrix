import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  getTenantAutoDisbursementRules,
  sanitizeTenantAutoDisbursementRulesInput,
  SUPPORTED_AUTO_DISBURSEMENT_DECISIONS,
} from "@/lib/tenant-auto-disbursement-rules";

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      rules: getTenantAutoDisbursementRules(
        (tenant.settings as Record<string, unknown> | null) || null
      ),
      supportedDecisions: SUPPORTED_AUTO_DISBURSEMENT_DECISIONS,
    });
  } catch (error) {
    console.error("Error fetching auto-disbursement rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch auto-disbursement rules" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!Array.isArray(body?.rules)) {
      return NextResponse.json(
        { error: "Rules array is required" },
        { status: 400 }
      );
    }

    const rules = sanitizeTenantAutoDisbursementRulesInput(body.rules);
    if (body.rules.length > 0 && rules.length !== body.rules.length) {
      return NextResponse.json(
        {
          error:
            "Each rule must include a loan product, trigger stage, and at least one valid CDE decision.",
        },
        { status: 400 }
      );
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      autoProgressToDisbursementRules: rules,
    };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: updatedSettings },
    });

    return NextResponse.json({
      success: true,
      rules,
      supportedDecisions: SUPPORTED_AUTO_DISBURSEMENT_DECISIONS,
    });
  } catch (error) {
    console.error("Error updating auto-disbursement rules:", error);
    return NextResponse.json(
      { error: "Failed to update auto-disbursement rules" },
      { status: 500 }
    );
  }
}
