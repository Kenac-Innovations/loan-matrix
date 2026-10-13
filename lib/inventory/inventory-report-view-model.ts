import type {
  InventoryReportFilters,
  InventoryReportResult,
} from "./inventory-report-types";
export function inventoryReportQuery(
  filters: InventoryReportFilters,
): URLSearchParams {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    if (
      ["availability", "reservations"].includes(filters.kind) &&
      ["startDate", "endDate"].includes(key)
    )
      continue;
    if (key === "status" && filters.kind !== "reservations") continue;
    p.set(key, String(value));
  }
  return p;
}
export function formatInventoryReportCell(
  value: string | null,
  type: InventoryReportResult["columns"][number]["type"],
) {
  if (value === null || value === "") return "Not captured";
  return type === "date"
    ? value.slice(0, 16).replace("T", " ") + " UTC"
    : value;
}
