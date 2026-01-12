"use client";

import { useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { LoansDataTable, Loan } from "@/components/tables/loans-data-table";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function transformLoanData(rawLoan: any, payoutStatusMap?: Map<number, string>): Loan {
  const loanId = rawLoan.id;
  return {
    id: loanId?.toString() || "",
    accountNo: rawLoan.accountNo || "",
    clientName:
      rawLoan.clientName || rawLoan.clientId?.toString() || "Unknown Client",
    clientId: rawLoan.clientId?.toString() || "",
    productName:
      rawLoan.productName || rawLoan.loanProductName || "Unknown Product",
    status: rawLoan.status?.value || rawLoan.status || "Unknown",
    principal: parseFloat(rawLoan.principal || rawLoan.principalAmount || "0"),
    currency: rawLoan.currency?.code || rawLoan.currency || "ZMW",
    disbursedAmount: parseFloat(rawLoan.disbursedAmount || "0"),
    outstandingBalance: parseFloat(rawLoan.outstandingBalance || "0"),
    daysInArrears: parseInt(rawLoan.daysInArrears || "0"),
    approvedOnDate: rawLoan.approvedOnDate || "",
    disbursedOnDate: rawLoan.disbursedOnDate || "",
    maturityDate: rawLoan.maturityDate || "",
    payoutStatus: payoutStatusMap?.get(loanId) || undefined,
  };
}

export default function LoansPage() {
  const [searchInput, setSearchInput] = useState("");
  const [serverQuery, setServerQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Fetch initial loans (5000 for browsing)
  const { data: initialData, error: initialError, isLoading: initialLoading } = useSWR(
    `/api/fineract/loans?limit=5000`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch payout statuses for loans
  const { data: payoutData } = useSWR(
    `/api/loans/payout-statuses`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Create a map of loan ID to payout status
  const payoutStatusMap = useMemo(() => {
    const map = new Map<number, string>();
    if (payoutData?.payouts && Array.isArray(payoutData.payouts)) {
      payoutData.payouts.forEach((payout: any) => {
        map.set(payout.fineractLoanId, payout.status);
      });
    }
    return map;
  }, [payoutData]);

  // Server-side search when user types 3+ characters
  const { data: searchData, isLoading: searchLoading } = useSWR(
    serverQuery.length >= 3 ? `/api/fineract/loans?query=${encodeURIComponent(serverQuery)}&limit=500` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      const timeout = setTimeout(() => {
        // Server search for 3+ characters
        setServerQuery(value.length >= 3 ? value : "");
      }, 500);

      setSearchTimeout(timeout);
    },
    [searchTimeout]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setServerQuery("");
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  }, [searchTimeout]);

  // Parse loans from response
  const parseLoans = (data: any): any[] => {
    if (!data) return [];
    if (data.pageItems && Array.isArray(data.pageItems)) return data.pageItems;
    if (Array.isArray(data)) return data;
    return [];
  };

  const initialLoans: Loan[] = parseLoans(initialData).map((loan) => transformLoanData(loan, payoutStatusMap));
  const searchLoans: Loan[] = parseLoans(searchData).map((loan) => transformLoanData(loan, payoutStatusMap));

  // Combine and deduplicate: search results + initial loans filtered by search
  const loans = useMemo(() => {
    if (!serverQuery) {
      // No search - just filter initial loans client-side
      if (!searchInput) return initialLoans;
      const lowerSearch = searchInput.toLowerCase();
      return initialLoans.filter(
        (loan) =>
          loan.clientName.toLowerCase().includes(lowerSearch) ||
          loan.accountNo.toLowerCase().includes(lowerSearch)
      );
    }

    // Combine server search results with matching initial loans
    const combinedMap = new Map<string, Loan>();
    
    // Add server search results first (these are from ALL loans)
    searchLoans.forEach((loan) => combinedMap.set(loan.id, loan));
    
    // Add matching loans from initial set that might not be in search results
    const lowerSearch = serverQuery.toLowerCase();
    initialLoans
      .filter(
        (loan) =>
          loan.clientName.toLowerCase().includes(lowerSearch) ||
          loan.accountNo.toLowerCase().includes(lowerSearch)
      )
      .forEach((loan) => {
        if (!combinedMap.has(loan.id)) {
          combinedMap.set(loan.id, loan);
        }
      });

    return Array.from(combinedMap.values());
  }, [initialLoans, searchLoans, serverQuery, searchInput]);

  const isLoading = initialLoading;
  const isSearching = searchLoading;
  const error = initialError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
          <p className="text-muted-foreground">
            Manage and track all loan applications
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <span>Failed to load loans from Fineract</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
          <p className="text-muted-foreground">
            Manage and track all loan applications and disbursements ({loans.length} total)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Loans</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              {isSearching ? (
                <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                placeholder="Search by client name or account number..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchInput && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={handleClearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {serverQuery && (
              <span className="text-sm text-muted-foreground">
                {isSearching ? "Searching..." : `Found ${loans.length} results`}
              </span>
            )}
          </div>
          
          <LoansDataTable data={loans} />
        </CardContent>
      </Card>
    </div>
  );
}
