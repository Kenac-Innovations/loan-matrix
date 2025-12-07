"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LeadsData } from "@/app/actions/leads-actions";
import { Lead } from "@/shared/types";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn, DataTableFilter } from "@/shared/types/data-table";
import { useState } from "react";

interface LeadsTableProps {
  initialData: LeadsData;
}

export function LeadsTable({ initialData }: LeadsTableProps) {
  const { leads, pipelineStages } = initialData;
  const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
    { columnId: "stage", value: "", type: "select" },
    { columnId: "type", value: "", type: "select" },
  ]);

  // Define table columns using DataTableColumn format
  const columns: DataTableColumn<Lead>[] = [
    {
      id: "client",
      accessorKey: "client",
      header: "Client",
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={`/diverse-group-avatars.png?height=32&width=32&query=avatar ${getValue()}`}
              alt={getValue()}
            />
            <AvatarFallback>
              {getValue()
                ? (getValue() as string)
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                : "UN"}
            </AvatarFallback>
          </Avatar>
          <span>{getValue()}</span>
        </div>
      ),
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
      id: "stage",
      accessorKey: "stage",
      header: "Stage",
      cell: ({ row }) => {
        const lead = row.original;
        const stage = pipelineStages.find((s) => s.id === lead.stage);
        return (
          <Badge
            className="text-white border-0 text-xs"
            style={{ backgroundColor: stage?.color || "#6B7280" }}
          >
            {stage?.name || "Unknown"}
          </Badge>
        );
      },
      filterOptions: pipelineStages.map((stage) => ({
        label: stage.name,
        value: stage.id,
      })),
    },
    {
      id: "timeInStage",
      accessorKey: "timeInStage",
      header: "Time in Stage",
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <span
            className={`text-xs ${
              lead.status === "overdue"
                ? "text-red-400"
                : lead.status === "warning"
                ? "text-yellow-400"
                : "text-muted-foreground"
            }`}
          >
            {lead.timeInStage} / {lead.sla}
          </span>
        );
      },
    },
    {
      id: "assigneeName",
      accessorKey: "assigneeName",
      header: "Assignee",
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: lead.assigneeColor }}
            >
              <span className="text-xs font-medium text-white">
                {lead.assignee}
              </span>
            </div>
            <span className="text-xs">{lead.assigneeName}</span>
          </div>
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
        const isDraft =
          !lead.stage ||
          !initialData.pipelineStages.find((s) => s.id === lead.stage);
        return (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={
                isDraft ? `/leads/new?leadId=${lead.id}` : `/leads/${lead.id}`
              }
            >
              View
            </Link>
          </Button>
        );
      },
      enableSorting: false,
    },
  ];

  // Handle row click to navigate to lead details
  const handleRowClick = (lead: Lead) => {
    const isDraft =
      !lead.stage || !pipelineStages.find((s) => s.id === lead.stage);
    window.location.href = isDraft
      ? `/leads/new?leadId=${lead.id}`
      : `/leads/${lead.id}`;
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
