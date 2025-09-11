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

import { RefreshCw, FileText, BarChart3, Smartphone } from "lucide-react";
import { UssdLeadMetrics } from "./components/ussd-lead-metrics";
import { UssdLeadsTable } from "./components/ussd-leads-table";
import { getUssdLeadsData } from "@/app/actions/ussd-leads-actions";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "USSD Leads | KENAC Loan Matrix",
  description: "Manage USSD loan application leads from mobile users",
};

export default async function UssdLeadsPage() {
  // Get tenant slug from headers (set by middleware)
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "default";

  // Fetch USSD leads data server-side
  const ussdLeadsData = await getUssdLeadsData(tenantSlug);

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-blue-500" />
            USSD Leads
          </h2>
          <p className="text-muted-foreground">
            Manage loan applications submitted via USSD from mobile users
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-blue-50 hover:bg-blue-100">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <UssdLeadMetrics className="mt-6" metrics={ussdLeadsData.metrics} />

      <Tabs defaultValue="table" className="mt-6">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger
            value="table"
            className="data-[state=active]:bg-blue-500"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">All Applications</span>
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-blue-500"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Analytics</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>USSD Loan Applications</CardTitle>
              <CardDescription>
                Review and process loan applications submitted via USSD
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UssdLeadsTable initialData={ussdLeadsData} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>USSD Analytics</CardTitle>
              <CardDescription>
                Insights and trends for USSD loan applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Analytics dashboard coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
