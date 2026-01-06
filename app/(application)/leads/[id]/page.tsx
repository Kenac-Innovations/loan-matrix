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
import { LeadValidations } from "./components/lead-validations";
import { LeadCDE } from "./components/lead-cde";
import { LeadCommunications } from "./components/lead-communications";
import { LeadSidebar } from "./components/lead-sidebar";
import { LeadAdditionalInfo } from "./components/lead-additional-info";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Activity,
  ShieldCheck,
  Calculator,
  Info,
  Database,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { extractTenantSlug } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getFineractService } from "@/lib/fineract-api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

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
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      console.warn("No access token available for Fineract API call");
      return { status: null, loanId: null, principal: null, accountNo: null, currency: null };
    }

    // Get the mapped Fineract tenant ID (e.g., "goodfellow" -> "goodfellow-training")
    const fineractTenantId = await getFineractTenantId();
    const fineractService = getFineractService(accessToken, fineractTenantId);

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

    // Fallback: Try fetching by external ID (leadId) using direct Fineract API call
    console.log(
      " Server ",
      "Attempting to fetch loan info by external ID:",
      leadId
    );
    try {
      const searchUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans?externalId=${encodeURIComponent(
        leadId
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
        // Handle different response formats
        let loans = [];
        if (Array.isArray(searchData)) {
          loans = searchData;
        } else if (
          searchData.pageItems &&
          Array.isArray(searchData.pageItems)
        ) {
          loans = searchData.pageItems;
        } else if (searchData.content && Array.isArray(searchData.content)) {
          loans = searchData.content;
        }

        const matchingLoan = loans.find(
          (loan: any) => loan.externalId === leadId
        );
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
      } else {
        console.warn(
          `Failed to fetch Fineract loan by external ID ${leadId}:`,
          response.status
        );
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
  } = await getLeadData(id);
  
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

        {/* Enhanced Header */}
        <div className="flex items-center gap-6">
          <Link href="/leads">
            <Button variant="outline" size="sm" className="shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-3xl font-bold tracking-tight">
                      Lead Details
                    </h1>
                    {fineractLoanStatus && (
                      <Badge
                        className={`${getStatusBadgeColor(
                          fineractLoanStatus
                        )} text-white border-0 whitespace-normal break-words`}
                      >
                        {fineractLoanStatus?.toLowerCase() === "active"
                          ? "Disbursed"
                          : fineractLoanStatus}
                      </Badge>
                    )}
                    {cdeResult && (
                      <Link href={`/leads/${id}/cde`}>
                        <Badge
                          className={`${
                            cdeResult.decision === "APPROVED"
                              ? "bg-green-500"
                              : cdeResult.decision === "MANUAL_REVIEW"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          } text-white border-0 whitespace-normal break-words cursor-pointer hover:opacity-80 transition-opacity`}
                        >
                          CDE: {cdeResult.decision}
                          {cdeResult.scoringResult?.creditScore && (
                            <span className="ml-2 opacity-90">
                              • Score: {cdeResult.scoringResult.creditScore}
                            </span>
                          )}
                          {cdeResult.pricingResult?.calculatedAPR && (
                            <span className="ml-2 opacity-90">
                              • APR:{" "}
                              {cdeResult.pricingResult.calculatedAPR.toFixed(1)}
                              %
                            </span>
                          )}
                        </Badge>
                      </Link>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {lead.externalId && (
                      <span className="mr-3">
                        ID:{" "}
                        <span className="font-mono font-medium text-foreground">
                          {lead.externalId}
                        </span>
                      </span>
                    )}
                    <span className="mr-3">
                      Stage:{" "}
                      <span className="font-medium text-foreground">
                        {currentStage}
                      </span>
                    </span>
                    {lead.clientTypeName && (
                      <span className="mr-3">
                        Type:{" "}
                        <span className="font-medium text-foreground">
                          {lead.clientTypeName}
                        </span>
                      </span>
                    )}
                    {fineractLoanId && (
                      <span>
                        Loan:{" "}
                        <span className="font-mono font-medium text-foreground">
                          #{fineractLoanId}
                        </span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
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
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="details">
                <FileText className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Details</span>
              </TabsTrigger>
              <TabsTrigger value="additional-info">
                <Database className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Additional Info</span>
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <Activity className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Documents</span>
              </TabsTrigger>
              <TabsTrigger value="validations">
                <ShieldCheck className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Validations</span>
              </TabsTrigger>
              <TabsTrigger value="communication">
                <MessageSquare className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Communication</span>
              </TabsTrigger>
              <TabsTrigger value="affordability">
                <Calculator className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">CDE</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              <ComprehensiveLeadDetails leadId={id} />
            </TabsContent>
            <TabsContent value="additional-info" className="mt-4">
              <LeadAdditionalInfo
                leadId={id}
                clientId={lead.fineractClientId || null}
                datatables={clientDatatables}
                datatableData={datatableData}
              />
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Timeline</CardTitle>
                  <CardDescription>
                    Track the progress of this lead through the pipeline
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LeadTimeline leadId={id} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <LeadDocuments
                leadId={id}
                fineractClientId={lead.fineractClientId || null}
                fineractLoanId={fineractLoanId || null}
                initialClientDocuments={clientDocuments}
                initialLoanDocuments={loanDocuments}
              />
            </TabsContent>
            <TabsContent value="validations" className="mt-4">
              <LeadValidations leadId={id} stage={currentStage} />
            </TabsContent>
            <TabsContent value="communication" className="mt-4">
              <LeadCommunications leadId={id} />
            </TabsContent>
            <TabsContent value="affordability" className="mt-4">
              <LeadCDE leadId={id} />
            </TabsContent>
          </Tabs>
        </div>
        <div className="mt-10">
          <LeadSidebar leadId={id} />
        </div>
      </div>
    </div>
  );
}
