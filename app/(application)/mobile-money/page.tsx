"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from "@/components/role-guard";
import { formatCurrency } from "@/lib/format-currency";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MobileMoneyConfigModal, type MobileMoneyConfigValue } from "./components/mobile-money-config-modal";
import { MobileMoneyTopupModal } from "./components/mobile-money-topup-modal";
import { TellerVaultTransactionsSkeleton } from "@/components/skeletons/tellers-skeleton";
import { Input } from "@/components/ui/input";

interface MobileMoneyTransaction {
  id: string;
  type: string;
  typeLabel: string;
  paymentTypeLabel: string;
  transactionDate: string;
  amount: number;
  signedAmount: number;
  runningBalance: number;
  currency: string;
  notes: string | null;
  createdBy: string;
  status: string;
  canReverse: boolean;
  clientName?: string | null;
  clientNrc?: string | null;
  loanId?: number | null;
  loanAccountNo?: string | null;
}

interface MobileMoneySummary {
  openingBalance: number;
  topUps: number;
  payoutReversals: number;
  payouts: number;
  currentBalance: number;
  transactionCount: number;
}

interface MobileMoneyResponse {
  config: MobileMoneyConfigValue | null;
  configured: MobileMoneyConfigValue | null;
  summary: MobileMoneySummary;
  transactions: MobileMoneyTransaction[];
}

function formatDateTime(dateValue: string) {
  const date = new Date(dateValue);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeFilteredTransactions(
  rows: MobileMoneyTransaction[]
): MobileMoneySummary {
  let openingBalance = 0;
  let topUps = 0;
  let payoutReversals = 0;
  let payouts = 0;

  for (const row of rows) {
    if (row.type === "OPENING_BALANCE") {
      openingBalance += row.amount;
    } else if (row.type === "TOP_UP") {
      topUps += row.amount;
    } else if (row.type === "PAYOUT_REVERSAL") {
      payoutReversals += row.amount;
    } else if (row.type === "PAYOUT") {
      payouts += row.amount;
    }
  }

  return {
    openingBalance,
    topUps,
    payoutReversals,
    payouts,
    currentBalance: rows.length > 0 ? rows[0].runningBalance : 0,
    transactionCount: rows.length,
  };
}

function getTransactionTypeInfo(type: string) {
  switch (type) {
    case "OPENING_BALANCE":
      return { label: "Opening Balance", color: "bg-blue-500", icon: Wallet };
    case "TOP_UP":
      return { label: "GL Top-Up", color: "bg-green-500", icon: ArrowDownRight };
    case "TOP_UP_REVERSAL":
      return {
        label: "Top-Up Reversal",
        color: "bg-amber-500",
        icon: RotateCcw,
      };
    case "PAYOUT":
      return {
        label: "Mobile Money Payout",
        color: "bg-rose-600",
        icon: ArrowUpRight,
      };
    case "PAYOUT_REVERSAL":
      return {
        label: "Payout Reversal",
        color: "bg-cyan-600",
        icon: RotateCcw,
      };
    default:
      return { label: type, color: "bg-gray-500", icon: Smartphone };
  }
}

function getTransactionRowKey(
  transaction: MobileMoneyTransaction,
  index: number
) {
  return [
    transaction.id,
    transaction.transactionDate,
    transaction.type,
    transaction.amount,
    index,
  ].join("-");
}

export default function MobileMoneyPage() {
  const { currencyCode: orgCurrency } = useCurrency();
  const { success, error } = useToast();
  const { hasAnyRole, isLoading: rolesLoading } = useUserRoles();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [provisioningExporting, setProvisioningExporting] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [transactions, setTransactions] = useState<MobileMoneyTransaction[]>([]);
  const [config, setConfig] = useState<MobileMoneyConfigValue | null>(null);
  const [configured, setConfigured] = useState<MobileMoneyConfigValue | null>(
    null
  );
  const [configOpen, setConfigOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [reverseTarget, setReverseTarget] =
    useState<MobileMoneyTransaction | null>(null);
  const [reversing, setReversing] = useState(false);

  const canConfigure = !rolesLoading
    ? hasAnyRole(["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "BRANCH_MANAGER"])
    : false;

  async function fetchMobileMoneyTransactions() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/mobile-money-transactions");
      const payload: MobileMoneyResponse | { error?: string } =
        await response.json();

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Failed to load mobile money transactions"
        );
      }

      const data = payload as MobileMoneyResponse;
      setTransactions(data.transactions || []);
      setConfig(data.config || null);
      setConfigured(data.configured || null);
    } catch (fetchError) {
      console.error("Error fetching mobile money transactions:", fetchError);
      setErrorMessage(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load mobile money transactions"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMobileMoneyTransactions();
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [transactions.length, fromDate, toDate]);

  const currency = transactions[0]?.currency || orgCurrency;
  const filteredTransactions = useMemo(() => {
    const fromBoundary = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const toBoundary = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.transactionDate);

      if (fromBoundary && transactionDate < fromBoundary) {
        return false;
      }

      if (toBoundary && transactionDate > toBoundary) {
        return false;
      }

      return true;
    });
  }, [fromDate, toDate, transactions]);
  const filteredSummary = useMemo(
    () => summarizeFilteredTransactions(filteredTransactions),
    [filteredTransactions]
  );
  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedTransactions = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, pageSize, safePageIndex]);
  const paginationStart =
    filteredTransactions.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const paginationEnd = Math.min(
    (safePageIndex + 1) * pageSize,
    filteredTransactions.length
  );

  function getExportPeriodSuffix() {
    if (fromDate && toDate) {
      return `${fromDate}-to-${toDate}`;
    }

    if (fromDate) {
      return `from-${fromDate}`;
    }

    if (toDate) {
      return `to-${toDate}`;
    }

    return new Date().toISOString().split("T")[0];
  }

  async function exportToExcel() {
    try {
      setExporting(true);
      const XLSX = await import("xlsx");

      const rows = filteredTransactions.map((transaction) => ({
        Date: formatDateTime(transaction.transactionDate),
        Type: transaction.typeLabel,
        "Payment Type": transaction.paymentTypeLabel,
        "Client Name": transaction.clientName || "",
        NRC: transaction.clientNrc || "",
        "Loan ID": transaction.loanId ?? "",
        "Loan Account No": transaction.loanAccountNo || "",
        Notes: transaction.notes || "",
        By: transaction.createdBy || "",
        Amount: transaction.signedAmount,
        Currency: transaction.currency,
        Balance: transaction.runningBalance,
        Status: transaction.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Mobile Money");

      XLSX.writeFile(
        workbook,
        `mobile-money-transactions-${getExportPeriodSuffix()}.xlsx`
      );
    } catch (exportError) {
      console.error("Error exporting mobile money transactions:", exportError);
      error({
        title: "Export failed",
        description: "Unable to export the mobile money ledger right now.",
      });
    } finally {
      setExporting(false);
    }
  }

  async function exportProvisioningExcel() {
    try {
      setProvisioningExporting(true);

      const provisioningRows = filteredTransactions
        .filter((transaction) => transaction.type === "PAYOUT")
        .map((transaction) => ({
          Date: formatDateTime(transaction.transactionDate),
          "Client Name": transaction.clientName || "",
          NRC: transaction.clientNrc || "",
          "Loan ID": transaction.loanId ?? "",
          "Loan Account No": transaction.loanAccountNo || "",
          "Payment Type": transaction.paymentTypeLabel,
          Amount: Math.abs(transaction.signedAmount),
          Currency: transaction.currency,
          Status: transaction.status,
          Notes: transaction.notes || "",
          "Processed By": transaction.createdBy || "",
        }));

      if (provisioningRows.length === 0) {
        error({
          title: "No payouts to export",
          description:
            "There are no mobile money payout rows in the selected date range.",
        });
        return;
      }

      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(provisioningRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Provisioning");
      XLSX.writeFile(
        workbook,
        `mobile-money-provisioning-${getExportPeriodSuffix()}.xlsx`
      );
    } catch (exportError) {
      console.error("Error exporting provisioning report:", exportError);
      error({
        title: "Provisioning export failed",
        description: "Unable to export the provisioning report right now.",
      });
    } finally {
      setProvisioningExporting(false);
    }
  }

  async function handleReverseTransaction() {
    if (!reverseTarget) return;

    setReversing(true);
    try {
      const response = await fetch(
        `/api/mobile-money-transactions/${reverseTarget.id}/reverse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to reverse top-up");
      }

      success({
        title: "Top-up reversed",
        description: "The mobile money top-up has been reversed successfully.",
      });
      setReverseTarget(null);
      await fetchMobileMoneyTransactions();
    } catch (reverseError) {
      console.error("Error reversing mobile money transaction:", reverseError);
      error({
        title: "Unable to reverse top-up",
        description:
          reverseError instanceof Error
            ? reverseError.message
            : "Please try again.",
      });
    } finally {
      setReversing(false);
    }
  }

  if (loading) {
    return <TellerVaultTransactionsSkeleton />;
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mobile Money Transactions</h1>
          <p className="text-muted-foreground mt-1">
            Error loading the mobile money ledger
          </p>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-red-500">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">{errorMessage}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={fetchMobileMoneyTransactions}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mobile Money Transactions</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canConfigure && (
            <Button variant="outline" onClick={() => setConfigOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Configure GL
            </Button>
          )}
          <Button
            onClick={() => setTopupOpen(true)}
            disabled={!configured}
            title={
              configured
                ? "Post a mobile money top-up"
                : "Configure the mobile money GL first"
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Top Up Mobile Money
          </Button>
          <Button variant="outline" onClick={exportToExcel} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Export Excel"}
          </Button>
          <Button
            variant="outline"
            onClick={exportProvisioningExcel}
            disabled={provisioningExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {provisioningExporting
              ? "Exporting Provisioning..."
              : "Provisioning Export"}
          </Button>
          <Button variant="outline" onClick={fetchMobileMoneyTransactions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {!configured && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Mobile money setup is incomplete</AlertTitle>
          <AlertDescription>
            We can already track mobile money transactions here, but top-ups are
            disabled until the mobile money GL account, payout clearing GL, and
            default office are configured.
          </AlertDescription>
        </Alert>
      )}

      {configured && (
        <Alert>
          <Smartphone className="h-4 w-4" />
          <AlertTitle>Pool configuration</AlertTitle>
          <AlertDescription>
            Mobile Money GL: {configured.glAccountCode} -{" "}
            {configured.glAccountName}. Default office:{" "}
            {configured.defaultOfficeName}. Payout clearing GL:{" "}
            {configured.payoutClearingGlAccountCode} -{" "}
            {configured.payoutClearingGlAccountName}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Opening Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {formatCurrency(filteredSummary.openingBalance, currency)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Initial mobile money float
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">GL Top-Ups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              +{formatCurrency(filteredSummary.topUps, currency)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Float funded from GL
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Payout Reversals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-500">
              +{formatCurrency(filteredSummary.payoutReversals, currency)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Funds returned to mobile money
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Mobile Money Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              -{formatCurrency(filteredSummary.payouts, currency)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Loans paid out through mobile money
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredSummary.currentBalance, currency)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredSummary.transactionCount} transaction
              {filteredSummary.transactionCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Complete mobile money ledger with GL-funded top-ups, payouts, and
            reversals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-end">
            <div className="grid gap-2">
              <label htmlFor="mobile-money-from-date" className="text-sm font-medium">
                From date
              </label>
              <Input
                id="mobile-money-from-date"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="w-full md:w-[180px]"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="mobile-money-to-date" className="text-sm font-medium">
                To date
              </label>
              <Input
                id="mobile-money-to-date"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                min={fromDate || undefined}
                className="w-full md:w-[180px]"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              disabled={!fromDate && !toDate}
            >
              Clear dates
            </Button>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
              <Smartphone className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">
                {transactions.length === 0
                  ? "No mobile money transactions yet"
                  : "No mobile money transactions found for the selected date range"}
              </p>
              <p className="text-sm text-muted-foreground">
                {transactions.length === 0
                  ? "Top-ups and mobile money payouts will start showing here once the pool is in use."
                  : "Try widening the date range or clearing the filters."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payment Type</TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead>NRC</TableHead>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((transaction, index) => {
                      const typeInfo = getTransactionTypeInfo(transaction.type);
                      const Icon = typeInfo.icon;
                      const amountClass =
                        transaction.signedAmount >= 0
                          ? "text-green-500"
                          : "text-rose-500";

                      return (
                        <TableRow key={getTransactionRowKey(transaction, index)}>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(transaction.transactionDate)}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${typeInfo.color} text-white`}>
                              <Icon className="h-3 w-3 mr-1" />
                              {transaction.typeLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.paymentTypeLabel}</TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            {transaction.clientName || "—"}
                          </TableCell>
                          <TableCell>{transaction.clientNrc || "—"}</TableCell>
                          <TableCell>{transaction.loanId ?? "—"}</TableCell>
                          <TableCell className="max-w-[360px] truncate">
                            {transaction.notes || "—"}
                          </TableCell>
                          <TableCell>{transaction.createdBy || "System"}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${amountClass}`}
                          >
                            {transaction.signedAmount >= 0 ? "+" : "-"}
                            {formatCurrency(
                              Math.abs(transaction.signedAmount),
                              transaction.currency
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(
                              transaction.runningBalance,
                              transaction.currency
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.canReverse ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReverseTarget(transaction)}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Reverse
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {paginationStart}-{paginationEnd} of{" "}
                  {filteredTransactions.length}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPageIndex(0);
                    }}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size} / page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPageIndex(0)}
                      disabled={safePageIndex === 0}
                    >
                      <ChevronFirst className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setPageIndex((current) => Math.max(0, current - 1))
                      }
                      disabled={safePageIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-sm text-muted-foreground">
                      Page {safePageIndex + 1} of {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setPageIndex((current) =>
                          Math.min(pageCount - 1, current + 1)
                        )
                      }
                      disabled={safePageIndex >= pageCount - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPageIndex(pageCount - 1)}
                      disabled={safePageIndex >= pageCount - 1}
                    >
                      <ChevronLast className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MobileMoneyConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        onSaved={fetchMobileMoneyTransactions}
      />

      <MobileMoneyTopupModal
        open={topupOpen}
        onOpenChange={setTopupOpen}
        defaultOfficeId={configured?.defaultOfficeId || config?.defaultOfficeId}
        onSaved={fetchMobileMoneyTransactions}
      />

      <AlertDialog
        open={Boolean(reverseTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setReverseTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse top-up?</AlertDialogTitle>
            <AlertDialogDescription>
              This will post the reverse GL journal entry and create a reversal
              row in the mobile money ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reversing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReverseTransaction} disabled={reversing}>
              {reversing ? "Reversing..." : "Reverse Top-Up"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
