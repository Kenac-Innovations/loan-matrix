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
import { LeadCommunications } from "./components/lead-communications";
import { LeadStateMachine } from "./components/lead-state-machine";
import { LeadSidebar } from "./components/lead-sidebar";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Activity,
  ShieldCheck,
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

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    );
  }

  const currentStage = lead.currentStage?.name || "New Lead";
  const fullName =
    [lead.firstname, lead.middlename, lead.lastname]
      .filter(Boolean)
      .join(" ") || `Lead #${id}`;

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
              <h2 className="text-2xl font-bold tracking-tight">{fullName}</h2>
              <Badge
                className={`text-white border-0 ${
                  lead.status === "DRAFT"
                    ? "bg-gray-500"
                    : lead.status === "SUBMITTED"
                    ? "bg-blue-500"
                    : lead.status === "CLOSED"
                    ? "bg-green-500"
                    : "bg-yellow-500"
                }`}
              >
                {lead.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {currentStage} • {lead.clientTypeName || "Individual Client"}
            </p>
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
              <LeadCommunications leadId={id} />
            </TabsContent>
            <TabsContent value="affordability" className="mt-4">
              <LeadAffordability leadId={id} />
            </TabsContent>
            <TabsContent value="state-machine" className="mt-4">
              <LeadStateMachine leadId={id} />
            </TabsContent>
          </Tabs>
        </div>
        <div>
          <LeadSidebar leadId={id} />
        </div>
      </div>
    </>
  );
}
