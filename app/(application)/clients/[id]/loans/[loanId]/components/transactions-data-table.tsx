"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  MoreVertical,
  Download,
} from "lucide-react";

interface Transaction {
  id: number;
  officeName: string;
  externalId?: string;
  date?: number[];
  type?: {
    value: string;
    disbursement?: boolean;
    repayment?: boolean;
    repaymentAtDisbursement?: boolean;
    accrual?: boolean;
  };
  amount: number;
  principalPortion: number;
  interestPortion: number;
  feeChargesPortion: number;
  penaltyChargesPortion: number;
  outstandingLoanBalance: number;
  transactionId?: string;
}

interface TransactionsDataTableProps {
  transactions: Transaction[];
  clientId: string | number;
  loanId: string | number;
  currencyCode: string;
  onExport?: () => void;
}

type SortField = "date" | "type" | "amount" | "principalPortion" | "interestPortion" | "outstandingLoanBalance";
type SortDirection = "asc" | "desc";

const formatCurrency = (amount: number | undefined, currencyCode: string) => {
  if (amount === undefined || amount === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateArray?: number[]) => {
  if (!dateArray || dateArray.length !== 3) return "";
  const [year, month, day] = dateArray;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function TransactionsDataTable({
  transactions,
  clientId,
  loanId,
  currencyCode,
  onExport,
}: TransactionsDataTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Get unique transaction types for filter
  const transactionTypes = useMemo(() => {
    const types = Array.from(
      new Set(transactions.map((t) => t.type?.value).filter(Boolean))
    );
    return types.sort();
  }, [transactions]);

  // Filter and sort data
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      // Type filter
      if (typeFilter !== "all") {
        if (!transaction.type) return false;
        if (typeFilter === "repaymentAtDisbursement" && !transaction.type.repaymentAtDisbursement) return false;
        else if (typeFilter !== "repaymentAtDisbursement" && !(transaction.type as any)[typeFilter]) return false;
      }

      // Search filter
      if (!searchTerm) return true;
      const query = searchTerm.toLowerCase();
      return (
        String(transaction.officeName || "").toLowerCase().includes(query) ||
        String(transaction.externalId || "").toLowerCase().includes(query) ||
        String(transaction.type?.value || "").toLowerCase().includes(query)
      );
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle special cases for sorting
      if (sortField === "date") {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        
        const aDate = new Date(a.date[0], a.date[1] - 1, a.date[2]);
        const bDate = new Date(b.date[0], b.date[1] - 1, b.date[2]);
        aValue = aDate.getTime();
        bValue = bDate.getTime();
      } else if (sortField === "type") {
        aValue = a.type?.value || "";
        bValue = b.type?.value || "";
      }

      // Convert to lowercase for string comparison
      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === "string") {
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [transactions, searchTerm, typeFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "all";

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const getTransactionRef = (transaction: Transaction): string | undefined => {
    if (!transaction) return undefined;
    if (typeof transaction.transactionId === 'string' && /^L\d+$/.test(transaction.transactionId)) {
      return transaction.transactionId;
    }
    if (typeof transaction.id === 'number') return `L${transaction.id}`;
    if (typeof transaction.externalId === 'string' && /^L\d+$/.test(transaction.externalId)) {
      return transaction.externalId;
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Search (office, external id, type)"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 max-w-sm"
          />
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="disbursement">Disbursement</SelectItem>
              <SelectItem value="repayment">Repayment</SelectItem>
              <SelectItem value="repaymentAtDisbursement">Repayment (at disbursement)</SelectItem>
              <SelectItem value="accrual">Accrual</SelectItem>
              {transactionTypes.map((type) => (
                <SelectItem key={type} value={type.toLowerCase().replace(/\s+/g, '')}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => {
              setItemsPerPage(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {startIndex + 1} to{" "}
          {Math.min(endIndex, filteredAndSortedTransactions.length)} of{" "}
          {filteredAndSortedTransactions.length} transactions
          {hasActiveFilters && ` (filtered from ${transactions.length} total)`}
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filters active</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Id</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>External Id</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("date")}
                >
                  Transaction Date
                  {getSortIcon("date")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("type")}
                >
                  Transaction Type
                  {getSortIcon("type")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("amount")}
                >
                  Amount
                  {getSortIcon("amount")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("principalPortion")}
                >
                  Principal
                  {getSortIcon("principalPortion")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("interestPortion")}
                >
                  Interest
                  {getSortIcon("interestPortion")}
                </Button>
              </TableHead>
              <TableHead>Fees</TableHead>
              <TableHead>Penalties</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("outstandingLoanBalance")}
                >
                  Loan Balance
                  {getSortIcon("outstandingLoanBalance")}
                </Button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No transactions found</p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedTransactions.map((transaction, index) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{startIndex + index + 1}</TableCell>
                  <TableCell>{transaction.id}</TableCell>
                  <TableCell>{transaction.officeName}</TableCell>
                  <TableCell>{transaction.externalId || ""}</TableCell>
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell>{transaction.type?.value || ""}</TableCell>
                  <TableCell>{formatCurrency(transaction.amount, currencyCode)}</TableCell>
                  <TableCell>{formatCurrency(transaction.principalPortion, currencyCode)}</TableCell>
                  <TableCell>{formatCurrency(transaction.interestPortion, currencyCode)}</TableCell>
                  <TableCell>{formatCurrency(transaction.feeChargesPortion, currencyCode)}</TableCell>
                  <TableCell>{formatCurrency(transaction.penaltyChargesPortion, currencyCode)}</TableCell>
                  <TableCell>{formatCurrency(transaction.outstandingLoanBalance, currencyCode)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            const txId = transaction.id;
                            if (!txId) {
                              alert('No transaction id found for this row');
                              return;
                            }
                            router.push(`/clients/${clientId}/loans/${loanId}/transactions/${encodeURIComponent(String(txId))}`);
                          }}
                        >
                          View Transaction
                        </DropdownMenuItem>
                        {(transaction?.type?.repaymentAtDisbursement || transaction?.type?.accrual) && (
                          <DropdownMenuItem
                            onClick={() => {
                              const df = "dd MMMM yyyy";
                              const date = transaction?.date;
                              const formatDateForAPI = (a?: number[]) => {
                                if (!a || a.length !== 3) return "";
                                const [y, m, d] = a;
                                const month = new Date(y, m - 1, d).toLocaleString('en-US', { month: 'long' });
                                return `${d} ${month} ${y}`;
                              };
                              fetch(`/api/fineract/loans/${loanId}/transactions/${transaction.id}?command=undo`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  dateFormat: df, 
                                  locale: 'en', 
                                  transactionAmount: 0, 
                                  transactionDate: formatDateForAPI(date) 
                                })
                              }).then(res => {
                                if (!res.ok) throw new Error('Undo failed');
                                router.refresh();
                              }).catch(() => alert('Undo failed'));
                            }}
                          >
                            Undo Transaction
                          </DropdownMenuItem>
                        )}
                        {(transaction?.type?.repaymentAtDisbursement || transaction?.type?.accrual) && (
                          <DropdownMenuItem
                            onClick={() => {
                              const url = `/api/fineract/reports?name=Loan%20Transaction%20Receipt&output-type=PDF&R_transactionId=${encodeURIComponent(String(transaction.id))}`;
                              window.open(url, '_blank');
                            }}
                          >
                            View Receipts
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            const ref = getTransactionRef(transaction);
                            if (!ref) {
                              alert('No valid transaction reference found for this row');
                              return;
                            }
                            router.push(`/clients/${clientId}/loans/${loanId}/journal-entries?transactionId=${encodeURIComponent(ref)}`);
                          }}
                        >
                          View Journal Entry
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) {
                      handlePageChange(currentPage - 1);
                    }
                  }}
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, index, array) => {
                  const showEllipsisBefore =
                    index > 0 && page - array[index - 1] > 1;

                  return (
                    <React.Fragment key={page}>
                      {showEllipsisBefore && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(page);
                          }}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </React.Fragment>
                  );
                })}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) {
                      handlePageChange(currentPage + 1);
                    }
                  }}
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
