"use client";

import useSWR from "swr";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UssdLinkedLeadsTable } from "./ussd-linked-leads-table";
import type { LeadsData } from "@/app/actions/leads-actions";
import type { Lead } from "@/shared/types/lead";

interface UssdLinkedLeadsPanelProps {
  enabled: boolean;
  startDate?: string;
  endDate?: string;
}

const fetcher = async (url: string): Promise<LeadsData> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to load USSD leads");
  }

  return response.json();
};

export function UssdLinkedLeadsPanel({
  enabled,
  startDate,
  endDate,
}: UssdLinkedLeadsPanelProps) {
  const queryString = new URLSearchParams({
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  }).toString();
  const dataUrl = `/api/leads/paginated?source=USSD&limit=100&offset=0&skipFineractStatus=true${
    queryString ? `&${queryString}` : ""
  }`;

  const { data, error, isLoading, mutate } = useSWR<LeadsData>(
    enabled ? dataUrl : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  );

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-8 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">Loading USSD leads</p>
          <p className="text-sm text-muted-foreground">
            Leads are fetched only when you open this tab to keep the page fast.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <div>
          <p className="font-medium text-foreground">Failed to load USSD leads</p>
          <p className="text-sm text-muted-foreground">
            The applications tab is still available while we retry the leads feed.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void mutate()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <UssdLinkedLeadsTable
      leads={data.leads as Lead[]}
      pipelineStages={data.pipelineStages}
    />
  );
}
