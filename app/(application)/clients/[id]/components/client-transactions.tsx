"use client";

import useSWR from 'swr';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FineractTransaction {
  id: number;
  type: {
    id: number;
    code: string;
    value: string;
    disbursement: boolean;
    repayment: boolean;
  };
  date: string;
  amount: number;
  principalPortion?: number;
  interestPortion?: number;
  feeChargesPortion?: number;
  outstandingLoanBalance?: number;
  submittedOnDate: string;
  manuallyReversed: boolean;
}

interface ClientTransactionsProps {
  clientId: number;
}

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ClientTransactions({ clientId }: ClientTransactionsProps) {
  const { data, error, isLoading } = useSWR(`/api/fineract/clients/${clientId}/transactions`, fetcher);

  // Handle different response formats
  const transactions: FineractTransaction[] = (() => {
    if (!data) return [];
    
    // If data is directly an array
    if (Array.isArray(data)) {
      return data;
    }
    
    // If data has pageItems (Fineract pagination format)
    if (data.pageItems && Array.isArray(data.pageItems)) {
      return data.pageItems;
    }
    
    // If data has content (another Fineract format)
    if (data.content && Array.isArray(data.content)) {
      return data.content;
    }
    
    // If data has transactions property
    if (data.transactions && Array.isArray(data.transactions)) {
      return data.transactions;
    }
    
    // Fallback to empty array
    return [];
  })();

  const getTransactionIcon = (transaction: FineractTransaction) => {
    if (transaction.type.disbursement) {
      return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
    }
    if (transaction.type.repayment) {
      return <ArrowUpRight className="h-4 w-4 text-blue-500" />;
    }
    return <DollarSign className="h-4 w-4 text-gray-500" />;
  };

  const getTransactionBadge = (transaction: FineractTransaction) => {
    if (transaction.manuallyReversed) {
      return (
        <Badge variant="outline" className="bg-red-500 text-white border-0">
          Reversed
        </Badge>
      );
    }
    if (transaction.type.disbursement) {
      return (
        <Badge variant="outline" className="bg-green-500 text-white border-0">
          Disbursement
        </Badge>
      );
    }
    if (transaction.type.repayment) {
      return (
        <Badge variant="outline" className="bg-blue-500 text-white border-0">
          Repayment
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-500 text-white border-0">
        {transaction.type.value}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load client transactions from Fineract</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>
          Complete transaction history for this client
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No transactions found for this client
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatDate(transaction.date)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction)}
                        {getTransactionBadge(transaction)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(transaction.amount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {transaction.principalPortion
                        ? formatCurrency(transaction.principalPortion)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {transaction.interestPortion
                        ? formatCurrency(transaction.interestPortion)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {transaction.outstandingLoanBalance
                        ? formatCurrency(transaction.outstandingLoanBalance)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
