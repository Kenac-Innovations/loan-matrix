"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
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
  id: number;
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

interface Summary {
  sumCashAllocation?: number;
  sumCashSettlement?: number;
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
  const router = useRouter();
  const [tellerId, setTellerId] = useState<string>("");
  const [cashierId, setCashierId] = useState<string>("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);

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

        if (!currencyCode) {
          // Prefer ZMW – allocations use ZMW; ZMK summary shows different/legacy data
          const zmw =
            currencyList.length > 0 &&
            currencyList.find(
              (c: Currency) => (c.code || "").toUpperCase() === "ZMW"
            );
          setCurrencyCode(zmw?.code ?? currencyList[0]?.code ?? "ZMW");
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
          setTransactions(data.cashierTransactions.pageItems);
        } else if (
          data?.cashierTransactions &&
          Array.isArray(data.cashierTransactions)
        ) {
          setTransactions(data.cashierTransactions);
        } else if (Array.isArray(data)) {
          setTransactions(data);
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

  const formatTransactionDate = (date: string | number[] | undefined) => {
    if (!date) return "—";
    if (Array.isArray(date) && date.length === 3) {
      return formatDate(date);
    }
    if (typeof date === "string") {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
    return "—";
  };

  const formatAmount = (amount: number, currency?: string) => {
    // Normalize ZMK to ZMW (Fineract uses legacy ZMK code)
    const normalizedCurrency = currency === "ZMK" ? "ZMW" : (currency || "ZMW");
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalizedCurrency,
      }).format(amount);
    } catch {
      return `${normalizedCurrency} ${amount.toFixed(2)}`;
    }
  };

  const getTransactionTypeBadge = (tx: Transaction) => {
    const txnTypeValue =
      typeof tx.txnType === "object"
        ? tx.txnType?.value || ""
        : tx.txnType || tx.transactionType?.value || tx.transactionType?.code || "";

    const txnTypeLower = txnTypeValue.toLowerCase();
    const isAllocate =
      txnTypeLower.includes("allocate") ||
      txnTypeLower.includes("credit") ||
      txnTypeLower.includes("deposit");
    const isSettle =
      txnTypeLower.includes("settle") ||
      txnTypeLower.includes("debit") ||
      txnTypeLower.includes("withdrawal");

    if (isAllocate) {
      return <Badge className="bg-green-500 text-white">Cash In</Badge>;
    } else if (isSettle) {
      return <Badge variant="destructive">Cash Out</Badge>;
    }
    return <Badge variant="outline">{txnTypeValue || "Unknown"}</Badge>;
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

  const columns: DataTableColumn<Transaction>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        accessorKey: "createdDate" as keyof Transaction,
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
    ],
    [currencyCode]
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
        <Button
          onClick={fetchTransactions}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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
                {formatAmount(summary.sumCashSettlement || 0, currencyCode)}
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

