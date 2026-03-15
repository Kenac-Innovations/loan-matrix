"use client";

import React from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ValidationError {
  field: string;
  message: string;
}

interface FormValidationSummaryProps {
  errors: ValidationError[];
  onDismiss?: () => void;
  className?: string;
  showDismiss?: boolean;
}

export function FormValidationSummary({
  errors,
  onDismiss,
  className = "",
  showDismiss = true,
}: FormValidationSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-red-200 bg-red-50 p-4",
        className
      )}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Please fix the following errors:
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>
                  <span className="font-medium">{error.field}:</span>{" "}
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {showDismiss && onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
              >
                <span className="sr-only">Dismiss</span>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldValidationErrorProps {
  error?: {
    message?: string;
  };
  className?: string;
}

export function FieldValidationError({
  error,
  className = "",
}: FieldValidationErrorProps) {
  if (!error?.message) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm text-red-600 mt-1",
        className
      )}
    >
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      <span>{error.message}</span>
    </div>
  );
}
