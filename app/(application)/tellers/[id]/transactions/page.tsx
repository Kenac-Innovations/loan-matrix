"use client";

import { useState, useEffect, use } from "react";
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
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Wallet,
  AlertCircle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  type: string;
  notes: string | null;
  allocatedBy: string;
  status: string;
  runningBalance: number;
}

interface Summary {
  openingBalance: number;
  allocationsFromBank: number;
  settlementReturns: number;
  varianceAdjustments: number;
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
  const [teller, setTeller] = useState<TellerInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      case "SETTLEMENT_RETURN":
        return {
          label: "Settlement Return",
          color: "bg-orange-500",
          icon: ArrowUpRight,
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

  const currency = transactions[0]?.currency || "ZMW";

  if (loading) {
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
            <p className="text-muted-foreground mt-1">Loading...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading transactions...
        </div>
      </div>
    );
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
        <Button variant="outline" onClick={fetchTransactions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
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
              <ArrowUpRight className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {summary.settlementReturns >= 0 ? "+" : ""}
                {formatCurrency(summary.settlementReturns, currency)}
              </div>
              <p className="text-xs text-muted-foreground">Cash from cashier settlements</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Adjustments</CardTitle>
              <AlertCircle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {summary.varianceAdjustments >= 0 ? "+" : ""}
                {formatCurrency(summary.varianceAdjustments, currency)}
              </div>
              <p className="text-xs text-muted-foreground">Variance corrections</p>
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
                  {transactions.map((tx) => {
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
                          {tx.allocatedBy === "SYSTEM-IMPORT" ? "System" : tx.allocatedBy?.slice(0, 8) || "—"}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
