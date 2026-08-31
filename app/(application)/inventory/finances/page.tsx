"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, RefreshCw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = {
  value: string;
  label: string;
};

type InventoryConfig = {
  currencies: Option[];
};

type FinanceSummary = {
  currencyCode: string;
  receivedStockValue: string;
  issuedStockValue: string;
  currentStockValue: string;
  repaymentsCollected: string;
  outstandingRecoveryValue: string;
  reconciliationDifference: string;
  openIssues: Array<{
    id: string;
    borrowerName: string;
    loanAccountNo: string;
    fineractOfficeName: string;
    currencyCode: string;
    status: string;
    totalValue: string;
    totalPaid: string;
    outstandingBalance: string;
    issuedAt: string;
  }>;
};

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function formatValue(value: string | number, currencyCode = "") {
  const amount = numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currencyCode ? `${currencyCode} ${amount}` : amount;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function InventoryFinancesPage() {
  const [config, setConfig] = useState<InventoryConfig>({ currencies: [] });
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    currencyCode: "USD",
    startDate: "",
    endDate: todayInputValue(),
  });

  const reconciliationStatus = useMemo(() => {
    const difference = numberValue(summary?.reconciliationDifference);
    if (Math.abs(difference) < 0.01) {
      return {
        label: "Balanced",
        className: "text-green-300",
      };
    }

    return {
      label: "Needs review",
      className: "text-orange-300",
    };
  }, [summary?.reconciliationDifference]);

  const loadFinances = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        currencyCode: filters.currencyCode,
      });
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      const [configResponse, financeResponse] = await Promise.all([
        fetch("/api/inventory/config"),
        fetch(`/api/inventory/finances?${params.toString()}`),
      ]);

      if (!configResponse.ok || !financeResponse.ok) {
        throw new Error("Inventory finance information could not be loaded.");
      }

      const [configData, financeData] = await Promise.all([
        configResponse.json(),
        financeResponse.json(),
      ]);

      setConfig(configData);
      setSummary(financeData);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Inventory finance load failed."
      );
    } finally {
      setLoading(false);
    }
  }, [filters.currencyCode, filters.endDate, filters.startDate]);

  useEffect(() => {
    loadFinances();
  }, [loadFinances]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-2 px-0 text-muted-foreground">
            <Link href="/inventory">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inventory
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">Inventory Finances</h1>
          <p className="text-sm text-muted-foreground">
            Track stock received, stock issued, money collected, and outstanding recoveries.
          </p>
        </div>
        <Button onClick={loadFinances} variant="outline" disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <Card className="bg-[#1d2838]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Banknote className="h-5 w-5 text-green-400" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={filters.currencyCode}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, currencyCode: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {config.currencies.map((currency) => (
                  <SelectItem key={currency.value} value={currency.value}>
                    {currency.value} - {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, endDate: event.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Stock Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatValue(summary?.receivedStockValue ?? "0", filters.currencyCode)}
            </div>
            <p className="text-sm text-muted-foreground">Total value stocked</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Stock Issued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatValue(summary?.issuedStockValue ?? "0", filters.currencyCode)}
            </div>
            <p className="text-sm text-muted-foreground">Recoverable value issued</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Current Stock Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatValue(summary?.currentStockValue ?? "0", filters.currencyCode)}
            </div>
            <p className="text-sm text-muted-foreground">Value still in inventory</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Repayments Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatValue(summary?.repaymentsCollected ?? "0", filters.currencyCode)}
            </div>
            <p className="text-sm text-muted-foreground">Money received against stock issues</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Outstanding Recoveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatValue(summary?.outstandingRecoveryValue ?? "0", filters.currencyCode)}
            </div>
            <p className="text-sm text-muted-foreground">Money still expected from borrowers</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Scale className="h-4 w-4 text-blue-400" />
              Balance Check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${reconciliationStatus.className}`}>
              {reconciliationStatus.label}
            </div>
            <p className="text-sm text-muted-foreground">
              Difference:{" "}
              {formatValue(summary?.reconciliationDifference ?? "0", filters.currencyCode)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#1d2838]">
        <CardHeader>
          <CardTitle className="text-white">Outstanding Stock Recoveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-muted-foreground">
                <tr>
                  <th className="py-3">Issued</th>
                  <th>Borrower</th>
                  <th>Branch</th>
                  <th>Value</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Loading finance summary...
                    </td>
                  </tr>
                ) : !summary || summary.openIssues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No outstanding stock recoveries for the selected filters.
                    </td>
                  </tr>
                ) : (
                  summary.openIssues.map((issue) => (
                    <tr key={issue.id} className="border-b border-white/5">
                      <td className="py-3">
                        {issue.issuedAt
                          ? new Date(issue.issuedAt).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>
                        <div className="font-medium text-white">{issue.borrowerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {issue.loanAccountNo || "-"}
                        </div>
                      </td>
                      <td>{issue.fineractOfficeName || "-"}</td>
                      <td>{formatValue(issue.totalValue, issue.currencyCode)}</td>
                      <td>{formatValue(issue.totalPaid, issue.currencyCode)}</td>
                      <td>{formatValue(issue.outstandingBalance, issue.currencyCode)}</td>
                      <td>{issue.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
