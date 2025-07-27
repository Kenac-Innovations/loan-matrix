"use client";

import { useState } from "react";
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
} from "lucide-react";

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

interface LeadValidationsProps {
  leadId: string;
  stage: string;
}

export function LeadValidations({ leadId, stage }: LeadValidationsProps) {
  const [expanded, setExpanded] = useState(true);

  // This would normally be fetched from an API based on the lead ID and stage
  const validationResults: ValidationResult[] = [
    {
      id: "1",
      name: "Required Company Information",
      description: "Ensures company information is complete",
      status: "passed",
      severity: "error",
    },
    {
      id: "2",
      name: "Budget Validation",
      description: "Checks if budget information is available",
      status: "warning",
      message:
        "Budget information is missing. Consider collecting this before proceeding.",
      suggestedAction: "Update Financial Information",
      actionUrl: `/leads/${leadId}/edit?section=financial`,
      severity: "warning",
    },
    {
      id: "3",
      name: "Document Verification",
      description: "Verifies required documents are uploaded",
      status: "failed",
      message:
        "Missing required documents: Business Registration, Financial Statements",
      suggestedAction: "Upload Missing Documents",
      actionUrl: `/leads/${leadId}/documents`,
      severity: "error",
    },
    {
      id: "4",
      name: "Contact Information Check",
      description: "Ensures primary contact information is complete",
      status: "passed",
      severity: "error",
    },
    {
      id: "5",
      name: "Credit Score Validation",
      description: "Checks if credit score meets minimum requirements",
      status: "warning",
      message:
        "Credit score is below recommended threshold but above minimum requirement.",
      suggestedAction: "Review Risk Assessment",
      actionUrl: `/leads/${leadId}?tab=risk`,
      severity: "warning",
    },
  ];

  const passedCount = validationResults.filter(
    (result) => result.status === "passed"
  ).length;
  const warningCount = validationResults.filter(
    (result) => result.status === "warning"
  ).length;
  const failedCount = validationResults.filter(
    (result) => result.status === "failed"
  ).length;
  const totalCount = validationResults.length;

  const passedPercentage = Math.round((passedCount / totalCount) * 100);

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

  const canProceed = failedCount === 0;

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
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-foreground">
              <span>Validation Progress</span>
              <span>
                {passedCount} of {totalCount} passed
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-green-500"
                style={{
                  width: `${passedPercentage}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
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
