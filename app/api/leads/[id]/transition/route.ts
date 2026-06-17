import { NextRequest, NextResponse } from "next/server";
import { TeamAwareStateMachineService } from "@/lib/team-state-machine-service";
import { getSession as getCustomSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyLeadVisibilityScope,
  getDisbursementBlockReason,
  getLeadViewerAccessContext,
} from "@/lib/lead-policy";
import { getLeadMovePermissionDenial } from "@/lib/lead-transition-permissions";

async function getTransitionPermissionDenial(input: {
  tenantId: string;
  currentStageId: string | null;
  assignedToUserId: number | null;
  currentUserId: string;
  canManageLead: boolean;
}) {
  if (!input.currentStageId) {
    return "This lead is not in a workflow stage and cannot be moved.";
  }

  const currentStageTeamPermission =
    await TeamAwareStateMachineService.checkTeamPermissions(
      input.currentStageId,
      input.tenantId,
      input.currentUserId
    );

  return getLeadMovePermissionDenial({
    currentUserId: input.currentUserId,
    assignedToUserId: input.assignedToUserId,
    isUserInCurrentStageTeam: currentStageTeamPermission.canTransition,
    canManageLead: input.canManageLead,
  });
}

/**
 * POST /api/leads/[id]/transition
 * Transition a lead to a new stage (by stage name for backward compat, or by stageId)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    const session = await getCustomSession();

    if (!session?.user?.id || !session.user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leadRecord = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        tenantId: true,
        fineractClientId: true,
      },
    });

    if (!leadRecord) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const leadAccess = await getLeadViewerAccessContext(
      leadRecord.tenantId,
      session.user.userId ?? null
    );
    const accessibleLead = await prisma.lead.findFirst({
      where: applyLeadVisibilityScope(
        {
          id: leadId,
          tenantId: leadRecord.tenantId,
        },
        leadAccess.visibleOfficeIds
      ),
      select: {
        tenantId: true,
        fineractClientId: true,
        currentStageId: true,
        assignedToUserId: true,
      },
    });

    if (!accessibleLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const permissionDenial = await getTransitionPermissionDenial({
      tenantId: accessibleLead.tenantId,
      currentStageId: accessibleLead.currentStageId,
      assignedToUserId: accessibleLead.assignedToUserId,
      currentUserId: session.user.id,
      canManageLead: true,
    });

    if (permissionDenial) {
      return NextResponse.json(
        { success: false, error: permissionDenial, message: permissionDenial },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      targetStageName,
      targetStageId,
      reason,
      fineractOverrides,
      overrideValidations,
      overrideReason,
    } = body;

    if (!targetStageName && !targetStageId) {
      return NextResponse.json(
        { error: "targetStageName or targetStageId is required" },
        { status: 400 }
      );
    }

    if (overrideValidations && !overrideReason?.trim()) {
      return NextResponse.json(
        { error: "Override reason is required when overriding validations" },
        { status: 400 }
      );
    }

    let resolvedStageId = targetStageId;

    if (!resolvedStageId && targetStageName) {
      const stage = await prisma.pipelineStage.findFirst({
        where: {
          tenantId: accessibleLead.tenantId,
          name: targetStageName,
          isActive: true,
        },
      });

      if (!stage) {
        return NextResponse.json(
          { error: `Stage "${targetStageName}" not found` },
          { status: 404 }
        );
      }

      resolvedStageId = stage.id;
    }

    // Check required documents before allowing transition
    let overriddenDocs: string[] = [];
    const leadForDocs = accessibleLead;

    if (leadForDocs) {
      const requiredDocs = await prisma.requiredDocument.findMany({
        where: { tenantId: leadForDocs.tenantId, isActive: true, isRequired: true },
      });

      if (requiredDocs.length > 0) {
        const localDocs = await prisma.leadDocument.findMany({
          where: { leadId },
          select: { name: true, category: true },
        });

        let fineractDocs: { name: string }[] = [];
        if (leadForDocs.fineractClientId) {
          try {
            const { fetchFineractAPI } = await import("@/lib/api");
            const clientDocs = await fetchFineractAPI(
              `/clients/${leadForDocs.fineractClientId}/documents`
            );
            const docs = Array.isArray(clientDocs) ? clientDocs : clientDocs?.pageItems || [];
            fineractDocs = docs.map((d: { name?: string; fileName?: string }) => ({
              name: d.name || d.fileName || "",
            }));
          } catch {
            // If Fineract is unreachable, just check local docs
          }
        }

        const allDocs = [
          ...localDocs.map((d) => ({ name: d.name, category: d.category })),
          ...fineractDocs.map((d) => ({ name: d.name, category: "" })),
        ];

        const missingDocs = requiredDocs.filter((req) => {
          const target = req.name.toLowerCase();
          return !allDocs.some(
            (d) => d.name.toLowerCase().includes(target)
          );
        });

        if (missingDocs.length > 0) {
          if (!overrideValidations) {
            return NextResponse.json(
              {
                success: false,
                message: `Missing required documents: ${missingDocs.map((d) => d.name).join(", ")}`,
                missingDocuments: missingDocs.map((d) => ({
                  name: d.name,
                  category: d.category,
                })),
              },
              { status: 400 }
            );
          }
          overriddenDocs = missingDocs.map((d) => d.name);
        }
      }
    }

    // Build the reason with override context
    const overrideNote = overriddenDocs.length > 0
      ? `[VALIDATION OVERRIDE] Missing documents: ${overriddenDocs.join(", ")}. Override reason: ${overrideReason}`
      : null;

    const combinedReason = [reason, overrideNote].filter(Boolean).join("\n\n");

    const result = await TeamAwareStateMachineService.executeTransition({
      leadId,
      targetStageId: resolvedStageId,
      event: "MANUAL_TRANSITION",
      triggeredBy: session.user.id,
      reason: combinedReason || undefined,
      fineractOverrides,
    });

    // Post override to Fineract notes if there was an override
    if (overrideNote && result.success && leadForDocs?.fineractClientId) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { fineractLoanId: true },
        });
        if (lead?.fineractLoanId) {
          const { fetchFineractAPI } = await import("@/lib/api");
          await fetchFineractAPI(
            `/loans/${lead.fineractLoanId}/notes`,
            { method: "POST", body: JSON.stringify({ note: overrideNote }) }
          );
        }
      } catch {
        // Non-blocking — override still proceeds
      }
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        newStage: result.lead?.currentStageId,
        stageName: result.lead?.currentStage?.name,
        message: result.message,
        assignedMember: result.assignedMember,
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in transition endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to transition lead",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/[id]/transition
 * Get available transitions for a lead with team context
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    const session = await getCustomSession();

    if (!session?.user?.id || !session.user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leadRecord = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        tenantId: true,
        designatedDisburserUserId: true,
        designatedDisburserUserName: true,
      },
    });

    if (!leadRecord) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const leadAccess = await getLeadViewerAccessContext(
      leadRecord.tenantId,
      session.user.userId ?? null
    );
    const accessibleLead = await prisma.lead.findFirst({
      where: applyLeadVisibilityScope(
        {
          id: leadId,
          tenantId: leadRecord.tenantId,
        },
        leadAccess.visibleOfficeIds
      ),
      select: {
        tenantId: true,
        currentStageId: true,
        assignedToUserId: true,
        assignedToUserName: true,
        designatedDisburserUserId: true,
        designatedDisburserUserName: true,
      },
    });

    if (!accessibleLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const permissionDenial = await getTransitionPermissionDenial({
      tenantId: accessibleLead.tenantId,
      currentStageId: accessibleLead.currentStageId,
      assignedToUserId: accessibleLead.assignedToUserId,
      currentUserId: session.user.id,
      canManageLead: true,
    });

    if (permissionDenial) {
      return NextResponse.json(
        { success: false, error: permissionDenial, message: permissionDenial },
        { status: 403 }
      );
    }

    const transitions =
      await TeamAwareStateMachineService.getAvailableTransitionsWithTeams(
        leadId,
        session.user.id
      );

    return NextResponse.json({
      transitions,
      disbursementPolicy: {
        onlyOriginatorCanDisburse: leadAccess.flags.onlyOriginatorCanDisburse,
        canOverrideInitiatorDisbursement:
          leadAccess.canOverrideInitiatorDisbursement,
        designatedDisburserUserId: accessibleLead.designatedDisburserUserId,
        designatedDisburserUserName: accessibleLead.designatedDisburserUserName,
        assignedToUserId: accessibleLead.assignedToUserId,
        assignedToUserName: accessibleLead.assignedToUserName,
        blockReason: getDisbursementBlockReason({
          onlyOriginatorCanDisburse:
            leadAccess.flags.onlyOriginatorCanDisburse,
          designatedDisburserUserId: accessibleLead.designatedDisburserUserId,
          designatedDisburserUserName: accessibleLead.designatedDisburserUserName,
          assignedToUserId: accessibleLead.assignedToUserId,
          assignedToUserName: accessibleLead.assignedToUserName,
          currentFineractUserId: session.user.userId ?? null,
        }),
      },
    });
  } catch (error) {
    console.error("Error getting available transitions:", error);
    return NextResponse.json(
      {
        error: "Failed to get available transitions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
