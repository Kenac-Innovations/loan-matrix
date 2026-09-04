const FINERACT_BUSINESS_TIME_ZONE = "Africa/Harare";

export type FineractBusinessDateValue =
  | Date
  | string
  | number
  | null
  | undefined;

function getFineractBusinessDateParts(
  value: FineractBusinessDateValue,
  month: "long" | "2-digit",
) {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month,
    year: "numeric",
    timeZone: FINERACT_BUSINESS_TIME_ZONE,
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value;
  const formattedMonth = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  return day && formattedMonth && year
    ? { day, month: formattedMonth, year }
    : null;
}

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
  const parts = getFineractBusinessDateParts(value, "long");

  return parts ? `${parts.day} ${parts.month} ${parts.year}` : null;
}

/**
 * Compares loan calendar days in the same timezone that is used when the
 * value is submitted to Fineract. This intentionally ignores the time of day.
 */
export function isFineractBusinessDateAfter(
  value: FineractBusinessDateValue,
  reference: FineractBusinessDateValue,
): boolean {
  const valueParts = getFineractBusinessDateParts(value, "2-digit");
  const referenceParts = getFineractBusinessDateParts(reference, "2-digit");

  if (!valueParts || !referenceParts) return false;

  const valueKey = `${valueParts.year}-${valueParts.month}-${valueParts.day}`;
  const referenceKey = `${referenceParts.year}-${referenceParts.month}-${referenceParts.day}`;

  return valueKey > referenceKey;
}

/**
 * Returns the latest safe submission date for a schedule. Fineract rejects a
 * submitted-on date after the expected disbursement date (and may reject it as
 * future-dated when the tenant business date trails the wall clock). The
 * caller can pass the live loan-template date as an additional upper bound.
 */
export function normalizeFineractSubmittedOnDate(
  submittedOn: FineractBusinessDateValue,
  expectedDisbursementDate: FineractBusinessDateValue,
  templateExpectedDisbursementDate?: FineractBusinessDateValue,
): FineractBusinessDateValue {
  let latestAllowedDate = expectedDisbursementDate;

  if (
    templateExpectedDisbursementDate &&
    (!latestAllowedDate ||
      isFineractBusinessDateAfter(
        latestAllowedDate,
        templateExpectedDisbursementDate,
      ))
  ) {
    latestAllowedDate = templateExpectedDisbursementDate;
  }

  return latestAllowedDate &&
    isFineractBusinessDateAfter(submittedOn, latestAllowedDate)
    ? latestAllowedDate
    : submittedOn;
}
