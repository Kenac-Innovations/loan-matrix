const FINERACT_BUSINESS_TIME_ZONE = "Africa/Harare";

type FineractBusinessDateValue = Date | string | number | null | undefined;

/**
 * Formats a persisted loan calendar date for Fineract without depending on
 * the timezone of the browser or application pod.
 *
 * Loan dates are selected as calendar days. Existing records may represent a
 * Harare midnight as the previous UTC day, so formatting them in the Fineract
 * business timezone preserves the day the user selected.
 */
export function formatFineractBusinessDate(
  value: FineractBusinessDateValue,
): string | null {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: FINERACT_BUSINESS_TIME_ZONE,
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  return day && month && year ? `${day} ${month} ${year}` : null;
}
