"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Wallet,
  AlertCircle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { TellerVaultTransactionsSkeleton } from "@/components/skeletons/tellers-skeleton";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  type: string;
  notes: string | null;
  allocatedBy: string;
  allocatedByName: string;
  status: string;
  runningBalance: number;
}

interface Summary {
  openingBalance: number;
  allocationsFromBank: number;
  settlementReturns: number;
  tellerToCashierAllocations: number;
  currentBalance: number;
  transactionCount: number;
}

interface TellerInfo {
  id: string;
  name: string;
  fineractTellerId: number | null;
}

export default function TellerTransactionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tellerId } = use(params);
  const { currencyCode: orgCurrency } = useCurrency();
  const [teller, setTeller] = useState<TellerInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tellers/${tellerId}/transactions`);
      if (response.ok) {
        const data = await response.json();
        setTeller(data.teller || null);
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch transactions");
      }
    } catch (err) {
      setError("Failed to fetch transactions");
      console.error("Error fetching teller transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [tellerId]);

  useEffect(() => {
    setPageIndex(0);
  }, [transactions.length]);

  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case "OPENING_BALANCE":
        return {
          label: "Opening Balance",
          color: "bg-blue-500",
          icon: Wallet,
        };
      case "ALLOCATION":
        return {
          label: "Bank Allocation",
          color: "bg-green-500",
          icon: ArrowDownRight,
        };
      case "CASHIER_ALLOCATION":
        return {
          label: "Cashier Allocation",
          color: "bg-rose-600",
          icon: ArrowUpRight,
        };
      case "SETTLEMENT_RETURN":
        return {
          label: "Settlement Return",
          color: "bg-cyan-600",
          icon: ArrowDownRight,
        };
      case "VARIANCE_ADJUSTMENT":
        return {
          label: "Variance Adjustment",
          color: "bg-purple-500",
          icon: AlertCircle,
        };
      default:
        return {
          label: type,
          color: "bg-gray-500",
          icon: Wallet,
        };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      const XLSX = await import("xlsx");

      const exportRows = transactions.map((tx) => ({
        Date: formatDate(tx.date),
        Type: getTransactionTypeInfo(tx.type).label,
        Notes: tx.notes || "",
        By: tx.allocatedByName || "",
        Amount: tx.amount,
        Currency: tx.currency,
        Balance: tx.runningBalance,
        Status: tx.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

      const fileDate = new Date().toISOString().split("T")[0];
      XLSX.writeFile(
        workbook,
        `teller-${tellerId}-transactions-${fileDate}.xlsx`
      );
    } catch (exportError) {
      console.error("Error exporting teller transactions:", exportError);
    } finally {
      setExporting(false);
    }
  };

  const currency = transactions[0]?.currency || orgCurrency;
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedTransactions = useMemo(() => {
    const start = safePageIndex * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, safePageIndex, pageSize]);
  const paginationStart = transactions.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const paginationEnd = Math.min((safePageIndex + 1) * pageSize, transactions.length);

  if (loading) {
    return <TellerVaultTransactionsSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/tellers/${tellerId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Vault Transactions</h1>
            <p className="text-muted-foreground mt-1">Error loading data</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-red-500">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchTransactions}>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/tellers/${tellerId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Vault Transactions</h1>
            <p className="text-muted-foreground mt-1">
              {teller?.name || "Teller"} • All cash movements in and out of the vault
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportToExcel}
            disabled={transactions.length === 0 || exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Export Excel"}
          </Button>
          <Button variant="outline" onClick={fetchTransactions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
              <Wallet className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(summary.openingBalance, currency)}
              </div>
              <p className="text-xs text-muted-foreground">Initial imported balance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bank Allocations</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +{formatCurrency(summary.allocationsFromBank, currency)}
              </div>
              <p className="text-xs text-muted-foreground">Cash received from bank</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Settlement Returns</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-700">
                {summary.settlementReturns >= 0 ? "+" : ""}
                {formatCurrency(summary.settlementReturns, currency)}
              </div>
              <p className="text-xs text-muted-foreground">Cash from cashier settlements</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Teller to Cashier</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-700">
                {formatCurrency(summary.tellerToCashierAllocations, currency)}
              </div>
              <p className="text-xs text-muted-foreground">Cash allocated from teller to cashiers</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.currentBalance, currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.transactionCount} transaction{summary.transactionCount === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Complete record of all vault transactions in chronological order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found for this teller vault.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Date</TableHead>
                    <TableHead className="w-[160px]">Type</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[120px]">By</TableHead>
                    <TableHead className="text-right w-[140px]">Amount</TableHead>
                    <TableHead className="text-right w-[140px]">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((tx) => {
                    const typeInfo = getTransactionTypeInfo(tx.type);
                    const Icon = typeInfo.icon;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${typeInfo.color} text-white flex items-center gap-1 w-fit`}
                          >
                            <Icon className="h-3 w-3" />
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <span className="truncate block" title={tx.notes || undefined}>
                            {tx.notes || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {tx.allocatedByName || "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            tx.amount >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {tx.amount >= 0 ? "+" : ""}
                          {formatCurrency(tx.amount, tx.currency)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(tx.runningBalance, tx.currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {paginationStart}-{paginationEnd} of {transactions.length} transactions
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Rows per page</p>
                    <Select
                      value={`${pageSize}`}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setPageIndex(0);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={pageSize} />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 25, 50, 100].map((size) => (
                          <SelectItem key={size} value={`${size}`}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center text-sm font-medium">
                    Page {safePageIndex + 1} of {pageCount}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setPageIndex(0)}
                      disabled={safePageIndex === 0}
                    >
                      <span className="sr-only">Go to first page</span>
                      <ChevronFirst className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={safePageIndex === 0}
                    >
                      <span className="sr-only">Go to previous page</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setPageIndex((prev) => Math.min(prev + 1, pageCount - 1))
                      }
                      disabled={safePageIndex >= pageCount - 1}
                    >
                      <span className="sr-only">Go to next page</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setPageIndex(pageCount - 1)}
                      disabled={safePageIndex >= pageCount - 1}
                    >
                      <span className="sr-only">Go to last page</span>
                      <ChevronLast className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
