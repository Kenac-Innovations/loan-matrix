"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  MoreHorizontal,
  Calendar,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface Loan {
  id: number;
  accountNo: string;
  clientId: number;
  clientName: string;
  productName?: string;
  loanProductName?: string;
  status: {
    id: number;
    code: string;
    value: string;
  };
  principal: number;
  currency?: {
    code: string;
  };
  summary?: {
    principalDisbursed: number;
    principalOutstanding: number;
    totalOutstanding: number;
  };
  timeline?: {
    submittedOnDate?: number[];
    approvedOnDate?: number[];
    expectedDisbursementDate?: number[];
    actualDisbursementDate?: number[];
    expectedMaturityDate?: number[];
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LoansPage() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
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
          setOffset(0);
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
    setOffset(0);
    setIsSearching(false);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  }, [searchTimeout]);

  // Build API URL
  const apiUrl = `/api/fineract/loans?offset=${offset}&limit=${limit}${
    query ? `&query=${encodeURIComponent(query)}` : ""
  }`;

  // Use keepPreviousData to prevent content flash during search
  const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
    keepPreviousData: true,
  });

  // Show skeleton only on initial load
  const showSkeleton = isLoading && !data;
  const showSearchingIndicator = (isLoading || isSearching) && data;

  // Parse loans from response
  const loans: Loan[] = (() => {
    if (!data) return [];
    if (data.pageItems && Array.isArray(data.pageItems)) return data.pageItems;
    if (Array.isArray(data)) return data;
    return [];
  })();

  const totalCount = data?.totalFilteredRecords || loans.length;
  const hasMore = loans.length === limit;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const getStatusBadge = (status: Loan["status"]) => {
    const statusValue = status?.value?.toLowerCase() || "";

    if (statusValue.includes("active")) {
      return (
        <Badge className="bg-green-500 text-white border-0">
          {status.value}
        </Badge>
      );
    }
    if (statusValue.includes("approved")) {
      return (
        <Badge className="bg-blue-500 text-white border-0">
          {status.value}
        </Badge>
      );
    }
    if (statusValue.includes("pending") || statusValue.includes("submitted")) {
      return (
        <Badge className="bg-yellow-500 text-white border-0">
          {status.value}
        </Badge>
      );
    }
    if (statusValue.includes("closed")) {
      return (
        <Badge className="bg-gray-500 text-white border-0">
          {status.value}
        </Badge>
      );
    }
    if (statusValue.includes("rejected") || statusValue.includes("withdrawn")) {
      return (
        <Badge className="bg-red-500 text-white border-0">{status.value}</Badge>
      );
    }
    return (
      <Badge className="bg-gray-500 text-white border-0">{status.value}</Badge>
    );
  };

  const formatDate = (dateInput: number[] | undefined) => {
    if (!dateInput || !Array.isArray(dateInput) || dateInput.length < 3)
      return "-";
    const [year, month, day] = dateInput;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency?: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
              <AlertCircle className="h-4 w-4" />
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
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative max-w-sm">
            {isSearching || isLoading ? (
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

          {loans.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              {query
                ? `No loans found matching "${query}". Try a different search term.`
                : "No loans found."}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Disbursement</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => (
                      <TableRow
                        key={loan.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          if (loan.clientId) {
                            window.location.href = `/clients/${loan.clientId}/loans/${loan.id}`;
                          }
                        }}
                      >
                        <TableCell>
                          <div className="font-mono text-sm">
                            {loan.accountNo}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {loan.clientName?.slice(0, 2).toUpperCase() ||
                                  "??"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {loan.clientName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID: {loan.clientId}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[150px] truncate">
                            {loan.productName || loan.loanProductName || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(loan.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatCurrency(
                              loan.principal,
                              loan.currency?.code
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatCurrency(
                              loan.summary?.totalOutstanding || 0,
                              loan.currency?.code
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(
                              loan.timeline?.actualDisbursementDate ||
                                loan.timeline?.expectedDisbursementDate
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/clients/${loan.clientId}/loans/${loan.id}`}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {offset + 1} to {Math.min(offset + limit, totalCount)}{" "}
                  of {totalCount} loans
                </p>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Rows per page</p>
                    <Select
                      value={limit.toString()}
                      onValueChange={(value) => {
                        setLimit(parseInt(value));
                        setOffset(0);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 20, 30, 50, 100].map((size) => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                        disabled={offset === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOffset(offset + limit)}
                        disabled={!hasMore}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
