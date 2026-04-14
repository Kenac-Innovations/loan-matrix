import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeadActions } from "./components/lead-actions";
import { LeadSidebar } from "./components/lead-sidebar";
import StateTransitionManager from "./components/state-transition-manager";
import { LeadMoreActions } from "./components/lead-more-actions";
import { LeadDetailTabs } from "./components/lead-detail-tabs";
import {
  ArrowLeft,
  UserCheck,
  UserX,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { extractTenantSlug } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import {
  canEditPendingLoanApplication,
  isPendingLoanApplicationEditTenant,
} from "@/lib/pending-loan-application-edit";

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143";

interface FineractLoanInfo {
  status: string | null;
  loanId: number | null;
  principal: number | null;
  accountNo: string | null;
  currency: string | null;
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
    const fineractService = await getFineractServiceWithSession();

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
        if (status) {
          console.log("Fineract loan info fetched by ID:", {
            status,
            loanId,
            principal,
            accountNo,
            currency,
          });
          return { status, loanId: Number(loanId), principal, accountNo, currency };
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
        if (status) {
          console.log("Fineract loan info fetched by external ID:", {
            status,
            loanId: fineractLoanId,
            principal,
            accountNo,
            currency,
          });
          return { status, loanId: fineractLoanId, principal, accountNo, currency };
        }
      }
    } catch (error) {
      console.warn(`Error fetching loan by external ID ${leadId}:`, error);
    }

    return { status: null, loanId: null, principal: null, accountNo: null, currency: null };
  } catch (error) {
    console.error("Error fetching Fineract loan info:", error);
    return { status: null, loanId: null, principal: null, accountNo: null, currency: null };
  }
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
  loanId: number | null,
  tenantSlug: string
): Promise<{ clientDocuments: any[]; loanDocuments: any[] }> {
  try {
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      return { clientDocuments: [], loanDocuments: [] };
    }

    const clientDocuments: any[] = [];
    const loanDocuments: any[] = [];

    // Fetch client documents
    if (clientId) {
      try {
        const clientDocsUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients/${clientId}/documents`;
        const clientDocsRes = await fetch(clientDocsUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${accessToken}`,
            "Fineract-Platform-TenantId": tenantSlug,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (clientDocsRes.ok) {
          const data = await clientDocsRes.json();
          if (Array.isArray(data)) {
            clientDocuments.push(...data);
          } else if (data.pageItems) {
            clientDocuments.push(...data.pageItems);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch client documents:", err);
      }
    }

    // Fetch loan documents
    if (loanId) {
      try {
        const loanDocsUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans/${loanId}/documents`;
        const loanDocsRes = await fetch(loanDocsUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${accessToken}`,
            "Fineract-Platform-TenantId": tenantSlug,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (loanDocsRes.ok) {
          const data = await loanDocsRes.json();
          if (Array.isArray(data)) {
            loanDocuments.push(...data);
          } else if (data.pageItems) {
            loanDocuments.push(...data.pageItems);
          }
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
  clientId: number,
  tenantSlug: string
): Promise<{ datatables: any[]; datatableData: Record<string, any> }> {
  try {
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      return { datatables: [], datatableData: {} };
    }

    // Fetch list of datatables for clients
    const datatableListUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/datatables?apptable=m_client`;
    const datatableListRes = await fetch(datatableListUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": tenantSlug,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!datatableListRes.ok) {
      console.warn("Failed to fetch datatables list:", datatableListRes.status);
      return { datatables: [], datatableData: {} };
    }

    const datatables = await datatableListRes.json();
    const datatableData: Record<string, any> = {};

    // Fetch data for each datatable
    for (const dt of datatables) {
      try {
        const dataUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/datatables/${encodeURIComponent(
          dt.registeredTableName
        )}/${clientId}?genericResultSet=true`;
        const dataRes = await fetch(dataUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${accessToken}`,
            "Fineract-Platform-TenantId": tenantSlug,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (dataRes.ok) {
          const data = await dataRes.json();
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
  try {
    // Get tenant from headers
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id") || "default-tenant";
    const host = headersList.get("host") || "localhost:3000";

    // Extract tenant slug from host for Fineract API calls
    const tenantSlug = extractTenantSlug(host);

    // Fetch lead data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        currentStage: true,
      },
    });

    // Fetch pipeline stages for the tenant
    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: "asc" },
    });

    // Fetch Fineract loan info directly from Fineract API
    // No need for internal HTTP calls - we call Fineract directly from this Server Component
    // Note: fineractLoanId doesn't exist in schema, so we always fetch by external ID (leadId)
    const fineractLoanInfo = await getFineractLoanInfo(null, leadId);

    // Extract CDE result from stateMetadata
    const stateMetadata = (lead as any)?.stateMetadata as any;
    const cdeResult = stateMetadata?.cdeResult || null;

    // Fetch client datatables if client is linked
    let clientDatatables: any[] = [];
    let datatableData: Record<string, any> = {};
    const clientId = lead?.fineractClientId;
    if (clientId) {
      const result = await getClientDatatables(clientId, tenantSlug);
      clientDatatables = result.datatables;
      datatableData = result.datatableData;
    }

    // Fetch Fineract documents (client and loan)
    const fineractDocs = await getFineractDocuments(
      clientId || null,
      fineractLoanInfo.loanId || null,
      tenantSlug
    );

    return {
      lead,
      stages,
      fineractLoanStatus: fineractLoanInfo.status,
      fineractLoanId: fineractLoanInfo.loanId,
      fineractLoanPrincipal: fineractLoanInfo.principal,
      fineractLoanAccountNo: fineractLoanInfo.accountNo,
      fineractLoanCurrency: fineractLoanInfo.currency,
      cdeResult,
      clientDatatables,
      clientDocuments: fineractDocs.clientDocuments,
      loanDocuments: fineractDocs.loanDocuments,
      datatableData,
      tenantSlug,
    };
  } catch (error) {
    console.error("Error fetching lead data:", error);
    return {
      lead: null,
      stages: [],
      fineractLoanStatus: null,
      fineractLoanId: null,
      fineractLoanPrincipal: null,
      fineractLoanAccountNo: null,
      fineractLoanCurrency: null,
      cdeResult: null,
      clientDatatables: [],
      datatableData: {},
      clientDocuments: [],
      loanDocuments: [],
      tenantSlug: null,
    };
  }
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const {
    lead,
    stages,
    fineractLoanStatus,
    fineractLoanId,
    fineractLoanPrincipal,
    fineractLoanAccountNo,
    fineractLoanCurrency,
    cdeResult,
    clientDatatables,
    datatableData,
    clientDocuments,
    loanDocuments,
    tenantSlug,
  } = await getLeadData(id);
  
  const session = await getSession();
  const currentUserId = session?.user?.id;
  const isAssignedUser =
    currentUserId != null &&
    lead?.assignedToUserId != null &&
    String(lead.assignedToUserId) === currentUserId;
  const isReadOnly = !isAssignedUser;
  const canEditPendingLoanTerms =
    isPendingLoanApplicationEditTenant(tenantSlug) &&
    canEditPendingLoanApplication(session, fineractLoanStatus);

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
    isUserInStageTeam = stageTeams.some((team) =>
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

  return (
    <div className={`-m-4 p-4 sm:-m-6 sm:p-6 min-h-screen ${pageHue}`}>
      <div className="space-y-3 sm:space-y-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground bg-muted/30 px-3 py-2 sm:px-4 sm:py-3 rounded-lg overflow-x-auto">
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
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <h1 className="text-lg font-semibold truncate">
                  {clientName || "Lead Details"}
                </h1>
                {fineractLoanStatus && (
                  <Badge
                    className={`${getStatusBadgeColor(fineractLoanStatus)} text-white border-0 text-xs shrink-0`}
                  >
                    {fineractLoanStatus?.toLowerCase() === "active" ? "Disbursed" : fineractLoanStatus}
                  </Badge>
                )}
                {lead.currentStage && (
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
              <div className="flex items-center gap-1.5 shrink-0">
                <StateTransitionManager
                  leadId={id}
                  currentStage={currentStage}
                  currentStageColor={lead.currentStage?.color}
                  assignedToUserId={lead.assignedToUserId}
                  currentUserId={currentUserId}
                  isUserInStageTeam={isUserInStageTeam}
                />
                <LeadActions
                  leadId={id}
                  loanStatus={fineractLoanStatus}
                  loanId={fineractLoanId}
                  loanPrincipal={fineractLoanPrincipal}
                  loanAccountNo={fineractLoanAccountNo}
                  clientName={clientName}
                  currency={fineractLoanCurrency}
                  assignedToUserId={lead.assignedToUserId}
                  fineractClientId={lead.fineractClientId}
                />
                {!isReadOnly && (
                  <LeadMoreActions
                    leadId={id}
                    loanStatus={fineractLoanStatus}
                    loanId={fineractLoanId}
                    fineractClientId={lead.fineractClientId}
                    canModifyPendingApplication={canEditPendingLoanTerms}
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
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Stage Progress */}
      {stages.length > 0 && (
        <div className="mt-3 sm:mt-4 px-1 sm:px-2 overflow-x-auto scrollbar-thin">
          <div className="flex items-center w-full min-w-[400px]">
            {(() => {
              const isRejected = lead.currentStage?.fineractAction === "reject";
              const normalStages = stages.filter((s) => s.fineractAction !== "reject");
              const visibleStages = isRejected
                ? [...normalStages, ...stages.filter((s) => s.fineractAction === "reject")]
                : normalStages;
              const currentOrder = lead.currentStage?.order ?? -1;
              const isOnFinalStage = lead.currentStage?.isFinalState === true && !isRejected;
              return visibleStages.map((stage, idx) => {
                const isCurrent = stage.id === lead.currentStage?.id;
                const isRejectStage = stage.fineractAction === "reject";
                const isCompleted = isRejected
                  ? (!isRejectStage && stage.order < currentOrder)
                  : isOnFinalStage
                  ? stage.order <= currentOrder
                  : stage.order < currentOrder;
                const isFuture = !isCompleted && !isCurrent;
                const isLast = idx === visibleStages.length - 1;

                return (
                  <div key={stage.id} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className={`
                          flex items-center justify-center rounded-full transition-all
                          ${isCurrent && !isOnFinalStage && !isRejected ? "w-8 h-8 ring-2 ring-offset-2 ring-offset-background" : "w-5 h-5"}
                          ${isCompleted && !isCurrent ? "opacity-70" : ""}
                          ${isCurrent && isRejected ? "w-7 h-7" : ""}
                        `}
                        style={{
                          backgroundColor: isCompleted || isCurrent ? (stage.color || "#6b7280") : "transparent",
                          borderColor: stage.color || "#6b7280",
                          borderWidth: isFuture ? "2px" : "0px",
                          borderStyle: "solid",
                          ...(isCurrent && !isOnFinalStage && !isRejected ? { ringColor: stage.color || "#6b7280" } : {}),
                        }}
                      >
                        {isCompleted && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {isCurrent && isRejected && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {isCurrent && !isOnFinalStage && !isRejected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span
                        className={`
                          text-[10px] mt-1 text-center leading-tight max-w-[72px] truncate
                          ${isCurrent && !isOnFinalStage && !isRejected ? "font-semibold" : isCompleted ? "font-medium text-foreground" : isCurrent && isRejected ? "font-semibold" : "text-muted-foreground/60"}
                        `}
                        style={isCompleted || isCurrent ? { color: stage.color || undefined } : undefined}
                        title={stage.name}
                      >
                        {stage.name}
                      </span>
                    </div>
                    {!isLast && (
                      <div className="flex-1 mx-1 h-0.5 rounded-full self-start mt-[10px]"
                        style={{
                          backgroundColor: isRejected && isCompleted && visibleStages[idx + 1]?.fineractAction === "reject"
                            ? "#ef4444"
                            : isCompleted ? (stage.color || "#6b7280") : "hsl(var(--border))",
                          opacity: isCompleted ? 0.5 : 0.3,
                        }}
                      />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

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
          />
        </div>
        <div className="mt-0 lg:mt-10">
          <LeadSidebar leadId={id} />
        </div>
      </div>
    </div>
  );
}
