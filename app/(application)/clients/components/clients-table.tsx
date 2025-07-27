"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  activationDate?: string;
  officeName: string;
  timeline: {
    submittedOnDate: string;
    activatedOnDate?: string;
  };
}

interface PaginationInfo {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface ClientsResponse {
  data: FineractClient[];
  pagination: PaginationInfo;
}

export function ClientsTable() {
  const [clients, setClients] = useState<FineractClient[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    offset: 0,
    limit: 20,
    total: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async (offset = 0, limit = 20) => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/clients?offset=${offset}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch clients");
      }
      const data: ClientsResponse = await response.json();

      // Handle both new API format and legacy format
      if (data.data && data.pagination) {
        setClients(data.data);
        setPagination(data.pagination);
      } else {
        // Legacy format - treat as direct array
        setClients(data as any);
        setPagination({
          offset,
          limit,
          total: (data as any).length,
          hasMore: false,
        });
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients from Fineract");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients(pagination.offset, pagination.limit);
  }, []);

  const handlePageChange = (newOffset: number) => {
    fetchClients(newOffset, pagination.limit);
  };

  const handlePageSizeChange = (newLimit: number) => {
    fetchClients(0, newLimit);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
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
            <span>{error}</span>
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

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const startRecord = pagination.offset + 1;
  const endRecord = Math.min(
    pagination.offset + pagination.limit,
    pagination.total
  );

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
            Showing {startRecord} to {endRecord} of {pagination.total} clients
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={pagination.limit.toString()}
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
                  handlePageChange(
                    Math.max(0, pagination.offset - pagination.limit)
                  )
                }
                disabled={pagination.offset === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handlePageChange(pagination.offset + pagination.limit)
                }
                disabled={!pagination.hasMore}
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
