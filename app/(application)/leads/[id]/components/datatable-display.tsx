"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Edit2, Save, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  getEmployersByClientType,
  getOccupationsByEmployer,
  isMinistryOfDefence,
} from "@/shared/defaults/employer-options";

interface DatatableDisplayProps {
  datatableName: string;
  clientId: number;
  initialData?: any;
  clientType?: string; // PDA, GRZ, etc.
}

export function DatatableDisplay({
  datatableName,
  clientId,
  initialData,
  clientType,
}: DatatableDisplayProps) {
  const [headers, setHeaders] = useState<any[]>(
    initialData?.columnHeaders || []
  );
  const [rows, setRows] = useState<any[][]>(
    (initialData?.data || []).map((r: any) => r.row)
  );
  const [rowData, setRowData] = useState<any[]>(initialData?.data || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    !initialData ? "No data available" : null
  );
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [showAddCodeValueDialog, setShowAddCodeValueDialog] = useState(false);
  const [currentCodeColumn, setCurrentCodeColumn] = useState<any>(null);
  const [newCodeValueName, setNewCodeValueName] = useState("");
  const [newCodeValueDescription, setNewCodeValueDescription] = useState("");
  const [addingCodeValue, setAddingCodeValue] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<string>("");
  const { toast } = useToast();

  // Get employer options based on client type
  const employerOptions = getEmployersByClientType(clientType).map((emp) => ({
    value: emp,
    label: emp,
  }));

  // Get occupation options based on selected employer
  const occupationOptions = getOccupationsByEmployer(selectedEmployer);

  // Track selected employer from edited data
  useEffect(() => {
    const employer = editedData["employer_cd_employer"] || editedData["employer"] || editedData["Employer"];
    if (employer && typeof employer === "string") {
      setSelectedEmployer(employer);
    }
  }, [editedData]);

  const formatCell = (
    val: any,
    columnType?: string,
    columnDisplayType?: string
  ) => {
    if (val === null || val === undefined || val === "") {
      return <span className="text-muted-foreground italic">—</span>;
    }

    if (Array.isArray(val)) {
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
  };

  const getRowId = (rowIndex: number): number | null => {
    const row = rowData[rowIndex];
    if (!row) return null;

    const idHeader = headers.find(
      (h) => h.columnName?.toLowerCase() === "id" && h.isColumnPrimaryKey
    );
    if (idHeader) {
      const idIndex = headers.findIndex((h) => h === idHeader);
      const rowId = row.row[idIndex];
      if (rowId != null) return Number(rowId);
    }

    const primaryKeyHeader = headers.find((h) => h.isColumnPrimaryKey);
    if (primaryKeyHeader) {
      const pkIndex = headers.findIndex((h) => h === primaryKeyHeader);
      const rowId = row.row[pkIndex];
      if (rowId != null) return Number(rowId);
    }

    if (headers[0] && row.row[0] != null) {
      const firstValue = Number(row.row[0]);
      if (!isNaN(firstValue) && firstValue > 0) return firstValue;
    }

    if (row.id != null) return Number(row.id);

    return null;
  };

  const startEditing = (rowIndex: number) => {
    const row = rows[rowIndex];
    const initialData: Record<string, any> = {};

    headers.forEach((header, index) => {
      const columnName = header.columnName;
      if (columnName) {
        const value = row[index];
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

  const reloadData = async () => {
    try {
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
      }
    } catch (err) {
      console.error("Error reloading data:", err);
    }
  };

  const saveRow = async (rowIndex: number) => {
    setSaving(true);
    try {
      const rowId = getRowId(rowIndex);
      if (!rowId) {
        throw new Error("Cannot update: Row ID not found.");
      }

      const payload: Record<string, any> = {};
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
          body: JSON.stringify({ rowId, data: payload }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update entry");
      }

      toast({
        title: "Success",
        description: "Data table entry updated successfully",
      });

      setEditingRowIndex(null);
      setEditedData({});
      await reloadData();
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

    // Check if this is an employer field - use custom employer list based on client type
    const isEmployerField =
      columnName?.toLowerCase().includes("employer") ||
      header?.columnCode?.toLowerCase().includes("employer");

    if (isEmployerField) {
      return (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(columnName)}
            {clientType && (
              <span className="ml-2 text-xs font-normal text-blue-500">
                ({clientType} employers)
              </span>
            )}
          </Label>
          <SearchableSelect
            options={employerOptions}
            value={currentValue?.toString() ?? ""}
            onValueChange={(value) => {
              handleFieldChange(columnName, value);
              setSelectedEmployer(value);
            }}
            placeholder={`Select ${clientType || ""} employer`}
            emptyMessage="No employers available"
          />
        </div>
      );
    }

    // Check if this is an occupation field - use conditional options based on employer
    const isOccupationField =
      columnName?.toLowerCase().includes("occupation") ||
      columnName?.toLowerCase().includes("position") ||
      header?.columnCode?.toLowerCase().includes("occupation");

    if (isOccupationField) {
      const isMOD = isMinistryOfDefence(selectedEmployer);
      return (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(columnName)}
            {isMOD && (
              <span className="ml-2 text-xs font-normal text-orange-500">
                (Defence personnel)
              </span>
            )}
          </Label>
          <SearchableSelect
            options={occupationOptions}
            value={currentValue?.toString() ?? ""}
            onValueChange={(value) => handleFieldChange(columnName, value)}
            placeholder="Select occupation"
            emptyMessage="No occupations available"
          />
          {isMOD && (
            <p className="text-xs text-orange-500 mt-1">
              Ministry of Defence employees: Select Soldier or Confidential
            </p>
          )}
        </div>
      );
    }

    if (
      header.columnDisplayType === "CODELOOKUP" &&
      header.columnValues &&
      Array.isArray(header.columnValues) &&
      header.columnValues.length > 0
    ) {
      const isIntegerType =
        header.columnType === "INTEGER" || header.columnType === "BIGINT";

      const codeValueOptions = header.columnValues.map((option: any) => {
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
        return { value: option.id.toString(), label };
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

  if (error && rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No data available in this table
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
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
                {row.map((cell: any, ci: number) => {
                  const header = headers[ci];
                  const headerName = formatHeaderName(header?.columnName || "");

                  const isSystemColumn =
                    header?.columnName?.toLowerCase() === "id" ||
                    header?.columnName?.toLowerCase() === "client_id" ||
                    header?.columnName?.toLowerCase() === "created_at" ||
                    header?.columnName?.toLowerCase() === "updated_at";

                  if (
                    isSystemColumn ||
                    (!isEditing &&
                      (cell === null || cell === undefined || cell === ""))
                  ) {
                    return null;
                  }

                  if (isEditing) {
                    return (
                      <div key={`${ri}-${ci}`}>
                        {renderEditableField(header, cell, ri, ci)}
                      </div>
                    );
                  }

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
                      if (matchingOption.name) {
                        displayValue = matchingOption.name;
                      } else if (matchingOption.value) {
                        const valueStr = String(matchingOption.value);
                        const cdMatch = valueStr.match(
                          /^(.+?)\s+cd_[a-z_]+\s+/i
                        );
                        if (cdMatch && cdMatch[1]) {
                          displayValue = cdMatch[1].trim();
                        } else {
                          const prefixMatch =
                            valueStr.match(/^cd_[a-z_]+\s+(.+)$/i);
                          if (prefixMatch && prefixMatch[1]) {
                            displayValue = prefixMatch[1].trim();
                          } else {
                            displayValue = valueStr;
                          }
                        }
                      }
                    }
                  }

                  const cellValue = formatCell(
                    displayValue,
                    header?.columnType,
                    header?.columnDisplayType
                  );

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
              onClick={async () => {
                if (
                  !currentCodeColumn?.columnCode ||
                  !newCodeValueName.trim()
                ) {
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
                          newCodeValueDescription.trim() ||
                          newCodeValueName.trim(),
                        position: 0,
                        isActive: true,
                      }),
                    }
                  );

                  const result = await response.json();
                  if (!response.ok) {
                    throw new Error(
                      result.error || "Failed to create code value"
                    );
                  }

                  toast({
                    title: "Success",
                    description: "Code value added successfully",
                  });

                  await reloadData();
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
              }}
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
