"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { LoansDataTable, Loan } from "@/components/tables/loans-data-table";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function transformLoanData(rawLoan: any): Loan {
  return {
    id: rawLoan.id?.toString() || "",
    accountNo: rawLoan.accountNo || "",
    clientName:
      rawLoan.clientName || rawLoan.clientId?.toString() || "Unknown Client",
    clientId: rawLoan.clientId?.toString() || "",
    productName:
      rawLoan.productName || rawLoan.loanProductName || "Unknown Product",
    status: rawLoan.status?.value || rawLoan.status || "Unknown",
    principal: parseFloat(rawLoan.principal || rawLoan.principalAmount || "0"),
    currency: rawLoan.currency?.code || rawLoan.currency || "USD",
    disbursedAmount: parseFloat(rawLoan.disbursedAmount || "0"),
    outstandingBalance: parseFloat(rawLoan.outstandingBalance || "0"),
    daysInArrears: parseInt(rawLoan.daysInArrears || "0"),
    approvedOnDate: rawLoan.approvedOnDate || "",
    disbursedOnDate: rawLoan.disbursedOnDate || "",
    maturityDate: rawLoan.maturityDate || "",
  };
}

export default function LoansPage() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search handler - requires minimum 2 characters
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // Only search if 2+ characters or empty (to clear search)
      if (value.length >= 2 || value.length === 0) {
        setIsSearching(value.length >= 2);

        const timeout = setTimeout(() => {
          setQuery(value.length >= 2 ? value : "");
          setIsSearching(false);
        }, 500);

        setSearchTimeout(timeout);
      }
    },
    [searchTimeout]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setQuery("");
    setIsSearching(false);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  }, [searchTimeout]);

  // Build API URL - use server-side search when query exists
  const apiUrl = query
    ? `/api/fineract/loans?query=${encodeURIComponent(query)}&limit=100`
    : `/api/fineract/loans?limit=500`;

  const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
    keepPreviousData: true,
  });

  // Parse loans from response
  const rawItems: any[] = (() => {
    if (!data) return [];
    if (data.pageItems && Array.isArray(data.pageItems)) return data.pageItems;
    if (Array.isArray(data)) return data;
    return [];
  })();

  const loans: Loan[] = rawItems.map(transformLoanData);
  const showSkeleton = isLoading && !data;

  if (showSkeleton) {
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
            Manage and track all loan applications and disbursements
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Loans</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 && !query ? (
            <div className="text-center py-6 text-muted-foreground">
              No loans found.
            </div>
          ) : (
            <LoansDataTable 
              data={loans} 
              hideSearch={true}
              serverSearchInput={
                <div className="relative flex-1 max-w-sm">
                  {isSearching || isLoading ? (
                    <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
                  ) : (
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  )}
                  <Input
                    placeholder="Search by client name or account..."
                    value={searchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 pr-10 h-9"
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
              }
              searchResultInfo={query ? `Showing results for "${query}" (${loans.length} found)` : undefined}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
