"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, RefreshCw, Undo2 } from "lucide-react";
import {
  ReverseCashierEntryModal,
  type ReverseCashierEntryInitial,
} from "../../components/reverse-cashier-entry-modal";
import {
  getOriginalCashDirectionForCounterEntry,
  isCashierCounterEntryBlockedByLoanContext,
} from "@/lib/cashier-txn-reversal-eligibility";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn } from "@/shared/types/data-table";

interface Transaction {
  id: number | string;
  cashierId?: number;
  txnType?: string | { id: number; value: string };
  txnAmount?: number;
  txnDate?: string | number[];
  txnNote?: string;
  entityType?: string;
  entityId?: number;
  createdDate?: string | number[];
  transactionDate?: string | number[];
  transactionType?: {
    id: number;
    code: string;
    value: string;
  };
  amount?: number;
  currency?: {
    code: string;
    name: string;
  };
  notes?: string;
}

interface Currency {
  code: string;
  name: string;
  displaySymbol?: string;
}

function transactionDateToIsoDate(tx: Transaction): string {
  const d = tx.txnDate || tx.transactionDate || tx.createdDate;
  if (Array.isArray(d) && d.length >= 3) {
    const [y, m, day] = d;
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  return new Date().toISOString().split("T")[0];
}

function buildSourcePayload(tx: Transaction) {
  const tt = tx.transactionType;
  const txnObj =
    typeof tx.txnType === "object" && tx.txnType
      ? (tx.txnType as { code?: string; value?: string })
      : null;
  const codeFromTxnType = txnObj?.code;
  const valueFromTxnType =
    typeof tx.txnType === "string"
      ? tx.txnType
      : txnObj?.value;
  return {
    sourceTxnTypeCode:
      typeof tt === "object" && tt ? tt.code : codeFromTxnType,
    sourceTxnTypeValue:
      typeof tt === "object" && tt ? tt.value : valueFromTxnType,
    sourceNotes: tx.txnNote || tx.notes || undefined,
    sourceFineractTransactionId:
      typeof tx.id === "number" ? tx.id : undefined,
  };
}

interface Summary {
  sumCashAllocation?: number;
  sumCashSettlement?: number;
  sumOutwardCash?: number;
  netCash?: number;
  tellerName?: string;
  cashierName?: string;
  cashierTransactions?: {
    totalFilteredRecords?: number;
    pageItems?: Transaction[];
  };
}

export default function CashierTransactionsPage({
  params,
}: {
  params: Promise<{ id: string; cashierId: string }>;
}) {
  const { currencyCode: orgCurrency } = useCurrency();
  const [tellerId, setTellerId] = useState<string>("");
  const [cashierId, setCashierId] = useState<string>("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [reverseModalInitial, setReverseModalInitial] =
    useState<ReverseCashierEntryInitial | null>(null);

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      setTellerId(resolvedParams.id);
      setCashierId(resolvedParams.cashierId);
      fetchCurrencies();
    }
    loadParams();
  }, [params]);

  useEffect(() => {
    if (tellerId && cashierId && currencyCode) {
      fetchTransactions();
    }
  }, [tellerId, cashierId, currencyCode]);

  const fetchCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const response = await fetch("/api/fineract/currencies");
      if (response.ok) {
        const data = await response.json();
        const currencyList = Array.isArray(data.selectedCurrencyOptions)
          ? data.selectedCurrencyOptions
          : Array.isArray(data)
          ? data
          : data.currencies || [];

        setCurrencies(currencyList);

        if (!currencyCode && currencyList.length > 0) {
          setCurrencyCode(currencyList[0].code);
        }
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const url = `/api/tellers/${tellerId}/cashiers/${cashierId}/transactions?currencyCode=${currencyCode}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setSummary(data);

        if (
          data?.cashierTransactions?.pageItems &&
          Array.isArray(data.cashierTransactions.pageItems)
        ) {
          setTransactions(sortByDateDesc(data.cashierTransactions.pageItems));
        } else if (
          data?.cashierTransactions &&
          Array.isArray(data.cashierTransactions)
        ) {
          setTransactions(sortByDateDesc(data.cashierTransactions));
        } else if (Array.isArray(data)) {
          setTransactions(sortByDateDesc(data));
        } else {
          setTransactions([]);
        }
      } else {
        console.error("Failed to fetch transactions");
        setTransactions([]);
        setSummary(null);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setTransactions([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const toTimestamp = (date: string | number[] | undefined): number => {
    if (!date) return 0;
    if (Array.isArray(date) && date.length >= 3) {
      return new Date(date[0], date[1] - 1, date[2]).getTime();
    }
    if (typeof date === "string") {
      const d = new Date(date);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return 0;
  };

  const sortByDateDesc = (txns: Transaction[]) =>
    [...txns].sort((a, b) => {
      const dateA = a.txnDate || a.transactionDate || a.createdDate;
      const dateB = b.txnDate || b.transactionDate || b.createdDate;
      return toTimestamp(dateB) - toTimestamp(dateA);
    });

  const formatTransactionDate = (date: string | number[] | undefined) => {
    if (!date) return "—";
    if (Array.isArray(date) && date.length === 3) {
      return formatDate(date);
    }
    if (typeof date === "string") {
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
      const d = isDateOnly ? new Date(date + "T00:00:00") : new Date(date);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          ...(isDateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
        });
      }
    }
    return "—";
  };

  const formatAmount = (amount: number, currency?: string) => {
    // Normalize ZMK to ZMW (Fineract uses legacy ZMK code)
    const normalizedCurrency = currency === "ZMK" ? "ZMW" : (currency || orgCurrency);
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalizedCurrency,
      }).format(amount);
    } catch {
      return `${normalizedCurrency} ${amount.toFixed(2)}`;
    }
  };

  const getTransactionTypeLabel = (tx: Transaction): string => {
    const txnTypeValue =
      typeof tx.txnType === "object"
        ? (tx.txnType as { value?: string })?.value || ""
        : (tx.txnType as string) || tx.transactionType?.value || tx.transactionType?.code || "";

    const txnTypeLower = txnTypeValue.toLowerCase();
    const isReversal = txnTypeLower.includes("reversal") || (tx as { _isReversal?: boolean })._isReversal;
    const isAllocate =
      txnTypeLower.includes("allocate") ||
      txnTypeLower.includes("credit") ||
      txnTypeLower.includes("deposit");
    const isSettle =
      txnTypeLower.includes("settle") ||
      txnTypeLower.includes("debit") ||
      txnTypeLower.includes("withdrawal") ||
      txnTypeLower.includes("expense");

    if (isReversal) return "Reversal (Cash In)";
    if (isAllocate) return "Cash In";
    if (isSettle) return "Cash Out";
    return txnTypeValue || "Unknown";
  };

  const getTransactionTypeBadge = (tx: Transaction) => {
    const label = getTransactionTypeLabel(tx);
    if (label === "Reversal (Cash In)") {
      return <Badge className="bg-green-600 text-white">Reversal (Cash In)</Badge>;
    }
    if (label === "Cash In") {
      return <Badge className="bg-green-500 text-white">Cash In</Badge>;
    }
    if (label === "Cash Out") {
      return <Badge variant="destructive">Cash Out</Badge>;
    }
    return <Badge variant="outline">{label}</Badge>;
  };

  const getTransactionAmount = (tx: Transaction) => {
    return tx.txnAmount || tx.amount || 0;
  };

  const getTransactionDate = (tx: Transaction) => {
    return tx.txnDate || tx.transactionDate;
  };

  const getTransactionNotes = (tx: Transaction) => {
    return tx.txnNote || tx.notes || "—";
  };

  const openReverseForRow = useCallback((tx: Transaction) => {
    const direction = getOriginalCashDirectionForCounterEntry(tx);
    if (!direction) return;
    const sp = buildSourcePayload(tx);
    setReverseModalInitial({
      amount: String(tx.txnAmount ?? tx.amount ?? ""),
      transactionDate: transactionDateToIsoDate(tx),
      notes: "",
      originalCashDirection: direction,
      sourceTxnTypeCode: sp.sourceTxnTypeCode,
      sourceTxnTypeValue: sp.sourceTxnTypeValue,
      sourceNotes: sp.sourceNotes,
      sourceFineractTransactionId: sp.sourceFineractTransactionId,
      lockDirection: true,
    });
    setReverseModalOpen(true);
  }, []);

  const columns: DataTableColumn<Transaction>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        accessorKey: "txnDate" as keyof Transaction,
        enableSorting: true,
        cell: ({ row }) => {
          const tx = row.original;
          const date = tx.txnDate || tx.transactionDate || tx.createdDate;
          return (
            <span className="text-sm">
              {formatTransactionDate(date)}
            </span>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        accessorKey: "txnType" as keyof Transaction,
        enableSorting: true,
        getExportValue: (row) => getTransactionTypeLabel(row),
        cell: ({ row }) => getTransactionTypeBadge(row.original),
      },
      {
        id: "amount",
        header: "Amount",
        accessorKey: "txnAmount" as keyof Transaction,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="text-sm font-medium text-right block">
            {formatAmount(
              row.original.txnAmount || row.original.amount || 0,
              currencyCode
            )}
          </span>
        ),
      },
      {
        id: "notes",
        header: "Notes",
        accessorKey: "txnNote" as keyof Transaction,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {getTransactionNotes(row.original)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const tx = row.original;
          const direction = getOriginalCashDirectionForCounterEntry(tx);
          const sp = buildSourcePayload(tx);
          const blocked = isCashierCounterEntryBlockedByLoanContext({
            sourceTxnTypeCode: sp.sourceTxnTypeCode,
            sourceTxnTypeValue: sp.sourceTxnTypeValue,
            sourceNotes: sp.sourceNotes,
          });
          const canReverse = direction != null && !blocked;
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
              disabled={!canReverse}
              title={
                blocked
                  ? "Repayment/disbursement: reverse from the loan"
                  : direction == null
                    ? "Unrecognized transaction type for cashier-only reverse"
                    : "Post opposing entry on cashier only"
              }
              onClick={() => openReverseForRow(tx)}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Reverse
            </Button>
          );
        },
      },
    ],
    [currencyCode, openReverseForRow]
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/tellers/${tellerId}/cashiers`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Cashier Transactions</h1>
            {summary && (
              <p className="text-muted-foreground">
                {summary.tellerName} → {summary.cashierName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setReverseModalInitial(null);
              setReverseModalOpen(true);
            }}
            disabled={!tellerId || !cashierId || !currencyCode}
            title="Post opposing cashier entry (choose cash in vs cash out)"
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Reverse cashier movement
          </Button>
          <Button
            onClick={fetchTransactions}
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <ReverseCashierEntryModal
        open={reverseModalOpen}
        onOpenChange={(o) => {
          setReverseModalOpen(o);
          if (!o) setReverseModalInitial(null);
        }}
        tellerId={tellerId}
        cashierId={cashierId}
        currencyCode={currencyCode}
        initial={reverseModalInitial}
        onSuccess={fetchTransactions}
      />

      {/* Currency Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="currencyCode" className="shrink-0">
              Currency:
            </Label>
            <select
              id="currencyCode"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              disabled={loadingCurrencies}
              className="flex h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {loadingCurrencies ? (
                <option value="">Loading...</option>
              ) : currencies.length === 0 ? (
                <option value="">No currencies</option>
              ) : (
                currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-2">
              <CardDescription>Cash In</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {formatAmount(summary.sumCashAllocation || 0, currencyCode)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardHeader className="pb-2">
              <CardDescription>Cash Out</CardDescription>
              <CardTitle className="text-2xl text-red-600">
                {formatAmount(
                  (summary.sumCashSettlement || 0) + (summary.sumOutwardCash || 0),
                  currencyCode
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Balance</CardDescription>
              <CardTitle className="text-2xl">
                {formatAmount(summary.netCash || 0, currencyCode)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Transactions Table – TanStack DataTable with pagination, sorting, search */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            {summary?.cashierTransactions?.totalFilteredRecords ?? transactions.length} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenericDataTable<Transaction>
            data={transactions}
            columns={columns}
            enablePagination={true}
            pageSize={25}
            searchPlaceholder="Search notes..."
            searchColumn="notes"
            enableExport={true}
            exportFileName={`cashier-${cashierId}-transactions`}
            enableFilters={false}
            enableColumnVisibility={true}
            isLoading={loading}
            emptyMessage="No transactions found for this currency"
            defaultSorting={[{ id: "date", desc: true }]}
            tableId={`cashier-transactions-${tellerId}-${cashierId}`}
          />
        </CardContent>
      </Card>

      {/* Footer Summary */}
      {transactions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Transactions:</span>
              <span className="text-sm font-bold">{transactions.length}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm font-medium">Balance:</span>
              <span className="text-sm font-bold">
                {formatAmount(summary?.netCash || 0, currencyCode)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

