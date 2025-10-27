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
  Clock
} from "lucide-react";
import { getUssdLeadsData } from "@/app/actions/ussd-leads-actions";
import { headers } from "next/headers";
import { UssdLeadsMetrics } from "./components/ussd-leads-metrics";
import UssdLoanApplicationsTable from "@/components/tables/UssdLoanApplicationsTable";
import { UssdLoanApplicationStatus } from "@/shared/types";

export const metadata: Metadata = {
  title: "USSD Leads | KENAC Loan Matrix",
  description: "Manage USSD loan applications from mobile users",
};

export default async function UssdLeadsPage() {
  // Get tenant slug from headers (set by middleware)d
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "goodfellow";

  // Fetch USSD leads data server-side
  const ussdLeadsData = await getUssdLeadsData("goodfellow");

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
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <UssdLeadsMetrics className="mt-6" metrics={ussdLeadsData.metrics} />

      <Tabs defaultValue="new-leads" className="mt-6">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger
            value="new-leads"
            className="w-full data-[state=active]:bg-blue-500"
          >
            <Clock className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">New USSD Leads</span>
          </TabsTrigger>
          <TabsTrigger
            value="all-leads"
            className="w-full data-[state=active]:bg-blue-500"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">All USSD Leads</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new-leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>New USSD Loan Applications</CardTitle>
              <CardDescription>
                Review and process new loan applications (Status: CREATED)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UssdLoanApplicationsTable 
                ussdLoanApplications={ussdLeadsData.applications} 
                filterStatus={UssdLoanApplicationStatus.CREATED}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All USSD Loan Applications</CardTitle>
              <CardDescription>
                View all loan applications with full history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UssdLoanApplicationsTable ussdLoanApplications={ussdLeadsData.applications} />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </>
  );
}


