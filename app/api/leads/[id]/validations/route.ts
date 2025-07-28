import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";
import { ValidationEngine } from "@/lib/validation-engine";

const prisma = new PrismaClient();

interface ValidationResult {
  id: string;
  name: string;
  description: string;
  status: "passed" | "failed" | "warning";
  message?: string;
  suggestedAction?: string;
  actionUrl?: string;
  severity: "info" | "warning" | "error";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch the lead with its current stage and tenant info
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
        tenantId: tenant.id,
      },
      include: {
        currentStage: true,
        documents: true,
        familyMembers: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Fetch validation rules for the current stage and tenant
    const validationRules = await prisma.validationRule.findMany({
      where: {
        tenantId: lead.tenantId,
        enabled: true,
        OR: [
          { pipelineStageId: lead.currentStageId },
          { pipelineStageId: null }, // Global rules
        ],
      },
      orderBy: { order: "asc" },
    });

    // Transform database rules to ValidationEngine format
    const transformedRules = validationRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || "",
      conditions: rule.conditions as any,
      actions: rule.actions as any,
      severity: rule.severity as "info" | "warning" | "error",
      enabled: rule.enabled,
      order: rule.order,
      pipelineStageId: rule.pipelineStageId,
    }));

    // Use the ValidationEngine to evaluate all rules
    const validationResults = ValidationEngine.evaluateAllRules(
      transformedRules,
      lead,
      lead.documents
    );

    // Update action URLs to include the lead ID
    const updatedResults = validationResults.map((result) => ({
      ...result,
      actionUrl: result.actionUrl
        ? `/leads/${leadId}${result.actionUrl}`
        : undefined,
    }));

    // Calculate summary statistics using the ValidationEngine
    const summary = ValidationEngine.calculateSummary(updatedResults);

    return NextResponse.json({
      validations: updatedResults,
      summary,
      leadInfo: {
        id: lead.id,
        name: `${lead.firstname || ""} ${lead.lastname || ""}`.trim(),
        currentStage: lead.currentStage?.name || "Not assigned",
        status: lead.status,
      },
    });
  } catch (error) {
    console.error("Error fetching lead validations:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead validations" },
      { status: 500 }
    );
  }
}
