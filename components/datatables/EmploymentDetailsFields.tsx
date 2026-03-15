"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/searchable-select";
import { differenceInYears, differenceInMonths, parseISO } from "date-fns";
import {
  getEmployersByClientType,
  getOccupationsByEmployer,
  isZambiaArmy,
} from "@/shared/defaults/employer-options";

interface EmploymentDetailsFieldsProps {
  headers: any[];
  editedData: Record<string, any>;
  onFieldChange: (columnName: string, value: any) => void;
  clientType?: string; // PDA, GRZ, etc. for employer filtering
}

// Helper to normalize column names for comparison
function normalizeColumnName(name: string | undefined | null): string {
  if (!name) return "";
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

// Check if column is contract start date field
function isContractStartDateField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "contractdate" ||
    normalized === "contractstartdate" ||
    normalized.includes("contractstart")
  );
}

// Check if column is contract end date field
function isContractEndDateField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "contractenddate" ||
    normalized === "contractexpirydate" ||
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

// Check if column is employer field
function isEmployerField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "employer" ||
    normalized === "employername" ||
    normalized === "companyname" ||
    normalized === "organization" ||
    normalized.includes("employer")
  );
}

// Check if column is occupation field
function isOccupationField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "occupation" ||
    normalized === "position" ||
    normalized === "jobtitle" ||
    normalized === "designation" ||
    normalized.includes("occupation") ||
    normalized.includes("position")
  );
}

// Check if column is pay date field (to hide)
function isPayDateField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "paydate" ||
    normalized === "payday" ||
    normalized === "salarydate" ||
    normalized.includes("paydate")
  );
}

// Check if column is employer name field (to hide - we use employer/employerId instead)
function isEmployerNameField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  // Only match exact "employername" - not "employer" alone
  return normalized === "employername";
}

// Check if column is employer ID field (to rename to "Employer Name")
function isEmployerIdField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return normalized === "employerid" || normalized === "employer";
}

// Format header name for display
function formatHeaderName(name: string): string {
  // Check if this is an employer ID field - rename to "Employer Name"
  if (isEmployerIdField(name)) {
    return "Employer Name";
  }

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
  clientType,
}: EmploymentDetailsFieldsProps) {
  // Early return if headers is not valid
  if (!headers || !Array.isArray(headers)) {
    return null;
  }

  // Find the relevant column headers (with null-safe checks)
  const employmentTypeHeader = headers.find((h) => h?.columnName && isEmploymentTypeField(h.columnName));
  const contractStartDateHeader = headers.find((h) => h?.columnName && isContractStartDateField(h.columnName));
  const contractEndDateHeader = headers.find((h) => h?.columnName && isContractEndDateField(h.columnName));
  const appointmentDateHeader = headers.find((h) => h?.columnName && isAppointmentDateField(h.columnName));
  const yearsOfServiceHeader = headers.find((h) => h?.columnName && isYearsOfServiceField(h.columnName));
  const employerHeader = headers.find((h) => h?.columnName && isEmployerField(h.columnName));
  const occupationHeader = headers.find((h) => h?.columnName && isOccupationField(h.columnName));

  // Get current values
  const currentEmploymentType = employmentTypeHeader
    ? editedData[employmentTypeHeader.columnName]
    : undefined;
  const currentContractStartDate = contractStartDateHeader
    ? editedData[contractStartDateHeader.columnName]
    : undefined;
  const currentContractEndDate = contractEndDateHeader
    ? editedData[contractEndDateHeader.columnName]
    : undefined;
  const currentAppointmentDate = appointmentDateHeader
    ? editedData[appointmentDateHeader.columnName]
    : undefined;
  const currentEmployer = employerHeader
    ? editedData[employerHeader.columnName]
    : undefined;
  const currentOccupation = occupationHeader
    ? editedData[occupationHeader.columnName]
    : undefined;

  // Get employer options based on client type
  const employerOptions = useMemo(() => {
    return getEmployersByClientType(clientType).map((emp) => ({
      value: emp,
      label: emp,
    }));
  }, [clientType]);

  // Check if this is an SME client (no predefined employers)
  const isSMEClient = useMemo(() => {
    if (!clientType) return false;
    const upperType = clientType.toUpperCase();
    return upperType.includes("SME") || upperType.includes("ENTERPRISE") || upperType.includes("BUSINESS");
  }, [clientType]);

  // Get occupation options based on selected employer
  const occupationOptions = useMemo(() => {
    return getOccupationsByEmployer(currentEmployer);
  }, [currentEmployer]);

  // Check if selected employer is Zambia Army (under PDA)
  const isArmyEmployer = useMemo(() => {
    return isZambiaArmy(currentEmployer);
  }, [currentEmployer]);

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

      {/* Contract Date Fields - Only shown if employment type is CONTRACT */}
      {contractStartDateHeader && isContract && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(contractStartDateHeader.columnName)}
          </Label>
          <Input
            type="date"
            value={formatDateForInput(currentContractStartDate)}
            onChange={(e) => onFieldChange(contractStartDateHeader.columnName, e.target.value)}
            className="text-sm"
          />
        </div>
      )}

      {/* Contract End Date Field - Only shown if employment type is CONTRACT */}
      {contractEndDateHeader && isContract && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(contractEndDateHeader.columnName)}
          </Label>
          <Input
            type="date"
            value={formatDateForInput(currentContractEndDate)}
            onChange={(e) => onFieldChange(contractEndDateHeader.columnName, e.target.value)}
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

      {/* Employer Field - Options filtered by client type (PDA/GRZ), free text for SME */}
      {employerHeader && !isSMEClient && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(employerHeader.columnName)}
            {clientType && (
              <span className="ml-2 text-xs font-normal text-blue-500">
                ({clientType} employers)
              </span>
            )}
          </Label>
          <SearchableSelect
            options={employerOptions}
            value={currentEmployer?.toString() ?? ""}
            onValueChange={(value) => {
              onFieldChange(employerHeader.columnName, value);
              // Clear occupation when employer changes if it's Zambia Army
              if (occupationHeader && isZambiaArmy(value) !== isArmyEmployer) {
                onFieldChange(occupationHeader.columnName, "");
              }
            }}
            placeholder={`Select ${clientType || ""} employer`}
            emptyMessage="No employers available"
          />
          {clientType && (
            <p className="text-xs text-muted-foreground">
              Showing {clientType === "GRZ" ? "government" : "private sector"} employers
            </p>
          )}
        </div>
      )}

      {/* SME Client - No employer/occupation fields needed (they are the business) */}
      {isSMEClient && (employerHeader || occupationHeader) && (
        <div className="space-y-1 col-span-2">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>SME Client:</strong> Employment details are not required for business/enterprise clients.
            </p>
          </div>
        </div>
      )}

      {/* Occupation Field - Options change based on employer (MOD shows Soldier/Confidential) */}
      {occupationHeader && !isSMEClient && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(occupationHeader.columnName)}
            {isArmyEmployer && (
              <span className="ml-2 text-xs font-normal text-orange-500">
                (Army personnel)
              </span>
            )}
          </Label>
          <SearchableSelect
            options={occupationOptions}
            value={currentOccupation?.toString() ?? ""}
            onValueChange={(value) => onFieldChange(occupationHeader.columnName, value)}
            placeholder="Select occupation"
            emptyMessage="No occupations available"
          />
          {isArmyEmployer && (
            <p className="text-xs text-orange-500 mt-1">
              Zambia Army personnel: Select Army Soldier, Army Officer, Confidential, or Non Military Personnel
            </p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Check if the datatable has employment detail fields that should use custom rendering
 */
export function hasEmploymentDetailFields(headers: any[] | undefined | null): boolean {
  if (!headers || !Array.isArray(headers)) return false;
  
  const hasEmploymentType = headers.some((h) => h?.columnName && isEmploymentTypeField(h.columnName));
  const hasAppointmentDate = headers.some((h) => h?.columnName && isAppointmentDateField(h.columnName));
  const hasEmployer = headers.some((h) => h?.columnName && isEmployerField(h.columnName));
  const hasOccupation = headers.some((h) => h?.columnName && isOccupationField(h.columnName));
  
  // Must have at least employment type, appointment date, employer, or occupation
  return hasEmploymentType || hasAppointmentDate || hasEmployer || hasOccupation;
}

/**
 * Get the column names that are handled by EmploymentDetailsFields
 */
export function getEmploymentDetailColumnNames(headers: any[] | undefined | null): string[] {
  if (!headers || !Array.isArray(headers)) return [];
  
  const names: string[] = [];

  const employmentTypeHeader = headers.find((h) => h?.columnName && isEmploymentTypeField(h.columnName));
  const contractStartDateHeader = headers.find((h) => h?.columnName && isContractStartDateField(h.columnName));
  const contractEndDateHeader = headers.find((h) => h?.columnName && isContractEndDateField(h.columnName));
  const appointmentDateHeader = headers.find((h) => h?.columnName && isAppointmentDateField(h.columnName));
  const yearsOfServiceHeader = headers.find((h) => h?.columnName && isYearsOfServiceField(h.columnName));
  const employerHeader = headers.find((h) => h?.columnName && isEmployerField(h.columnName));
  const occupationHeader = headers.find((h) => h?.columnName && isOccupationField(h.columnName));
  // Hidden fields
  const payDateHeader = headers.find((h) => h?.columnName && isPayDateField(h.columnName));
  const employerNameHeader = headers.find((h) => h?.columnName && isEmployerNameField(h.columnName));

  if (employmentTypeHeader) names.push(employmentTypeHeader.columnName);
  if (contractStartDateHeader) names.push(contractStartDateHeader.columnName);
  if (contractEndDateHeader) names.push(contractEndDateHeader.columnName);
  if (appointmentDateHeader) names.push(appointmentDateHeader.columnName);
  if (yearsOfServiceHeader) names.push(yearsOfServiceHeader.columnName);
  if (employerHeader) names.push(employerHeader.columnName);
  if (occupationHeader) names.push(occupationHeader.columnName);
  // Include hidden fields so they're not rendered by generic renderer
  if (payDateHeader) names.push(payDateHeader.columnName);
  if (employerNameHeader) names.push(employerNameHeader.columnName);

  return names;
}

