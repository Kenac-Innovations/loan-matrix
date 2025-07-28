"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { ProgressChart, MetricsChart } from "@/components/charts";
import { LeadMetrics as LeadMetricsType } from "@/app/actions/leads-actions";

interface LeadMetricsProps {
  className?: string;
  metrics: LeadMetricsType;
}

export function LeadMetrics({ className, metrics }: LeadMetricsProps) {
  // Calculate progress percentages
  const activeLeadsProgress = Math.round(
    (metrics.activeLeads / metrics.monthlyTarget) * 100
  );
  const conversionProgress = Math.round(
    (metrics.conversionRate / metrics.conversionTarget) * 100
  );
  const processingTimeProgress = Math.round(
    ((metrics.processingTimeTarget - metrics.avgProcessingTime) /
      metrics.processingTimeTarget) *
      100
  );

  // Calculate trends (placeholder - in real app this would come from historical data)
  const activeLeadsTrend =
    metrics.activeLeads > metrics.monthlyTarget * 0.8 ? "up" : "down";
  const conversionTrend =
    metrics.conversionRate >= metrics.conversionTarget * 0.9 ? "up" : "down";
  const processingTimeTrend =
    metrics.avgProcessingTime <= metrics.processingTimeTarget ? "up" : "down";
  const slaComplianceTrend = metrics.slaCompliance >= 90 ? "up" : "down";
  return (
    <div
      className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
          {activeLeadsTrend === "up" ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.activeLeads}</div>
          <div className="flex items-center mt-1">
            <span
              className={`text-xs ${
                activeLeadsTrend === "up" ? "text-green-400" : "text-red-400"
              }`}
            >
              {metrics.activeLeads >= metrics.monthlyTarget ? "+" : ""}
              {Math.abs(metrics.activeLeads - metrics.monthlyTarget)} from
              target
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span>Monthly Target: {metrics.monthlyTarget}</span>
              <ProgressChart
                value={Math.min(activeLeadsProgress, 100)}
                color="#22C55E"
                size="sm"
                showPercentage={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          {conversionTrend === "up" ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
          <div className="flex items-center mt-1">
            <span
              className={`text-xs ${
                conversionTrend === "up" ? "text-green-400" : "text-red-400"
              }`}
            >
              {conversionTrend === "up" ? "+" : ""}
              {Math.abs(
                metrics.conversionRate -
                  Math.round(metrics.conversionTarget * 0.9)
              )}
              % from target
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span>Monthly Target: {metrics.conversionTarget}%</span>
              <ProgressChart
                value={Math.min(conversionProgress, 100)}
                color="#EAB308"
                size="sm"
                showPercentage={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Avg. Processing Time
          </CardTitle>
          {processingTimeTrend === "up" ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.avgProcessingTime} days
          </div>
          <div className="flex items-center mt-1">
            <span
              className={`text-xs ${
                processingTimeTrend === "up" ? "text-green-400" : "text-red-400"
              }`}
            >
              {processingTimeTrend === "up" ? "-" : "+"}
              {Math.abs(
                metrics.avgProcessingTime - metrics.processingTimeTarget
              )}{" "}
              days from target
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span>Target: {metrics.processingTimeTarget} days</span>
              <ProgressChart
                value={Math.min(Math.max(processingTimeProgress, 0), 100)}
                color="#3B82F6"
                size="sm"
                showPercentage={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
          {slaComplianceTrend === "up" ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.slaCompliance}%</div>
          <div className="flex items-center mt-1">
            <span
              className={`text-xs ${
                slaComplianceTrend === "up" ? "text-green-400" : "text-red-400"
              }`}
            >
              {slaComplianceTrend === "up" ? "+" : ""}
              {Math.abs(metrics.slaCompliance - 90)}% from target
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>On Time ({metrics.onTimeCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                <span>At Risk ({metrics.atRiskCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                <span>Overdue ({metrics.overdueCount})</span>
              </div>
            </div>
            <MetricsChart
              type="sla-breakdown"
              data={{
                onTimeCount: metrics.onTimeCount,
                atRiskCount: metrics.atRiskCount,
                overdueCount: metrics.overdueCount,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
