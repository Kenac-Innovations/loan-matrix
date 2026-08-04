import { format } from "date-fns";

export type ReportDateValue =
  | string
  | number
  | Date
  | [number, number, number]
  | null
  | undefined;

const ISO_DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_FIRST_DATE_REGEX = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;

export function isReportDateArray(
  value: unknown
): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((part) => typeof part === "number")
  );
}

export function isReportDateLike(value: unknown): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (isReportDateArray(value)) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return (
    ISO_DATE_ONLY_REGEX.test(trimmed) || DAY_FIRST_DATE_REGEX.test(trimmed)
  );
}

export function parseReportDateValue(value: ReportDateValue): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (isReportDateArray(value)) {
    const [year, month, day] = value;
    return new Date(year, month - 1, day);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    const isoDateMatch = trimmed.match(ISO_DATE_ONLY_REGEX);
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const dayFirstMatch = trimmed.match(DAY_FIRST_DATE_REGEX);
    if (dayFirstMatch) {
      const [, day, month, year] = dayFirstMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsedDate = new Date(trimmed);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

export function formatReportDateValue(
  value: ReportDateValue,
  fallback = ""
): string {
  const parsedDate = parseReportDateValue(value);
  return parsedDate ? format(parsedDate, "dd/MM/yyyy") : fallback;
}
