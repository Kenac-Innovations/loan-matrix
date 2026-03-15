/**
 * Format currency utility
 * 
 * IMPORTANT: Currency defaults are loaded dynamically from Fineract via the
 * CurrencyProvider context. These standalone functions are for use in:
 * - Server components
 * - API routes
 * - Non-React contexts
 * 
 * For React components, prefer using the useCurrency() hook from
 * @/contexts/currency-context which automatically uses the organization's
 * currency from Fineract.
 */

/**
 * Normalize currency code - converts deprecated ZMK to ZMW.
 * Fineract may return ZMK (old Zambian Kwacha code pre-2013 redenomination).
 * If no code is provided, returns undefined so the caller can apply their own default.
 */
export const normalizeCurrencyCode = (code: string | undefined | null): string | undefined => {
  if (!code) return undefined;
  // Convert old ZMK (Zambian Kwacha pre-2013) to ZMW (current Zambian Kwacha)
  if (code.toUpperCase() === "ZMK") return "ZMW";
  return code;
};

/**
 * Format a monetary amount with the given currency code.
 * The currency code should be provided by the caller (from Fineract data, loan data, etc.).
 * If no currency is provided, formats as a plain number without a currency symbol.
 */
export const formatCurrency = (
  amount: number | undefined | null,
  currencyCode?: string
): string => {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "-";
  }
  
  // Normalize currency code (convert ZMK to ZMW)
  const normalizedCode = normalizeCurrencyCode(currencyCode);
  
  if (!normalizedCode) {
    // No currency code available — format as plain number
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for currency codes not supported by Intl
    return `${normalizedCode} ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

/**
 * Format currency with explicit symbol (useful when Intl doesn't support the currency)
 */
export const formatCurrencyWithSymbol = (
  amount: number | undefined | null,
  symbol: string = "",
  decimalPlaces: number = 2
): string => {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "-";
  }
  
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  })}`;
};

/**
 * Format amount without currency symbol
 */
export const formatAmount = (
  amount: number | undefined | null,
  decimalPlaces: number = 2
): string => {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "-";
  }
  
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
};
