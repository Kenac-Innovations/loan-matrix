"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClientMetricsData {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  newClientsThisMonth: number;
  totalPortfolioValue: number;
  averageLoanAmount: number;
  clientGrowthRate: number;
  riskClients: number;
}

export function ClientMetrics() {
  const [metrics, setMetrics] = useState<ClientMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch("/api/clients/metrics");
        if (!response.ok) {
          throw new Error("Failed to fetch client metrics");
        }
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        console.error("Error fetching client metrics:", err);
        setError("Failed to load client metrics from Fineract");
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load client metrics</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          <Users className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.totalClients)}
          </div>
          <p className="text-xs text-green-400">
            +{metrics.clientGrowthRate}% from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
          <UserCheck className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.activeClients)}
          </div>
          <p className="text-xs text-muted-foreground">
            {((metrics.activeClients / metrics.totalClients) * 100).toFixed(1)}%
            of total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">New This Month</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.newClientsThisMonth)}
          </div>
          <p className="text-xs text-green-400">+15% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
          <DollarSign className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metrics.totalPortfolioValue)}
          </div>
          <p className="text-xs text-green-400">+8% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Average Loan</CardTitle>
          <DollarSign className="h-4 w-4 text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metrics.averageLoanAmount)}
          </div>
          <p className="text-xs text-muted-foreground">Per active client</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Inactive Clients
          </CardTitle>
          <UserX className="h-4 w-4 text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.inactiveClients)}
          </div>
          <p className="text-xs text-muted-foreground">
            {((metrics.inactiveClients / metrics.totalClients) * 100).toFixed(
              1
            )}
            % of total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Risk Clients</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.riskClients)}
          </div>
          <p className="text-xs text-red-400">Require attention</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.clientGrowthRate}%</div>
          <p className="text-xs text-green-400">Monthly growth</p>
        </CardContent>
      </Card>
    </div>
  );
}
