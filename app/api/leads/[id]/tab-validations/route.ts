import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { fetchFineractAPI } from "@/lib/api";
import { ValidationEngine, EvaluationContext } from "@/lib/validation-engine";
import { ValidationRule } from "@/shared/types/validation";

interface TabCheck {
  id: string;
  label: string;
  passed: boolean;
  message: string;
  severity?: string;
  suggestedAction?: string;
}

interface TabValidation {
  tab: string;
  passed: boolean;
  checks: TabCheck[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId, tenantId: tenant.id },
      include: {
        currentStage: true,
        documents: true,
        communications: true,
        familyMembers: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const requiredDocs = await prisma.requiredDocument.findMany({
      where: { tenantId: tenant.id, isActive: true, isRequired: true },
    });

    // Fetch Fineract loan, client, documents, and appraisal data in parallel
    let appraisalRows: any[] = [];
    let appraisalHeaders: any[] = [];
    let fineractLoan: any = null;
    let fineractClient: any = null;
    let fineractClientDocs: any[] = [];

    const fineractFetches: Promise<void>[] = [];

    if (lead.fineractClientId) {
      fineractFetches.push(
        fetchFineractAPI(
          `/datatables/${encodeURIComponent("Proposed Security")}/${lead.fineractClientId}?genericResultSet=true`,
          { cache: "no-store" }
        )
          .then((data) => { appraisalRows = data?.data || []; appraisalHeaders = data?.columnHeaders || []; })
          .catch(() => {})
      );

      fineractFetches.push(
        fetchFineractAPI(`/clients/${lead.fineractClientId}`, { cache: "no-store" })
          .then((data) => { fineractClient = data; })
          .catch(() => {})
      );

      fineractFetches.push(
        fetchFineractAPI(`/clients/${lead.fineractClientId}/documents`, { cache: "no-store" })
          .then((data) => {
            fineractClientDocs = Array.isArray(data) ? data : data?.pageItems || [];
          })
          .catch(() => {})
      );
    }

    // Fetch loan by fineractLoanId or by external ID
    if (lead.fineractLoanId) {
      fineractFetches.push(
        fetchFineractAPI(
          `/loans/${lead.fineractLoanId}?associations=all&exclude=guarantors,futureSchedule`,
          { cache: "no-store" }
        )
          .then((data) => { fineractLoan = data; })
          .catch(() => {})
      );
    } else {
      fineractFetches.push(
        fetchFineractAPI(`/loans?externalId=${encodeURIComponent(leadId)}`, { cache: "no-store" })
          .then((data) => {
            const loans = Array.isArray(data) ? data : data?.pageItems || [];
            fineractLoan = loans.find((l: any) => l.externalId === leadId) || null;
          })
          .catch(() => {})
      );
    }

    await Promise.all(fineractFetches);

    // Merge Fineract data onto lead so validation rules can access it
    const enrichedLead = {
      ...lead,
      requestedAmount:
        lead.requestedAmount ||
        fineractLoan?.approvedPrincipal ||
        fineractLoan?.principal ||
        null,
      fineractLoanStatus: fineractLoan?.status?.value || null,
      fineractLoanId: fineractLoan?.id || lead.fineractLoanId || null,
      fineractLoanAccountNo: fineractLoan?.accountNo || null,
      fineractPrincipal: fineractLoan?.principal || null,
      fineractApprovedPrincipal: fineractLoan?.approvedPrincipal || null,
      fineractDisbursedAmount: fineractLoan?.summary?.principalDisbursed || null,
      fineractCurrency: fineractLoan?.currency?.code || null,
      fineractLoanProductName: fineractLoan?.loanProductName || null,
      loanProductName: lead.loanProductName || fineractLoan?.loanProductName || null,
      loanProductId: lead.loanProductId || fineractLoan?.loanProductId || null,
      collateralValue: lead.collateralValue || null,
      fineractClientDisplayName: fineractClient?.displayName || null,
    };

    // Fetch configurable validation rules with tab assigned
    const dbRules = await prisma.validationRule.findMany({
      where: {
        tenantId: tenant.id,
        enabled: true,
        tab: { not: null },
      },
      orderBy: { order: "asc" },
    });

    // Combine local DB documents with Fineract client documents
    const allDocuments = [
      ...(lead.documents || []),
      ...fineractClientDocs,
    ];

    const ctx: EvaluationContext = {
      leadData: enrichedLead,
      documents: allDocuments,
      communications: lead.communications || [],
      appraisalRows,
      appraisalHeaders,
      requiredDocuments: requiredDocs,
    };

    // Group rules by tab
    const rulesByTab = new Map<string, typeof dbRules>();
    for (const rule of dbRules) {
      const tab = rule.tab!;
      if (!rulesByTab.has(tab)) rulesByTab.set(tab, []);
      rulesByTab.get(tab)!.push(rule);
    }

    const tabs: TabValidation[] = [];
    const allTabs = ["details", "documents", "communication", "appraisal", "notes"];

    for (const tabName of allTabs) {
      const tabRules = rulesByTab.get(tabName) || [];

      if (tabRules.length === 0) {
        tabs.push({
          tab: tabName,
          passed: true,
          checks: [
            {
              id: `${tabName}_none`,
              label: "No rules configured",
              passed: true,
              message: "No validation rules configured for this tab",
            },
          ],
        });
        continue;
      }

      const transformedRules: ValidationRule[] = tabRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description || "",
        conditions: rule.conditions as any,
        actions: rule.actions as any,
        severity: rule.severity as "info" | "warning" | "error",
        enabled: rule.enabled,
        order: rule.order,
        pipelineStageId: rule.pipelineStageId,
        tab: rule.tab,
      }));

      const results = ValidationEngine.evaluateAllRules(
        transformedRules,
        enrichedLead,
        allDocuments,
        ctx
      );

      const checks: TabCheck[] = results.map((r) => ({
        id: r.id,
        label: r.name,
        passed: r.status === "passed",
        message: r.message || r.description,
        severity: r.severity,
        suggestedAction: r.suggestedAction,
      }));

      tabs.push({
        tab: tabName,
        passed: checks.every((c) => c.passed),
        checks,
      });
    }

    // Overall validations tab
    const allChecks = tabs.flatMap((t) => t.checks);
    const totalPassed = allChecks.filter((c) => c.passed).length;
    tabs.push({
      tab: "validations",
      passed: allChecks.every((c) => c.passed),
      checks: [
        {
          id: "overall",
          label: "All validations",
          passed: allChecks.every((c) => c.passed),
          message: `${totalPassed}/${allChecks.length} checks passed`,
        },
      ],
    });

    return NextResponse.json({ tabs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error evaluating tab validations:", error);
    return NextResponse.json(
      { error: "Failed to evaluate tab validations" },
      { status: 500 }
    );
  }
}
