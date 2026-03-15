"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FineractClient {
  id: number;
  accountNo: string;
  displayName: string;
  firstname: string;
  lastname: string;
  mobileNo?: string;
  emailAddress?: string;
  status: {
    id: number;
    code: string;
    value: string;
  };
  active: boolean;
  activationDate?: string | number[];
  officeName: string;
  timeline: {
    submittedOnDate: string | number[];
    activatedOnDate?: string | number[];
  };
}

interface PaginationInfo {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Fetch offices for filter dropdown
const officesFetcher = (url: string) => fetch(url).then((res) => res.json());

export function ClientsTable() {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [navigatingToClient, setNavigatingToClient] = useState<number | null>(
    null
  );

  // Filter and sort states
  const [officeId, setOfficeId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [orderBy, setOrderBy] = useState<string>("id");
  const [sortOrder, setSortOrder] = useState<string>("DESC");

  // Fetch offices for filter dropdown
  const { data: officesData } = useSWR("/api/fineract/offices", officesFetcher);

  // Debounced search handler - requires minimum 2 characters
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);

      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // Only search if 2+ characters or empty (to clear search)
      if (value.length >= 2 || value.length === 0) {
        setIsSearching(value.length >= 2);

        // Set new timeout for debounced search (500ms for better UX)
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

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setQuery("");
    setOffset(0);
    setIsSearching(false);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  }, [searchTimeout]);

  // Build the API URL with query parameters
  const apiUrl = `/api/fineract/clients?offset=${offset}&limit=${limit}&orderBy=${orderBy}&sortOrder=${sortOrder}${
    query ? `&query=${encodeURIComponent(query)}` : ""
  }${officeId ? `&officeId=${officeId}` : ""}${
    status ? `&status=${status}` : ""
  }`;

  // Use keepPreviousData to prevent content flash during search
  const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
    keepPreviousData: true,
  });

  // Show skeleton only on initial load, not during search
  const showSkeleton = isLoading && !data;
  // Show subtle loading indicator when searching with existing data
  const showSearchingIndicator = (isLoading || isSearching) && data;

  // Handle different response formats from Fineract API
  const clients: FineractClient[] = (() => {
    if (!data) return [];

    // Handle the specific response format from your backend
    if (
      data.clients &&
      data.clients.pageItems &&
      Array.isArray(data.clients.pageItems)
    ) {
      return data.clients.pageItems;
    }

    // If data has a clients property (our wrapper)
    if (data.clients && Array.isArray(data.clients)) {
      return data.clients;
    }

    // If data is directly an array
    if (Array.isArray(data)) {
      return data;
    }

    // If data has pageItems (Fineract pagination format)
    if (data.pageItems && Array.isArray(data.pageItems)) {
      return data.pageItems;
    }

    // If data has content (another Fineract format)
    if (data.content && Array.isArray(data.content)) {
      return data.content;
    }

    // Fallback to empty array
    return [];
  })();

  // Get total count from the response
  const totalCount = (() => {
    if (!data) return 0;

    // Handle the specific response format from your backend
    if (data.clients && data.clients.totalFilteredRecords) {
      return data.clients.totalFilteredRecords;
    }

    // Fallback to array length
    return clients.length;
  })();

  const hasMore = clients.length === limit;

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  const handlePageSizeChange = (newLimit: number) => {
    setLimit(newLimit);
    setOffset(0); // Reset to first page when changing page size
  };

  const getStatusBadge = (
    status: FineractClient["status"],
    active: boolean
  ) => {
    if (active && status.code === "clientStatusType.active") {
      return (
        <Badge variant="outline" className="bg-green-500 text-white border-0">
          Active
        </Badge>
      );
    }
    if (status.code === "clientStatusType.pending") {
      return (
        <Badge variant="outline" className="bg-yellow-500 text-white border-0">
          Pending
        </Badge>
      );
    }
    if (status.code === "clientStatusType.closed") {
      return (
        <Badge variant="outline" className="bg-gray-500 text-white border-0">
          Closed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500 text-white border-0">
        {status.value}
      </Badge>
    );
  };

  const formatDate = (dateInput: string | number[] | undefined) => {
    if (!dateInput) return "Not specified";

    let date: Date;
    if (Array.isArray(dateInput) && dateInput.length === 3) {
      const [year, month, day] = dateInput;
      date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    } else if (typeof dateInput === "string") {
      date = new Date(dateInput);
    } else {
      return "Invalid date";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Only show skeleton on initial load (when there's no data yet)
  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load clients from Fineract</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get offices list
  const offices = officesData || [];

  // Clear all filters
  const handleClearFilters = () => {
    setOfficeId("");
    setStatus("");
    setOrderBy("id");
    setSortOrder("DESC");
    setOffset(0);
  };

  const hasActiveFilters =
    officeId || status || orderBy !== "id" || sortOrder !== "DESC";

  // Handle column sort click
  const handleSort = (column: string) => {
    if (orderBy === column) {
      // Toggle sort order if same column
      setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC");
    } else {
      // Set new column with DESC default
      setOrderBy(column);
      setSortOrder("DESC");
    }
    setOffset(0);
  };

  // Render sort indicator
  const SortIndicator = ({ column }: { column: string }) => {
    if (orderBy !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    }
    return sortOrder === "ASC" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  if (clients.length === 0) {
    return (
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            {isSearching || isLoading ? (
              <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              placeholder="Search by name or account number..."
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
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-3.5 w-3.5 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              {query || hasActiveFilters
                ? "No clients found matching your search or filters. Try adjusting your criteria."
                : "No clients found. Please check your Fineract connection."}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);
  const startRecord = offset + 1;
  const endRecord = Math.min(offset + limit, totalCount);

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-sm">
          {isSearching || isLoading ? (
            <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            placeholder="Search by name or account number..."
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Office Filter */}
          <Select
            value={officeId}
            onValueChange={(value) => {
              setOfficeId(value === "all" ? "" : value);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-[160px] h-9">
              <MapPin className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Offices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offices</SelectItem>
              {offices.map((office: any) => (
                <SelectItem key={office.id} value={office.id.toString()}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value === "all" ? "" : value);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-[140px] h-9">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {(officeId || status) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={handleClearFilters}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort("displayName")}
              >
                <div className="flex items-center">
                  Client
                  <SortIndicator column="displayName" />
                </div>
              </TableHead>
              <TableHead>Account No</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Status</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort("submittedOnDate")}
              >
                <div className="flex items-center">
                  Joined
                  <SortIndicator column="submittedOnDate" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow
                key={client.id}
                className={`cursor-pointer hover:bg-muted/50 ${
                  navigatingToClient === client.id ? "opacity-70" : ""
                }`}
                onClick={() => {
                  setNavigatingToClient(client.id);
                  router.push(`/clients/${client.id}`);
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={`/api/placeholder/36/36?text=${
                            client.firstname?.[0] || "U"
                          }${client.lastname?.[0] || "N"}`}
                          alt={client.displayName}
                        />
                        <AvatarFallback>
                          {client.firstname?.[0] || "U"}
                          {client.lastname?.[0] || "N"}
                        </AvatarFallback>
                      </Avatar>
                      {navigatingToClient === client.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{client.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {client.id}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-sm">{client.accountNo}</div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {client.mobileNo && (
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {client.mobileNo}
                      </div>
                    )}
                    {client.emailAddress && (
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" />
                        {client.emailAddress}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {client.officeName}
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(client.status, client.active)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    {formatDate(client.timeline.submittedOnDate)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Showing {startRecord} to {endRecord} of {totalCount} clients
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={limit.toString()}
              onValueChange={(value) => handlePageSizeChange(parseInt(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={pageSize.toString()}>
                    {pageSize}
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
                onClick={() => handlePageChange(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(offset + limit)}
                disabled={!hasMore}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
