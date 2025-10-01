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
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  FileText, 
  BarChart3, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Calendar
} from "lucide-react";
import { getUssdLeadsData } from "@/app/actions/ussd-leads-actions";
import { headers } from "next/headers";
import { UssdLeadsTable } from "./components/ussd-leads-table";
import { UssdLeadsMetrics } from "./components/ussd-leads-metrics";

export const metadata: Metadata = {
  title: "USSD Leads | KENAC Loan Matrix",
  description: "Manage USSD loan applications from mobile users",
};

export default async function UssdLeadsPage() {
  // Get tenant slug from headers (set by middleware)
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "goodfellow";

  // Fetch USSD leads data server-side
  const ussdLeadsData = await getUssdLeadsData(tenantSlug);

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

      <Tabs defaultValue="table" className="mt-6">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger
            value="table"
            className="data-[state=active]:bg-blue-500"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Applications</span>
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
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
        
        <TabsContent value="metrics" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{ussdLeadsData.metrics.totalApplications}</div>
                <p className="text-xs text-muted-foreground">
                  All time applications
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Action</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{ussdLeadsData.metrics.pendingAction}</div>
                <p className="text-xs text-muted-foreground">
                  Need review
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{ussdLeadsData.metrics.approvalRate}%</div>
                <p className="text-xs text-muted-foreground">
                  Success rate
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{ussdLeadsData.metrics.approved}</div>
                <p className="text-xs text-muted-foreground">
                  Applications approved
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{ussdLeadsData.metrics.rejected}</div>
                <p className="text-xs text-muted-foreground">
                  Applications rejected
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{ussdLeadsData.metrics.averageProcessingTime}h</div>
                <p className="text-xs text-muted-foreground">
                  Time to process
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}


