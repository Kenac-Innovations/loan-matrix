"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import { Loader2 } from "lucide-react";

interface Transaction {
  id: number;
  cashierId?: number;
  txnType?: string;
  txnAmount?: number;
  txnDate?: string | number[];
  txnNote?: string;
  entityType?: string;
  entityId?: number;
  createdDate?: string | number[];
  // Legacy fields
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

interface TransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
}

export function TransactionsModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
}: TransactionsModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);

  // Fetch currencies from Fineract
  const fetchCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const response = await fetch("/api/fineract/currencies");
      if (response.ok) {
        const data = await response.json();
        // Handle different response structures from Fineract
        const currencyList = Array.isArray(data.selectedCurrencyOptions)
          ? data.selectedCurrencyOptions
          : Array.isArray(data)
          ? data
          : data.currencies || [];
        
        setCurrencies(currencyList);
        
        // Set default currency if not already set
        if (currencyList.length > 0 && !currencyCode) {
          setCurrencyCode(currencyList[0].code);
        }
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCurrencies();
    }
  }, [open]);

  useEffect(() => {
    if (open && currencyCode) {
      fetchTransactions();
    }
  }, [open, tellerId, cashierId, currencyCode]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const url = `/api/tellers/${tellerId}/cashiers/${cashierId}/transactions?currencyCode=${currencyCode}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log("Transactions API response:", data);
        
        // Store the full summary
        setSummary(data);
        
        // Extract transactions from the response
        // Fineract returns cashierTransactions as object with pageItems array
        if (data?.cashierTransactions?.pageItems && Array.isArray(data.cashierTransactions.pageItems)) {
          setTransactions(data.cashierTransactions.pageItems);
        } else if (data?.cashierTransactions && Array.isArray(data.cashierTransactions)) {
          setTransactions(data.cashierTransactions);
        } else if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          setTransactions([]);
        }
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch transactions:", errorData);
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

  const handleFilter = () => {
    fetchTransactions();
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "ZMW",
    }).format(amount);
  };

  const getTransactionTypeBadge = (tx: Transaction) => {
    // Handle both string and object formats for txnType
    const txnTypeValue = typeof tx.txnType === "object" 
      ? (tx.txnType as any)?.value || "" 
      : tx.txnType || tx.transactionType?.value || tx.transactionType?.code || "";
    
    const txnTypeLower = txnTypeValue.toLowerCase();
    const isAllocate = txnTypeLower.includes("allocate") || txnTypeLower.includes("credit") || txnTypeLower.includes("deposit");
    const isSettle = txnTypeLower.includes("settle") || txnTypeLower.includes("debit") || txnTypeLower.includes("withdrawal");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cashier Transactions</DialogTitle>
          <DialogDescription>
            {cashierName && `View transactions for ${cashierName}`}
          </DialogDescription>
        </DialogHeader>

        {/* Currency Filter */}
        <div className="flex gap-4 py-4 border-b">
          <div className="flex-1 space-y-2">
            <Label htmlFor="currencyCode">Currency</Label>
            <select
              id="currencyCode"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              disabled={loadingCurrencies}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {loadingCurrencies ? (
                <option value="">Loading currencies...</option>
              ) : currencies.length === 0 ? (
                <option value="">No currencies available</option>
              ) : (
                currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleFilter} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Cashier Summary */}
        {summary && (
          <div className="space-y-4 py-4 border-b">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{summary.tellerName}</span> → <span className="font-medium">{summary.cashierName}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-muted-foreground">Cash In</div>
                <div className="text-lg font-bold text-green-600">
                  {formatAmount(summary.sumCashAllocation || 0, currencyCode)}
                </div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xs text-muted-foreground">Cash Out</div>
                <div className="text-lg font-bold text-red-600">
                  {formatAmount(summary.sumCashSettlement || 0, currencyCode)}
                </div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="text-lg font-bold">
                  {formatAmount(summary.netCash || 0, currencyCode)}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Total Records: {summary.cashierTransactions?.totalFilteredRecords || 0}
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((tx, index) => (
                    <tr key={tx.id || index} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">
                        {formatTransactionDate(getTransactionDate(tx))}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getTransactionTypeBadge(tx)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatAmount(getTransactionAmount(tx), currencyCode)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {getTransactionNotes(tx)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {transactions.length > 0 && (
          <div className="mt-4 pt-4 border-t">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


