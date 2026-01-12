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

const defaultCurrency: Currency = {
  code: "ZMW",
  name: "Zambian Kwacha",
  decimalPlaces: 2,
  inMultiplesOf: 1,
  displaySymbol: "K",
  nameCode: "currency.ZMW",
  displayLabel: "Zambian Kwacha (K)",
};

/**
 * Normalize currency code - converts deprecated ZMK to ZMW
 * ZMK was the old Zambian Kwacha code before redenomination
 */
export function normalizeCurrencyCode(code: string | undefined | null): string {
  if (!code) return "ZMW";
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
      nameCode: currency.nameCode?.replace(/ZMK/gi, "ZMW") || "currency.ZMW",
      displayLabel: currency.displayLabel?.replace(/ZMK/gi, "ZMW") || "Zambian Kwacha (K)",
    };
  }
  return currency;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: defaultCurrency,
  currencyCode: defaultCurrency.code,
  currencySymbol: defaultCurrency.displaySymbol,
  currencies: [],
  isLoading: true,
  error: null,
  refetch: async () => {},
  formatCurrency: () => "-",
  formatAmount: () => "-",
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency | null>(defaultCurrency);
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
      
      // Set the primary/default currency (first in the list or find specific one)
      if (currencyList.length > 0) {
        // Try to find organization default currency, otherwise use first
        const primaryCurrency = currencyList[0];
        setCurrency(primaryCurrency);
      }
    } catch (err) {
      console.error("Error fetching currencies:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch currencies");
      // Keep default currency on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  // Format currency with the organization's currency
  const formatCurrency = useCallback(
    (amount: number | undefined | null): string => {
      if (amount === undefined || amount === null || isNaN(amount)) {
        return "-";
      }
      
      // Normalize currency code (convert ZMK to ZMW)
      const currencyCode = normalizeCurrencyCode(currency?.code) || defaultCurrency.code;
      
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currencyCode,
          minimumFractionDigits: currency?.decimalPlaces ?? 2,
          maximumFractionDigits: currency?.decimalPlaces ?? 2,
        }).format(amount);
      } catch {
        // Fallback for unsupported currency codes
        const symbol = currency?.displaySymbol || defaultCurrency.displaySymbol;
        return `${symbol}${amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
    },
    [currency]
  );

  // Format amount with optional symbol
  const formatAmount = useCallback(
    (amount: number | undefined | null, showSymbol: boolean = true): string => {
      if (amount === undefined || amount === null || isNaN(amount)) {
        return "-";
      }
      
      if (showSymbol) {
        return formatCurrency(amount);
      }
      
      return amount.toLocaleString("en-US", {
        minimumFractionDigits: currency?.decimalPlaces ?? 2,
        maximumFractionDigits: currency?.decimalPlaces ?? 2,
      });
    },
    [currency, formatCurrency]
  );

  const value: CurrencyContextType = {
    currency,
    currencyCode: normalizeCurrencyCode(currency?.code) || defaultCurrency.code,
    currencySymbol: currency?.displaySymbol || defaultCurrency.displaySymbol,
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

// Export a standalone format function for use outside of React components (e.g., API routes)
export function formatCurrencyStandalone(
  amount: number | undefined | null,
  currencyCode: string = "ZMW",
  displaySymbol: string = "K"
): string {
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
    return `${displaySymbol}${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
