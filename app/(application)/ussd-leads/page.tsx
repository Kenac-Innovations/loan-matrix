import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  FileText,
  RefreshCw,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { getLeadsData } from "@/app/actions/leads-actions";
import { getUssdLeadsData } from "@/app/actions/ussd-leads-actions";
import { headers } from "next/headers";
import { UssdLeadsMetrics } from "./components/ussd-leads-metrics";
import UssdLoanApplicationsTable from "@/components/tables/UssdLoanApplicationsTable";
import { PipelineView } from "../leads/components/pipeline-view";
import type { LeadsData } from "@/app/actions/leads-actions";

export const metadata: Metadata = {
  title: "USSD Leads | KENAC Loan Matrix",
  description: "Manage USSD applications and pipeline leads from mobile users",
};

export default async function UssdLeadsPage() {
  // Get tenant slug from headers (set by middleware)
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "goodfellow";

  const emptyPipelineData: LeadsData = {
    leads: [],
    pipelineStages: [],
    metrics: {
      activeLeads: 0,
      conversionRate: 0,
      avgProcessingTime: 0,
      slaCompliance: 0,
      onTimeCount: 0,
      atRiskCount: 0,
      overdueCount: 0,
      monthlyTarget: 0,
      conversionTarget: 0,
      processingTimeTarget: 0,
      conversionMetrics: { labels: [], conversionRates: [] },
      stageTATMetrics: [],
    },
    pagination: {
      total: 0,
      limit: 10,
      offset: 0,
      hasMore: false,
    },
  };

  // Fetch USSD applications and the linked pipeline leads in parallel.
  // The leads load is allowed to fail softly so the workspace still opens.
  const [ussdLeadsResult, ussdPipelineResult] = await Promise.allSettled([
    getUssdLeadsData(tenantSlug),
    getLeadsData(tenantSlug, { source: "USSD" }),
  ]);

  const ussdLeadsData =
    ussdLeadsResult.status === "fulfilled"
      ? ussdLeadsResult.value
      : null;

  const ussdPipelineData =
    ussdPipelineResult.status === "fulfilled"
      ? ussdPipelineResult.value
      : emptyPipelineData;

  if (ussdLeadsResult.status === "rejected") {
    console.error("Failed to load USSD applications:", ussdLeadsResult.reason);
  }

  if (ussdPipelineResult.status === "rejected") {
    console.error("Failed to load USSD pipeline leads:", ussdPipelineResult.reason);
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Phone className="h-6 w-6 text-blue-500" />
            USSD Leads
          </h2>
          <p className="text-muted-foreground">
            Manage loan applications submitted via USSD
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/ussd-leads">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Link>
          </Button>
        </div>
      </div>

      <UssdLeadsMetrics
        className="mt-6"
        metrics={ussdLeadsData?.metrics ?? {
          totalApplications: 0,
          pendingAction: 0,
          approved: 0,
          rejected: 0,
          disbursed: 0,
          underReview: 0,
          cancelled: 0,
          expired: 0,
          approvalRate: 0,
          averageProcessingTime: 0,
          monthlyTarget: 0,
          completionRate: 0,
        }}
      />

      <Tabs defaultValue="applications" className="mt-6">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger
            value="applications"
            className="w-full data-[state=active]:bg-blue-500"
          >
            <Clock className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">USSD Applications</span>
          </TabsTrigger>
          <TabsTrigger
            value="leads"
            className="w-full data-[state=active]:bg-blue-500"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">USSD Leads</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>USSD Applications</CardTitle>
              <CardDescription>
                Review incoming USSD applications before they are converted into leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UssdLoanApplicationsTable
                ussdLoanApplications={ussdLeadsData?.applications ?? []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <PipelineView
            initialData={ussdPipelineData}
            source="USSD"
            title="USSD Leads"
            description="Pipeline-style view of leads created from USSD applications"
            leadTitle="USSD Pipeline Leads"
            leadDescription="View and manage the lead records created from USSD applications"
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
