"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

export interface Currency {
  code: string;
  name: string;
  decimalPlaces: number;
  inMultiplesOf: number;
  displaySymbol: string;
  nameCode: string;
  displayLabel: string;
}

interface CurrencyContextType {
  currency: Currency | null;
  currencyCode: string;
  currencySymbol: string;
  currencies: Currency[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  formatCurrency: (amount: number | undefined | null) => string;
  formatAmount: (amount: number | undefined | null, showSymbol?: boolean) => string;
}

/**
 * Placeholder currency used while the real currency is loading from Fineract.
 * This gets replaced once the CurrencyProvider fetches from /api/fineract/currencies.
 */
const LOADING_PLACEHOLDER_CURRENCY: Currency = {
  code: "USD",
  name: "US Dollar",
  decimalPlaces: 2,
  inMultiplesOf: 1,
  displaySymbol: "$",
  nameCode: "currency.USD",
  displayLabel: "US Dollar ($)",
};

/**
 * Normalize currency code - converts deprecated ZMK to ZMW.
 * Fineract may return ZMK (old Zambian Kwacha code pre-2013 redenomination).
 * For any other code (including null/undefined), returns the code as-is.
 */
export function normalizeCurrencyCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  // Convert old ZMK (Zambian Kwacha pre-2013) to ZMW (current Zambian Kwacha)
  if (code.toUpperCase() === "ZMK") return "ZMW";
  return code;
}

/**
 * Normalize a currency object - converts ZMK to ZMW
 */
function normalizeCurrency(currency: Currency): Currency {
  if (currency.code?.toUpperCase() === "ZMK") {
    return {
      ...currency,
      code: "ZMW",
      nameCode: currency.nameCode?.replace(/ZMK/gi, "ZMW") || `currency.ZMW`,
      displayLabel: currency.displayLabel?.replace(/ZMK/gi, "ZMW") || currency.displayLabel,
    };
  }
  return currency;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: null,
  currencyCode: "",
  currencySymbol: "",
  currencies: [],
  isLoading: true,
  error: null,
  refetch: async () => {},
  formatCurrency: () => "-",
  formatAmount: () => "-",
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrencies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/fineract/currencies");
      
      if (!response.ok) {
        throw new Error("Failed to fetch currencies");
      }
      
      const data = await response.json();
      
      // Handle different response structures from Fineract
      const rawCurrencyList: Currency[] = Array.isArray(data.selectedCurrencyOptions)
        ? data.selectedCurrencyOptions
        : Array.isArray(data.currencyOptions)
        ? data.currencyOptions
        : Array.isArray(data)
        ? data
        : [];
      
      // Normalize all currencies (convert ZMK to ZMW)
      const currencyList = rawCurrencyList.map(normalizeCurrency);
      
      setCurrencies(currencyList);
      
      // Set the primary/default currency (first in the list from Fineract)
      if (currencyList.length > 0) {
        const primaryCurrency = currencyList[0];
        setCurrency(primaryCurrency);
      }
    } catch (err) {
      console.error("Error fetching currencies:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch currencies");
      // Keep null currency on error — components should handle this gracefully
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  // The effective currency (use loaded currency or placeholder while loading)
  const effectiveCurrency = currency || LOADING_PLACEHOLDER_CURRENCY;

  // Format currency with the organization's currency from Fineract
  const formatCurrency = useCallback(
    (amount: number | undefined | null): string => {
      if (amount === undefined || amount === null || Number.isNaN(amount)) {
        return "-";
      }
      
      const code = normalizeCurrencyCode(effectiveCurrency.code) || effectiveCurrency.code;
      
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: code,
          minimumFractionDigits: effectiveCurrency.decimalPlaces ?? 2,
          maximumFractionDigits: effectiveCurrency.decimalPlaces ?? 2,
        }).format(amount);
      } catch {
        // Fallback for unsupported currency codes
        const symbol = effectiveCurrency.displaySymbol || code;
        return `${symbol}${amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
    },
    [effectiveCurrency]
  );

  // Format amount with optional symbol
  const formatAmount = useCallback(
    (amount: number | undefined | null, showSymbol: boolean = true): string => {
      if (amount === undefined || amount === null || Number.isNaN(amount)) {
        return "-";
      }
      
      if (showSymbol) {
        return formatCurrency(amount);
      }
      
      return amount.toLocaleString("en-US", {
        minimumFractionDigits: effectiveCurrency.decimalPlaces ?? 2,
        maximumFractionDigits: effectiveCurrency.decimalPlaces ?? 2,
      });
    },
    [effectiveCurrency, formatCurrency]
  );

  const value: CurrencyContextType = {
    currency: effectiveCurrency,
    currencyCode: normalizeCurrencyCode(effectiveCurrency.code) || effectiveCurrency.code,
    currencySymbol: effectiveCurrency.displaySymbol || "",
    currencies,
    isLoading,
    error,
    refetch: fetchCurrencies,
    formatCurrency,
    formatAmount,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

/**
 * Standalone format function for use outside of React components (e.g., API routes).
 * The currencyCode should come from the data being processed (loan, transaction, etc.).
 */
export function formatCurrencyStandalone(
  amount: number | undefined | null,
  currencyCode?: string,
  displaySymbol?: string
): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "-";
  }
  
  // Normalize currency code (convert ZMK to ZMW)
  const normalizedCode = normalizeCurrencyCode(currencyCode);
  
  if (!normalizedCode) {
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
    const symbol = displaySymbol || normalizedCode;
    return `${symbol}${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
