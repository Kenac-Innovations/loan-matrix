import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LeadTimeline } from "./components/lead-timeline";
import { LeadDetails } from "./components/lead-details";
import { ComprehensiveLeadDetails } from "./components/comprehensive-lead-details";
import { LeadDocuments } from "./components/lead-documents";
import { LeadActions } from "./components/lead-actions";
import { RcfLeadActions } from "./components/rcf-lead-actions";
import { LeadSidebar } from "./components/lead-sidebar";
import StateTransitionManager from "./components/state-transition-manager";
import { LeadDetailTabs } from "./components/lead-detail-tabs";
import { LeadMoreActions } from "./components/lead-more-actions";
import { LeadAdditionalInfo } from "./components/lead-additional-info";
import {
  ArrowLeft,
  ChevronRight,
  Landmark,
  UserCheck,
  UserX,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { extractTenantSlug, getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { fetchFineractAPI } from "@/lib/api";
import { getFineractServiceWithServiceAuth } from "@/lib/fineract-api";
import { callCDEAndStore } from "@/lib/cde-utils";
import { TeamAwareStateMachineService } from "@/lib/team-state-machine-service";
import {
  canEditPendingLoanApplication,
  isPendingLoanApplicationEditTenant,
} from "@/lib/pending-loan-application-edit";
import { canPrintLoanContract } from "@/lib/loan-contract-print";
import { getFacilityLoanLink } from "@/lib/fineract-credit-facility";
import { isCreditFacilityEnabled } from "@/lib/tenant-features";
import {
  canUserAccessLeadOffice,
  getLeadViewerAccessContext,
} from "@/lib/lead-policy";
import { buildAutoDisbursementTrail } from "@/lib/auto-disbursement-trail";

interface FineractLoanInfo {
  status: string | null;
  loanId: number | null;
  principal: number | null;
  accountNo: string | null;
  currency: string | null;
  productName: string | null;
}

/**
 * Get Fineract loan info by calling Fineract API directly
 * Tries by loan ID first, then by external ID (leadId) as fallback
 */
async function getFineractLoanInfo(
  loanId: number | string | null,
  leadId: string
): Promise<FineractLoanInfo> {
  try {
    const fineractService = await getFineractServiceWithServiceAuth();

    // Try fetching by loan ID first if available
    if (loanId) {
      console.log("Fetching Fineract loan info by loan ID:", loanId);
      try {
        const loanData = await fineractService.getLoan(Number(loanId));
        const status = loanData.status?.value || null;
        const principal =
          loanData.principal || loanData.approvedPrincipal || null;
        const accountNo = loanData.accountNo || null;
        const currency = loanData.currency?.code || null;
        const productName = loanData.loanProductName || null;
        if (status) {
          console.log("Fineract loan info fetched by ID:", {
            status,
            loanId,
            principal,
            accountNo,
            currency,
            productName,
          });
          return {
            status,
            loanId: Number(loanId),
            principal,
            accountNo,
            currency,
            productName,
          };
        }
      } catch (error) {
        console.warn(`Failed to fetch Fineract loan by ID ${loanId}:`, error);
      }
    }

    // Fallback: Try fetching by external ID (leadId) using service credentials
    console.log("Attempting to fetch loan info by external ID:", leadId);
    try {
      const loans = await fineractService.searchLoansByExternalId(leadId);
      const matchingLoan = loans.find((loan: any) => loan.externalId === leadId);
      if (matchingLoan) {
        const status = matchingLoan.status?.value || null;
        const fineractLoanId = matchingLoan.id || null;
        const principal =
          matchingLoan.principal || matchingLoan.approvedPrincipal || null;
        const accountNo = matchingLoan.accountNo || null;
        const currency = matchingLoan.currency?.code || null;
        const productName = matchingLoan.loanProductName || null;
        if (status) {
          console.log("Fineract loan info fetched by external ID:", {
            status,
            loanId: fineractLoanId,
            principal,
            accountNo,
            currency,
            productName,
          });
          return {
            status,
            loanId: fineractLoanId,
            principal,
            accountNo,
            currency,
            productName,
          };
        }
      }
    } catch (error) {
      console.warn(`Error fetching loan by external ID ${leadId}:`, error);
    }

    return {
      status: null,
      loanId: null,
      principal: null,
      accountNo: null,
      currency: null,
      productName: null,
    };
  } catch (error) {
    console.error("Error fetching Fineract loan info:", error);
    return {
      status: null,
      loanId: null,
      principal: null,
      accountNo: null,
      currency: null,
      productName: null,
    };
  }
}

function getFacilityTypeLabel(facilityType: string | null | undefined): string {
  if (facilityType === "REVOLVING_CREDIT") return "RCF";
  if (facilityType === "INVOICE_DISCOUNTING") return "Invoice";
  if (facilityType === "TERM_LOAN") return "Term Loan";
  return "Facility";
}

/**
 * Get status badge color
 */
function getStatusBadgeColor(status: string | null): string {
  if (!status) return "bg-gray-500";
  const statusLower = status.toLowerCase();
  if (statusLower.includes("active")) return "bg-green-500";
  if (statusLower.includes("approved") && !statusLower.includes("pending"))
    return "bg-blue-500";
  if (statusLower.includes("submitted") || statusLower.includes("pending"))
    return "bg-yellow-500";
  if (statusLower.includes("closed")) return "bg-gray-500";
  return "bg-gray-500";
}

/**
 * Get page background hue based on loan status
 */
function getStatusPageHue(status: string | null): string {
  if (!status) return "";
  const statusLower = status.toLowerCase();
  // Active/Disbursed - green hue
  if (statusLower.includes("active") || statusLower.includes("disbursed")) {
    return "bg-green-50 dark:bg-green-950/20";
  }
  // Approved - blue hue
  if (statusLower.includes("approved") && !statusLower.includes("pending")) {
    return "bg-blue-50 dark:bg-blue-950/20";
  }
  // Pending/Submitted - yellow hue
  if (statusLower.includes("submitted") || statusLower.includes("pending")) {
    return "bg-yellow-50 dark:bg-yellow-950/20";
  }
  // Rejected - red hue
  if (statusLower.includes("rejected") || statusLower.includes("withdrawn")) {
    return "bg-red-50 dark:bg-red-950/20";
  }
  return "";
}

/**
 * Fetch documents from Fineract (client and loan)
 */
async function getFineractDocuments(
  clientId: number | null,
  loanId: number | null
): Promise<{ clientDocuments: any[]; loanDocuments: any[] }> {
  try {
    const clientDocuments: any[] = [];
    const loanDocuments: any[] = [];

    // Fetch client documents
    if (clientId) {
      try {
        const data = await fetchFineractAPI(`/clients/${clientId}/documents`, {
          authMode: "service",
          cache: "no-store",
        });

        if (Array.isArray(data)) {
          clientDocuments.push(...data);
        } else if (data.pageItems) {
          clientDocuments.push(...data.pageItems);
        }
      } catch (err) {
        console.warn("Failed to fetch client documents:", err);
      }
    }

    // Fetch loan documents
    if (loanId) {
      try {
        const data = await fetchFineractAPI(`/loans/${loanId}/documents`, {
          authMode: "service",
          cache: "no-store",
        });

        if (Array.isArray(data)) {
          loanDocuments.push(...data);
        } else if (data.pageItems) {
          loanDocuments.push(...data.pageItems);
        }
      } catch (err) {
        console.warn("Failed to fetch loan documents:", err);
      }
    }

    return { clientDocuments, loanDocuments };
  } catch (error) {
    console.error("Error fetching Fineract documents:", error);
    return { clientDocuments: [], loanDocuments: [] };
  }
}

/**
 * Fetch client datatables from Fineract
 */
async function getClientDatatables(
  clientId: number
): Promise<{ datatables: any[]; datatableData: Record<string, any> }> {
  try {
    // Fetch list of datatables for clients
    const datatables = await fetchFineractAPI("/datatables?apptable=m_client", {
      authMode: "service",
      cache: "no-store",
    });
    const datatableData: Record<string, any> = {};

    // Fetch data for each datatable
    for (const dt of datatables) {
      try {
        const data = await fetchFineractAPI(
          `/datatables/${encodeURIComponent(
            dt.registeredTableName
          )}/${clientId}?genericResultSet=true`,
          {
            authMode: "service",
            cache: "no-store",
          }
        );

        if (data) {
          datatableData[dt.registeredTableName] = data;
        }
      } catch (err) {
        console.warn(
          `Failed to fetch data for ${dt.registeredTableName}:`,
          err
        );
      }
    }

    return { datatables, datatableData };
  } catch (error) {
    console.error("Error fetching client datatables:", error);
    return { datatables: [], datatableData: {} };
  }
}

async function getLeadData(leadId: string) {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const tenantSlug = extractTenantSlug(host);
  const session = await getSession();

  const emptyResult = {
    lead: null,
    fineractLoanStatus: null,
    fineractLoanId: null,
    fineractLoanPrincipal: null,
    fineractLoanAccountNo: null,
    fineractLoanCurrency: null,
    cdeResult: null,
    autoDisbursement: null,
    clientDatatables: [],
    datatableData: {},
    clientDocuments: [],
    loanDocuments: [],
    tenantSlug,
    hasCreditFacility: false,
    canManageLead: false,
  };

  if (!session?.user?.userId) {
    return emptyResult;
  }

  const leadRecord = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { tenantId: true },
  });

  if (!leadRecord) {
    return emptyResult;
  }

  const leadAccess = await getLeadViewerAccessContext(
    leadRecord.tenantId,
    session.user.userId
  );

  let lead: Awaited<ReturnType<typeof prisma.lead.findFirst>>;
  let canManageLead = false;
  try {
    const leadWhere = {
      id: leadId,
      tenantId: leadRecord.tenantId,
    };

    lead = await prisma.lead.findFirst({
      where: {
        ...leadWhere,
      },
      include: {
        currentStage: true,
      },
    });
    canManageLead = canUserAccessLeadOffice(
      lead?.officeId,
      leadAccess.visibleOfficeIds
    );
  } catch (error) {
    console.error("Error fetching base lead record:", error);
    return emptyResult;
  }

  if (!lead) {
    return emptyResult;
  }

  let revolving: { id: string; fineractSavingsAccountId: number } | null = null;
  try {
    revolving = await prisma.revolvingCreditFacility.findUnique({
      where: { leadId },
      select: { id: true, fineractSavingsAccountId: true },
    });
  } catch (error) {
    console.error("Error fetching revolving facility info:", error);
  }

  const leadWithRelations = {
    ...lead,
    revolving,
  };

  let hasCreditFacility = false;
  try {
    const tenant = await getTenantFromHeaders();
    const resolvedTenantId = tenant?.id || lead.tenantId;

    const tenantRow = await prisma.tenant.findUnique({
      where: { id: resolvedTenantId },
      select: { settings: true },
    });
    hasCreditFacility = isCreditFacilityEnabled(tenantRow?.settings);
  } catch (error) {
    console.error("Error fetching tenant-specific lead data:", error);
  }

  let fineractLoanInfo: FineractLoanInfo = {
    status: null,
    loanId: null,
    principal: null,
    accountNo: null,
    currency: null,
    productName: null,
  };
  try {
    fineractLoanInfo = await getFineractLoanInfo(
      lead.fineractLoanId ?? null,
      leadId
    );
  } catch (error) {
    console.error("Error fetching Fineract loan info for lead page:", error);
  }

  const stateMetadata = ((lead as any).stateMetadata as any) || {};
  let currentStateMetadata = stateMetadata;
  let cdeResult = stateMetadata.cdeResult || null;
  let autoDisbursement = currentStateMetadata.autoDisbursement || null;

  if (lead.loanSubmittedToFineract && lead.fineractLoanId && !cdeResult) {
    try {
      cdeResult = await callCDEAndStore(lead.id);

      if (cdeResult?.decision) {
        await TeamAwareStateMachineService.autoProgressToDisbursementFromCdeResult(
          lead.id,
          "system",
          cdeResult
        );
      }

      if (cdeResult) {
        const refreshedLead = await prisma.lead.findFirst({
          where: {
            id: leadId,
            tenantId: leadRecord.tenantId,
          },
          include: {
            currentStage: true,
          },
        });

        if (refreshedLead) {
          lead = refreshedLead;
          currentStateMetadata =
            (lead.stateMetadata as Record<string, unknown> | null) || {};
          cdeResult = currentStateMetadata.cdeResult || cdeResult;
          autoDisbursement = currentStateMetadata.autoDisbursement || null;
        }
      }
    } catch (error) {
      console.error("Failed to auto-run CDE during lead page load:", error);
    }
  }

  let clientDatatables: any[] = [];
  let datatableData: Record<string, any> = {};
  const clientId = lead.fineractClientId;
  if (clientId) {
    try {
      const result = await getClientDatatables(clientId);
      clientDatatables = result.datatables;
      datatableData = result.datatableData;
    } catch (error) {
      console.error("Error fetching client datatables for lead page:", error);
    }
  }

  let clientDocuments: any[] = [];
  let loanDocuments: any[] = [];
  try {
    const fineractDocs = await getFineractDocuments(
      clientId || null,
      fineractLoanInfo.loanId || lead.fineractLoanId || null
    );
    clientDocuments = fineractDocs.clientDocuments;
    loanDocuments = fineractDocs.loanDocuments;
  } catch (error) {
    console.error("Error fetching Fineract documents for lead page:", error);
  }

  return {
    lead: leadWithRelations,
    fineractLoanStatus: fineractLoanInfo.status,
    fineractLoanId: fineractLoanInfo.loanId,
    fineractLoanPrincipal: fineractLoanInfo.principal,
    fineractLoanAccountNo: fineractLoanInfo.accountNo,
    fineractLoanCurrency: fineractLoanInfo.currency,
    fineractLoanProductName: fineractLoanInfo.productName,
    cdeResult,
    clientDatatables,
    clientDocuments,
    loanDocuments,
    datatableData,
    tenantSlug,
    hasCreditFacility,
    canManageLead,
    autoDisbursement,
  };
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const {
    lead,
    fineractLoanStatus,
    fineractLoanId,
    fineractLoanPrincipal,
    fineractLoanAccountNo,
    fineractLoanCurrency,
    fineractLoanProductName,
    cdeResult,
    clientDatatables,
    datatableData,
    clientDocuments,
    loanDocuments,
    tenantSlug,
    hasCreditFacility,
    canManageLead,
    autoDisbursement,
  } = await getLeadData(id);

  const session = await getSession();
  const currentUserId = session?.user?.id;

  const facilityLink = hasCreditFacility && fineractLoanId
    ? await getFacilityLoanLink(fineractLoanId).catch(() => null)
    : null;
  const isAssignedUser =
    currentUserId != null &&
    lead?.assignedToUserId != null &&
    String(lead.assignedToUserId) === currentUserId;
  const isReadOnly = !isAssignedUser || !canManageLead;
  const canEditPendingLoanTerms =
    isPendingLoanApplicationEditTenant(tenantSlug) &&
    canEditPendingLoanApplication(session, fineractLoanStatus);
  const canPrintContract = canPrintLoanContract(
    tenantSlug,
    fineractLoanStatus
  );

  // Check if current user is in the team for the lead's current stage
  let isUserInStageTeam = false;
  if (lead?.currentStage && currentUserId) {
    const stageTeams = await prisma.team.findMany({
      where: {
        tenantId: lead.tenantId,
        pipelineStageIds: { has: lead.currentStage.id },
        isActive: true,
      },
      include: { members: { where: { isActive: true } } },
    });
    isUserInStageTeam =
      stageTeams.length === 0 ||
      stageTeams.some((team) =>
        team.members.some((m: { userId: string }) => String(m.userId) === currentUserId)
      );
  }

  // Construct client name from lead data
  const clientName = lead 
    ? [lead.firstname, lead.middlename, lead.lastname].filter(Boolean).join(" ") || "Client"
    : "Client";

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    );
  }

  const currentStage = lead.currentStage?.name || "New Lead";
  const pageHue = getStatusPageHue(fineractLoanStatus);
  const isRcfLead = lead.facilityType === "REVOLVING_CREDIT";
  const rcfApproved = isRcfLead && !!(lead as any).revolving;
  const facilityTypeLabel = getFacilityTypeLabel(lead.facilityType);
  const displayProductName =
    lead.loanProductName || fineractLoanProductName || facilityTypeLabel;
  const autoDisbursementTrail = buildAutoDisbursementTrail(
    autoDisbursement as any
  );

  return (
    <div className={`-m-6 p-6 min-h-screen ${pageHue}`}>
      <div className="space-y-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href="/leads"
            className="hover:text-foreground transition-colors"
          >
            Leads
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground font-medium">Lead #{id}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href="/leads" className="shrink-0 mt-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <h1 className="text-lg font-semibold truncate">
                    {clientName || "Lead Details"}
                  </h1>
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sky-500/12 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300 shrink-0">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <span className="truncate max-w-[14rem] sm:max-w-[18rem]">
                      {displayProductName}
                    </span>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {facilityTypeLabel}
                  </Badge>
                {fineractLoanStatus && (
                  <Badge
                    className={`${getStatusBadgeColor(fineractLoanStatus)} text-white border-0 text-xs shrink-0`}
                  >
                    {fineractLoanStatus?.toLowerCase() === "active" ? "Disbursed" : fineractLoanStatus}
                  </Badge>
                )}
                {autoDisbursement && autoDisbursementTrail.statusLabel && (
                  <Badge
                    variant={autoDisbursementTrail.statusVariant}
                    className="text-xs shrink-0"
                  >
                    Auto {autoDisbursementTrail.statusLabel}
                  </Badge>
                )}
                {rcfApproved && (
                  <Badge className="bg-blue-600 text-white border-0 text-xs gap-1 shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    Approved
                  </Badge>
                  )}
                  {lead.currentStage && !rcfApproved && (
                    lead.currentStage.isFinalState ? (
                      lead.currentStage.fineractAction === "reject" ? (
                        <Badge className="bg-red-600 text-white border-0 text-xs gap-1 shrink-0">
                          <XCircle className="h-3 w-3" />
                          Rejected
                        </Badge>
                      ) : (
                        <Badge className="bg-green-600 text-white border-0 text-xs gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" />
                          Complete
                        </Badge>
                      )
                    ) : (
                      <Badge
                        className="text-white border-0 text-xs shrink-0"
                        style={{ backgroundColor: lead.currentStage.color || "#6b7280" }}
                      >
                        {currentStage}
                      </Badge>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!rcfApproved && (
                  <StateTransitionManager
                    leadId={id}
                    currentStage={currentStage}
                    currentStageColor={lead.currentStage?.color}
                    preferredPaymentMethod={lead.preferredPaymentMethod ?? null}
                    currentUserId={currentUserId}
                    assignedToUserId={lead.assignedToUserId}
                    isUserInStageTeam={isUserInStageTeam}
                    canManageLead={canManageLead}
                  />
                )}
                {lead.facilityType === "REVOLVING_CREDIT" ? (
                  <RcfLeadActions
                    leadId={id}
                    fineractClientId={lead.fineractClientId}
                    fineractSavingsAccountId={(lead as any).revolving?.fineractSavingsAccountId ?? lead.fineractSavingsAccountId ?? null}
                    rcfApproved={rcfApproved}
                  />
                ) : (
                  <LeadActions
                    leadId={id}
                    currentStage={currentStage}
                    loanStatus={fineractLoanStatus}
                    loanId={fineractLoanId}
                    loanPrincipal={fineractLoanPrincipal}
                    loanAccountNo={fineractLoanAccountNo}
                    clientName={clientName}
                    currency={fineractLoanCurrency}
                    assignedToUserId={lead.assignedToUserId}
                    fineractClientId={lead.fineractClientId}
                    canViewContract={canPrintContract}
                  />
                )}
                {!isReadOnly && (
                  <LeadMoreActions
                    leadId={id}
                    loanStatus={fineractLoanStatus}
                    loanId={fineractLoanId}
                    fineractClientId={lead.fineractClientId}
                    canModifyPendingApplication={canEditPendingLoanTerms}
                    canPrintContract={canPrintContract}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground mt-1">
              {lead.externalId && (
                <span>
                  ID: <span className="font-mono font-medium text-foreground">{lead.externalId}</span>
                </span>
              )}
              {fineractLoanId && (
                <span>
                  Loan: <span className="font-mono font-medium text-foreground">#{fineractLoanId}</span>
                </span>
              )}
              {facilityLink && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                  <Landmark className="h-3 w-3" />
                  Credit Facility
                </span>
              )}
              {lead.clientTypeName && (
                <span>{lead.clientTypeName}</span>
              )}
              {lead.preferredPaymentMethod && (() => {
                const method = String(lead.preferredPaymentMethod).toUpperCase().replaceAll(/\s+/g, "_");
                const label = method === "CASH" ? "Cash" : method === "MOBILE_MONEY" ? "Mobile Money" : method === "BANK_TRANSFER" ? "Bank Transfer" : lead.preferredPaymentMethod;
                return <span>{label}</span>;
              })()}
              {lead.assignedToUserName ? (
                <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                  <UserCheck className="h-3 w-3" />
                  {lead.assignedToUserName}
                </span>
              ) : lead.loanSubmittedToFineract ? (
                <span className="inline-flex items-center gap-1 text-orange-500">
                  <UserX className="h-3 w-3" />
                  Unassigned
                </span>
              ) : null}
              {cdeResult && (
                <Link href={`/leads/${id}/cde`} className="hover:underline">
                  <span className={`inline-flex items-center gap-1 ${
                    cdeResult.decision === "APPROVED" ? "text-green-600" : cdeResult.decision === "MANUAL_REVIEW" ? "text-yellow-600" : "text-red-600"
                  }`}>
                    CDE: {cdeResult.decision}
                    {cdeResult.scoringResult?.creditScore && ` • ${cdeResult.scoringResult.creditScore}`}
                  </span>
                </Link>
              )}
              {autoDisbursement && autoDisbursementTrail.stages.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Auto Flow
                  </span>
                  {autoDisbursementTrail.stages.map((stage, index) => {
                    const isLast = index === autoDisbursementTrail.stages.length - 1;
                    return (
                      <span key={stage.key} className="inline-flex items-center gap-1.5">
                        {index > 0 && (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                        <Badge
                          variant={isLast ? "default" : "outline"}
                          className="text-[11px] font-medium capitalize"
                        >
                          {stage.label}
                        </Badge>
                      </span>
                    );
                  })}
                  {autoDisbursement.cdeDecision && (
                    <Badge variant="secondary" className="text-[11px] font-medium">
                      CDE {String(autoDisbursement.cdeDecision)}
                    </Badge>
                  )}
                  {autoDisbursement.stopReason && (
                    <span className="text-[11px] text-muted-foreground">
                      Stop: {autoDisbursement.stopReason}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <LeadDetailTabs
            leadId={id}
            fineractClientId={lead.fineractClientId || null}
            fineractLoanId={fineractLoanId || null}
            requestedAmount={lead.requestedAmount || fineractLoanPrincipal || null}
            currentStage={currentStage}
            clientTypeName={lead.clientTypeName || undefined}
            clientDatatables={clientDatatables}
            datatableData={datatableData}
            clientDocuments={clientDocuments}
            loanDocuments={loanDocuments}
            readOnly={isReadOnly}
            canEditPendingLoanApplication={canEditPendingLoanTerms}
            facilityType={lead.facilityType}
            hasCreditFacility={hasCreditFacility}
          />
        </div>
        <div className="mt-10">
          <LeadSidebar leadId={id} canManageLead={canManageLead} />
        </div>
      </div>
    </div>
  );
}
