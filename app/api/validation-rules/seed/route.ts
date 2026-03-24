import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";

const DEFAULT_TAB_RULES = [
  // --- Details Tab ---
  {
    name: "Client name",
    description: "First name and last name must be provided",
    tab: "details",
    order: 1,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [
        { field: "firstname", operator: "isNotEmpty" },
        { field: "lastname", operator: "isNotEmpty" },
      ],
    },
    actions: {
      onPass: { message: "Name provided" },
      onFail: { message: "First name and last name required" },
    },
  },
  {
    name: "Date of birth",
    description: "Date of birth must be set",
    tab: "details",
    order: 2,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [{ field: "dateOfBirth", operator: "isNotEmpty" }],
    },
    actions: {
      onPass: { message: "Date of birth set" },
      onFail: { message: "Date of birth required" },
    },
  },
  {
    name: "Phone number",
    description: "A valid phone number must be provided",
    tab: "details",
    order: 3,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [{ field: "mobileNo", operator: "isNotEmpty" }],
    },
    actions: {
      onPass: { message: "Phone number provided" },
      onFail: { message: "Phone number required" },
    },
  },
  {
    name: "NRC / External ID",
    description: "National registration card or external ID required",
    tab: "details",
    order: 4,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [{ field: "externalId", operator: "isNotEmpty" }],
    },
    actions: {
      onPass: { message: "ID number provided" },
      onFail: { message: "NRC or external ID required" },
    },
  },
  {
    name: "Requested amount",
    description: "Loan amount must be specified",
    tab: "details",
    order: 5,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [{ field: "requestedAmount", operator: "greaterThan", value: 0 }],
    },
    actions: {
      onPass: { message: "Loan amount specified" },
      onFail: { message: "Requested loan amount required" },
    },
  },
  {
    name: "Loan product",
    description: "A loan product must be selected",
    tab: "details",
    order: 6,
    severity: "warning",
    conditions: {
      type: "OR",
      rules: [
        { field: "loanProductId", operator: "isNotEmpty" },
        { field: "loanProductName", operator: "isNotEmpty" },
      ],
    },
    actions: {
      onPass: { message: "Loan product selected" },
      onFail: { message: "Loan product required" },
    },
  },

  // --- Documents Tab ---
  {
    name: "Required documents uploaded",
    description: "All required documents must be uploaded",
    tab: "documents",
    order: 1,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [{ field: "requiredDocuments", operator: "allUploaded" }],
    },
    actions: {
      onPass: { message: "All required documents uploaded" },
      onFail: { message: "Some required documents are missing" },
    },
  },

  // --- Communication Tab ---
  {
    name: "Contacted borrower",
    description: "Communication with the borrower must be recorded",
    tab: "communication",
    order: 1,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [{ field: "communications", operator: "hasContactPerson", value: "BORROWER" }],
    },
    actions: {
      onPass: { message: "Borrower contacted" },
      onFail: { message: "No communication with borrower recorded" },
    },
  },
  {
    name: "Contacted guarantor",
    description: "Communication with the guarantor must be recorded",
    tab: "communication",
    order: 2,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [{ field: "communications", operator: "hasContactPerson", value: "GUARANTOR" }],
    },
    actions: {
      onPass: { message: "Guarantor contacted" },
      onFail: { message: "No communication with guarantor recorded" },
    },
  },
  {
    name: "Contacted reference",
    description: "Communication with a reference must be recorded",
    tab: "communication",
    order: 3,
    severity: "warning",
    conditions: {
      type: "AND",
      rules: [{ field: "communications", operator: "hasContactPerson", value: "REFERENCE" }],
    },
    actions: {
      onPass: { message: "Reference contacted" },
      onFail: { message: "No communication with reference recorded" },
    },
  },

  // --- Appraisal Tab ---
  {
    name: "Collateral items recorded",
    description: "At least one collateral item must be recorded",
    tab: "appraisal",
    order: 1,
    severity: "error",
    conditions: {
      type: "AND",
      rules: [{ field: "appraisal", operator: "hasMinimumCount", value: 1 }],
    },
    actions: {
      onPass: { message: "Collateral items recorded" },
      onFail: { message: "No collateral items recorded" },
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    if (!force) {
      const existing = await prisma.validationRule.count({
        where: { tenantId: tenant.id, tab: { not: null } },
      });
      if (existing > 0) {
        return NextResponse.json({
          message: `${existing} tab validation rules already exist. Use ?force=true to replace them.`,
          count: existing,
        });
      }
    }

    if (force) {
      await prisma.validationRule.deleteMany({
        where: { tenantId: tenant.id, tab: { not: null } },
      });
    }

    const created = await prisma.validationRule.createMany({
      data: DEFAULT_TAB_RULES.map((rule) => ({
        tenantId: tenant.id,
        name: rule.name,
        description: rule.description,
        tab: rule.tab,
        order: rule.order,
        severity: rule.severity,
        enabled: true,
        conditions: rule.conditions,
        actions: rule.actions,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Created ${created.count} default tab validation rules`,
      count: created.count,
    });
  } catch (error) {
    console.error("Error seeding validation rules:", error);
    return NextResponse.json(
      { error: "Failed to seed validation rules" },
      { status: 500 }
    );
  }
}
