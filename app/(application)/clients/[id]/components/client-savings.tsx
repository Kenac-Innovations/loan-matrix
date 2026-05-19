"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Wallet,
  AlertCircle,
  ChevronRight,
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

interface FineractSavingsAccount {
  id: number;
  accountNo: string;
  productName?: string;
  savingsProductName?: string;
  status?: {
    id: number;
    code: string;
    value: string;
    active?: boolean;
    closed?: boolean;
  };
  currency?: { code: string; displaySymbol?: string };
  summary?: { availableBalance?: number; accountBalance?: number };
  depositType?: { value: string };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getStatusBadge(account: FineractSavingsAccount) {
  const statusVal = account.status?.value?.toLowerCase() || "";
  if (statusVal.includes("active")) {
    return (
      <Badge variant="outline" className="bg-green-500 text-white border-0">
        Active
      </Badge>
    );
  }
  if (statusVal.includes("closed")) {
    return (
      <Badge variant="outline" className="bg-gray-500 text-white border-0">
        Closed
      </Badge>
    );
  }
  if (statusVal.includes("approved")) {
    return (
      <Badge variant="outline" className="bg-blue-500 text-white border-0">
        Approved
      </Badge>
    );
  }
  if (statusVal.includes("submitted") || statusVal.includes("pending")) {
    return (
      <Badge variant="outline" className="bg-yellow-500 text-white border-0">
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-gray-400 text-white border-0">
      {account.status?.value || "Unknown"}
    </Badge>
  );
}

function formatBalance(amount: number | undefined, currencyCode?: string) {
  if (amount === undefined || amount === null || isNaN(amount)) return "—";
  const code = currencyCode?.toUpperCase() === "ZMK" ? "ZMW" : (currencyCode || "ZMW");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ClientSavingsProps {
  clientId: number;
}

export function ClientSavings({ clientId }: ClientSavingsProps) {
  const router = useRouter();
  const { data, error, isLoading } = useSWR(
    `/api/fineract/clients/${clientId}/accounts`,
    fetcher
  );

  const accounts: FineractSavingsAccount[] = (() => {
    if (!data) return [];
    if (Array.isArray(data?.savingsAccounts)) return data.savingsAccounts;
    if (Array.isArray(data)) return data;
    return [];
  })();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
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
            <span>Failed to load savings accounts</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings Accounts</CardTitle>
        <CardDescription>All savings accounts for this client</CardDescription>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No savings accounts found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account No</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Available Balance</TableHead>
                  <TableHead className="w-[48px] text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() =>
                      router.push(`/clients/${clientId}/savings/${account.id}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(
                          `/clients/${clientId}/savings/${account.id}`
                        );
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open savings account ${account.accountNo}`}
                  >
                    <TableCell>
                      <span className="font-mono text-sm">{account.accountNo}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {account.productName || account.savingsProductName || "—"}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(account)}</TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">
                        {formatBalance(
                          account.summary?.availableBalance ??
                            account.summary?.accountBalance,
                          account.currency?.code
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
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
