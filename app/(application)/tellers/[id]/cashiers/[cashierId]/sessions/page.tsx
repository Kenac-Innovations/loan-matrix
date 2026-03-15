"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn } from "@/shared/types/data-table";
import { formatDate } from "@/lib/format-date";
import { useCurrency } from "@/contexts/currency-context";

interface Session {
  id: string;
  sessionStatus: string;
  sessionStartTime: string | null;
  sessionEndTime: string | null;
  allocatedBalance: number;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
  expectedBalance: number | null;
  closingBalance: number | null;
  difference: number | null;
  countedCashAmount: number | null;
  comments: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export default function SessionsHistoryPage({
  params,
}: {
  params: Promise<{ id: string; cashierId: string }>;
}) {
  const router = useRouter();
  const { formatAmount } = useCurrency();
  const [tellerId, setTellerId] = useState<string>("");
  const [cashierId, setCashierId] = useState<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashierName, setCashierName] = useState<string>("");

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      setTellerId(resolvedParams.id);
      setCashierId(resolvedParams.cashierId);
      fetchSessions(resolvedParams.id, resolvedParams.cashierId);
    }
    loadParams();
  }, [params]);

  const fetchSessions = async (tId: string, cId: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/tellers/${tId}/cashiers/${cId}/sessions`
      );
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);

        // Get cashier name from first session or fetch it
        if (data.sessions && data.sessions.length > 0) {
          // We can get cashier name from the cashiers page
          const cashiersResponse = await fetch(`/api/tellers/${tId}/cashiers`);
          if (cashiersResponse.ok) {
            const cashiersData = await cashiersResponse.json();
            const cashier = cashiersData.find(
              (c: any) => (c.dbId || c.id.toString()) === cId
            );
            if (cashier) {
              setCashierName(cashier.staffName);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      NOT_STARTED: "bg-gray-500",
      ACTIVE: "bg-green-500",
      CLOSED: "bg-yellow-500",
      CLOSED_VERIFIED: "bg-blue-500",
    };

    return (
      <Badge
        className={
          colors[status] ? `${colors[status]} text-white` : "bg-gray-500"
        }
      >
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const columns: DataTableColumn<Session>[] = [
    {
      id: "sessionStartTime",
      header: "Start Time",
      cell: ({ row }: { row: any }) => {
        const time = row.original.sessionStartTime;
        if (!time) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {new Date(time).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        );
      },
    },
    {
      id: "sessionEndTime",
      header: "End Time",
      cell: ({ row }: { row: any }) => {
        const time = row.original.sessionEndTime;
        if (!time) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {new Date(time).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        );
      },
    },
    {
      id: "sessionStatus",
      header: "Status",
      cell: ({ row }: { row: any }) =>
        getStatusBadge(row.original.sessionStatus),
    },
    {
      id: "openingFloat",
      header: "Opening Float",
      cell: ({ row }: { row: any }) => (
        <span className="font-medium">
          {formatAmount(row.original.openingFloat)}
        </span>
      ),
    },
    {
      id: "cashIn",
      header: "Cash In",
      cell: ({ row }: { row: any }) => (
        <span className="text-green-600 font-medium">
          {formatAmount(row.original.cashIn)}
        </span>
      ),
    },
    {
      id: "cashOut",
      header: "Cash Out",
      cell: ({ row }: { row: any }) => (
        <span className="text-red-600 font-medium">
          {formatAmount(row.original.cashOut)}
        </span>
      ),
    },
    {
      id: "expectedBalance",
      header: "Expected",
      cell: ({ row }: { row: any }) => {
        const expected = row.original.expectedBalance;
        if (expected === null)
          return <span className="text-muted-foreground">—</span>;
        return (
          <span className="font-medium">
            {formatAmount(expected)}
          </span>
        );
      },
    },
    {
      id: "closingBalance",
      header: "Actual",
      cell: ({ row }: { row: any }) => {
        const actual = row.original.closingBalance;
        if (actual === null)
          return <span className="text-muted-foreground">—</span>;
        return (
          <span className="font-medium">
            {formatAmount(actual)}
          </span>
        );
      },
    },
    {
      id: "difference",
      header: "Variance",
      cell: ({ row }: { row: any }) => {
        const diff = row.original.difference;
        if (diff === null)
          return <span className="text-muted-foreground">—</span>;
        const isBalanced = Math.abs(diff) < 0.01;
        const isOver = diff > 0;
        return (
          <span
            className={`font-bold ${
              isBalanced
                ? "text-gray-600"
                : isOver
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {isBalanced
              ? "Balanced"
              : `${isOver ? "+" : ""}${formatAmount(diff)}`}
          </span>
        );
      },
    },
    {
      id: "verifiedAt",
      header: "Verified",
      cell: ({ row }: { row: any }) => {
        const verified = row.original.verifiedAt;
        if (!verified) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm text-muted-foreground">
            {new Date(verified).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        );
      },
    },
  ];

  if (loading) {
    return <div>Loading sessions...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/tellers/${tellerId}/cashiers`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Session History</h1>
            <p className="text-muted-foreground mt-1">
              {cashierName && `Viewing sessions for ${cashierName}`}
            </p>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Past Sessions</CardTitle>
          <CardDescription>
            View all past cashier sessions and their reconciliation status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenericDataTable
            data={sessions}
            columns={columns}
            searchPlaceholder="Search sessions..."
            enablePagination={true}
            enableColumnVisibility={true}
            enableExport={true}
            pageSize={10}
            tableId="sessions-history-table"
            emptyMessage="No sessions found"
          />
        </CardContent>
      </Card>
    </div>
  );
}


