"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/currency-context";
import { formatCurrency } from "@/lib/format-currency";
import { format } from "date-fns";
import {
  Plus,
  Loader2,
  ShieldCheck,
  Landmark,
  BarChart3,
  Percent,
  Edit2,
  Trash2,
  RefreshCw,
  PackageSearch,
} from "lucide-react";

const DATATABLE_NAME = "Proposed Security";

const SYSTEM_COLUMNS = new Set(["id", "client_id", "created_at", "updated_at"]);

interface LeadAppraisalsProps {
  leadId: string;
  fineractClientId: number | null;
  requestedAmount?: number | null;
  readOnly?: boolean;
}

interface ColumnHeader {
  columnName: string;
  columnType: string;
  columnDisplayType: string;
  columnLength?: number;
  columnCode?: string;
  columnValues?: { id: number; value: string; name?: string }[];
  isColumnPrimaryKey?: boolean;
  isColumnNullable?: boolean;
}

export function LeadAppraisals({
  leadId,
  fineractClientId,
  requestedAmount,
  readOnly = false,
}: LeadAppraisalsProps) {
  const [headers, setHeaders] = useState<ColumnHeader[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [rowData, setRowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteRowId, setDeleteRowId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { currencyCode } = useCurrency();

  const editableHeaders = headers.filter(
    (h) => !SYSTEM_COLUMNS.has(h.columnName?.toLowerCase())
  );

  const fetchData = useCallback(async () => {
    if (!fineractClientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/fineract/datatables/${encodeURIComponent(DATATABLE_NAME)}/${fineractClientId}?genericResultSet=true`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch data");
      setHeaders(data.columnHeaders || []);
      setRows((data.data || []).map((r: any) => r.row));
      setRowData(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load collateral data");
    } finally {
      setLoading(false);
    }
  }, [fineractClientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Helpers ---

  function getRowId(rowIndex: number): number | null {
    const row = rowData[rowIndex];
    if (!row) return null;
    const idHeader = headers.find(
      (h) => h.columnName?.toLowerCase() === "id" && h.isColumnPrimaryKey
    );
    if (idHeader) {
      const idx = headers.indexOf(idHeader);
      if (row.row[idx] != null) return Number(row.row[idx]);
    }
    const pk = headers.find((h) => h.isColumnPrimaryKey);
    if (pk) {
      const idx = headers.indexOf(pk);
      if (row.row[idx] != null) return Number(row.row[idx]);
    }
    if (row.row[0] != null && Number(row.row[0]) > 0) return Number(row.row[0]);
    return row.id != null ? Number(row.id) : null;
  }

  function formatHeaderName(name: string) {
    let formatted = name
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
    const dup = formatted.match(/^(.+?)\s+cd[\s-]+\1$/i);
    if (dup?.[1]) return dup[1].trim();
    const cd = formatted.match(/^(.+?)\s+cd[\s-]+/i);
    if (cd?.[1]) return cd[1].trim();
    return formatted;
  }

  function resolveCodeLabel(header: ColumnHeader, value: any): string {
    if (!header.columnValues?.length || value == null) return String(value ?? "");
    const match = header.columnValues.find(
      (o) => o.id === value || o.id === Number(value)
    );
    if (!match) return String(value);
    if (match.name) return match.name;
    const v = String(match.value);
    const m = v.match(/^(.+?)\s+cd_[a-z_]+\s+/i);
    return m?.[1]?.trim() || v;
  }

  function formatCellValue(value: any, header: ColumnHeader) {
    if (value == null || value === "") return "—";
    if (Array.isArray(value)) {
      const [y, m, d] = value;
      if (y && m && d) {
        return new Date(y, m - 1, d).toLocaleDateString("en-US", {
          year: "numeric", month: "short", day: "numeric",
        });
      }
      return "—";
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (header.columnDisplayType === "CODELOOKUP") return resolveCodeLabel(header, value);
    if (header.columnDisplayType === "DECIMAL" || header.columnDisplayType === "NUMERIC") {
      const n = parseFloat(String(value));
      return isNaN(n) ? String(value) : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (header.columnDisplayType === "INTEGER" || header.columnType === "BIGINT") {
      const n = parseInt(String(value));
      return isNaN(n) ? String(value) : n.toLocaleString("en-US");
    }
    return String(value);
  }

  function isValueColumn(header: ColumnHeader) {
    const name = header.columnName?.toLowerCase() || "";
    const displayName = formatHeaderName(header.columnName)?.toLowerCase() || "";
    return (
      name.includes("value") || name.includes("amount") || name.includes("price") || name.includes("worth") ||
      displayName.includes("value") || displayName.includes("amount") || displayName.includes("price") || displayName.includes("worth")
    );
  }

  // --- Summary ---

  const summary = (() => {
    const count = rows.length;
    let totalValue = 0;
    let valueIndices = headers
      .map((h, i) => (isValueColumn(h) ? i : -1))
      .filter((i) => i >= 0);

    // Fallback: if no value columns detected by name, try all non-system numeric-looking columns
    if (valueIndices.length === 0 && rows.length > 0) {
      valueIndices = headers
        .map((h, i) => {
          if (SYSTEM_COLUMNS.has(h.columnName?.toLowerCase())) return -1;
          const firstVal = rows[0]?.[i];
          if (firstVal != null && !isNaN(parseFloat(String(firstVal))) && String(firstVal).trim() !== "") {
            const name = h.columnName?.toLowerCase() || "";
            if (!name.includes("serial") && !name.includes("phone") && !name.includes("id") && !name.includes("number")) {
              return i;
            }
          }
          return -1;
        })
        .filter((i) => i >= 0);
    }

    for (const row of rows) {
      for (const idx of valueIndices) {
        const v = parseFloat(String(row[idx]));
        if (!isNaN(v)) totalValue += v;
      }
    }
    const coverage = requestedAmount && requestedAmount > 0
      ? ((totalValue / requestedAmount) * 100).toFixed(0)
      : null;
    return { count, totalValue, coverage };
  })();

  // --- Form ---

  function openAddForm() {
    setEditingRowId(null);
    setFormData({});
    setFormOpen(true);
  }

  function openEditForm(rowIndex: number) {
    const row = rows[rowIndex];
    const data: Record<string, any> = {};
    headers.forEach((header, i) => {
      const col = header.columnName;
      if (!col || SYSTEM_COLUMNS.has(col.toLowerCase())) return;
      const val = row[i];
      if (Array.isArray(val) && (header.columnDisplayType === "DATE" || header.columnDisplayType === "DATETIME")) {
        const [y, m, d] = val;
        if (y && m && d) data[col] = format(new Date(y, m - 1, d), "yyyy-MM-dd");
      } else {
        data[col] = val;
      }
    });
    const rid = getRowId(rowIndex);
    setEditingRowId(rid);
    setFormData(data);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!fineractClientId) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      for (const header of editableHeaders) {
        const col = header.columnName;
        const val = formData[col];
        if (val === undefined) continue;
        if (header.columnDisplayType === "DATE" && typeof val === "string") {
          payload[col] = format(new Date(val), "yyyy-MM-dd");
        } else if (header.columnDisplayType === "BOOLEAN") {
          payload[col] = Boolean(val);
        } else if (header.columnDisplayType === "DECIMAL" || header.columnDisplayType === "NUMERIC") {
          payload[col] = parseFloat(String(val)) || 0;
        } else if (header.columnDisplayType === "INTEGER" || header.columnType === "BIGINT" || header.columnType === "INTEGER") {
          payload[col] = parseInt(String(val)) || 0;
        } else if (header.columnDisplayType === "CODELOOKUP" && (header.columnType === "INTEGER" || header.columnType === "BIGINT")) {
          payload[col] = parseInt(String(val)) || 0;
        } else {
          payload[col] = val;
        }
      }

      const url = `/api/fineract/datatables/${encodeURIComponent(DATATABLE_NAME)}/${fineractClientId}`;
      if (editingRowId != null) {
        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowId: editingRowId, data: payload }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update");
        }
        toast({ title: "Updated", description: "Collateral item updated successfully" });
      } else {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create");
        }
        toast({ title: "Added", description: "Collateral item added successfully" });
      }

      setFormOpen(false);
      setFormData({});
      setEditingRowId(null);
      await fetchData();
      window.dispatchEvent(new Event("lead-data-changed"));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!fineractClientId || deleteRowId == null) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/fineract/datatables/${encodeURIComponent(DATATABLE_NAME)}/${fineractClientId}?rowId=${deleteRowId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      toast({ title: "Deleted", description: "Collateral item removed" });
      setDeleteRowId(null);
      await fetchData();
      window.dispatchEvent(new Event("lead-data-changed"));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  function renderFormField(header: ColumnHeader) {
    const col = header.columnName;
    const val = formData[col] ?? "";
    const label = formatHeaderName(col);

    if (header.columnDisplayType === "BOOLEAN") {
      return (
        <div key={col} className="flex items-center space-x-2 col-span-1">
          <Checkbox
            checked={Boolean(val)}
            onCheckedChange={(checked) => setFormData((p) => ({ ...p, [col]: checked }))}
          />
          <Label className="text-sm">{label}</Label>
        </div>
      );
    }

    if (header.columnDisplayType === "DATE") {
      return (
        <div key={col} className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
          <Input type="date" value={val} onChange={(e) => setFormData((p) => ({ ...p, [col]: e.target.value }))} />
        </div>
      );
    }

    if (header.columnDisplayType === "DECIMAL" || header.columnDisplayType === "NUMERIC") {
      return (
        <div key={col} className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
          <Input type="number" step="0.01" value={val} onChange={(e) => setFormData((p) => ({ ...p, [col]: e.target.value }))} />
        </div>
      );
    }

    if (header.columnDisplayType === "INTEGER" || header.columnType === "BIGINT" || header.columnType === "INTEGER") {
      if (header.columnDisplayType !== "CODELOOKUP") {
        return (
          <div key={col} className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
            <Input type="number" value={val} onChange={(e) => setFormData((p) => ({ ...p, [col]: e.target.value }))} />
          </div>
        );
      }
    }

    if (header.columnDisplayType === "CODELOOKUP" && header.columnValues?.length) {
      const isInt = header.columnType === "INTEGER" || header.columnType === "BIGINT";
      const opts = header.columnValues.map((o) => {
        let lbl = o.name || "";
        if (!lbl && o.value) {
          const v = String(o.value);
          const m = v.match(/^(.+?)\s+cd_[a-z_]+\s+/i);
          lbl = m?.[1]?.trim() || v;
        }
        return { value: String(o.id), label: lbl || String(o.id) };
      });
      return (
        <div key={col} className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
          <SearchableSelect
            options={opts}
            value={String(val ?? "")}
            onValueChange={(v) => setFormData((p) => ({ ...p, [col]: isInt ? parseInt(v) || 0 : v }))}
            placeholder={`Select ${label.toLowerCase()}`}
            emptyMessage="No options"
          />
        </div>
      );
    }

    const isLongText = (header.columnLength && header.columnLength > 255) ||
      col.toLowerCase().includes("note") || col.toLowerCase().includes("description") || col.toLowerCase().includes("remark");
    if (isLongText) {
      return (
        <div key={col} className="space-y-1.5 col-span-full">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
          <Textarea value={val} onChange={(e) => setFormData((p) => ({ ...p, [col]: e.target.value }))} rows={3} />
        </div>
      );
    }

    return (
      <div key={col} className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
        <Input value={val} onChange={(e) => setFormData((p) => ({ ...p, [col]: e.target.value }))} />
      </div>
    );
  }

  // --- Render ---

  if (!fineractClientId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">No Fineract client linked to this lead. Submit client to Fineract first.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-destructive mb-3">{error}</p>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const visibleHeaders = headers.filter((h) => !SYSTEM_COLUMNS.has(h.columnName?.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Collateral Items</p>
              <p className="text-2xl font-bold">{summary.count}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalValue, currencyCode)}</p>
            </div>
            <Landmark className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Coverage Ratio</p>
              <p className="text-2xl font-bold">
                {summary.coverage != null ? `${summary.coverage}%` : "—"}
              </p>
              {requestedAmount != null && requestedAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  vs {formatCurrency(requestedAmount, currencyCode)} requested
                </p>
              )}
            </div>
            <Percent className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Proposed Security</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" />Refresh
            </Button>
            {!readOnly && (
              <Button size="sm" onClick={openAddForm}>
                <Plus className="h-4 w-4 mr-1" />Add Collateral
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12">
              <PackageSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No collateral items recorded yet.</p>
              {!readOnly && (
                <Button className="mt-4" size="sm" onClick={openAddForm}>
                  <Plus className="h-4 w-4 mr-1" />Add First Item
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">#</th>
                    {visibleHeaders.map((h) => (
                      <th key={h.columnName} className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        {formatHeaderName(h.columnName)}
                      </th>
                    ))}
                    {!readOnly && (
                      <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{ri + 1}</td>
                      {visibleHeaders.map((header) => {
                        const ci = headers.indexOf(header);
                        const val = row[ci];
                        const display = formatCellValue(val, header);
                        const isValue = isValueColumn(header);
                        return (
                          <td key={header.columnName} className={`px-3 py-2.5 ${isValue ? "font-medium tabular-nums" : ""}`}>
                            {typeof val === "boolean" ? (
                              <Badge variant={val ? "default" : "outline"} className={val ? "bg-green-500 text-white" : ""}>
                                {val ? "Yes" : "No"}
                              </Badge>
                            ) : display === "—" ? (
                              <span className="text-muted-foreground italic">—</span>
                            ) : (
                              display
                            )}
                          </td>
                        );
                      })}
                      {!readOnly && (
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(ri)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteRowId(getRowId(ri))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRowId != null ? "Edit Collateral" : "Add Collateral"}</DialogTitle>
            <DialogDescription>
              {editingRowId != null ? "Update the collateral details below." : "Fill in the collateral details to add a new item."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {editableHeaders.map((h) => renderFormField(h))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : editingRowId != null ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteRowId != null} onOpenChange={(open) => { if (!open) setDeleteRowId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collateral Item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this collateral item from Fineract. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
