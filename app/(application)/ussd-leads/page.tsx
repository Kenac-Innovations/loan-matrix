import type { Metadata } from "next";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Phone,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { getUssdLeadsData } from "@/app/actions/ussd-leads-actions";
import { headers } from "next/headers";
import { UssdLeadsMetrics } from "./components/ussd-leads-metrics";
import { UssdDateRangeFilter } from "./components/ussd-date-range-filter";
import { UssdWorkspaceTabs } from "./components/ussd-workspace-tabs";

export const metadata: Metadata = {
  title: "USSD Leads | KENAC Loan Matrix",
  description: "Manage USSD applications and pipeline leads from mobile users",
};

type UssdLeadsPageSearchParams = Promise<{
  startDate?: string;
  endDate?: string;
  range?: string;
}>;

function isDateParam(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default async function UssdLeadsPage({
  searchParams,
}: {
  searchParams?: UssdLeadsPageSearchParams;
}) {
  // Get tenant slug from headers (set by middleware)
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "goodfellow";
  const resolvedSearchParams = (await searchParams) ?? {};
  const today = format(new Date(), "yyyy-MM-dd");
  const isAllDates = resolvedSearchParams.range === "all";
  const startDate = isAllDates
    ? undefined
    : isDateParam(resolvedSearchParams.startDate)
    ? resolvedSearchParams.startDate
    : today;
  const endDate = isAllDates
    ? undefined
    : isDateParam(resolvedSearchParams.endDate)
    ? resolvedSearchParams.endDate
    : startDate;
  const refreshHref = isAllDates
    ? "/ussd-leads?range=all"
    : `/ussd-leads?startDate=${startDate}&endDate=${endDate}`;
  const ussdLeadsData = await getUssdLeadsData(tenantSlug, {
    startDate,
    endDate,
  });

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
          <UssdDateRangeFilter
            startDate={startDate}
            endDate={endDate}
            isAllDates={isAllDates}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={refreshHref}>
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

      <UssdWorkspaceTabs
        applications={ussdLeadsData?.applications ?? []}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
}
