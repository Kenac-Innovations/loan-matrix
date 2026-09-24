export type OrgCurrencyForWrite = {
  rawCode: string;
  displayCode: string;
};

function normalizeCode(code: string): string {
  return code.toUpperCase() === "ZMK" ? "ZMW" : code;
}

/**
 * Parse the selected organization currency returned by Fineract.
 *
 * This is intentionally dependency-free and pure so write callers can
 * validate the exact selected-currency payload without relying on a cache.
 */
export function parseOrgCurrencyForWrite(data: unknown): OrgCurrencyForWrite {
  const selectedCurrencyOptions =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as { selectedCurrencyOptions?: unknown }).selectedCurrencyOptions
      : undefined;

  if (!Array.isArray(selectedCurrencyOptions) || selectedCurrencyOptions.length === 0) {
    throw new Error("Fineract returned no selected organization currency");
  }

  const selectedCurrency = selectedCurrencyOptions[0];
  const rawCode =
    selectedCurrency &&
    typeof selectedCurrency === "object" &&
    typeof (selectedCurrency as { code?: unknown }).code === "string"
      ? (selectedCurrency as { code: string }).code.trim().toUpperCase()
      : "";

  if (!rawCode) {
    throw new Error("Fineract returned a malformed selected organization currency");
  }

  return {
    rawCode,
    displayCode: normalizeCode(rawCode).toUpperCase(),
  };
}
