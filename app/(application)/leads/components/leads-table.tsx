"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LeadsData, fetchLeadStatuses } from "@/app/actions/leads-actions";
import { Lead } from "@/shared/types";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn, DataTableFilter } from "@/shared/types/data-table";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { FileEdit, User, Loader2, RefreshCw } from "lucide-react";
import useSWR from "swr";

interface LeadsTableProps {
  initialData: LeadsData;
}

// Helper function to get status badge color based on Fineract loan status
function getStatusBadgeColor(status: string): string {
  const statusLower = status.toLowerCase();
  // Active/Disbursed - green
  if (statusLower.includes("active") || statusLower.includes("disbursed")) {
    return "bg-green-500 hover:bg-green-600";
  }
  // Approved (not pending) - blue
  if (statusLower.includes("approved") && !statusLower.includes("pending")) {
    return "bg-blue-500 hover:bg-blue-600";
  }
  // Pending/Submitted - yellow
  if (statusLower.includes("pending") || statusLower.includes("submitted")) {
    return "bg-yellow-500 hover:bg-yellow-600";
  }
  // Rejected/Withdrawn - red
  if (statusLower.includes("rejected") || statusLower.includes("withdrawn")) {
    return "bg-red-500 hover:bg-red-600";
  }
  // Closed/Written off - gray
  if (statusLower.includes("closed") || statusLower.includes("written off")) {
    return "bg-gray-500 hover:bg-gray-600";
  }
  // Overpaid - purple
  if (statusLower.includes("overpaid")) {
    return "bg-purple-500 hover:bg-purple-600";
  }
  return "bg-blue-500 hover:bg-blue-600";
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Predefined Fineract loan statuses for filter dropdown
const LOAN_STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "Submitted and pending approval", value: "Submitted and pending approval" },
  { label: "Approved", value: "Approved" },
  { label: "Disbursed", value: "Active" }, // "Active" in Fineract = Disbursed
  { label: "Closed (obligations met)", value: "Closed (obligations met)" },
  { label: "Closed (written off)", value: "Closed (written off)" },
  { label: "Closed (rescheduled)", value: "Closed (rescheduled)" },
  { label: "Overpaid", value: "Overpaid" },
  { label: "Rejected", value: "Rejected" },
  { label: "Withdrawn by applicant", value: "Withdrawn by applicant" },
];


export function LeadsTable({ initialData }: LeadsTableProps) {
  const { leads: initialLeads, pipelineStages } = initialData;
  const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
    { columnId: "leadStatus", value: "", type: "select" },
  ]);
  const [navigatingLeadId, setNavigatingLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for Fineract statuses fetched after initial load
  const [leadStatuses, setLeadStatuses] = useState<Record<string, { status: string | null; payoutStatus?: string }>>({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const statusesFetchedRef = useRef<Set<string>>(new Set());

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch Fineract statuses for leads that have been submitted to Fineract
  useEffect(() => {
    const fetchStatuses = async () => {
      // Get leads that need status fetch (submitted to Fineract but status not yet fetched)
      const leadsNeedingStatus = (initialLeads as Lead[]).filter(
        (lead) =>
          lead.loanSubmittedToFineract &&
          !lead.fineractLoanStatus &&
          !statusesFetchedRef.current.has(lead.id)
      );

      if (leadsNeedingStatus.length === 0) return;

      // Mark these leads as being fetched
      leadsNeedingStatus.forEach((lead) => statusesFetchedRef.current.add(lead.id));

      setIsLoadingStatuses(true);
      try {
        const leadIds = leadsNeedingStatus.map((lead) => lead.id);
        const statuses = await fetchLeadStatuses(leadIds);
        setLeadStatuses((prev) => ({ ...prev, ...statuses }));
      } catch (error) {
        console.error("Error fetching lead statuses:", error);
      } finally {
        setIsLoadingStatuses(false);
      }
    };

    fetchStatuses();
  }, [initialLeads]);

  // Check if status filter is active (need to fetch Fineract statuses)
  const hasStatusFilter = customFilters.some(
    (f) => f.columnId === "leadStatus" && f.value && f.value !== ""
  );

  // Always fetch data via SWR for live updates
  // Use initialData for fast first render, then poll for updates
  const { data: serverData, isLoading: isSearching, mutate } = useSWR(
    `/api/leads/paginated?${new URLSearchParams({
      limit: "100",
      skipFineractStatus: hasStatusFilter ? "false" : "true",
      ...(debouncedSearch.length >= 2 ? { search: debouncedSearch } : {}),
      ...Object.fromEntries(
        customFilters
          .filter((f) => f.value)
          .map((f) => [f.columnId, String(f.value)])
      ),
    }).toString()}`,
    fetcher,
    {
      fallbackData: { leads: initialLeads },
      refreshInterval: 30000, // Poll every 30 seconds
      revalidateOnFocus: true, // Refresh when user returns to tab
      revalidateOnReconnect: true, // Refresh on network reconnect
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  );

  // Expose mutate for manual refresh if needed
  const refreshLeads = useCallback(() => {
    mutate();
    // Also refresh statuses
    statusesFetchedRef.current.clear();
    setLeadStatuses({});
  }, [mutate]);

  // Use server data (with fallback to initial data via SWR)
  // Merge fetched statuses with leads data
  const leads = useMemo(() => {
    const baseLeads = serverData?.leads || initialLeads;
    
    // If no statuses fetched, return base leads
    if (Object.keys(leadStatuses).length === 0) {
      return baseLeads;
    }
    
    // Merge fetched statuses into leads
    return (baseLeads as Lead[]).map((lead) => {
      const fetchedStatus = leadStatuses[lead.id];
      if (fetchedStatus && fetchedStatus.status) {
        return {
          ...lead,
          fineractLoanStatus: fetchedStatus.status,
          payoutStatus: fetchedStatus.payoutStatus || lead.payoutStatus,
        };
      }
      return lead;
    });
  }, [serverData?.leads, initialLeads, leadStatuses]);

  // Define table columns using DataTableColumn format
  const columns: DataTableColumn<Lead>[] = [
    {
      id: "rowNumber",
      header: "#",
      cell: ({ row }) => {
        return (
          <span className="text-muted-foreground font-mono text-xs">
            {row.index + 1}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      id: "client",
      accessorKey: "client",
      header: "Client",
      cell: ({ getValue, row }) => {
        const isNavigating = navigatingLeadId === row.original.id;
        return (
          <div className="flex items-center gap-2">
            {isNavigating ? (
              <div className="h-8 w-8 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getValue()
                    ? (getValue() as string)
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "UN"}
                </AvatarFallback>
              </Avatar>
            )}
            <span className={isNavigating ? "opacity-50" : ""}>
              {getValue()}
            </span>
          </div>
        );
      },
    },
    {
      id: "leadStatus",
      accessorKey: "fineractLoanStatus",
      header: "Status",
      cell: ({ row }) => {
        const lead = row.original;
        const status = lead.fineractLoanStatus;

        if (status === "Draft" || !status) {
          return (
            <Badge
              variant="outline"
              className="border-yellow-500 bg-yellow-500/10 text-yellow-600 text-xs"
            >
              <FileEdit className="h-3 w-3 mr-1" />
              Draft
            </Badge>
          );
        }

        // Transform "Active" to "Disbursed" for better clarity
        const displayStatus = status === "Active" ? "Disbursed" : status;
        return (
          <Badge
            className={`${getStatusBadgeColor(
              status
            )} text-white border-0 text-xs`}
          >
            {displayStatus}
          </Badge>
        );
      },
      filterOptions: LOAN_STATUS_OPTIONS,
    },
    {
      id: "payoutStatus",
      accessorKey: "payoutStatus",
      header: "Payout",
      cell: ({ row }) => {
        const lead = row.original;
        const loanStatus = lead.fineractLoanStatus;
        const payoutStatus = lead.payoutStatus;

        // Only show payout status for disbursed loans
        if (loanStatus?.toLowerCase() !== "active") {
          return <span className="text-muted-foreground text-xs">-</span>;
        }

        if (payoutStatus === "PAID") {
          return (
            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
              Paid
            </Badge>
          );
        } else if (payoutStatus === "VOIDED") {
          return (
            <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs">
              Voided
            </Badge>
          );
        } else {
          return (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
              Pending
            </Badge>
          );
        }
      },
    },
    {
      id: "amount",
      accessorKey: "amount",
      header: "Amount",
    },
    {
      id: "loanOfficer",
      accessorKey: "createdByUserName",
      header: "Loan Officer",
      cell: ({ row }) => {
        const lead = row.original;
        // Show createdByUserName (originator), falling back to assignedToUserName, then userId
        const officerName = lead.createdByUserName || lead.assignedToUserName || lead.userId || "Unknown";
        return (
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs truncate max-w-[120px]" title={officerName}>
              {officerName}
            </span>
          </div>
        );
      },
    },
    {
      id: "assignedTo",
      accessorKey: "assignedToUserName",
      header: "Assigned To",
      cell: ({ row }) => {
        const lead = row.original;
        const isSubmitted = lead.loanSubmittedToFineract || lead.fineractLoanId;

        if (!isSubmitted) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }

        if (lead.assignedToUserName) {
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-green-500/20 text-green-600 text-xs">
                  {lead.assignedToUserName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{lead.assignedToUserName}</span>
            </div>
          );
        }

        return (
          <Badge
            variant="outline"
            className="text-xs border-orange-500 text-orange-500 bg-orange-500/10"
          >
            <User className="h-3 w-3 mr-1" />
            Unassigned
          </Badge>
        );
      },
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ getValue }) => {
        // Format date
        const date = new Date(getValue());
        const formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return <span className="text-xs">{formattedDate}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const lead = row.original;
        // Show detail view for submitted loans, create view for drafts
        const isSubmitted = lead.loanSubmittedToFineract || lead.fineractLoanId;
        return (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={
                isSubmitted ? `/leads/${lead.id}` : `/leads/new?id=${lead.id}`
              }
            >
              {isSubmitted ? "View" : "Continue"}
            </Link>
          </Button>
        );
      },
      enableSorting: false,
    },
  ];

  // Handle row click to navigate to lead details
  const handleRowClick = (lead: Lead) => {
    // Set navigating state to show loader
    setNavigatingLeadId(lead.id);
    // Show detail view for submitted loans, create view for drafts
    const isSubmitted = lead.loanSubmittedToFineract || lead.fineractLoanId;
    window.location.href = isSubmitted
      ? `/leads/${lead.id}`
      : `/leads/new?id=${lead.id}`;
  };

  return (
    <GenericDataTable
      data={leads}
      columns={columns}
      searchPlaceholder="Search all leads..."
      enablePagination={true}
      enableColumnVisibility={true}
      enableExport={true}
      enableFilters={true}
      pageSize={8}
      tableId="leads-table"
      onRowClick={handleRowClick}
      exportFileName="leads-export"
      emptyMessage={isSearching ? "Searching..." : "No leads found."}
      customFilters={customFilters}
      onFilterChange={setCustomFilters}
      defaultSorting={[{ id: "createdAt", desc: true }]}
      externalSearch={searchQuery}
      onSearchChange={setSearchQuery}
      isLoading={isSearching || isLoadingStatuses}
      headerActions={
        <Button
          variant="outline"
          size="sm"
          onClick={refreshLeads}
          disabled={isSearching || isLoadingStatuses}
          className="h-9"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${(isSearching || isLoadingStatuses) ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
    />
  );
}
