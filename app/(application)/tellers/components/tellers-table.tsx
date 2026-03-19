"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn } from "@/components/tables/generic-data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Users, CheckCircle, Building2, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format-date";

interface Teller {
  id: string;
  fineractTellerId: number;
  name: string;
  description?: string;
  officeId: number;
  officeName: string;
  status: string;
  startDate: string;
  endDate?: string;
  bankId?: string;
  bank?: {
    id: string;
    name: string;
    code: string;
  };
  currentAllocation?: {
    amount: number;
    currency: string;
  };
  activeCashiers?: number;
  settlementCount?: number;
}

export function TellersTable() {
  const router = useRouter();
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);

  const navigateTo = (path: string) => {
    setNavigating(true);
    router.push(path);
  };

  useEffect(() => {
    fetchTellers();
  }, []);

  const fetchTellers = async () => {
    try {
      const response = await fetch("/api/tellers");
      if (response.ok) {
        const data = await response.json();
        setTellers(data);
      }
    } catch (error) {
      console.error("Error fetching tellers:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      ACTIVE: "default",
      PENDING: "secondary",
      CLOSED: "outline",
    };

    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500",
      PENDING: "bg-yellow-500",
      CLOSED: "bg-gray-500",
    };

    return (
      <Badge
        variant={variants[status] || "outline"}
        className={colors[status] ? `${colors[status]} text-white` : ""}
      >
        {status}
      </Badge>
    );
  };

  const columns: DataTableColumn<Teller>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "Teller Name",
      cell: ({ getValue, row }) => {
        const teller = row.original;
        return (
          <div>
            <div className="font-medium">{getValue() as string}</div>
            {teller.description && (
              <div className="text-xs text-muted-foreground">
                {teller.description}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "bank",
      header: "Bank",
      cell: ({ row }) => {
        const bank = row.original.bank;
        if (!bank) {
          return <span className="text-muted-foreground text-sm">Unassigned</span>;
        }
        return (
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span>{bank.name}</span>
          </div>
        );
      },
    },
    {
      id: "office",
      accessorKey: "officeName",
      header: "Office",
      cell: ({ getValue }) => <span>{getValue() as string}</span>,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => getStatusBadge(getValue() as string),
      filterType: "select",
      filterOptions: [
        { label: "All", value: "" },
        { label: "Active", value: "ACTIVE" },
        { label: "Pending", value: "PENDING" },
        { label: "Closed", value: "CLOSED" },
      ],
    },
    {
      id: "allocation",
      header: "Available Balance",
      cell: ({ row }) => {
        const allocation = row.original.currentAllocation;
        if (!allocation || allocation.amount === 0) {
          return (
            <span className="text-muted-foreground text-sm">No balance</span>
          );
        }
        return (
          <span className="font-medium">
            {allocation.amount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      id: "cashiers",
      header: "Active Cashiers",
      cell: ({ row }) => {
        const count = row.original.activeCashiers || 0;
        return (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span>{count}</span>
          </div>
        );
      },
    },
    {
      id: "startDate",
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ getValue }) => {
        const date = new Date(getValue() as string);
        return <span className="text-sm">{formatDate(date)}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const teller = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigateTo(`/tellers/${teller.fineractTellerId}`)}
              >
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigateTo(`/tellers/${teller.fineractTellerId}/cashiers`)}
              >
                Manage Cashiers
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigateTo(`/tellers/${teller.fineractTellerId}/allocate`)}
              >
                Allocate Cash
              </DropdownMenuItem>
              {teller.status === "ACTIVE" && (
                <DropdownMenuItem
                  onClick={() => navigateTo(`/tellers/${teller.fineractTellerId}/settle`)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Settle Cash
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
    },
  ];

  if (loading) {
    return <div>Loading tellers...</div>;
  }

  return (
    <>
      {navigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}
      <GenericDataTable
        data={tellers}
        columns={columns}
        searchPlaceholder="Search tellers..."
        enablePagination={true}
        enableColumnVisibility={true}
        enableExport={true}
        enableFilters={true}
        pageSize={10}
        tableId="tellers-table"
        onRowClick={(teller) => navigateTo(`/tellers/${teller.fineractTellerId}`)}
        exportFileName="tellers-export"
        emptyMessage="No tellers found. Create your first teller to get started."
      />
    </>
  );
}
