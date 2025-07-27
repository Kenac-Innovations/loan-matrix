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

import { Plus, FileText, BarChart3 } from "lucide-react";
import Link from "next/link";
import { LeadMetrics } from "./components/lead-metrics";
import { PipelineView } from "./components/pipeline-view";
import { LeadsTable } from "./components/leads-table";
import { getLeadsData } from "@/app/actions/leads-actions";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Lead Management | KENAC Loan Matrix",
  description: "Track and manage loan leads through the sales pipeline",
};

export default async function LeadsPage() {
  // Get tenant slug from headers (set by middleware)
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "default";

  // Fetch leads data server-side
  const leadsData = await getLeadsData(tenantSlug);

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lead Management</h2>
          <p className="text-muted-foreground">
            Track leads through the loan processing pipeline
          </p>
        </div>
        <Button className="bg-blue-500 hover:bg-blue-600" asChild>
          <Link href="/leads/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Lead
          </Link>
        </Button>
      </div>

      <LeadMetrics className="mt-6" metrics={leadsData.metrics} />

      <Tabs defaultValue="pipeline" className="mt-6">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger
            value="pipeline"
            className="data-[state=active]:bg-blue-500"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Pipeline View</span>
          </TabsTrigger>
          <TabsTrigger
            value="table"
            className="data-[state=active]:bg-blue-500"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Table View</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineView initialData={leadsData} />
        </TabsContent>
        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Leads</CardTitle>
              <CardDescription>
                Manage and track all leads in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadsTable initialData={leadsData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
