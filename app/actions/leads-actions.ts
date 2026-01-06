"use server";

import { prisma } from "@/lib/prisma";
import {
  getOrCreateDefaultTenant,
  getTenantBySlug,
  getTenantFromHeaders,
} from "@/lib/tenant-service";
import { UssdLeadsMetrics, UssdLoanApplication } from "./ussd-leads-actions";
import { Lead, PipelineStage } from "@/shared/types/lead";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143";

export interface ConversionMetrics {
  labels: string[];
  conversionRates: number[];
}

export interface StageTATMetrics {
  stageId: string;
  stageName: string;
  avgTAT: number;
  slaTarget: number;
  variance: number;
}

export interface LeadMetrics {
  activeLeads: number;
  conversionRate: number;
  avgProcessingTime: number;
  slaCompliance: number;
  onTimeCount: number;
  atRiskCount: number;
  overdueCount: number;
  monthlyTarget: number;
  conversionTarget: number;
  processingTimeTarget: number;
  conversionMetrics: ConversionMetrics;
  stageTATMetrics: StageTATMetrics[];
}

// Tenant metric settings stored in tenant.settings JSON field
export interface TenantMetricSettings {
  monthlyTarget?: number;
  conversionTarget?: number;
  processingTimeTarget?: number;
}

// Default metric targets
const DEFAULT_METRIC_SETTINGS: Required<TenantMetricSettings> = {
  monthlyTarget: 50,
  conversionTarget: 75,
  processingTimeTarget: 10,
};

export interface LeadsData {
  leads: Lead[] | UssdLoanApplication[];
  pipelineStages: PipelineStage[];
  metrics: LeadMetrics | UssdLeadsMetrics;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export async function getLeadsData(
  tenantSlug: string = "goodfellow",
  options: {
    stage?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<LeadsData> {
  try {
    const { stage, status, limit = 50, offset = 0 } = options;

    // Get tenant - prefer headers for consistency with API routes
    let tenant = await getTenantFromHeaders();
    if (!tenant) {
      tenant = await getOrCreateDefaultTenant();
    }
    console.log(
      "==========> log on server side getLeadsData tenant ::",
      { id: tenant?.id, slug: (tenant as any)?.slug }
    );
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Build where clause
    const where: any = {
      tenantId: tenant.id,
    };

    if (stage) {
      where.currentStageId = stage;
    }

    if (status) {
      where.status = status;
    }

    // Get leads with related data
    const leads = await prisma.lead.findMany({
      where,
      include: {
        currentStage: true,
        stateTransitions: {
          orderBy: { triggeredAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get pipeline stages for this tenant
    const pipelineStages = await prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { order: "asc" },
    });

    // Get SLA configs for calculating time in stage
    const slaConfigs = await prisma.sLAConfig.findMany({
      where: { tenantId: tenant.id, enabled: true },
    });

    // Get team members for assignee information
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        team: {
          tenantId: tenant.id,
          isActive: true,
        },
        isActive: true,
      },
      include: {
        team: true,
      },
    });

    // Transform leads data for frontend
    const transformedLeads: Lead[] = leads.map((lead) => {
      const stageTransition = lead.stateTransitions[0];
      const timeInStage = stageTransition
        ? new Date().getTime() - new Date(stageTransition.triggeredAt).getTime()
        : new Date().getTime() - new Date(lead.createdAt).getTime();

      // Calculate time in stage in days and hours
      const days = Math.floor(timeInStage / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeInStage % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const timeInStageFormatted = `${days}d ${hours}h`;

      // Get SLA for current stage
      const stageSLA = slaConfigs.find(
        (sla) => sla.pipelineStageId === lead.currentStageId
      );

      let slaFormatted = "N/A";
      let slaStatus: "normal" | "warning" | "overdue" = "normal";

      if (stageSLA) {
        const slaTimeMs =
          stageSLA.timeframe *
          (stageSLA.timeUnit === "days"
            ? 24 * 60 * 60 * 1000
            : stageSLA.timeUnit === "hours"
            ? 60 * 60 * 1000
            : 60 * 1000);

        slaFormatted =
          stageSLA.timeUnit === "days"
            ? `${stageSLA.timeframe}d`
            : stageSLA.timeUnit === "hours"
            ? `${stageSLA.timeframe}h`
            : `${stageSLA.timeframe}m`;

        // Determine SLA status
        if (timeInStage > slaTimeMs) {
          slaStatus = "overdue";
        } else if (timeInStage > slaTimeMs * 0.8) {
          slaStatus = "warning";
        }
      }

      // Find assignee (for now, assign based on stage and team)
      const stageTeamMember = teamMembers.find((member) =>
        member.team.pipelineStageIds.includes(lead.currentStageId || "")
      );

      const assignee = stageTeamMember
        ? {
            initials: stageTeamMember.name
              .split(" ")
              .map((n) => n[0])
              .join(""),
            name: stageTeamMember.name,
            color: getColorForUser(stageTeamMember.userId),
          }
        : {
            initials: "UN",
            name: "Unassigned",
            color: "#6B7280",
          };

      // Get loan amount from actual lead data
      const stateMetadata = (lead.stateMetadata as any) || {};
      const loanTerms = stateMetadata.loanTerms || {};

      // Try to get amount from: loanTerms.principal > requestedAmount > 0
      let amountNum = 0;
      if (loanTerms.principal && loanTerms.principal > 0) {
        amountNum = loanTerms.principal;
      } else if (lead.requestedAmount && lead.requestedAmount > 0) {
        amountNum = lead.requestedAmount;
      }

      // Format amount with currency (default to ZMK)
      const currency = stateMetadata.currency || "ZMK";
      const amount =
        amountNum > 0
          ? `${currency} ${amountNum
              .toFixed(2)
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
          : "Not specified";

      // Determine loan type based on amount (if available)
      const loanType =
        amountNum > 200000
          ? "Mortgage"
          : amountNum > 100000
          ? "Business Loan"
          : amountNum > 0
          ? "Personal Loan"
          : "Not specified";

      return {
        id: lead.id,
        client:
          `${lead.firstname || ""} ${lead.lastname || ""}`.trim() ||
          "Unknown Client",
        amount,
        type: loanType,
        stage: lead.currentStageId || "",
        timeInStage: timeInStageFormatted,
        sla: slaFormatted,
        status: slaStatus,
        assignee: assignee.initials,
        assigneeName: assignee.name,
        assigneeColor: assignee.color,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        userId: lead.userId, // Include created by user ID
        // Fineract tracking fields
        fineractLoanId: lead.fineractLoanId,
        loanSubmittedToFineract: lead.loanSubmittedToFineract,
        loanSubmissionDate: lead.loanSubmissionDate,
        clientCreatedInFineract: lead.clientCreatedInFineract,
        fineractClientId: lead.fineractClientId,
        // Set to "Draft" for non-submitted leads, will be updated with Fineract status for submitted leads
        fineractLoanStatus: lead.loanSubmittedToFineract ? null : "Draft",
        // Assignment fields
        assignedToUserId: lead.assignedToUserId,
        assignedToUserName: lead.assignedToUserName,
        assignedAt: lead.assignedAt,
      };
    });

    // Fetch Fineract loan statuses for submitted leads
    const submittedLeads = transformedLeads.filter(
      (lead) => lead.loanSubmittedToFineract
    );

    if (submittedLeads.length > 0) {
      try {
        const session = await getSession();
        const accessToken =
          session?.base64EncodedAuthenticationKey || session?.accessToken;

        if (accessToken) {
          const fineractTenantId = await getFineractTenantId();

          // Fetch statuses in parallel for all submitted leads
          const statusPromises = submittedLeads.map(async (lead) => {
            try {
              // Try to fetch by external ID (leadId)
              const searchUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans?externalId=${encodeURIComponent(
                lead.id
              )}`;

              const response = await fetch(searchUrl, {
                method: "GET",
                headers: {
                  Authorization: `Basic ${accessToken}`,
                  "Fineract-Platform-TenantId": fineractTenantId,
                  Accept: "application/json",
                },
                cache: "no-store",
              });

              if (response.ok) {
                const searchData = await response.json();
                let loans = [];
                if (Array.isArray(searchData)) {
                  loans = searchData;
                } else if (
                  searchData.pageItems &&
                  Array.isArray(searchData.pageItems)
                ) {
                  loans = searchData.pageItems;
                } else if (
                  searchData.content &&
                  Array.isArray(searchData.content)
                ) {
                  loans = searchData.content;
                }

                const matchingLoan = loans.find(
                  (loan: any) => loan.externalId === lead.id
                );

                if (matchingLoan?.status?.value) {
                  return { leadId: lead.id, status: matchingLoan.status.value };
                }
              }
            } catch (error) {
              console.error(
                `Error fetching Fineract status for lead ${lead.id}:`,
                error
              );
            }
            return { leadId: lead.id, status: null };
          });

          const statuses = await Promise.all(statusPromises);

          // Update leads with their statuses
          statuses.forEach(({ leadId, status }) => {
            const lead = transformedLeads.find((l) => l.id === leadId);
            if (lead && status) {
              lead.fineractLoanStatus = status;
            }
          });
        }
      } catch (error) {
        console.error("Error fetching Fineract loan statuses:", error);
      }
    }

    // Fetch payout statuses for active/disbursed loans
    const disbursedLeads = transformedLeads.filter(
      (lead) =>
        lead.fineractLoanStatus?.toLowerCase() === "active" &&
        lead.fineractLoanId
    );

    console.log(`Leads with active loans: ${disbursedLeads.length}, tenant: ${tenant.id}`);

    if (disbursedLeads.length > 0) {
      try {
        const loanIds = disbursedLeads
          .map((l) => l.fineractLoanId)
          .filter((id): id is number => id !== null && id !== undefined);
        
        console.log(`Looking up payout statuses for loan IDs:`, loanIds);
        
        // Get all payout records for this tenant
        const payoutRecords = await prisma.loanPayout.findMany({
          where: {
            tenantId: tenant.id,
            fineractLoanId: {
              in: loanIds,
            },
          },
          select: {
            fineractLoanId: true,
            status: true,
          },
        });

        console.log(`Found ${payoutRecords.length} payout records:`, payoutRecords);

        // Create a map for quick lookup
        const payoutStatusMap = new Map<number, string>(
          payoutRecords.map((p: { fineractLoanId: number; status: string }) => [
            p.fineractLoanId,
            p.status,
          ])
        );

        // Update leads with payout status
        disbursedLeads.forEach((lead) => {
          if (lead.fineractLoanId) {
            lead.payoutStatus =
              payoutStatusMap.get(lead.fineractLoanId) || "PENDING";
          }
        });
      } catch (error) {
        console.error("Error fetching payout statuses:", error);
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.lead.count({ where });

    // Calculate metrics
    const activeLeads = transformedLeads.filter(
      (lead) => !pipelineStages.find((s) => s.id === lead.stage)?.isFinalState
    ).length;

    const onTimeCount = transformedLeads.filter(
      (lead) => lead.status === "normal"
    ).length;
    const atRiskCount = transformedLeads.filter(
      (lead) => lead.status === "warning"
    ).length;
    const overdueCount = transformedLeads.filter(
      (lead) => lead.status === "overdue"
    ).length;

    const slaCompliance =
      transformedLeads.length > 0
        ? Math.round((onTimeCount / transformedLeads.length) * 100)
        : 0;

    // Calculate conversion rate (closed won vs total leads)
    const closedWonStage = pipelineStages.find(
      (stage) =>
        stage.name.toLowerCase().includes("won") ||
        stage.name.toLowerCase().includes("closed won")
    );
    const closedWonCount = closedWonStage
      ? transformedLeads.filter((lead) => lead.stage === closedWonStage.id)
          .length
      : 0;
    const conversionRate =
      transformedLeads.length > 0
        ? Math.round((closedWonCount / transformedLeads.length) * 100)
        : 0;

    // Calculate average processing time
    const totalProcessingTime = transformedLeads.reduce((acc, lead) => {
      const days = parseInt(lead.timeInStage.split("d")[0]) || 0;
      const hours =
        parseInt(lead.timeInStage.split("d")[1]?.split("h")[0]) || 0;
      return acc + days + hours / 24;
    }, 0);
    const avgProcessingTime =
      transformedLeads.length > 0
        ? Math.round((totalProcessingTime / transformedLeads.length) * 10) / 10
        : 0;

    // Calculate conversion metrics between stages
    const conversionMetrics = calculateConversionMetrics(
      pipelineStages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        description: stage.description || undefined,
        order: stage.order,
        color: stage.color,
        isActive: stage.isActive,
        isInitialState: stage.isInitialState,
        isFinalState: stage.isFinalState,
        allowedTransitions: stage.allowedTransitions,
      })),
      transformedLeads
    );

    // Calculate stage TAT metrics
    const stageTATMetrics = calculateStageTATMetrics(
      pipelineStages,
      transformedLeads,
      slaConfigs
    );

    // Get metric targets from tenant settings, falling back to defaults
    const tenantSettings = (tenant.settings as TenantMetricSettings) || {};
    const metricSettings = {
      monthlyTarget:
        tenantSettings.monthlyTarget ?? DEFAULT_METRIC_SETTINGS.monthlyTarget,
      conversionTarget:
        tenantSettings.conversionTarget ??
        DEFAULT_METRIC_SETTINGS.conversionTarget,
      processingTimeTarget:
        tenantSettings.processingTimeTarget ??
        DEFAULT_METRIC_SETTINGS.processingTimeTarget,
    };

    const metrics: LeadMetrics = {
      activeLeads,
      conversionRate,
      avgProcessingTime,
      slaCompliance,
      onTimeCount,
      atRiskCount,
      overdueCount,
      monthlyTarget: metricSettings.monthlyTarget,
      conversionTarget: metricSettings.conversionTarget,
      processingTimeTarget: metricSettings.processingTimeTarget,
      conversionMetrics,
      stageTATMetrics,
    };

    return {
      leads: transformedLeads,
      pipelineStages: pipelineStages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        description: stage.description || undefined,
        order: stage.order,
        color: stage.color,
        isActive: stage.isActive,
        isInitialState: stage.isInitialState,
        isFinalState: stage.isFinalState,
        allowedTransitions: stage.allowedTransitions,
      })),
      metrics,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    };
  } catch (error) {
    console.error("Error fetching leads:", error);
    throw new Error("Failed to fetch leads data");
  }
}

// Helper function to calculate conversion metrics between stages
function calculateConversionMetrics(
  pipelineStages: PipelineStage[],
  leads: Lead[]
): ConversionMetrics {
  // Sort stages by order to get proper transitions
  const sortedStages = pipelineStages
    .filter((stage) => !stage.isFinalState)
    .sort((a, b) => a.order - b.order);

  const labels: string[] = [];
  const conversionRates: number[] = [];

  // Calculate conversion rates between consecutive stages
  for (let i = 0; i < sortedStages.length - 1; i++) {
    const currentStage = sortedStages[i];
    const nextStage = sortedStages[i + 1];

    // Count leads in current stage and next stage
    const currentStageLeads = leads.filter(
      (lead) => lead.stage === currentStage.id
    ).length;
    const nextStageLeads = leads.filter(
      (lead) => lead.stage === nextStage.id
    ).length;

    // Calculate total leads that have passed through current stage
    const totalLeadsPassedThrough = leads.filter((lead) => {
      const leadStage = pipelineStages.find((s) => s.id === lead.stage);
      return leadStage && leadStage.order >= currentStage.order;
    }).length;

    // Calculate conversion rate
    const conversionRate =
      totalLeadsPassedThrough > 0
        ? Math.round(
            ((nextStageLeads +
              leads.filter((lead) => {
                const leadStage = pipelineStages.find(
                  (s) => s.id === lead.stage
                );
                return leadStage && leadStage.order > nextStage.order;
              }).length) /
              totalLeadsPassedThrough) *
              100
          )
        : 0;

    labels.push(`${currentStage.name} → ${nextStage.name}`);
    conversionRates.push(Math.min(conversionRate, 100));
  }

  // If no transitions calculated, provide default data
  if (labels.length === 0) {
    return {
      labels: ["No Data Available"],
      conversionRates: [0],
    };
  }

  return {
    labels,
    conversionRates,
  };
}

// Helper function to calculate stage TAT metrics
function calculateStageTATMetrics(
  pipelineStages: any[],
  leads: Lead[],
  slaConfigs: any[]
): StageTATMetrics[] {
  return pipelineStages.map((stage) => {
    // Get leads in this stage
    const stageLeads = leads.filter((lead) => lead.stage === stage.id);

    // Calculate average TAT for this stage
    let totalTAT = 0;
    let validLeads = 0;

    stageLeads.forEach((lead) => {
      const days = parseInt(lead.timeInStage.split("d")[0]) || 0;
      const hours =
        parseInt(lead.timeInStage.split("d")[1]?.split("h")[0]) || 0;
      const tatInDays = days + hours / 24;

      if (tatInDays >= 0) {
        totalTAT += tatInDays;
        validLeads++;
      }
    });

    const avgTAT =
      validLeads > 0 ? Math.round((totalTAT / validLeads) * 10) / 10 : 0;

    // Get SLA target for this stage
    const stageSLA = slaConfigs.find((sla) => sla.pipelineStageId === stage.id);
    let slaTarget = 0;

    if (stageSLA) {
      slaTarget =
        stageSLA.timeUnit === "days"
          ? stageSLA.timeframe
          : stageSLA.timeUnit === "hours"
          ? stageSLA.timeframe / 24
          : stageSLA.timeframe / (24 * 60);
    }

    // Calculate variance from SLA
    const variance =
      slaTarget > 0 ? Math.round((avgTAT - slaTarget) * 10) / 10 : 0;

    return {
      stageId: stage.id,
      stageName: stage.name,
      avgTAT,
      slaTarget,
      variance,
    };
  });
}

// Helper function to generate consistent colors for users
function getColorForUser(userId: string): string {
  const colors = [
    "#3B82F6", // blue
    "#A855F7", // purple
    "#EAB308", // yellow
    "#22C55E", // green
    "#14B8A6", // teal
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // violet
  ];

  // Simple hash function to get consistent color for user
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }

  return colors[Math.abs(hash) % colors.length];
}
