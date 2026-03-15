"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  children: React.ReactNode;
  error?: {
    message?: string;
  };
  className?: string;
  showError?: boolean;
}

export function FormField({
  children,
  error,
  className = "",
  showError = true,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {children}
      {error?.message && showError && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
}

interface FormFieldWithLabelProps extends FormFieldProps {
  label: string;
  required?: boolean;
  description?: string;
  htmlFor?: string;
}

export function FormFieldWithLabel({
  children,
  error,
  label,
  required = false,
  description,
  htmlFor,
  className = "",
  showError = true,
}: FormFieldWithLabelProps) {
  return (
    <FormField error={error} className={className} showError={showError}>
      <div className="space-y-2">
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
        <div
          className={cn(
            error?.message && "border-red-300 focus-within:border-red-500"
          )}
        >
          {children}
        </div>
      </div>
    </FormField>
  );
}
