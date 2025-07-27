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
import { LeadDocuments } from "./components/lead-documents";
import { LeadActions } from "./components/lead-actions";
import { LeadValidations } from "./components/lead-validations";
import { LeadAffordability } from "./components/lead-affordability";
import { PipelineStateMachineWrapper } from "@/components/state-machine/pipeline-state-machine-wrapper";
import {
  ArrowLeft,
  Clock,
  FileText,
  MessageSquare,
  Activity,
  ShieldCheck,
  ArrowRight,
  Calculator,
  Play,
} from "lucide-react";
import Link from "next/link";
import { PrismaClient } from "@/app/generated/prisma";
import { headers } from "next/headers";

const prisma = new PrismaClient();

async function getLeadData(leadId: string) {
  try {
    // Get tenant from headers
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id") || "default-tenant";

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

    return { lead, stages };
  } catch (error) {
    console.error("Error fetching lead data:", error);
    return { lead: null, stages: [] };
  }
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { lead, stages } = await getLeadData(id);

  // Mock data for demonstration if no real lead found
  const mockLead = {
    id: id,
    firstname: "John",
    lastname: "Doe",
    emailAddress: "john.doe@example.com",
    status: "active",
    currentStageId: stages[0]?.id || "stage-1",
  };

  const currentLead = lead || mockLead;
  const currentStage = lead?.currentStage?.name || "New Lead";

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
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">Lead #{id}</h2>
              <Badge className="bg-yellow-500 text-white border-0">
                In Progress
              </Badge>
            </div>
            <p className="text-muted-foreground">Business Loan - $125,000</p>
          </div>
        </div>
        <LeadActions leadId={id} />
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
                <span className="whitespace-nowrap">Affordability</span>
              </TabsTrigger>
              <TabsTrigger value="state-machine">
                <Play className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">State Machine</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              <LeadDetails leadId={id} />
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
              <Card>
                <CardHeader>
                  <CardTitle>Communication History</CardTitle>
                  <CardDescription>
                    All communications with the client
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-40">
                    <p className="text-muted-foreground">
                      Communication history will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="affordability" className="mt-4">
              <LeadAffordability leadId={id} />
            </TabsContent>
            <TabsContent value="state-machine" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pipeline State Machine</CardTitle>
                  <CardDescription>
                    Interactive state machine showing lead progression through
                    pipeline stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PipelineStateMachineWrapper
                    lead={currentLead}
                    stages={
                      stages.length > 0
                        ? stages.map((stage) => ({
                            ...stage,
                            description: stage.description || "",
                          }))
                        : [
                            {
                              id: "stage-1",
                              name: "New Lead",
                              description:
                                "Initial contact with potential client",
                              order: 1,
                              color: "#3b82f6",
                              isActive: true,
                              isInitialState: true,
                              isFinalState: false,
                              allowedTransitions: ["stage-2", "stage-6"],
                            },
                            {
                              id: "stage-2",
                              name: "Qualification",
                              description:
                                "Assessing lead requirements and fit",
                              order: 2,
                              color: "#8b5cf6",
                              isActive: true,
                              isInitialState: false,
                              isFinalState: false,
                              allowedTransitions: ["stage-3", "stage-6"],
                            },
                            {
                              id: "stage-3",
                              name: "Proposal",
                              description: "Preparing and sending proposal",
                              order: 3,
                              color: "#ec4899",
                              isActive: true,
                              isInitialState: false,
                              isFinalState: false,
                              allowedTransitions: ["stage-4", "stage-6"],
                            },
                            {
                              id: "stage-4",
                              name: "Negotiation",
                              description: "Discussing terms and conditions",
                              order: 4,
                              color: "#f59e0b",
                              isActive: true,
                              isInitialState: false,
                              isFinalState: false,
                              allowedTransitions: ["stage-5", "stage-6"],
                            },
                            {
                              id: "stage-5",
                              name: "Closed Won",
                              description:
                                "Successfully converted lead to customer",
                              order: 5,
                              color: "#10b981",
                              isActive: true,
                              isInitialState: false,
                              isFinalState: true,
                              allowedTransitions: [],
                            },
                            {
                              id: "stage-6",
                              name: "Closed Lost",
                              description: "Lead did not convert to customer",
                              order: 6,
                              color: "#ef4444",
                              isActive: true,
                              isInitialState: false,
                              isFinalState: true,
                              allowedTransitions: [],
                            },
                          ]
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Turn-Around Time
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">Current Stage</span>
                    <span className="text-xs font-medium text-blue-400">
                      Credit Assessment
                    </span>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">Time in Stage</span>
                    <span className="text-xs font-medium text-yellow-400">
                      2d 4h (SLA: 3d)
                    </span>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">Total Time</span>
                    <span className="text-xs font-medium text-green-400">
                      5d 7h
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <h4 className="text-xs font-semibold mb-2">
                    Stage TAT Performance
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Lead Qualification</span>
                        <span className="text-xs text-green-400">
                          1d 2h (SLA: 2d)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Document Collection</span>
                        <span className="text-xs text-green-400">
                          2d 1h (SLA: 3d)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Credit Assessment</span>
                        <span className="text-xs text-yellow-400">
                          2d 4h (SLA: 3d)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Approval</span>
                        <span className="text-xs text-muted-foreground">
                          Pending
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Disbursement</span>
                        <span className="text-xs text-muted-foreground">
                          Pending
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add validation summary card to the sidebar */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Validation Summary
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Required Fields</span>
                  <Badge className="bg-green-500 text-white">Passed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Document Verification</span>
                  <Badge className="bg-red-500 text-white">Failed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Budget Information</span>
                  <Badge className="bg-yellow-500 text-white">Warning</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Contact Information</span>
                  <Badge className="bg-green-500 text-white">Passed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Credit Score</span>
                  <Badge className="bg-yellow-500 text-white">Warning</Badge>
                </div>
                <div className="pt-3 mt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-blue-400"
                    asChild
                  >
                    <a href={`/leads/${id}?tab=validations`}>
                      View All Validations
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Assigned Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">JD</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">John Doe</p>
                      <p className="text-xs text-muted-foreground">
                        Lead Qualifier
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-green-500 bg-green-500/10 text-green-400"
                  >
                    Completed
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">AS</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Alice Smith</p>
                      <p className="text-xs text-muted-foreground">
                        Document Specialist
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-green-500 bg-green-500/10 text-green-400"
                  >
                    Completed
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">RJ</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Robert Johnson</p>
                      <p className="text-xs text-muted-foreground">
                        Credit Analyst
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-yellow-500 bg-yellow-500/10 text-yellow-400"
                  >
                    In Progress
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
