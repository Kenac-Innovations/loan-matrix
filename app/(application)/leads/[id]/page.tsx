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
import { LeadStateMachine } from "./components/lead-state-machine";
import { LeadSidebar } from "./components/lead-sidebar";
import TransitionHistory from "./components/transition-history";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Activity,
  ShieldCheck,
  Calculator,
  Play,
  Info,
  History,
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

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143";

/**
 * Get Fineract loan status by calling Fineract API directly
 * Tries by loan ID first, then by external ID (leadId) as fallback
 */
async function getFineractLoanStatus(
  loanId: number | string | null,
  leadId: string,
  tenantSlug: string
): Promise<string | null> {
  try {
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      console.warn("No access token available for Fineract API call");
      return null;
    }

    const fineractService = getFineractService(accessToken, tenantSlug);

    // Try fetching by loan ID first if available
    if (loanId) {
      console.log("Fetching Fineract loan status by loan ID:", loanId);
      try {
        const loanData = await fineractService.getLoan(Number(loanId));
        const status = loanData.status?.value || null;
        if (status) {
          console.log("Fineract loan status fetched by ID:", status);
          return status;
        }
      } catch (error) {
        console.warn(`Failed to fetch Fineract loan by ID ${loanId}:`, error);
      }
    }

    // Fallback: Try fetching by external ID (leadId) using direct Fineract API call
    console.log("Attempting to fetch loan status by external ID:", leadId);
    try {
      const searchUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans?externalId=${encodeURIComponent(
        leadId
      )}`;
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": tenantSlug,
          Accept: "application/json",
        },
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
          if (status) {
            console.log("Fineract loan status fetched by external ID:", status);
            return status;
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

    return null;
  } catch (error) {
    console.error("Error fetching Fineract loan status:", error);
    return null;
  }
}

/**
 * Get status badge color
 */
function getStatusBadgeColor(status: string | null): string {
  if (!status) return "bg-gray-500";
  const statusLower = status.toLowerCase();
  if (statusLower.includes("active")) return "bg-green-500";
  if (statusLower.includes("approved")) return "bg-blue-500";
  if (statusLower.includes("submitted") || statusLower.includes("pending"))
    return "bg-yellow-500";
  if (statusLower.includes("closed")) return "bg-gray-500";
  return "bg-gray-500";
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

    // Fetch Fineract loan status directly from Fineract API
    // No need for internal HTTP calls - we call Fineract directly from this Server Component
    // Note: fineractLoanId doesn't exist in schema, so we always fetch by external ID (leadId)
    const fineractLoanStatus = await getFineractLoanStatus(
      null,
      leadId,
      tenantSlug
    );

    // Extract CDE result from stateMetadata
    const stateMetadata = (lead as any)?.stateMetadata as any;
    const cdeResult = stateMetadata?.cdeResult || null;

    return { lead, stages, fineractLoanStatus, cdeResult };
  } catch (error) {
    console.error("Error fetching lead data:", error);
    return {
      lead: null,
      stages: [],
      fineractLoanStatus: null,
      cdeResult: null,
    };
  }
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { lead, stages, fineractLoanStatus, cdeResult } = await getLeadData(id);

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    );
  }

  const currentStage = lead.currentStage?.name || "New Lead";

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild className="h-8 w-8">
            <Link href="/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight">Lead #{id}</h2>
              {fineractLoanStatus && (
                <Badge
                  className={`${getStatusBadgeColor(
                    fineractLoanStatus
                  )} text-white border-0 whitespace-normal break-words`}
                >
                  {fineractLoanStatus}
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
                        {cdeResult.pricingResult.calculatedAPR.toFixed(1)}%
                      </span>
                    )}
                  </Badge>
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {lead.externalId && (
                <span>
                  External ID:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {lead.externalId}
                  </span>
                </span>
              )}
              <span>
                Stage:{" "}
                <span className="font-medium text-foreground">
                  {currentStage}
                </span>
              </span>
              {lead.clientTypeName && (
                <span>
                  Type:{" "}
                  <span className="font-medium text-foreground">
                    {lead.clientTypeName}
                  </span>
                </span>
              )}
              {(lead as any).fineractLoanId && (
                <span>
                  Loan ID:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {(lead as any).fineractLoanId}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        <LeadActions leadId={id} currentStage={currentStage} />
      </div>

      <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="details">
                <FileText className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Details</span>
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
              <TabsTrigger value="state-machine">
                <Play className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">State Machine</span>
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">History</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              <ComprehensiveLeadDetails leadId={id} />
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
              <LeadDocuments leadId={id} />
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
            <TabsContent value="state-machine" className="mt-4">
              <LeadStateMachine leadId={id} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <TransitionHistory leadId={id} />
            </TabsContent>
          </Tabs>
        </div>
        <div className="mt-10">
          <LeadSidebar leadId={id} />
        </div>
      </div>
    </>
  );
}
