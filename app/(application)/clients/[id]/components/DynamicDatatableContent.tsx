"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, AlertCircle, Edit2, Save, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BankDetailsFields,
  hasBankDetailFields,
  getBankDetailColumnNames,
} from "@/components/datatables/BankDetailsFields";

// Helper function to check if a column is a phone/mobile number field
const isPhoneNumberField = (columnName: string): boolean => {
  const lowerName = columnName.toLowerCase();
  return (
    lowerName.includes("mobile") ||
    lowerName.includes("phone") ||
    lowerName.includes("tel") ||
    lowerName.includes("cell") ||
    lowerName.includes("contact_number") ||
    lowerName.includes("contactnumber")
  );
};

// Format phone number for display (Zambian format)
const formatZambianPhoneDisplay = (value: string): string => {
  if (!value) return "";
  // Remove all non-digits
  let digits = value.replace(/\D/g, "");
  
  // Remove country code if present
  if (digits.startsWith("260")) {
    digits = digits.substring(3);
  }
  
  // Remove leading zero if present
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }
  
  // Format as 9X XXX XXXX
  if (digits.length >= 9) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
  }
  return digits;
};

// Format phone number for storage (just digits, max 10)
const formatPhoneForStorage = (value: string): string => {
  // Remove all non-digits
  let digits = value.replace(/\D/g, "");
  
  // Remove country code if present
  if (digits.startsWith("260")) {
    digits = digits.substring(3);
  }
  
  // Remove leading zero if present
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }
  
  // Limit to 9 digits (Zambian local number without leading 0)
  return digits.slice(0, 9);
};

interface DynamicDatatableContentProps {
  datatableName: string;
  clientId: number;
  initialData?: any;
  onDataChange?: (hasData: boolean) => void; // Callback when data changes (add/edit/delete)
  onEditingChange?: (isEditing: boolean) => void; // Callback when editing state changes
}

export function DynamicDatatableContent({
  datatableName,
  clientId,
  initialData,
  onDataChange,
  onEditingChange,
}: DynamicDatatableContentProps) {
  // Initialize state from server-provided data if available
  const [headers, setHeaders] = useState<any[]>(
    initialData?.columnHeaders || []
  );
  const [rows, setRows] = useState<any[][]>(
    (initialData?.data || []).map((r: any) => r.row)
  );
  const [rowData, setRowData] = useState<any[]>(initialData?.data || []); // Store full row data including IDs
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [showAddCodeValueDialog, setShowAddCodeValueDialog] = useState(false);
  const [currentCodeColumn, setCurrentCodeColumn] = useState<any>(null);
  const [newCodeValueName, setNewCodeValueName] = useState("");
  const [newCodeValueDescription, setNewCodeValueDescription] = useState("");
  const [addingCodeValue, setAddingCodeValue] = useState(false);
  const { toast } = useToast();

  // Store callbacks in refs to avoid stale closures and infinite loops
  const onEditingChangeRef = useRef(onEditingChange);
  const onDataChangeRef = useRef(onDataChange);
  
  // Update refs when callbacks change
  useEffect(() => {
    onEditingChangeRef.current = onEditingChange;
  }, [onEditingChange]);
  
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // Notify parent when editing state changes
  useEffect(() => {
    if (onEditingChangeRef.current) {
      onEditingChangeRef.current(editingRowIndex !== null);
    }
  }, [editingRowIndex]);

  useEffect(() => {
    // Skip initial fetch if we have server-provided data
    if (initialData) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/fineract/datatables/${encodeURIComponent(
            datatableName
          )}/${clientId}?genericResultSet=true`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.error || "Failed to fetch datatable rows");
        setHeaders(data.columnHeaders || []);
        const mapped: any[][] = (data.data || []).map((r: any) => r.row);
        setRows(mapped);
        // Store full row data including IDs and metadata
        setRowData(data.data || []);
      } catch (e: any) {
        setError(e.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [datatableName, clientId, initialData]);

  const formatCell = (
    val: any,
    columnType?: string,
    columnDisplayType?: string
  ) => {
    if (val === null || val === undefined || val === "") {
      return <span className="text-muted-foreground italic">—</span>;
    }

    if (Array.isArray(val)) {
      // Date or DateTime arrays from Fineract [year, month, day, hour, minute, second]
      const [y, m, d, hh, mm, ss] = val;
      if (y && m && d) {
        const dt = new Date(
          y,
          (m as number) - 1,
          d as number,
          hh || 0,
          mm || 0,
          ss || 0
        );
        if (columnDisplayType === "DATE") {
          return dt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }
        return dt.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return <span className="text-muted-foreground">Invalid date</span>;
    }

    if (typeof val === "boolean") {
      return (
        <Badge
          variant={val ? "default" : "outline"}
          className={val ? "bg-green-500 hover:bg-green-600" : ""}
        >
          {val ? "Yes" : "No"}
        </Badge>
      );
    }

    // Format numbers and decimals
    if (columnDisplayType === "DECIMAL" || columnDisplayType === "NUMERIC") {
      const num = parseFloat(String(val));
      if (!isNaN(num)) {
        return (
          <span className="font-medium tabular-nums">
            {num.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      }
    }

    if (
      columnDisplayType === "INTEGER" ||
      columnType === "BIGINT" ||
      columnType === "INTEGER"
    ) {
      const num = parseInt(String(val));
      if (!isNaN(num)) {
        return (
          <span className="font-medium tabular-nums">
            {num.toLocaleString("en-US")}
          </span>
        );
      }
    }

    // Format long text with word wrap
    const strVal = String(val);
    if (strVal.length > 50) {
      return (
        <div className="max-w-xs">
          <p className="text-sm break-words">{strVal}</p>
        </div>
      );
    }

    return <span className="text-sm">{strVal}</span>;
  };

  const formatHeaderName = (name: string) => {
    // Convert camelCase or snake_case to Title Case
    let formatted = name
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    // Handle duplicated patterns like "bank branch code cd bank branch code"
    // Pattern: "Text cd Text" or "Text cd- Text" -> extract just "Text"
    const duplicateMatch = formatted.match(/^(.+?)\s+cd[\s-]+\1$/i);
    if (duplicateMatch && duplicateMatch[1]) {
      return duplicateMatch[1].trim();
    }

    // Pattern: "Text cd text" (slightly different case) -> extract first part
    const cdMatch = formatted.match(/^(.+?)\s+cd[\s-]+/i);
    if (cdMatch && cdMatch[1]) {
      return cdMatch[1].trim();
    }

    return formatted;
  };

  const getRowId = (rowIndex: number): number | null => {
    const row = rowData[rowIndex];
    if (!row) {
      console.warn(`Row data not found for index ${rowIndex}`);
      return null;
    }

    // Log the row structure for debugging
    console.log(`Getting rowId for row ${rowIndex}:`, {
      rowData: row,
      headers: headers.map((h) => ({
        name: h.columnName,
        isPrimaryKey: h.isColumnPrimaryKey,
      })),
    });

    // Try multiple strategies to find the row ID
    // Strategy 1: Find column named "id" (case insensitive) that is a primary key
    const idHeader = headers.find(
      (h) => h.columnName?.toLowerCase() === "id" && h.isColumnPrimaryKey
    );
    if (idHeader) {
      const idIndex = headers.findIndex((h) => h === idHeader);
      const rowId = row.row[idIndex];
      if (rowId != null) {
        console.log(`Found rowId from 'id' column: ${rowId}`);
        return Number(rowId);
      }
    }

    // Strategy 2: Find any primary key column
    const primaryKeyHeader = headers.find((h) => h.isColumnPrimaryKey);
    if (primaryKeyHeader) {
      const pkIndex = headers.findIndex((h) => h === primaryKeyHeader);
      const rowId = row.row[pkIndex];
      if (rowId != null) {
        console.log(
          `Found rowId from primary key column '${primaryKeyHeader.columnName}': ${rowId}`
        );
        return Number(rowId);
      }
    }

    // Strategy 3: Check if first column is numeric and might be an ID
    if (headers[0] && row.row[0] != null) {
      const firstValue = Number(row.row[0]);
      if (!isNaN(firstValue) && firstValue > 0) {
        console.log(`Using first column as rowId: ${firstValue}`);
        return firstValue;
      }
    }

    // Strategy 4: Check if row object has an id property directly
    if (row.id != null) {
      console.log(`Found rowId from row.id property: ${row.id}`);
      return Number(row.id);
    }

    console.warn(`Could not find rowId for row ${rowIndex}`);
    return null;
  };

  const startEditing = (rowIndex: number) => {
    const row = rows[rowIndex];
    const initialData: Record<string, any> = {};

    headers.forEach((header, index) => {
      const columnName = header.columnName;
      if (columnName) {
        const value = row[index];
        // Convert date arrays to date strings for input
        if (Array.isArray(value) && header.columnDisplayType === "DATE") {
          const [y, m, d] = value;
          if (y && m && d) {
            initialData[columnName] = format(
              new Date(y, (m as number) - 1, d),
              "yyyy-MM-dd"
            );
          }
        } else if (
          Array.isArray(value) &&
          header.columnDisplayType === "DATETIME"
        ) {
          const [y, m, d, hh, mm] = value;
          if (y && m && d) {
            initialData[columnName] = format(
              new Date(y, (m as number) - 1, d, hh || 0, mm || 0),
              "yyyy-MM-dd'T'HH:mm"
            );
          }
        } else {
          initialData[columnName] = value;
        }
      }
    });

    setEditedData(initialData);
    setEditingRowIndex(rowIndex);
  };

  const cancelEditing = () => {
    setEditingRowIndex(null);
    setEditedData({});
  };

  const handleFieldChange = (columnName: string, value: any) => {
    setEditedData((prev) => ({
      ...prev,
      [columnName]: value,
    }));
  };

  const saveRow = async (rowIndex: number) => {
    setSaving(true);
    try {
      const rowId = getRowId(rowIndex);

      // Validate that we have a rowId - required for updating specific rows
      if (!rowId) {
        throw new Error(
          "Cannot update: Row ID not found. This datatable may not support individual row updates."
        );
      }

      console.log(`Saving row ${rowIndex} with rowId: ${rowId}`);

      const payload: Record<string, any> = {};

      // Build payload with only changed fields (excluding system columns)
      headers.forEach((header) => {
        const columnName = header.columnName;
        if (!columnName) return;

        const isSystemColumn =
          columnName.toLowerCase() === "id" ||
          columnName.toLowerCase() === "client_id" ||
          columnName.toLowerCase() === "created_at" ||
          columnName.toLowerCase() === "updated_at";

        if (isSystemColumn) return;

        const newValue = editedData[columnName];
        if (newValue !== undefined) {
          // Handle date inputs - convert to Fineract format
          if (
            header.columnDisplayType === "DATE" &&
            typeof newValue === "string"
          ) {
            const date = new Date(newValue);
            payload[columnName] = format(date, "yyyy-MM-dd");
          } else if (
            header.columnDisplayType === "DATETIME" &&
            typeof newValue === "string"
          ) {
            const date = new Date(newValue);
            payload[columnName] = format(date, "yyyy-MM-dd HH:mm:ss");
          } else if (header.columnDisplayType === "BOOLEAN") {
            payload[columnName] = Boolean(newValue);
          } else if (
            header.columnDisplayType === "DECIMAL" ||
            header.columnDisplayType === "NUMERIC"
          ) {
            payload[columnName] = parseFloat(String(newValue)) || 0;
          } else if (
            header.columnDisplayType === "INTEGER" ||
            header.columnType === "BIGINT" ||
            header.columnType === "INTEGER"
          ) {
            payload[columnName] = parseInt(String(newValue)) || 0;
          } else if (header.columnDisplayType === "CODELOOKUP") {
            // For CODELOOKUP, send the ID value (already stored correctly)
            // If it's an integer type, ensure it's parsed
            if (
              header.columnType === "INTEGER" ||
              header.columnType === "BIGINT"
            ) {
              payload[columnName] = parseInt(String(newValue)) || 0;
            } else {
              payload[columnName] = newValue;
            }
          } else {
            payload[columnName] = newValue;
          }
        }
      });

      const response = await fetch(
        `/api/fineract/datatables/${encodeURIComponent(
          datatableName
        )}/${clientId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rowId,
            data: payload,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details?.defaultUserMessage ||
            "Failed to update entry"
        );
      }

      toast({
        title: "Success",
        description: "Data table entry updated successfully",
      });

      // Refresh data
      setEditingRowIndex(null);
      setEditedData({});

      // Reload the data
      const res = await fetch(
        `/api/fineract/datatables/${encodeURIComponent(
          datatableName
        )}/${clientId}?genericResultSet=true`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setHeaders(data.columnHeaders || []);
        const mapped: any[][] = (data.data || []).map((r: any) => r.row);
        setRows(mapped);
        setRowData(data.data || []);
        
        // Notify parent that data has changed
        if (onDataChangeRef.current) {
          onDataChangeRef.current(mapped.length > 0);
        }
      }
    } catch (err: any) {
      console.error("Error saving row:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update data table entry",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderEditableField = (
    header: any,
    value: any,
    rowIndex: number,
    columnIndex: number
  ) => {
    const columnName = header.columnName;
    const currentValue = editedData[columnName] ?? value;
    const isSystemColumn =
      columnName?.toLowerCase() === "id" ||
      columnName?.toLowerCase() === "client_id" ||
      columnName?.toLowerCase() === "created_at" ||
      columnName?.toLowerCase() === "updated_at";

    if (isSystemColumn) return null;

    // Boolean field
    if (header.columnDisplayType === "BOOLEAN") {
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={Boolean(currentValue)}
            onCheckedChange={(checked) =>
              handleFieldChange(columnName, checked)
            }
          />
          <Label className="text-sm font-normal">
            {formatHeaderName(columnName)}
          </Label>
        </div>
      );
    }

    // Date field
    if (header.columnDisplayType === "DATE") {
      let dateValue = "";
      if (Array.isArray(value)) {
        const [y, m, d] = value;
        if (y && m && d) {
          dateValue = format(new Date(y, (m as number) - 1, d), "yyyy-MM-dd");
        }
      } else if (typeof currentValue === "string") {
        dateValue = currentValue;
      }
      return (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(columnName)}
          </Label>
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => handleFieldChange(columnName, e.target.value)}
            className="text-sm"
          />
        </div>
      );
    }

    // DateTime field
    if (header.columnDisplayType === "DATETIME") {
      let dateTimeValue = "";
      if (Array.isArray(value)) {
        const [y, m, d, hh, mm] = value;
        if (y && m && d) {
          dateTimeValue = format(
            new Date(y, (m as number) - 1, d, hh || 0, mm || 0),
            "yyyy-MM-dd'T'HH:mm"
          );
        }
      } else if (typeof currentValue === "string") {
        dateTimeValue = currentValue;
      }
      return (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(columnName)}
          </Label>
          <Input
            type="datetime-local"
            value={dateTimeValue}
            onChange={(e) => handleFieldChange(columnName, e.target.value)}
            className="text-sm"
          />
        </div>
      );
    }

    // Number fields
    if (
      header.columnDisplayType === "DECIMAL" ||
      header.columnDisplayType === "NUMERIC"
    ) {
      return (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(columnName)}
          </Label>
          <Input
            type="number"
            step="0.01"
            value={currentValue ?? ""}
            onChange={(e) =>
              handleFieldChange(columnName, parseFloat(e.target.value) || 0)
            }
            className="text-sm"
          />
        </div>
      );
    }

    // CODELOOKUP field - check this first before other types
    if (
      header.columnDisplayType === "CODELOOKUP" &&
      header.columnValues &&
      Array.isArray(header.columnValues) &&
      header.columnValues.length > 0
    ) {
      // For INTEGER type CODELOOKUP, store the ID as integer
      const isIntegerType =
        header.columnType === "INTEGER" ||
        header.columnType === "BIGINT" ||
        header.columnDisplayType === "INTEGER";

      // Convert columnValues to SearchableSelect options
      // Prefer 'name' over 'value' as 'value' often contains duplicated text
      const codeValueOptions = header.columnValues.map((option: any) => {
        let label = option.id.toString();
        if (option.name) {
          label = option.name;
        } else if (option.value) {
          // Value might have duplicated text or code prefix
          const valueStr = String(option.value);

          // Try to find a pattern like "text cd_something text" and take the first part
          const cdMatch = valueStr.match(/^(.+?)\s+cd_[a-z_]+\s+/i);
          if (cdMatch && cdMatch[1]) {
            label = cdMatch[1].trim();
          } else {
            // Try pattern: starts with cd_xxx followed by space and text
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
      });

      return (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(columnName)}
          </Label>
          <SearchableSelect
            options={codeValueOptions}
            value={currentValue?.toString() ?? ""}
            onValueChange={(value) =>
              handleFieldChange(
                columnName,
                isIntegerType ? parseInt(value) || 0 : value
              )
            }
            placeholder="Select an option"
            emptyMessage="No options available"
            onAddNew={() => {
              setCurrentCodeColumn(header);
              setNewCodeValueName("");
              setNewCodeValueDescription("");
              setShowAddCodeValueDialog(true);
            }}
            addNewLabel={`Add new ${formatHeaderName(columnName)}`}
          />
        </div>
      );
    }

    if (
      header.columnDisplayType === "INTEGER" ||
      header.columnType === "BIGINT" ||
      header.columnType === "INTEGER"
    ) {
      return (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(columnName)}
          </Label>
          <Input
            type="number"
            value={currentValue ?? ""}
            onChange={(e) =>
              handleFieldChange(columnName, parseInt(e.target.value) || 0)
            }
            className="text-sm"
          />
        </div>
      );
    }

    // Phone number field - detect by column name and apply Zambian format
    if (isPhoneNumberField(columnName)) {
      const displayValue = formatZambianPhoneDisplay(String(currentValue ?? ""));
      return (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(columnName)}
          </Label>
          <div className="flex">
            <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted text-muted-foreground text-sm">
              +260
            </div>
            <Input
              type="tel"
              value={displayValue}
              onChange={(e) => {
                const formatted = formatPhoneForStorage(e.target.value);
                handleFieldChange(columnName, formatted);
              }}
              placeholder="9X XXX XXXX"
              maxLength={12}
              className="text-sm rounded-l-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter 9 digit Zambian number (e.g., 97 123 4567)
          </p>
        </div>
      );
    }

    // Text field (default)
    return (
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {formatHeaderName(columnName)}
        </Label>
        <Input
          type="text"
          value={currentValue ?? ""}
          onChange={(e) => handleFieldChange(columnName, e.target.value)}
          className="text-sm"
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed p-8 flex flex-col items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
        <p className="text-sm text-muted-foreground">Loading table data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 p-4 flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertCircle className="h-5 w-5" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  const startAddingNew = () => {
    // Create an empty row for editing
    const initialData: Record<string, any> = {};
    headers.forEach((header) => {
      const columnName = header.columnName;
      if (columnName) {
        // Skip system columns
        const isSystemColumn =
          columnName.toLowerCase() === "id" ||
          columnName.toLowerCase() === "client_id" ||
          columnName.toLowerCase() === "created_at" ||
          columnName.toLowerCase() === "updated_at";
        if (!isSystemColumn) {
          // Set default values based on column type
          if (header.columnDisplayType === "BOOLEAN") {
            initialData[columnName] = false;
          } else if (
            header.columnDisplayType === "DECIMAL" ||
            header.columnDisplayType === "NUMERIC" ||
            header.columnDisplayType === "INTEGER" ||
            header.columnType === "BIGINT" ||
            header.columnType === "INTEGER"
          ) {
            initialData[columnName] = "";
          } else {
            initialData[columnName] = "";
          }
        }
      }
    });
    setEditedData(initialData);
    setEditingRowIndex(-1); // Use -1 to indicate new row
  };

  const saveNewRow = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};

      // Build payload excluding system columns
      headers.forEach((header) => {
        const columnName = header.columnName;
        if (!columnName) return;

        const isSystemColumn =
          columnName.toLowerCase() === "id" ||
          columnName.toLowerCase() === "client_id" ||
          columnName.toLowerCase() === "created_at" ||
          columnName.toLowerCase() === "updated_at";

        if (isSystemColumn) return;

        const newValue = editedData[columnName];
        if (newValue !== undefined && newValue !== "") {
          // Handle date inputs - convert to Fineract format
          if (
            header.columnDisplayType === "DATE" &&
            typeof newValue === "string"
          ) {
            const date = new Date(newValue);
            payload[columnName] = format(date, "yyyy-MM-dd");
          } else if (
            header.columnDisplayType === "DATETIME" &&
            typeof newValue === "string"
          ) {
            const date = new Date(newValue);
            payload[columnName] = format(date, "yyyy-MM-dd HH:mm:ss");
          } else if (header.columnDisplayType === "BOOLEAN") {
            payload[columnName] = Boolean(newValue);
          } else if (
            header.columnDisplayType === "DECIMAL" ||
            header.columnDisplayType === "NUMERIC"
          ) {
            payload[columnName] = parseFloat(String(newValue)) || 0;
          } else if (
            header.columnDisplayType === "INTEGER" ||
            header.columnType === "BIGINT" ||
            header.columnType === "INTEGER"
          ) {
            payload[columnName] = parseInt(String(newValue)) || 0;
          } else if (header.columnDisplayType === "CODELOOKUP") {
            // For CODELOOKUP, send the ID value (already stored correctly)
            // If it's an integer type, ensure it's parsed
            if (
              header.columnType === "INTEGER" ||
              header.columnType === "BIGINT"
            ) {
              payload[columnName] = parseInt(String(newValue)) || 0;
            } else {
              payload[columnName] = newValue;
            }
          } else {
            payload[columnName] = newValue;
          }
        }
      });

      const response = await fetch(
        `/api/fineract/datatables/${encodeURIComponent(
          datatableName
        )}/${clientId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details?.defaultUserMessage ||
            "Failed to create entry"
        );
      }

      toast({
        title: "Success",
        description: "Data table entry created successfully",
      });

      // Refresh data
      setEditingRowIndex(null);
      setEditedData({});

      // Reload the data
      const res = await fetch(
        `/api/fineract/datatables/${encodeURIComponent(
          datatableName
        )}/${clientId}?genericResultSet=true`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setHeaders(data.columnHeaders || []);
        const mapped: any[][] = (data.data || []).map((r: any) => r.row);
        setRows(mapped);
        setRowData(data.data || []);
        
        // Notify parent that data has changed
        if (onDataChangeRef.current) {
          onDataChangeRef.current(mapped.length > 0);
        }
      }
    } catch (err: any) {
      console.error("Error creating row:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to create data table entry",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Check if this datatable has bank detail fields that need custom rendering
  const showBankDetailFields = hasBankDetailFields(headers);
  const bankDetailColumnNames = showBankDetailFields
    ? getBankDetailColumnNames(headers)
    : [];

  // Show form for adding new row when editingRowIndex is -1
  if (editingRowIndex === -1) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-muted-foreground">
            New Entry
          </h4>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancelEditing}
              disabled={saving}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveNewRow}
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Render custom bank detail fields if applicable */}
          {showBankDetailFields && (
            <BankDetailsFields
              headers={headers}
              editedData={editedData}
              onFieldChange={handleFieldChange}
            />
          )}
          {/* Render other fields normally, skipping bank detail fields */}
          {headers.map((header, index) => {
            const columnName = header.columnName;
            if (!columnName) return null;

            const isSystemColumn =
              columnName.toLowerCase() === "id" ||
              columnName.toLowerCase() === "client_id" ||
              columnName.toLowerCase() === "created_at" ||
              columnName.toLowerCase() === "updated_at";

            if (isSystemColumn) return null;

            // Skip bank detail fields - they're rendered by BankDetailsFields
            if (bankDetailColumnNames.includes(columnName)) return null;

            return renderEditableField(
              header,
              editedData[columnName],
              -1,
              index
            );
          })}
        </div>
      </div>
    );
  }

  // Handle adding new code value
  const handleAddCodeValue = async () => {
    if (!currentCodeColumn?.columnCode || !newCodeValueName.trim()) {
      toast({
        title: "Error",
        description: "Code name and value name are required",
        variant: "destructive",
      });
      return;
    }

    setAddingCodeValue(true);
    try {
      const response = await fetch(
        `/api/fineract/codes/${encodeURIComponent(
          currentCodeColumn.columnCode
        )}/codevalues`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newCodeValueName.trim(),
            description:
              newCodeValueDescription.trim() || newCodeValueName.trim(),
            position: 0,
            isActive: true,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create code value");
      }

      toast({
        title: "Success",
        description: "Code value added successfully",
      });

      // Reload the datatable to get updated columnValues
      const res = await fetch(
        `/api/fineract/datatables/${encodeURIComponent(
          datatableName
        )}/${clientId}?genericResultSet=true`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setHeaders(data.columnHeaders || []);
        const mapped: any[][] = (data.data || []).map((r: any) => r.row);
        setRows(mapped);
        setRowData(data.data || []);

        // Find the newly created code value and select it
        // Check 'name' first as 'value' often contains code prefix
        const updatedHeader = data.columnHeaders?.find(
          (h: any) => h.columnName === currentCodeColumn.columnName
        );
        if (updatedHeader?.columnValues) {
          const newValue = updatedHeader.columnValues.find(
            (opt: any) =>
              opt.name?.toLowerCase() === newCodeValueName.toLowerCase()
          );
          if (newValue) {
            const isIntegerType =
              currentCodeColumn.columnType === "INTEGER" ||
              currentCodeColumn.columnType === "BIGINT";
            handleFieldChange(
              currentCodeColumn.columnName,
              isIntegerType ? newValue.id : newValue.id.toString()
            );
          }
        }
      }

      // Close dialog and reset
      setShowAddCodeValueDialog(false);
      setNewCodeValueName("");
      setNewCodeValueDescription("");
      setCurrentCodeColumn(null);
    } catch (err: any) {
      console.error("Error adding code value:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to add code value",
        variant: "destructive",
      });
    } finally {
      setAddingCodeValue(false);
    }
  };

  if (rows.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-dashed p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            No data available in this table
          </p>
          <Button
            type="button"
            onClick={startAddingNew}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>
        {/* Add Code Value Dialog */}
        <Dialog
          open={showAddCodeValueDialog}
          onOpenChange={setShowAddCodeValueDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Add New{" "}
                {currentCodeColumn
                  ? formatHeaderName(currentCodeColumn.columnName)
                  : "Code Value"}
              </DialogTitle>
              <DialogDescription>
                Create a new code value for{" "}
                {currentCodeColumn?.columnCode || "this code"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="codeValueName">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="codeValueName"
                  value={newCodeValueName}
                  onChange={(e) => setNewCodeValueName(e.target.value)}
                  placeholder="Enter code value name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codeValueDescription">Description</Label>
                <Input
                  id="codeValueDescription"
                  value={newCodeValueDescription}
                  onChange={(e) => setNewCodeValueDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddCodeValueDialog(false);
                  setNewCodeValueName("");
                  setNewCodeValueDescription("");
                  setCurrentCodeColumn(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAddCodeValue}
                disabled={addingCodeValue || !newCodeValueName.trim()}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {addingCodeValue ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Code Value"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Add Entry Button at the top */}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={startAddingNew}
            className="bg-blue-500 hover:bg-blue-600"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>

        {rows.map((row, ri) => {
          const isEditing = editingRowIndex === ri;

          return (
            <div
              key={ri}
              className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Entry #{ri + 1}
                </h4>
                {!isEditing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startEditing(ri)}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={cancelEditing}
                      disabled={saving}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveRow(ri)}
                      disabled={saving}
                      className="gap-2 bg-blue-500 hover:bg-blue-600"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Render custom bank detail fields when editing */}
                {isEditing && showBankDetailFields && (
                  <BankDetailsFields
                    headers={headers}
                    editedData={editedData}
                    onFieldChange={handleFieldChange}
                  />
                )}
                {row.map((cell: any, ci: number) => {
                  const header = headers[ci];
                  const headerName = formatHeaderName(header?.columnName || "");

                  // Skip empty cells or system columns like id, client_id, created_at, updated_at
                  const isSystemColumn =
                    header?.columnName?.toLowerCase() === "id" ||
                    header?.columnName?.toLowerCase() === "client_id" ||
                    header?.columnName?.toLowerCase() === "created_at" ||
                    header?.columnName?.toLowerCase() === "updated_at";

                  // Don't render if it's a system column or empty (when not editing)
                  if (
                    isSystemColumn ||
                    (!isEditing &&
                      (cell === null || cell === undefined || cell === ""))
                  ) {
                    return null;
                  }

                  // Skip bank detail fields when editing - they're rendered by BankDetailsFields
                  if (isEditing && bankDetailColumnNames.includes(header?.columnName)) {
                    return null;
                  }

                  if (isEditing) {
                    return (
                      <div key={`${ri}-${ci}`}>
                        {renderEditableField(header, cell, ri, ci)}
                      </div>
                    );
                  }

                  // For CODELOOKUP fields, try to find the matching value from columnValues
                  // Prefer 'name' over 'value' as 'value' often contains duplicated text like "Bank branch code cd_bank_branch_code Bank branch code"
                  let displayValue = cell;
                  if (
                    header?.columnDisplayType === "CODELOOKUP" &&
                    header?.columnValues &&
                    Array.isArray(header.columnValues) &&
                    cell != null
                  ) {
                    const matchingOption = header.columnValues.find(
                      (opt: any) => opt.id === cell || opt.id === Number(cell)
                    );
                    if (matchingOption) {
                      // Use name if available (cleanest option)
                      if (matchingOption.name) {
                        displayValue = matchingOption.name;
                      } else if (matchingOption.value) {
                        // Value might have duplicated text or code prefix
                        // Pattern 1: "Name cd_code_name Name" -> extract first "Name"
                        // Pattern 2: "cd_code_name Name" -> extract "Name"
                        const valueStr = String(matchingOption.value);

                        // Try to find a pattern like "text cd_something text" and take the first part
                        const cdMatch = valueStr.match(
                          /^(.+?)\s+cd_[a-z_]+\s+/i
                        );
                        if (cdMatch && cdMatch[1]) {
                          displayValue = cdMatch[1].trim();
                        } else {
                          // Try pattern: starts with cd_xxx followed by space and text
                          const prefixMatch =
                            valueStr.match(/^cd_[a-z_]+\s+(.+)$/i);
                          if (prefixMatch && prefixMatch[1]) {
                            displayValue = prefixMatch[1].trim();
                          } else {
                            displayValue = valueStr;
                          }
                        }
                      } else {
                        displayValue = cell;
                      }
                    }
                  }

                  // Format phone numbers with Zambian international format
                  let cellValue;
                  if (isPhoneNumberField(header?.columnName || "")) {
                    const formattedPhone = formatZambianPhoneDisplay(String(displayValue ?? ""));
                    cellValue = formattedPhone ? (
                      <span className="font-medium">+260 {formattedPhone}</span>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    );
                  } else {
                    cellValue = formatCell(
                    displayValue,
                    header?.columnType,
                    header?.columnDisplayType
                  );
                  }

                  return (
                    <div key={`${ri}-${ci}`} className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {headerName}
                      </p>
                      <div className="text-sm font-medium">{cellValue}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Code Value Dialog */}
      <Dialog
        open={showAddCodeValueDialog}
        onOpenChange={setShowAddCodeValueDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add New{" "}
              {currentCodeColumn
                ? formatHeaderName(currentCodeColumn.columnName)
                : "Code Value"}
            </DialogTitle>
            <DialogDescription>
              Create a new code value for{" "}
              {currentCodeColumn?.columnCode || "this code"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="codeValueName">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="codeValueName"
                value={newCodeValueName}
                onChange={(e) => setNewCodeValueName(e.target.value)}
                placeholder="Enter code value name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codeValueDescription">Description</Label>
              <Input
                id="codeValueDescription"
                value={newCodeValueDescription}
                onChange={(e) => setNewCodeValueDescription(e.target.value)}
                placeholder="Enter description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddCodeValueDialog(false);
                setNewCodeValueName("");
                setNewCodeValueDescription("");
                setCurrentCodeColumn(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddCodeValue}
              disabled={addingCodeValue || !newCodeValueName.trim()}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {addingCodeValue ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Code Value"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
