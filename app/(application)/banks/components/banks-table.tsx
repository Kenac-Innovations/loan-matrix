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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, DollarSign, Building2, Users } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { AllocateFundsModal } from "./allocate-funds-modal";

interface Bank {
  id: string;
  name: string;
  code: string;
  description?: string;
  officeId?: number;
  officeName?: string;
  status: string;
  totalAllocated: number;
  allocatedToTellers: number;
  availableBalance: number;
  currency: string;
  tellerCount: number;
  activeTellers: number;
}

export function BanksTable() {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const response = await fetch("/api/banks");
      if (response.ok) {
        const data = await response.json();
        setBanks(data);
      }
    } catch (error) {
      console.error("Error fetching banks:", error);
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
      INACTIVE: "secondary",
      CLOSED: "outline",
    };

    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500",
      INACTIVE: "bg-yellow-500",
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

  const handleOpenAllocate = (bank: Bank) => {
    setSelectedBank(bank);
    setAllocateModalOpen(true);
  };

  const columns: DataTableColumn<Bank>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "Bank Name",
      cell: ({ getValue, row }) => {
        const bank = row.original;
        return (
          <div>
            <div className="font-medium">{getValue() as string}</div>
            <div className="text-xs text-muted-foreground">
              Code: {bank.code}
            </div>
          </div>
        );
      },
    },
    {
      id: "office",
      accessorKey: "officeName",
      header: "Office",
      cell: ({ getValue }) => (
        <span>{(getValue() as string) || "—"}</span>
      ),
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
        { label: "Inactive", value: "INACTIVE" },
        { label: "Closed", value: "CLOSED" },
      ],
    },
    {
      id: "totalAllocated",
      header: "Total Funds",
      cell: ({ row }) => {
        const bank = row.original;
        return (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">
              {formatCurrency(bank.totalAllocated, bank.currency)}
            </span>
          </div>
        );
      },
    },
    {
      id: "availableBalance",
      header: "Available Balance",
      cell: ({ row }) => {
        const bank = row.original;
        const isLow = bank.availableBalance < bank.totalAllocated * 0.2;
        return (
          <div className="flex items-center gap-1">
            <span
              className={`font-medium ${
                isLow ? "text-orange-500" : "text-green-600"
              }`}
            >
              {formatCurrency(bank.availableBalance, bank.currency)}
            </span>
          </div>
        );
      },
    },
    {
      id: "tellers",
      header: "Active Tellers",
      cell: ({ row }) => {
        const count = row.original.activeTellers || 0;
        return (
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span>{count}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const bank = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/banks/${bank.id}`)}
              >
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/banks/${bank.id}/tellers`)}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Manage Tellers
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleOpenAllocate(bank)}>
                <DollarSign className="h-4 w-4 mr-2" />
                Allocate Funds
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
    },
  ];

  if (loading) {
    return <div>Loading banks...</div>;
  }

  return (
    <>
      <GenericDataTable
        data={banks}
        columns={columns}
        searchPlaceholder="Search banks..."
        enablePagination={true}
        enableColumnVisibility={true}
        enableExport={true}
        enableFilters={true}
        pageSize={10}
        tableId="banks-table"
        onRowClick={(bank) => router.push(`/banks/${bank.id}`)}
        exportFileName="banks-export"
        emptyMessage="No banks found. Create your first bank to get started."
      />
      {selectedBank && (
        <AllocateFundsModal
          open={allocateModalOpen}
          onOpenChange={setAllocateModalOpen}
          bankId={selectedBank.id}
          bankName={selectedBank.name}
          onSuccess={fetchBanks}
        />
      )}
    </>
  );
}

