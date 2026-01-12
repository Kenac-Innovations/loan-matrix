/**
 * Format currency utility
 * 
 * Note: For React components, prefer using the useCurrency() hook from
 * @/contexts/currency-context which automatically uses the organization's
 * currency from Fineract.
 * 
 * This standalone function is for use in:
 * - Server components
 * - API routes
 * - Non-React contexts
 */

// Default currency configuration (Zambian Kwacha)
const DEFAULT_CURRENCY_CODE = "ZMW";
const DEFAULT_CURRENCY_SYMBOL = "K";

/**
 * Normalize currency code - converts deprecated ZMK to ZMW
 * ZMK was the old Zambian Kwacha code before redenomination in 2013
 */
export const normalizeCurrencyCode = (code: string | undefined | null): string => {
  if (!code) return DEFAULT_CURRENCY_CODE;
  // Convert old ZMK (Zambian Kwacha pre-2013) to ZMW (current Zambian Kwacha)
  if (code.toUpperCase() === "ZMK") return "ZMW";
  return code;
};

export const formatCurrency = (
  amount: number | undefined | null,
  currencyCode: string = DEFAULT_CURRENCY_CODE
): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "-";
  }
  
  // Normalize currency code (convert ZMK to ZMW)
  const normalizedCode = normalizeCurrencyCode(currencyCode);
  
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported currency codes
    return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-US", {
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
  symbol: string = DEFAULT_CURRENCY_SYMBOL,
  decimalPlaces: number = 2
): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
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
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "-";
  }
  
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
};
