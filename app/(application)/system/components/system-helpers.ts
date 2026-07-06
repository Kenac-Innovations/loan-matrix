import { format } from "date-fns";
import type { SystemPermission } from "@/shared/types/system";

export function formatSystemLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function groupPermissions(permissions: SystemPermission[]) {
  return permissions.reduce<Record<string, SystemPermission[]>>(
    (groups, permission) => {
      const key = permission.grouping || "other";
      groups[key] = groups[key] ?? [];
      groups[key].push(permission);
      return groups;
    },
    {}
  );
}

export function formatFineractDate(value?: string | number | number[] | null) {
  if (!value) return "N/A";

  if (Array.isArray(value)) {
    const [year, month, day, hour, minute, second] = value;
    if (!year || !month || !day) return "N/A";

    const date = new Date(
      year,
      month - 1,
      day,
      hour ?? 0,
      minute ?? 0,
      second ?? 0
    );

    return date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: value.length > 3 ? "short" : undefined,
    });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle:
      typeof value === "number" ||
      (typeof value === "string" && value.includes(":"))
        ? "short"
        : undefined,
  });
}

export function formatDateInputForFineract(value: string) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "dd MMMM yyyy");
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
