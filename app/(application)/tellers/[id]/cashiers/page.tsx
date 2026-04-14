"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/searchable-select";
import { AllocateCashModal } from "@/app/(application)/tellers/components/allocate-cash-modal";
import { TellerCashiersSkeleton } from "@/components/skeletons/tellers-skeleton";
import { SettleCashModal } from "./components/settle-cash-modal";
import { ReconcileCashModal } from "./components/reconcile-cash-modal";
// TransactionsModal replaced with dedicated page at /tellers/[id]/cashiers/[cashierId]/transactions
import { StartSessionModal } from "./components/start-session-modal";
import { CloseSessionModal } from "./components/close-session-modal";
import { EditCashierModal } from "./components/edit-cashier-modal";
import { CashInModal } from "./components/cash-in-modal";
import { CashOutModal } from "./components/cash-out-modal";
import {
  DollarSign,
  Wallet,
  Eye,
  Play,
  Square,
  History,
  MoreHorizontal,
  Edit,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Cashier {
  id: string | number; // Fineract cashier ID
  dbId?: string | null; // Database cashier ID
  staffId: number;
  staffName: string;
  startDate: string | number[];
  endDate?: string | number[];
  startTime?: string;
  endTime?: string;
  isFullDay: boolean;
  status?: string;
  sessionStatus?: string;
  allocatedBalance?: number;
  availableBalance?: number;
  openingFloat?: number;
  cashIn?: number;
  cashOut?: number;
  netCash?: number;
  expectedBalance?: number;
  currencyCode?: string;
}

interface CashierSessionData {
  session: {
    sessionStatus?: string;
  } | null;
  balances: {
    allocatedBalance?: number;
    availableBalance?: number;
    openingFloat?: number;
    cashIn?: number;
    cashOut?: number;
    expectedBalance?: number;
  };
}

interface CashierSummaryResponse {
  netCash?: number;
  sumCashAllocation?: number;
}

interface Staff {
  id: number;
  firstname: string;
  lastname: string;
  displayName?: string;
}

type CashierTableCell = Parameters<
  NonNullable<DataTableColumn<Cashier>["cell"]>
>[0];

const formatCashierDateValue = (date?: string | number[]) => {
  if (!date) return null;

  if (Array.isArray(date)) {
    return formatDate(date);
  }

  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const dateOnlyValue = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    return dateOnlyValue.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const normalizedDate = new Date(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth(),
    parsedDate.getUTCDate()
  );

  return normalizedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function CashiersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { currencyCode: orgCurrency } = useCurrency();
  const [tellerId, setTellerId] = useState<string>("");
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [systemCurrency, setSystemCurrency] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showEditCashierModal, setShowEditCashierModal] = useState(false);
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [showCloseSessionModal, setShowCloseSessionModal] = useState(false);
  const [showCashInModal, setShowCashInModal] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState<Cashier | null>(null);
  const [sessionData, setSessionData] = useState<CashierSessionData | null>(
    null
  );
  const [formData, setFormData] = useState({
    staffId: "",
    staffName: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    startTime: "",
    endTime: "",
    isFullDay: true,
  });

  const fetchSystemCurrency = useCallback(async () => {
    try {
      const response = await fetch("/api/fineract/currencies");
      if (response.ok) {
        const data = await response.json();
        // Handle different response structures
        const currencyList = Array.isArray(data.selectedCurrencyOptions)
          ? data.selectedCurrencyOptions
          : Array.isArray(data)
            ? data
            : data.currencies || [];

        // Get the first currency (usually the default/system currency)
        if (currencyList.length > 0) {
          const defaultCurrency = currencyList[0];
          const code = defaultCurrency.code || orgCurrency;
          setSystemCurrency(code);
        }
      }
    } catch (error) {
      console.error("Error fetching system currency:", error);
    }
  }, [orgCurrency]);

  const fetchCashiers = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/tellers/${id}/cashiers`);
        if (response.ok) {
          const responseData = (await response.json()) as Cashier[] | null;
          const fetchedCashiers = responseData || [];
          setCashiers(fetchedCashiers);

          // Use the raw Fineract currency code from /api/fineract/currencies
          // so this page matches the cashier transactions page exactly.
          const balanceCurrency = systemCurrency || orgCurrency;

          // Fetch session data and Fineract balance for each cashier in parallel
          const updatedCashiers = await Promise.all(
            fetchedCashiers.map(async (cashier) => {
              const cashierId = cashier.dbId || cashier.id?.toString() || "";
              try {
                const [sessionResponse, summaryResponse] = await Promise.all([
                  fetch(`/api/tellers/${id}/cashiers/${cashierId}/session`),
                  fetch(
                    `/api/tellers/${id}/cashiers/${cashierId}/transactions?currencyCode=${balanceCurrency}`
                  ),
                ]);

                let fineractBalance = 0;
                if (summaryResponse.ok) {
                  const summaryData =
                    (await summaryResponse.json()) as CashierSummaryResponse;
                  fineractBalance =
                    summaryData.netCash ?? summaryData.sumCashAllocation ?? 0;
                }

                let sessionInfo: CashierSessionData = {
                  session: null,
                  balances: {},
                };
                if (sessionResponse.ok) {
                  sessionInfo =
                    (await sessionResponse.json()) as CashierSessionData;
                }

                return {
                  ...cashier,
                  sessionStatus:
                    sessionInfo.session?.sessionStatus || "NOT_STARTED",
                  allocatedBalance: sessionInfo.balances?.allocatedBalance || 0,
                  availableBalance: sessionInfo.balances?.availableBalance || 0,
                  openingFloat: sessionInfo.balances?.openingFloat || 0,
                  cashIn: sessionInfo.balances?.cashIn || 0,
                  cashOut: sessionInfo.balances?.cashOut || 0,
                  netCash: fineractBalance,
                  expectedBalance: sessionInfo.balances?.expectedBalance || 0,
                  currencyCode: balanceCurrency,
                };
              } catch (error) {
                console.error(
                  "Error fetching data for cashier:",
                  cashierId,
                  error
                );
                return {
                  ...cashier,
                  netCash: 0,
                  currencyCode: balanceCurrency,
                };
              }
            })
          );

          setCashiers(updatedCashiers);
        }
      } catch (error) {
        console.error("Error fetching cashiers:", error);
      } finally {
        setLoading(false);
      }
    },
    [orgCurrency, systemCurrency]
  );

  const fetchStaff = useCallback(async () => {
    try {
      const response = await fetch("/api/staff");
      if (response.ok) {
        const data = await response.json();
        setStaff(data || []);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      setTellerId(resolvedParams.id);
      fetchCashiers(resolvedParams.id);
      fetchStaff();
      fetchSystemCurrency();
    }
    loadParams();
  }, [fetchCashiers, fetchStaff, fetchSystemCurrency, params]);

  // Auto-refresh balances for active sessions
  useEffect(() => {
    if (!tellerId) return;

    const interval = setInterval(() => {
      // Only refresh if there are active sessions
      const hasActiveSession = cashiers.some(
        (c) => c.sessionStatus === "ACTIVE"
      );
      if (hasActiveSession) {
        fetchCashiers(tellerId);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [cashiers, fetchCashiers, tellerId]);

  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const payload = {
        ...formData,
        staffId: parseInt(formData.staffId),
      };

      console.log("Submitting cashier creation:", payload);

      const response = await fetch(`/api/tellers/${tellerId}/cashiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("Cashier creation response:", {
        status: response.status,
        result,
      });

      if (response.ok || response.status === 207) {
        setShowCreateModal(false);
        setFormData({
          staffId: "",
          staffName: "",
          description: "",
          startDate: new Date().toISOString().split("T")[0],
          endDate: "",
          startTime: "",
          endTime: "",
          isFullDay: true,
        });
        fetchCashiers(tellerId);

        if (result.warning) {
          alert(`Cashier created but with warning: ${result.warning}`);
        } else {
          // Show success message
          console.log("Cashier created successfully:", result.id);
        }
      } else {
        console.error("Error creating cashier:", result);
        const errorMessage =
          result.error || result.details || "Failed to create cashier";
        alert(errorMessage);
      }
    } catch (error) {
      console.error("Error creating cashier:", error);
      alert("Failed to create cashier. Check console for details.");
    } finally {
      setCreating(false);
    }
  };

  const columns: DataTableColumn<Cashier>[] = [
    {
      id: "staffName",
      accessorKey: "staffName",
      header: "Cashier Name",
      cell: ({ getValue }: CashierTableCell) => (
        <span className="font-medium">{getValue() as string}</span>
      ),
    },
    {
      id: "startDate",
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ getValue }: CashierTableCell) => {
        const formattedDate = formatCashierDateValue(
          getValue() as Cashier["startDate"]
        );
        if (formattedDate) {
          return <span className="text-sm">{formattedDate}</span>;
        }
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "endDate",
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ getValue }: CashierTableCell) => {
        const formattedDate = formatCashierDateValue(
          getValue() as Cashier["endDate"]
        );
        if (formattedDate) {
          return <span className="text-sm">{formattedDate}</span>;
        }
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "time",
      header: "Working Hours",
      cell: ({ row }: CashierTableCell) => {
        const cashier = row.original;
        if (cashier.isFullDay) {
          return (
            <span className="text-sm text-muted-foreground">Full Day</span>
          );
        }
        if (cashier.startTime && cashier.endTime) {
          return (
            <span className="text-sm">
              {cashier.startTime} - {cashier.endTime}
            </span>
          );
        }
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "balance",
      header: "Balance",
      cell: ({ row }: CashierTableCell) => {
        const cashier = row.original;
        const balance = cashier.netCash || 0;
        // Normalize ZMK to ZMW (Fineract uses legacy ZMK code)
        const rawCurrency = cashier.currencyCode || systemCurrency;
        const currency = rawCurrency === "ZMK" ? "ZMW" : rawCurrency;

        const formatAmount = (amount: number) => {
          try {
            return new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: currency,
            }).format(amount);
          } catch {
            return `${currency} ${amount.toFixed(2)}`;
          }
        };

        return (
          <div className="text-right">
            <span
              className={`font-semibold ${
                balance > 0
                  ? "text-green-600"
                  : balance < 0
                  ? "text-red-600"
                  : "text-muted-foreground"
              }`}
            >
              {formatAmount(balance)}
            </span>
          </div>
        );
      },
    },
    {
      id: "sessionStatus",
      header: "Session",
      cell: ({ row }: CashierTableCell) => {
        const cashier = row.original;
        const sessionStatus = cashier.sessionStatus || "NOT_STARTED";
        const colors: Record<string, string> = {
          NOT_STARTED: "bg-gray-500",
          ACTIVE: "bg-green-500",
          CLOSED: "bg-yellow-500",
          SETTLED: "bg-purple-500",
          CLOSED_VERIFIED: "bg-blue-500",
        };
        return (
          <Badge
            className={
              colors[sessionStatus] ? `${colors[sessionStatus]} text-white` : ""
            }
          >
            {sessionStatus.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }: CashierTableCell) => {
        const cashier = row.original;
        const isClosed =
          cashier.status === "CLOSED" || cashier.status === "SETTLED";

        const sessionStatus = cashier.sessionStatus || "NOT_STARTED";
        const canStartSession =
          sessionStatus === "NOT_STARTED" || sessionStatus === "CLOSED";
        const canCloseSession = sessionStatus === "ACTIVE";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canStartSession && (
                <DropdownMenuItem
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSelectedCashier(cashier);
                    // Fetch latest session data
                    const cashierId = cashier.dbId || cashier.id.toString();
                    try {
                      const response = await fetch(
                        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`
                      );
                      if (response.ok) {
                        const data = await response.json();
                        setSessionData(data);
                        setShowStartSessionModal(true);
                      }
                    } catch (error) {
                      console.error("Error fetching session:", error);
                      setShowStartSessionModal(true);
                    }
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Session
                </DropdownMenuItem>
              )}
              {canCloseSession && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCashier(cashier);
                    setShowCloseSessionModal(true);
                  }}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Close Session
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCashier(cashier);
                  setShowEditCashierModal(true);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Dates
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCashier(cashier);
                  setShowCashInModal(true);
                }}
              >
                <ArrowDownLeft className="h-4 w-4 mr-2 text-green-600" />
                Cash In
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCashier(cashier);
                  setShowCashOutModal(true);
                }}
                disabled={sessionStatus !== "ACTIVE"}
              >
                <ArrowUpRight className="h-4 w-4 mr-2 text-red-600" />
                Cash Out {sessionStatus !== "ACTIVE" && "(Session Required)"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCashier(cashier);
                  setShowAllocateModal(true);
                }}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Allocate Cash
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  const cashierIdToUse = cashier.dbId || cashier.id.toString();
                  router.push(`/tellers/${tellerId}/cashiers/${cashierIdToUse}/transactions`);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Transactions
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCashier(cashier);
                  setShowSettleModal(true);
                }}
                disabled={isClosed}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Settle Cash
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCashier(cashier);
                  setShowReconcileModal(true);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reconcile & Return Cash
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  const cashierId = cashier.dbId || cashier.id.toString();
                  window.location.href = `/tellers/${tellerId}/cashiers/${cashierId}/sessions`;
                }}
              >
                <History className="h-4 w-4 mr-2" />
                View History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (loading) {
    return <TellerCashiersSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/tellers/${tellerId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Manage Cashiers</h1>
            <p className="text-muted-foreground mt-1">
              Assign and manage cashiers for this teller
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Cashier
        </Button>
      </div>

      {/* Cashiers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cashiers</CardTitle>
          <CardDescription>
            Staff members assigned to this teller for cash operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenericDataTable
            data={cashiers}
            columns={columns}
            searchPlaceholder="Search cashiers..."
            enablePagination={true}
            enableColumnVisibility={true}
            enableExport={true}
            enableFilters={true}
            pageSize={10}
            tableId="cashiers-table"
            exportFileName="cashiers-export"
            emptyMessage="No cashiers assigned. Assign your first cashier to get started."
          />
        </CardContent>
      </Card>

      {/* Create Cashier Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Cashier to Teller</DialogTitle>
            <DialogDescription>
              Assign a staff member (loan officer) as a cashier for this teller
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCashier}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="staffId">
                  Staff Member (Loan Officer){" "}
                  <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={staff.map((s) => ({
                    value: s.id.toString(),
                    label: s.displayName || `${s.firstname} ${s.lastname}`,
                  }))}
                  value={formData.staffId}
                  onValueChange={(value) => {
                    const selectedStaff = staff.find(
                      (s) => s.id.toString() === value
                    );
                    setFormData({
                      ...formData,
                      staffId: value,
                      staffName:
                        selectedStaff?.displayName ||
                        `${selectedStaff?.firstname} ${selectedStaff?.lastname}` ||
                        "",
                    });
                  }}
                  placeholder={
                    loadingStaff
                      ? "Loading staff..."
                      : "Search and select staff member"
                  }
                  emptyMessage="No staff members found"
                  disabled={loadingStaff}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Cashier description (optional)..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">
                  End Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  min={formData.startDate}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  If not provided, will default to 1 year from start date
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isFullDay" className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isFullDay"
                    checked={formData.isFullDay}
                    onChange={(e) =>
                      setFormData({ ...formData, isFullDay: e.target.checked })
                    }
                    className="rounded"
                  />
                  Full Day
                </Label>
              </div>

              {!formData.isFullDay && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) =>
                        setFormData({ ...formData, startTime: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) =>
                        setFormData({ ...formData, endTime: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || loadingStaff}>
                {creating ? "Assigning..." : "Assign Cashier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Cashier Modal */}
      {selectedCashier && (
        <EditCashierModal
          open={showEditCashierModal}
          onOpenChange={setShowEditCashierModal}
          tellerId={tellerId}
          cashier={selectedCashier}
          onSuccess={() => {
            fetchCashiers(tellerId);
          }}
        />
      )}

      {/* Allocate Cash Modal */}
      {selectedCashier && (
        <AllocateCashModal
          open={showAllocateModal}
          onOpenChange={setShowAllocateModal}
          tellerId={tellerId}
          cashierId={selectedCashier.dbId || selectedCashier.id.toString()}
          cashierName={selectedCashier.staffName}
        />
      )}

      {/* Start Session Modal */}
      {selectedCashier && (
        <StartSessionModal
          open={showStartSessionModal}
          onOpenChange={setShowStartSessionModal}
          tellerId={tellerId}
          cashierId={selectedCashier.dbId || selectedCashier.id.toString()}
          cashierName={selectedCashier.staffName}
          allocatedBalance={
            selectedCashier.allocatedBalance ||
            sessionData?.balances?.allocatedBalance ||
            0
          }
        />
      )}

      {/* Close Session Modal */}
      {selectedCashier && (
        <CloseSessionModal
          open={showCloseSessionModal}
          onOpenChange={setShowCloseSessionModal}
          tellerId={tellerId}
          cashierId={selectedCashier.dbId || selectedCashier.id.toString()}
          cashierName={selectedCashier.staffName}
        />
      )}

      {/* Settle Cash Modal */}
      {selectedCashier && (
        <SettleCashModal
          open={showSettleModal}
          onOpenChange={setShowSettleModal}
          tellerId={tellerId}
          cashierId={selectedCashier.dbId || selectedCashier.id.toString()}
          cashierName={selectedCashier.staffName}
        />
      )}

      {/* Reconcile Cash Modal */}
      {selectedCashier && (
        <ReconcileCashModal
          open={showReconcileModal}
          onOpenChange={setShowReconcileModal}
          tellerId={tellerId}
          cashierId={selectedCashier.dbId || selectedCashier.id.toString()}
          cashierName={selectedCashier.staffName}
        />
      )}

      {/* Cash In Modal */}
      {selectedCashier && (
        <CashInModal
          open={showCashInModal}
          onOpenChange={setShowCashInModal}
          tellerId={tellerId}
          cashierId={selectedCashier.dbId || selectedCashier.id.toString()}
          cashierName={selectedCashier.staffName}
          onSuccess={() => {
            fetchCashiers(tellerId);
          }}
        />
      )}

      {/* Cash Out Modal */}
      {selectedCashier && (
        <CashOutModal
          open={showCashOutModal}
          onOpenChange={setShowCashOutModal}
          tellerId={tellerId}
          cashierId={selectedCashier.dbId || selectedCashier.id.toString()}
          cashierName={selectedCashier.staffName}
          onSuccess={() => {
            fetchCashiers(tellerId);
          }}
        />
      )}
    </div>
  );
}
