"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronDown,
  ChevronUp,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

// Define the lead data type
type Lead = {
  id: string;
  client: string;
  amount: string;
  type: string;
  stage: string;
  stageName: string;
  stageColor: string;
  timeInStage: string;
  sla: string;
  status: "normal" | "warning" | "overdue";
  assignee: string;
  assigneeName: string;
  assigneeColor: string;
  createdAt: string;
};

// Sample lead data
const sampleLeads: Lead[] = [
  {
    id: "1001",
    client: "Robert Johnson",
    amount: "$125,000",
    type: "Business Loan",
    stage: "qualification",
    stageName: "Lead Qualification",
    stageColor: "bg-blue-500",
    timeInStage: "1d 4h",
    sla: "2d",
    status: "normal",
    assignee: "JD",
    assigneeName: "John Doe",
    assigneeColor: "bg-blue-500",
    createdAt: "2025-05-08",
  },
  {
    id: "1002",
    client: "Sarah Williams",
    amount: "$75,000",
    type: "Personal Loan",
    stage: "documents",
    stageName: "Document Collection",
    stageColor: "bg-purple-500",
    timeInStage: "2d 6h",
    sla: "3d",
    status: "warning",
    assignee: "AS",
    assigneeName: "Alice Smith",
    assigneeColor: "bg-purple-500",
    createdAt: "2025-05-07",
  },
  {
    id: "1003",
    client: "Michael Chen",
    amount: "$250,000",
    type: "Mortgage",
    stage: "assessment",
    stageName: "Credit Assessment",
    stageColor: "bg-yellow-500",
    timeInStage: "4d 2h",
    sla: "3d",
    status: "overdue",
    assignee: "RJ",
    assigneeName: "Robert Johnson",
    assigneeColor: "bg-yellow-500",
    createdAt: "2025-05-06",
  },
  {
    id: "1004",
    client: "Emily Rodriguez",
    amount: "$180,000",
    type: "Business Loan",
    stage: "assessment",
    stageName: "Credit Assessment",
    stageColor: "bg-yellow-500",
    timeInStage: "1d 5h",
    sla: "3d",
    status: "normal",
    assignee: "RJ",
    assigneeName: "Robert Johnson",
    assigneeColor: "bg-yellow-500",
    createdAt: "2025-05-05",
  },
  {
    id: "1005",
    client: "David Kim",
    amount: "$95,000",
    type: "Personal Loan",
    stage: "approval",
    stageName: "Approval",
    stageColor: "bg-green-500",
    timeInStage: "0d 8h",
    sla: "2d",
    status: "normal",
    assignee: "AD",
    assigneeName: "Alex Donovan",
    assigneeColor: "bg-green-500",
    createdAt: "2025-05-04",
  },
  {
    id: "1006",
    client: "Jennifer Lee",
    amount: "$320,000",
    type: "Mortgage",
    stage: "disbursement",
    stageName: "Disbursement",
    stageColor: "bg-teal-500",
    timeInStage: "0d 4h",
    sla: "1d",
    status: "normal",
    assignee: "MS",
    assigneeName: "Maria Santos",
    assigneeColor: "bg-teal-500",
    createdAt: "2025-05-03",
  },
  {
    id: "1007",
    client: "Thomas Wilson",
    amount: "$150,000",
    type: "Business Loan",
    stage: "documents",
    stageName: "Document Collection",
    stageColor: "bg-purple-500",
    timeInStage: "1d 2h",
    sla: "3d",
    status: "normal",
    assignee: "AS",
    assigneeName: "Alice Smith",
    assigneeColor: "bg-purple-500",
    createdAt: "2025-05-02",
  },
  {
    id: "1008",
    client: "Lisa Brown",
    amount: "$85,000",
    type: "Personal Loan",
    stage: "qualification",
    stageName: "Lead Qualification",
    stageColor: "bg-blue-500",
    timeInStage: "0d 6h",
    sla: "2d",
    status: "normal",
    assignee: "JD",
    assigneeName: "John Doe",
    assigneeColor: "bg-blue-500",
    createdAt: "2025-05-01",
  },
];

export function LeadsTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Define table columns
  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <span className="text-xs">#{row.getValue("id")}</span>,
    },
    {
      accessorKey: "client",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="-ml-4 h-8 data-[state=open]:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Client
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={`/diverse-group-avatars.png?height=32&width=32&query=avatar ${row.getValue(
                "client"
              )}`}
              alt={row.getValue("client")}
            />
            <AvatarFallback>
              {(row.getValue("client") as string)
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <span>{row.getValue("client")}</span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="-ml-4 h-8 data-[state=open]:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Amount
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className="border-[#1a2035] bg-[#1a2035] text-xs text-gray-300"
        >
          {row.getValue("type")}
        </Badge>
      ),
    },
    {
      accessorKey: "stageName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="-ml-4 h-8 data-[state=open]:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Stage
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        );
      },
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <Badge className={`${lead.stageColor} text-white border-0 text-xs`}>
            {lead.stageName}
          </Badge>
        );
      },
    },
    {
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
                : "text-gray-400"
            }`}
          >
            {lead.timeInStage} / {lead.sla}
          </span>
        );
      },
    },
    {
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
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="-ml-4 h-8 data-[state=open]:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        );
      },
      cell: ({ row }) => {
        // Format date
        const date = new Date(row.getValue("createdAt"));
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
      cell: ({ row }) => {
        return (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/leads/${row.original.id}`}>View</Link>
          </Button>
        );
      },
    },
  ];

  // Filter data based on search query
  const filteredData = sampleLeads.filter((lead) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      lead.client.toLowerCase().includes(searchLower) ||
      lead.id.includes(searchQuery) ||
      lead.type.toLowerCase().includes(searchLower) ||
      lead.stageName.toLowerCase().includes(searchLower) ||
      lead.amount.toLowerCase().includes(searchLower)
    );
  });

  // Initialize table
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 8,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 border-[#1a2035] bg-[#0a0e17] text-white"
          />
        </div>
      </div>

      <div className="rounded-md border border-[#1a2035]">
        <Table>
          <TableHeader className="bg-[#0a0e17]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-[#1a2035] hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-gray-400">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-[#1a2035] hover:bg-[#141b2d]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="border-[#1a2035]">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Showing{" "}
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            filteredData.length
          )}{" "}
          of {filteredData.length} leads
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-[#1a2035] hover:bg-[#1a2035]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-[#1a2035] hover:bg-[#1a2035]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
