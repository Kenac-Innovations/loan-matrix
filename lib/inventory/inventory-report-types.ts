import { z } from "zod";
export const INVENTORY_REPORTS = {
  availability: "Stock Availability and Value",
  reservations: "Reservations and Age",
  movements: "Stock Movement History",
  performance: "Monthly Stock Performance",
  exceptions: "Stock Reconciliation Exceptions",
} as const;
export type InventoryReportKind = keyof typeof INVENTORY_REPORTS;
export type InventoryReportFilters = {
  kind: InventoryReportKind;
  startDate?: string;
  endDate?: string;
  officeId?: number;
  itemId?: string;
  currencyCode: string;
  status?: string;
  page: number;
  pageSize: number;
};
export type InventoryReportResult = {
  columns: { key: string; type: "text" | "date" | "decimal" | "integer" }[];
  rows: Record<string, string | null>[];
  totalRows: number;
  totals: Record<string, string>;
  generatedAt: string;
  positionBasis: "current" | "activity";
  timezone: "UTC";
};
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");
const schema = z
  .object({
    kind: z
      .enum([
        "availability",
        "reservations",
        "movements",
        "performance",
        "exceptions",
      ])
      .default("availability"),
    startDate: date.optional(),
    endDate: date.optional(),
    officeId: z.coerce.number().int().positive().optional(),
    itemId: z.string().min(1).max(100).optional(),
    currencyCode: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("USD"),
    status: z
      .enum([
        "DRAFT",
        "RESERVED",
        "PROCESSING",
        "ISSUED",
        "REPAID",
        "FAILED",
        "RETURNED",
        "CANCELLED",
      ])
      .optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .refine(
    (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
    "Start date must not follow end date",
  );
export function parseInventoryReportFilters(
  params: URLSearchParams,
): InventoryReportFilters {
  return schema.parse(
    Object.fromEntries([...params].filter(([, v]) => v !== "")),
  );
}
