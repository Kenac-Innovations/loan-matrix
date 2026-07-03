"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import type { DataTableColumn } from "@/shared/types/data-table";
import type { Lead, PipelineStage } from "@/shared/types/lead";
import { cn } from "@/lib/utils";

interface UssdLinkedLeadsTableProps {
  leads: Lead[];
  pipelineStages: PipelineStage[];
}

function getDisplayLoanStatus(lead: Lead): string {
  if (lead.fineractLoanStatus) {
    return lead.fineractLoanStatus;
  }

  if (lead.payoutStatus) {
    return "Disbursed";
  }

  if (lead.fineractLoanId || lead.loanSubmittedToFineract) {
    return "Submitted";
  }

  return "Draft";
}

function getLoanStatusClasses(status?: string | null): string {
  const normalizedStatus = (status || "Draft").toLowerCase();

  if (normalizedStatus.includes("active") || normalizedStatus.includes("disbursed")) {
    return "border-transparent bg-emerald-500 text-white";
  }

  if (normalizedStatus.includes("approved")) {
    return "border-transparent bg-blue-500 text-white";
  }

  if (normalizedStatus.includes("pending") || normalizedStatus.includes("submitted")) {
    return "border-transparent bg-amber-500 text-white";
  }

  if (normalizedStatus.includes("rejected") || normalizedStatus.includes("withdrawn")) {
    return "border-transparent bg-rose-500 text-white";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}

export function UssdLinkedLeadsTable({
  leads,
  pipelineStages,
}: UssdLinkedLeadsTableProps) {
  const stageMap = new Map(
    pipelineStages.map((stage) => [stage.id, stage] as const)
  );

  const columns: DataTableColumn<Lead>[] = [
    {
      id: "client",
      header: "Client",
      accessorKey: "client",
      meta: { width: 220 },
      enableSorting: true,
      cell: ({ row }) => {
        const lead = row.original;

        return (
          <div className="space-y-1">
            <div className="font-medium text-foreground">{lead.client}</div>
            <div className="text-xs text-muted-foreground">{lead.id}</div>
          </div>
        );
      },
      getExportValue: (lead) => lead.client,
    },
    {
      id: "loanProductName",
      header: "Loan Product",
      accessorKey: "loanProductName",
      meta: { width: 220 },
      enableSorting: true,
      cell: ({ row }) => row.original.loanProductName || row.original.type || "Not specified",
      getExportValue: (lead) => lead.loanProductName || lead.type || "Not specified",
    },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      meta: { width: 130 },
      enableSorting: true,
    },
    {
      id: "stage",
      header: "Stage",
      accessorKey: "stage",
      meta: { width: 180 },
      enableSorting: true,
      cell: ({ row }) => {
        const stage = stageMap.get(row.original.stage);

        if (!stage) {
          return <Badge variant="outline">Unassigned</Badge>;
        }

        return (
          <Badge
            className="border-transparent text-white"
            style={{ backgroundColor: stage.color || "#64748b" }}
          >
            {stage.name}
          </Badge>
        );
      },
      getExportValue: (lead) => stageMap.get(lead.stage)?.name || "Unassigned",
    },
    {
      id: "fineractLoanStatus",
      header: "Loan Status",
      accessorKey: "fineractLoanStatus",
      meta: { width: 150 },
      enableSorting: true,
      cell: ({ row }) => {
        const status = getDisplayLoanStatus(row.original);

        return (
          <Badge className={cn("border", getLoanStatusClasses(status))}>
            {status}
          </Badge>
        );
      },
      getExportValue: (lead) => getDisplayLoanStatus(lead),
    },
    {
      id: "assignedToUserName",
      header: "Assigned To",
      accessorKey: "assignedToUserName",
      meta: { width: 180 },
      enableSorting: true,
      cell: ({ row }) => row.original.assignedToUserName || "Unassigned",
      getExportValue: (lead) => lead.assignedToUserName || "Unassigned",
    },
    {
      id: "updatedAt",
      header: "Last Updated",
      accessorKey: "updatedAt",
      meta: { width: 160 },
      enableSorting: true,
      cell: ({ row }) => format(new Date(row.original.updatedAt), "MMM dd, yyyy HH:mm"),
      getExportValue: (lead) =>
        format(new Date(lead.updatedAt), "yyyy-MM-dd HH:mm:ss"),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { width: 120 },
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/leads/${row.original.id}`}>
            View Lead
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      ),
      getExportValue: () => "View Lead",
    },
  ];

  return (
    <GenericDataTable
      data={leads}
      columns={columns}
      searchPlaceholder="Search USSD leads..."
      enableSelection={false}
      enablePagination={true}
      enableColumnVisibility={false}
      enableExport={true}
      enableFilters={false}
      pageSize={20}
      tableId="ussd-linked-leads"
      exportFileName="ussd-linked-leads"
      emptyMessage="No USSD leads found yet."
      defaultSorting={[{ id: "updatedAt", desc: true }]}
    />
  );
}
