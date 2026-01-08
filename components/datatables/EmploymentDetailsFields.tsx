"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/searchable-select";
import { differenceInYears, differenceInMonths, parseISO } from "date-fns";

interface EmploymentDetailsFieldsProps {
  headers: any[];
  editedData: Record<string, any>;
  onFieldChange: (columnName: string, value: any) => void;
}

// Helper to normalize column names for comparison
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\s-]+/g, "") // Remove underscores, spaces, hyphens
    .replace(/cd.*$/i, ""); // Remove cd suffix patterns
}

// Check if column is employment type field
function isEmploymentTypeField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "employmenttype" ||
    normalized === "typeofemployment" ||
    normalized.includes("employmenttype")
  );
}

// Check if column is contract date field
function isContractDateField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "contractdate" ||
    normalized === "contractenddate" ||
    normalized === "contractexpirydate" ||
    normalized.includes("contractdate") ||
    normalized.includes("contractend") ||
    normalized.includes("contractexpiry")
  );
}

// Check if column is appointment date field
function isAppointmentDateField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "appointmentdate" ||
    normalized === "dateofappointment" ||
    normalized === "startdate" ||
    normalized === "employmentdate" ||
    normalized.includes("appointmentdate") ||
    normalized.includes("dateofappointment")
  );
}

// Check if column is years of service field
function isYearsOfServiceField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "yearsofservice" ||
    normalized === "serviceperiod" ||
    normalized === "tenure" ||
    normalized.includes("yearsofservice") ||
    normalized.includes("serviceyears")
  );
}

// Format header name for display
function formatHeaderName(name: string): string {
  let formatted = name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  const duplicateMatch = formatted.match(/^(.+?)\s+cd[\s-]+\1$/i);
  if (duplicateMatch && duplicateMatch[1]) {
    return duplicateMatch[1].trim();
  }

  const cdMatch = formatted.match(/^(.+?)\s+cd[\s-]+/i);
  if (cdMatch && cdMatch[1]) {
    return cdMatch[1].trim();
  }

  return formatted;
}

// Calculate years and months of service
function calculateYearsOfService(appointmentDate: string | Date | any[]): string {
  if (!appointmentDate) return "";

  let date: Date;

  // Handle Fineract date array format [year, month, day]
  if (Array.isArray(appointmentDate)) {
    const [y, m, d] = appointmentDate;
    if (y && m && d) {
      date = new Date(y, (m as number) - 1, d as number);
    } else {
      return "";
    }
  } else if (typeof appointmentDate === "string") {
    // Handle string date format
    date = parseISO(appointmentDate);
  } else if (appointmentDate instanceof Date) {
    date = appointmentDate;
  } else {
    return "";
  }

  if (isNaN(date.getTime())) return "";

  const today = new Date();
  const years = differenceInYears(today, date);
  const months = differenceInMonths(today, date) % 12;

  if (years > 0 && months > 0) {
    return `${years} year${years !== 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""}`;
  } else if (years > 0) {
    return `${years} year${years !== 1 ? "s" : ""}`;
  } else if (months > 0) {
    return `${months} month${months !== 1 ? "s" : ""}`;
  } else {
    return "Less than 1 month";
  }
}

export function EmploymentDetailsFields({
  headers,
  editedData,
  onFieldChange,
}: EmploymentDetailsFieldsProps) {
  // Find the relevant column headers
  const employmentTypeHeader = headers.find((h) => isEmploymentTypeField(h.columnName));
  const contractDateHeader = headers.find((h) => isContractDateField(h.columnName));
  const appointmentDateHeader = headers.find((h) => isAppointmentDateField(h.columnName));
  const yearsOfServiceHeader = headers.find((h) => isYearsOfServiceField(h.columnName));

  // Get current values
  const currentEmploymentType = employmentTypeHeader
    ? editedData[employmentTypeHeader.columnName]
    : undefined;
  const currentContractDate = contractDateHeader
    ? editedData[contractDateHeader.columnName]
    : undefined;
  const currentAppointmentDate = appointmentDateHeader
    ? editedData[appointmentDateHeader.columnName]
    : undefined;

  // Check if employment type is CONTRACT
  const isContract = useMemo(() => {
    if (!currentEmploymentType || !employmentTypeHeader?.columnValues) return false;

    const matchingOption = employmentTypeHeader.columnValues.find(
      (opt: any) => opt.id === currentEmploymentType || opt.id === Number(currentEmploymentType)
    );

    if (matchingOption) {
      const optionName = (matchingOption.name || matchingOption.value || "").toLowerCase();
      return optionName.includes("contract");
    }

    return false;
  }, [currentEmploymentType, employmentTypeHeader]);

  // Calculate years of service when appointment date changes
  const calculatedYearsOfService = useMemo(() => {
    return calculateYearsOfService(currentAppointmentDate);
  }, [currentAppointmentDate]);

  // Auto-update years of service field when appointment date changes
  useEffect(() => {
    if (yearsOfServiceHeader && calculatedYearsOfService) {
      onFieldChange(yearsOfServiceHeader.columnName, calculatedYearsOfService);
    }
  }, [calculatedYearsOfService, yearsOfServiceHeader, onFieldChange]);

  // Build employment type options from Fineract CODELOOKUP
  const employmentTypeOptions =
    employmentTypeHeader?.columnValues?.map((option: any) => {
      let label = option.id.toString();
      if (option.name) {
        label = option.name;
      } else if (option.value) {
        const valueStr = String(option.value);
        const cdMatch = valueStr.match(/^(.+?)\s+cd_[a-z_]+\s+/i);
        if (cdMatch && cdMatch[1]) {
          label = cdMatch[1].trim();
        } else {
          const prefixMatch = valueStr.match(/^cd_[a-z_]+\s+(.+)$/i);
          if (prefixMatch && prefixMatch[1]) {
            label = prefixMatch[1].trim();
          } else {
            label = valueStr;
          }
        }
      }
      return {
        value: option.id.toString(),
        label,
      };
    }) || [];

  // Handle employment type change
  const handleEmploymentTypeChange = useCallback(
    (value: any) => {
      if (employmentTypeHeader) {
        const isIntegerType =
          employmentTypeHeader.columnType === "INTEGER" ||
          employmentTypeHeader.columnType === "BIGINT";
        onFieldChange(
          employmentTypeHeader.columnName,
          isIntegerType ? parseInt(value) || 0 : value
        );
      }
    },
    [employmentTypeHeader, onFieldChange]
  );

  // Format date for input
  const formatDateForInput = (dateValue: any): string => {
    if (!dateValue) return "";
    
    // Handle Fineract date array format [year, month, day]
    if (Array.isArray(dateValue)) {
      const [y, m, d] = dateValue;
      if (y && m && d) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
      return "";
    }
    
    if (typeof dateValue === "string") {
      // If already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      // Try to parse and format
      const date = parseISO(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
    
    return "";
  };

  return (
    <>
      {/* Employment Type Field */}
      {employmentTypeHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(employmentTypeHeader.columnName)}
          </Label>
          <SearchableSelect
            options={employmentTypeOptions}
            value={currentEmploymentType?.toString() ?? ""}
            onValueChange={handleEmploymentTypeChange}
            placeholder="Select employment type"
            emptyMessage="No options available"
          />
        </div>
      )}

      {/* Appointment Date Field */}
      {appointmentDateHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(appointmentDateHeader.columnName)}
          </Label>
          <Input
            type="date"
            value={formatDateForInput(currentAppointmentDate)}
            onChange={(e) => onFieldChange(appointmentDateHeader.columnName, e.target.value)}
            className="text-sm"
          />
        </div>
      )}

      {/* Contract Date Field - Only shown if employment type is CONTRACT */}
      {contractDateHeader && isContract && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(contractDateHeader.columnName)}
          </Label>
          <Input
            type="date"
            value={formatDateForInput(currentContractDate)}
            onChange={(e) => onFieldChange(contractDateHeader.columnName, e.target.value)}
            className="text-sm"
          />
        </div>
      )}

      {/* Years of Service Field - Auto-calculated, read-only */}
      {yearsOfServiceHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(yearsOfServiceHeader.columnName)}
          </Label>
          <Input
            type="text"
            value={calculatedYearsOfService}
            readOnly
            className="text-sm bg-muted"
            placeholder="Calculated from appointment date"
          />
          <p className="text-xs text-muted-foreground">
            Auto-calculated from appointment date
          </p>
        </div>
      )}
    </>
  );
}

/**
 * Check if the datatable has employment detail fields that should use custom rendering
 */
export function hasEmploymentDetailFields(headers: any[]): boolean {
  const hasEmploymentType = headers.some((h) => isEmploymentTypeField(h.columnName));
  const hasAppointmentDate = headers.some((h) => isAppointmentDateField(h.columnName));
  
  // Must have at least employment type or appointment date
  return hasEmploymentType || hasAppointmentDate;
}

/**
 * Get the column names that are handled by EmploymentDetailsFields
 */
export function getEmploymentDetailColumnNames(headers: any[]): string[] {
  const names: string[] = [];

  const employmentTypeHeader = headers.find((h) => isEmploymentTypeField(h.columnName));
  const contractDateHeader = headers.find((h) => isContractDateField(h.columnName));
  const appointmentDateHeader = headers.find((h) => isAppointmentDateField(h.columnName));
  const yearsOfServiceHeader = headers.find((h) => isYearsOfServiceField(h.columnName));

  if (employmentTypeHeader) names.push(employmentTypeHeader.columnName);
  if (contractDateHeader) names.push(contractDateHeader.columnName);
  if (appointmentDateHeader) names.push(appointmentDateHeader.columnName);
  if (yearsOfServiceHeader) names.push(yearsOfServiceHeader.columnName);

  return names;
}

