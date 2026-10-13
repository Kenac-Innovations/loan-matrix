"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  INVENTORY_REPORTS,
  type InventoryReportFilters,
  type InventoryReportResult,
} from "@/lib/inventory/inventory-report-types";
import {
  inventoryReportQuery,
  formatInventoryReportCell,
} from "@/lib/inventory/inventory-report-view-model";
import { InventoryTabs } from "./inventory-tabs";
type Props = {
  offices: { id: number; name: string }[];
  items: { id: string; name: string }[];
  currencies: string[];
};
export function InventoryReports({ offices, items, currencies }: Props) {
  const [filters, setFilters] = useState<InventoryReportFilters>({
    kind: "availability",
    currencyCode: currencies[0] || "USD",
    page: 1,
    pageSize: 50,
  });
  const [applied, setApplied] = useState(filters);
  const [report, setReport] = useState<InventoryReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    fetch("/api/inventory/reports?" + inventoryReportQuery(applied), {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Report unavailable.");
        if (generation.current === current) setReport(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError" && generation.current === current) {
          setReport(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
    return () => controller.abort();
  }, [applied, refresh]);
  function change(key: keyof InventoryReportFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]:
        key === "officeId"
          ? value
            ? Number(value)
            : undefined
          : value || undefined,
      page: 1,
    }));
  }
  async function download(format: "csv" | "xlsx") {
    setExporting(true);
    setError("");
    try {
      const params = inventoryReportQuery(applied);
      params.set("format", format);
      const r = await fetch("/api/inventory/reports/export?" + params);
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Export failed.");
      }
      const url = URL.createObjectURL(await r.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `arda-stock-${applied.kind}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }
  const selectClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Inventory Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track stock availability, reservations, movements and items issued
            to borrowers.
          </p>
        </div>
        <InventoryTabs />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Report filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setLoading(true);
              setError("");
              setApplied({ ...filters, page: 1 });
              setRefresh((v) => v + 1);
            }}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <label className="space-y-2 text-sm">
              Report
              <select
                className={selectClass}
                value={filters.kind}
                onChange={(e) => change("kind", e.target.value)}
              >
                {Object.entries(INVENTORY_REPORTS).map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Office
              <select
                className={selectClass}
                value={filters.officeId ?? ""}
                onChange={(e) => change("officeId", e.target.value)}
              >
                <option value="">All accessible offices</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Stock item
              <select
                className={selectClass}
                value={filters.itemId ?? ""}
                onChange={(e) => change("itemId", e.target.value)}
              >
                <option value="">All items</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Currency
              <select
                className={selectClass}
                value={filters.currencyCode}
                onChange={(e) => change("currencyCode", e.target.value)}
              >
                {(currencies.length ? currencies : ["USD"]).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {!["availability", "reservations"].includes(filters.kind) && (
              <>
                <label className="space-y-2 text-sm">
                  Start date (UTC)
                  <Input
                    type="date"
                    value={filters.startDate ?? ""}
                    onChange={(e) => change("startDate", e.target.value)}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  End date (UTC)
                  <Input
                    type="date"
                    value={filters.endDate ?? ""}
                    onChange={(e) => change("endDate", e.target.value)}
                  />
                </label>
              </>
            )}
            {filters.kind === "reservations" && (
              <label className="space-y-2 text-sm">
                Status
                <select
                  className={selectClass}
                  value={filters.status ?? "RESERVED"}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {[
                    "RESERVED",
                    "PROCESSING",
                    "ISSUED",
                    "CANCELLED",
                    "RETURNED",
                    "FAILED",
                    "REPAID",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Generating…" : "Generate report"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400"
        >
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{INVENTORY_REPORTS[applied.kind]}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!report || loading || exporting}
                onClick={() => download("csv")}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                disabled={!report || loading || exporting}
                onClick={() => download("xlsx")}
              >
                Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {["availability", "reservations"].includes(applied.kind)
              ? "Current position. Balances and reservations are live snapshots."
              : "Activity within the selected dates (UTC)."}{" "}
            Quantities are reported in each item’s unit; values are in{" "}
            {applied.currencyCode}.
          </p>
          {applied.kind === "performance" && (
            <p className="mb-4 text-sm text-muted-foreground">
              Rankings compare net issued quantities within the same unit and
              currency. Returns reduce net quantity.
            </p>
          )}
          {loading ? (
            <p
              role="status"
              className="py-12 text-center text-muted-foreground"
            >
              Loading report…
            </p>
          ) : !report?.rows.length ? (
            <p className="py-12 text-center text-muted-foreground">
              No stock records match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  {INVENTORY_REPORTS[applied.kind]}
                </caption>
                <thead className="bg-muted">
                  <tr>
                    {report.columns.map((c) => (
                      <th
                        scope="col"
                        key={c.key}
                        className="whitespace-nowrap border-b p-3 text-left font-medium"
                      >
                        {c.key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, index) => (
                    <tr
                      key={index}
                      className={`border-b last:border-0 ${Number(row["Age (days)"] ?? 0) >= 7 ? "bg-amber-500/10" : ""}`}
                    >
                      {report.columns.map((c) => (
                        <td
                          key={c.key}
                          className={`max-w-md p-3 ${c.type === "decimal" || c.type === "integer" ? "text-right tabular-nums" : "text-left"}`}
                        >
                          {formatInventoryReportCell(row[c.key], c.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                {report.totalRows.toLocaleString()} records · Page{" "}
                {applied.page} · Generated{" "}
                {new Date(report.generatedAt).toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={loading || applied.page === 1}
                  onClick={() => { setLoading(true); setError(""); setApplied((p) => ({ ...p, page: p.page - 1 })); }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    loading ||
                    applied.page * applied.pageSize >= report.totalRows
                  }
                  onClick={() => { setLoading(true); setError(""); setApplied((p) => ({ ...p, page: p.page + 1 })); }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
