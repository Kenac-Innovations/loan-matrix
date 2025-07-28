"use client";

import { useState, useEffect } from "react";
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
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { useChartTheme } from "@/lib/chart-theme-utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ValidationResult {
  id: string;
  name: string;
  description: string;
  status: "passed" | "failed" | "warning";
  message?: string;
  suggestedAction?: string;
  actionUrl?: string;
  severity: "info" | "warning" | "error";
}

interface ValidationSummary {
  total: number;
  passed: number;
  warnings: number;
  failed: number;
  passedPercentage: number;
  canProceed: boolean;
}

interface ValidationData {
  validations: ValidationResult[];
  summary: ValidationSummary;
  leadInfo: {
    id: string;
    name: string;
    currentStage: string;
    status: string;
  };
}

interface LeadValidationsProps {
  leadId: string;
  stage: string;
}

export function LeadValidations({ leadId, stage }: LeadValidationsProps) {
  const [expanded, setExpanded] = useState(true);
  const [validationData, setValidationData] = useState<ValidationData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { colors, getOptions } = useChartTheme();

  useEffect(() => {
    const fetchValidations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/leads/${leadId}/validations`);
        if (!response.ok) {
          throw new Error("Failed to fetch validation data");
        }
        const data = await response.json();
        setValidationData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchValidations();
  }, [leadId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error || !validationData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {error || "Failed to load validation data"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { validations: validationResults, summary } = validationData;
  const {
    passed: passedCount,
    warnings: warningCount,
    failed: failedCount,
    total: totalCount,
    passedPercentage,
    canProceed,
  } = summary;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-green-500 text-white">Passed</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500 text-white">Warning</Badge>;
      case "failed":
        return <Badge className="bg-red-500 text-white">Failed</Badge>;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "info":
        return (
          <Badge
            variant="outline"
            className="border-blue-500 bg-blue-500/10 text-blue-400"
          >
            Info
          </Badge>
        );
      case "warning":
        return (
          <Badge
            variant="outline"
            className="border-yellow-500 bg-yellow-500/10 text-yellow-400"
          >
            Warning
          </Badge>
        );
      case "error":
        return (
          <Badge
            variant="outline"
            className="border-red-500 bg-red-500/10 text-red-400"
          >
            Blocking
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Validation Status
              {canProceed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>
              {canProceed
                ? "All required validations have passed"
                : `${failedCount} validation${
                    failedCount > 1 ? "s" : ""
                  } failed, ${warningCount} warning${
                    warningCount > 1 ? "s" : ""
                  }`}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Validation Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Doughnut Chart for Overall Progress */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                Overall Progress
              </h4>
              <div className="h-48 flex items-center justify-center">
                <div className="relative w-32 h-32">
                  <Doughnut
                    data={{
                      labels: ["Passed", "Warnings", "Failed"],
                      datasets: [
                        {
                          data: [passedCount, warningCount, failedCount],
                          backgroundColor: [
                            colors.success,
                            colors.warning,
                            colors.error,
                          ],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={getOptions({
                      cutout: "70%",
                      scales: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          callbacks: {
                            label: function (context: any) {
                              const label = context.label || "";
                              const value = context.parsed;
                              const percentage = Math.round(
                                (value / totalCount) * 100
                              );
                              return `${label}: ${value} (${percentage}%)`;
                            },
                          },
                        },
                      },
                    })}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {passedPercentage}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Complete
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Passed: {passedCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span>Warnings: {warningCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Failed: {failedCount}</span>
                </div>
              </div>
            </div>

            {/* Bar Chart for Validation Categories */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                Validation Breakdown
              </h4>
              <div className="h-48">
                <Bar
                  data={{
                    labels: ["Passed", "Warnings", "Failed"],
                    datasets: [
                      {
                        label: "Count",
                        data: [passedCount, warningCount, failedCount],
                        backgroundColor: [
                          colors.success,
                          colors.warning,
                          colors.error,
                        ],
                        borderColor: [
                          colors.success.replace("0.8", "1"),
                          colors.warning.replace("0.8", "1"),
                          colors.error.replace("0.8", "1"),
                        ],
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={getOptions({
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        callbacks: {
                          label: function (context: any) {
                            const value = context.parsed.y;
                            const percentage = Math.round(
                              (value / totalCount) * 100
                            );
                            return `${context.label}: ${value} (${percentage}%)`;
                          },
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                  })}
                />
              </div>
            </div>
          </div>

          {expanded && (
            <div className="space-y-3 pt-2">
              {validationResults.map((result) => (
                <div
                  key={result.id}
                  className={`rounded-md border p-3 ${
                    result.status === "failed"
                      ? "border-red-500/20 bg-red-500/5"
                      : result.status === "warning"
                      ? "border-yellow-500/20 bg-yellow-500/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getStatusIcon(result.status)}</div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">
                          {result.name}
                        </h4>
                        {getStatusBadge(result.status)}
                        {getSeverityBadge(result.severity)}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {result.description}
                      </p>
                      {result.message && (
                        <p className="mt-2 text-sm text-foreground">
                          {result.message}
                        </p>
                      )}
                      {result.suggestedAction && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-blue-500 hover:text-blue-600"
                            asChild
                          >
                            <a href={result.actionUrl}>
                              {result.suggestedAction}
                              <ArrowRight className="ml-2 h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!canProceed && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 mt-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-foreground">
                  Cannot proceed to next stage until all blocking validations
                  are resolved.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
