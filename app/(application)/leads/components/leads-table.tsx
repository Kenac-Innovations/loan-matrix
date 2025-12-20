"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LeadsData } from "@/app/actions/leads-actions";
import { Lead } from "@/shared/types";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn, DataTableFilter } from "@/shared/types/data-table";
import { useState } from "react";
import {
  CheckCircle2,
  UserCheck,
  FileEdit,
  Send,
  User,
  Loader2,
} from "lucide-react";

interface LeadsTableProps {
  initialData: LeadsData;
}

export function LeadsTable({ initialData }: LeadsTableProps) {
  const { leads, pipelineStages } = initialData;
  const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
    { columnId: "leadStatus", value: "", type: "select" },
    { columnId: "type", value: "", type: "select" },
  ]);
  const [navigatingLeadId, setNavigatingLeadId] = useState<string | null>(null);

  // Define table columns using DataTableColumn format
  const columns: DataTableColumn<Lead>[] = [
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
      accessorKey: "loanSubmittedToFineract",
      header: "Status",
      cell: ({ row }) => {
        const lead = row.original;
        const isSubmitted = lead.loanSubmittedToFineract || lead.fineractLoanId;

        if (isSubmitted) {
          return (
            <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Submitted
            </Badge>
          );
        } else {
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
      },
      filterOptions: [
        { label: "Submitted", value: "true" },
        { label: "Draft", value: "false" },
      ],
    },
    {
      id: "amount",
      accessorKey: "amount",
      header: "Amount",
    },
    {
      id: "type",
      accessorKey: "type",
      header: "Type",
      cell: ({ getValue }) => (
        <Badge variant="outline" className="text-xs">
          {getValue()}
        </Badge>
      ),
      filterOptions: Array.from(new Set(leads.map((lead) => lead.type))).map(
        (type) => ({
          label: type,
          value: type,
        })
      ),
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
      searchPlaceholder="Search leads..."
      enablePagination={true}
      enableColumnVisibility={true}
      enableExport={true}
      enableFilters={true}
      pageSize={8}
      tableId="leads-table"
      onRowClick={handleRowClick}
      exportFileName="leads-export"
      emptyMessage="No leads found."
      customFilters={customFilters}
      onFilterChange={setCustomFilters}
    />
  );
}
