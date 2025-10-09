"use client";

import { AlertCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldErrorDisplayProps {
  error?: {
    message: string;
    severity: "error" | "warning" | "info";
  };
  className?: string;
  showIcon?: boolean;
  inline?: boolean;
}

export function FieldErrorDisplay({
  error,
  className = "",
  showIcon = true,
  inline = false,
}: FieldErrorDisplayProps) {
  if (!error) return null;

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "error":
        return {
          icon: XCircle,
          className: "text-red-600",
          bgClassName: "bg-red-50",
          borderClassName: "border-red-200",
        };
      case "warning":
        return {
          icon: AlertCircle,
          className: "text-yellow-600",
          bgClassName: "bg-yellow-50",
          borderClassName: "border-yellow-200",
        };
      case "info":
        return {
          icon: Info,
          className: "text-blue-600",
          bgClassName: "bg-blue-50",
          borderClassName: "border-blue-200",
        };
      default:
        return {
          icon: AlertCircle,
          className: "text-gray-600",
          bgClassName: "bg-gray-50",
          borderClassName: "border-gray-200",
        };
    }
  };

  const config = getSeverityConfig(error.severity);
  const Icon = config.icon;

  if (inline) {
    return (
      <div
        className={cn(
          "flex items-center gap-1 text-sm",
          config.className,
          className
        )}
      >
        {showIcon && <Icon className="h-3 w-3 flex-shrink-0" />}
        <span>{error.message}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2 rounded-md border text-sm",
        config.bgClassName,
        config.borderClassName,
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
      <span className="flex-1">{error.message}</span>
    </div>
  );
}

interface FieldWithErrorProps {
  children: React.ReactNode;
  error?: {
    message: string;
    severity: "error" | "warning" | "info";
  };
  className?: string;
  showErrorBelow?: boolean;
}

export function FieldWithError({
  children,
  error,
  className = "",
  showErrorBelow = true,
}: FieldWithErrorProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {children}
      {error && showErrorBelow && (
        <FieldErrorDisplay error={error} inline={false} />
      )}
    </div>
  );
}

interface StepErrorIndicatorProps {
  stepName: string;
  errorCount: number;
  warningCount: number;
  className?: string;
}

export function StepErrorIndicator({
  stepName,
  errorCount,
  warningCount,
  className = "",
}: StepErrorIndicatorProps) {
  const totalIssues = errorCount + warningCount;
  
  if (totalIssues === 0) return null;

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-muted-foreground">{stepName}:</span>
      {errorCount > 0 && (
        <span className="text-red-600 font-medium">
          {errorCount} error{errorCount !== 1 ? "s" : ""}
        </span>
      )}
      {warningCount > 0 && (
        <span className="text-yellow-600 font-medium">
          {warningCount} warning{warningCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
