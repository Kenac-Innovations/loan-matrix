"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/contexts/currency-context";
import { formatCurrency } from "@/lib/format-currency";
import {
  FileSpreadsheet,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Upload,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadStats {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  queuedCount: number;
  successCount: number;
  failedCount: number;
  reversedCount: number;
  totalAmount: string;
  stagedCount: number;
  processingCount: number;
}

interface UploadDashboardProps {
  uploadId: string;
}

const POLL_INTERVAL = 3000;

export function UploadDashboard({ uploadId }: UploadDashboardProps) {
  const { currencyCode } = useCurrency();
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!uploadId) return;
    try {
      const response = await fetch(`/api/collections/uploads/${uploadId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch {
      // Silently fail on poll
    } finally {
      setLoading(false);
    }
  }, [uploadId]);

  useEffect(() => {
    if (!uploadId) return;
    setLoading(true);
    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [uploadId, fetchStats]);

  if (!uploadId || !stats) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 p-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading upload details...
        </div>
      );
    }
    return null;
  }

  const processed = stats.successCount + stats.failedCount + stats.reversedCount;
  const progressPercent = stats.totalRows > 0 ? (processed / stats.totalRows) * 100 : 0;
  const successRate =
    processed > 0
      ? ((stats.successCount / processed) * 100).toFixed(1)
      : "0.0";
  const isProcessing = stats.status === "PROCESSING";
  const totalAmount = parseFloat(stats.totalAmount) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
        <div>
          <h4 className="font-medium text-sm">{stats.fileName}</h4>
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              stats.status === "COMPLETED" && "bg-green-100 text-green-800",
              stats.status === "PROCESSING" && "bg-blue-100 text-blue-800",
              stats.status === "FAILED" && "bg-red-100 text-red-800",
              stats.status === "STAGING" && "bg-amber-100 text-amber-800"
            )}
          >
            {stats.status}
          </Badge>
        </div>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Processing progress</span>
            <span className="font-medium">{processed} / {stats.totalRows}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
        <Card className="bg-muted/30">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Upload className="h-3 w-3" /> Total Rows
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold">{stats.totalRows}</div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold">{formatCurrency(totalAmount, currencyCode)}</div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Queued
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={cn("text-lg font-bold", stats.queuedCount > 0 && "text-purple-600")}>
              {stats.queuedCount}
              {stats.queuedCount > 0 && isProcessing && (
                <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Successful
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={cn("text-lg font-bold", stats.successCount > 0 && "text-green-600")}>
              {stats.successCount}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Reversed
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={cn("text-lg font-bold", stats.reversedCount > 0 && "text-amber-600")}>
              {stats.reversedCount}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={cn("text-lg font-bold", stats.failedCount > 0 && "text-red-600")}>
              {stats.failedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {processed > 0 && (
        <p className="text-xs text-muted-foreground">
          Success rate: <strong>{successRate}%</strong>
        </p>
      )}
    </div>
  );
}
