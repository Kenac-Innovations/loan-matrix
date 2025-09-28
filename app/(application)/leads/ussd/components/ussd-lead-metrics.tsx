"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressChart } from "@/components/charts/progress-chart";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  AlertCircle,
  Ban,
  Timer
} from "lucide-react";
import { UssdLeadsMetrics } from "@/app/actions/ussd-leads-actions";

interface UssdLeadMetricsProps {
  metrics: UssdLeadsMetrics;
  className?: string;
}

export function UssdLeadMetrics({ className, metrics }: UssdLeadMetricsProps) {
  // Calculate progress percentages
  const pendingActionProgress = Math.round((metrics.pendingAction / metrics.monthlyTarget) * 100);
  const approvedProgress = Math.round((metrics.approved / metrics.monthlyTarget) * 100);
  
  // Calculate trends (simplified for demo)
  const pendingActionTrend = metrics.pendingAction >= 20 ? "up" : "down";
  const approvedTrend = metrics.approved >= 15 ? "up" : "down";
  const processingTimeTrend = metrics.averageProcessingTime <= 24 ? "down" : "up";
  const approvalRateTrend = metrics.approvalRate >= 60 ? "up" : "down";

  return (
    <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {/* Pending Action Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pending Action</CardTitle>
          {pendingActionTrend === "up" ? (
            <TrendingUp className="h-4 w-4 text-orange-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-green-400" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{metrics.pendingAction}</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-muted-foreground">
              Applications requiring review
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span>Target: {metrics.monthlyTarget}</span>
              <ProgressChart
                value={Math.min(pendingActionProgress, 100)}
                color="#F97316"
                size="sm"
                showPercentage={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approved Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Approved</CardTitle>
          {approvedTrend === "up" ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{metrics.approved}</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-muted-foreground">
              {metrics.approvalRate}% approval rate
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span>Target: {metrics.monthlyTarget}</span>
              <ProgressChart
                value={Math.min(approvedProgress, 100)}
                color="#22C55E"
                size="sm"
                showPercentage={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rejected Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          <XCircle className="h-4 w-4 text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{metrics.rejected}</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-muted-foreground">
              Applications declined
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span>Rejection Rate: {Math.round((metrics.rejected / metrics.totalApplications) * 100)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Time Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Avg. Processing</CardTitle>
          {processingTimeTrend === "down" ? (
            <TrendingDown className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingUp className="h-4 w-4 text-red-400" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{metrics.averageProcessingTime}h</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-muted-foreground">
              Average processing time
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span>Target: &lt;24h</span>
              <div className="flex items-center gap-1">
                {metrics.averageProcessingTime <= 24 ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-orange-500" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Status Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Under Review</CardTitle>
          <Clock className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{metrics.underReview}</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-muted-foreground">
              Currently being reviewed
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Disbursed</CardTitle>
          <DollarSign className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{metrics.disbursed}</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-muted-foreground">
              Successfully disbursed
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
          <Ban className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-600">{metrics.cancelled}</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-muted-foreground">
              User cancelled
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Expired</CardTitle>
          <Timer className="h-4 w-4 text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{metrics.expired}</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-muted-foreground">
              Expired applications
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
