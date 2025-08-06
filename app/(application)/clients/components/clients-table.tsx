"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from 'swr';
import {
  Eye,
  Edit,
  MoreHorizontal,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ClientsTable() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');

  // Build the API URL with query parameters
  const apiUrl = `/api/fineract/clients?offset=${offset}&limit=${limit}${query ? `&query=${encodeURIComponent(query)}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher);

  // Handle different response formats from Fineract API
  const clients: FineractClient[] = (() => {
    if (!data) return [];
    
    // Handle the specific response format from your backend
    if (data.clients && data.clients.pageItems && Array.isArray(data.clients.pageItems)) {
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

  if (isLoading) {
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

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No clients found. Please check your Fineract connection.
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);
  const startRecord = offset + 1;
  const endRecord = Math.min(offset + limit, totalCount);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Account No</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
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
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/clients/${client.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/clients/${client.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Client
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
                onClick={() =>
                  handlePageChange(Math.max(0, offset - limit))
                }
                disabled={offset === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handlePageChange(offset + limit)
                }
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
