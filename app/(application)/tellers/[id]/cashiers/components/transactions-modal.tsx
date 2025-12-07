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
  transactionDate: string | number[];
  transactionType: {
    id: number;
    code: string;
    value: string;
  };
  amount: number;
  currency: {
    code: string;
    name: string;
  };
  notes?: string;
  createdDate?: string | number[];
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
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (open) {
      fetchTransactions();
    }
  }, [open, tellerId, cashierId]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let url = `/api/tellers/${tellerId}/cashiers/${cashierId}/transactions`;
      const params = new URLSearchParams();
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTransactions(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to fetch transactions");
        setTransactions([]);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setTransactions([]);
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
      currency: currency || "USD",
    }).format(amount);
  };

  const getTransactionTypeBadge = (type: Transaction["transactionType"]) => {
    const code = type?.code || "";
    const isDebit = code.includes("DEBIT") || code.includes("WITHDRAWAL");
    const isCredit = code.includes("CREDIT") || code.includes("DEPOSIT");

    if (isDebit) {
      return <Badge variant="destructive">Debit</Badge>;
    } else if (isCredit) {
      return <Badge className="bg-green-500 text-white">Credit</Badge>;
    }
    return <Badge variant="outline">{type?.value || code}</Badge>;
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

        {/* Date Filters */}
        <div className="flex gap-4 py-4 border-b">
          <div className="flex-1 space-y-2">
            <Label htmlFor="fromDate">From Date</Label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="toDate">To Date</Label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleFilter} disabled={loading}>
              Filter
            </Button>
          </div>
        </div>

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
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">
                        {formatTransactionDate(tx.transactionDate)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getTransactionTypeBadge(tx.transactionType)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatAmount(tx.amount, tx.currency?.code || "USD")}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {tx.notes || "—"}
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
              <span className="text-sm font-medium">Total Amount:</span>
              <span className="text-sm font-bold">
                {formatAmount(
                  transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
                  transactions[0]?.currency?.code || "USD"
                )}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

