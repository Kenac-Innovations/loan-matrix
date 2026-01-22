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
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

export const metadata: Metadata = {
  title: "Lead Management | KENAC Loan Matrix",
  description: "Track and manage loan leads through the sales pipeline",
};

// Check if user has Loan Officer role (only sees their assigned leads)
async function getUserRoleFilter(): Promise<{ isLoanOfficer: boolean; userId: number | null }> {
  try {
    const session = await getSession();
    if (!session?.user?.userId) {
      return { isLoanOfficer: false, userId: null };
    }

    const mifosUserId = session.user.userId;
    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return { isLoanOfficer: false, userId: null };
    }

    // Check if user has Loan Officer role in local DB
    const userRoles = await prisma.userRole.findMany({
      where: {
        tenantId: tenant.id,
        mifosUserId: mifosUserId,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    // Check if any role is "LOAN_OFFICER"
    const isLoanOfficer = userRoles.some(
      (ur) => ur.role.name === "LOAN_OFFICER"
    );

    return { isLoanOfficer, userId: mifosUserId };
  } catch (error) {
    console.error("Error checking user role:", error);
    return { isLoanOfficer: false, userId: null };
  }
}

export default async function LeadsPage() {
  // Get tenant slug from headers (set by middleware)
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "default";

  // Check if user is a Loan Officer (should only see their assigned leads)
  const { isLoanOfficer, userId } = await getUserRoleFilter();

  // Fetch all leads for accurate metrics (skipFineractStatus for speed)
  // DB query is fast, the slow part was Fineract API calls which we skip
  // If user is Loan Officer, filter by their assigned leads
  const fullData = await getLeadsData(tenantSlug, {
    limit: 5000, // High limit for accurate metrics
    skipFineractStatus: true,
    ...(isLoanOfficer && userId ? { assignedToUserId: userId } : {}),
  });

  // Use full data for metrics, but limit leads array for table rendering
  const leadsData = {
    ...fullData,
    leads: fullData.leads.slice(0, 100), // Limit table to 100 for faster rendering
  };

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lead Management</h2>
          <p className="text-muted-foreground">
            {isLoanOfficer
              ? "View and manage your assigned leads"
              : "Track leads through the loan processing pipeline"}
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

      <Tabs defaultValue="table" className="mt-6 w-full">
        <TabsList>
          <TabsTrigger
            value="table"
            className="w-full data-[state=active]:bg-blue-500 flex-1 lg:flex-initial"
          >
            <FileText className="h-4 w-4 lg:mr-2" />
            <span className="whitespace-nowrap hidden lg:inline">
              Table View
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="pipeline"
            className="w-full data-[state=active]:bg-blue-500 flex-1 lg:flex-initial"
          >
            <BarChart3 className="h-4 w-4 lg:mr-2" />
            <span className="whitespace-nowrap hidden lg:inline">
              Pipeline View
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{isLoanOfficer ? "My Leads" : "All Leads"}</CardTitle>
              <CardDescription>
                {isLoanOfficer
                  ? `Leads assigned to you (showing ${leadsData.leads.length} of ${fullData.pagination.total})`
                  : `Manage and track leads (showing ${leadsData.leads.length} of ${fullData.pagination.total})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadsTable initialData={leadsData} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineView initialData={leadsData} />
        </TabsContent>
      </Tabs>
    </>
  );
}
