"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  MoreHorizontal, 
  Phone, 
  User, 
  DollarSign, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from "lucide-react";
import Link from "next/link";
import { UssdLeadsData, UssdLoanApplication } from "@/app/actions/ussd-leads-actions";
import { format } from "date-fns";

interface UssdLeadsTableProps {
  initialData: UssdLeadsData;
}

const statusColors = {
  CREATED: "bg-blue-100 text-blue-800",
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  UNDER_REVIEW: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  DISBURSED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  EXPIRED: "bg-red-100 text-red-800",
};

const payoutMethodLabels = {
  "1": "Mobile Money",
  "2": "Cash Pickup", 
  "3": "Bank Transfer",
};

export function UssdLeadsTable({ initialData }: UssdLeadsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [applications, setApplications] = useState(initialData.applications);

  // Filter applications based on search and status
  const filteredApplications = applications.filter((app) => {
    const matchesSearch = 
      app.userFullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.userPhoneNumber.includes(searchQuery) ||
      app.messageId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleStatusUpdate = async (applicationId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/ussd-leads/${applicationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Update local state
        setApplications(prev => 
          prev.map(app => 
            app.loanApplicationUssdId === applicationId 
              ? { ...app, status: newStatus as UssdLoanApplication["status"] }
              : app
          )
        );
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleMarkAsSubmitted = async (app: UssdLoanApplication) => {
    try {
      // Create Fineract loan using backend mapping
      const res = await fetch(`/api/ussd-leads/${app.loanApplicationUssdId}/submit`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.errorData?.defaultUserMessage || data?.error || 'Failed to create loan';
        alert(msg);
        return;
      }

      // Update status to SUBMITTED locally and in DB
      await handleStatusUpdate(app.loanApplicationUssdId, 'SUBMITTED');
      alert('Loan submitted successfully');
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to submit loan');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name, phone, message ID, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="CREATED">Created</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="DISBURSED">Disbursed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Application</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Loan Details</TableHead>
              <TableHead>Payout Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.length > 0 ? (
              filteredApplications.map((app) => (
                <TableRow key={app.loanApplicationUssdId}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-sm">
                        #{app.loanApplicationUssdId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {app.messageId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {app.referenceNumber}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{app.userFullName}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {app.userPhoneNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {app.userNationalId}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{app.loanProductDisplayName}</div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
                        <DollarSign className="h-3 w-3" />
                        ${app.principalAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {app.loanTermMonths} months
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        {payoutMethodLabels[app.payoutMethod as keyof typeof payoutMethodLabels] || app.payoutMethod}
                      </div>
                      {app.payoutMethod === "1" && app.mobileMoneyNumber && (
                        <div className="text-xs text-muted-foreground">
                          {app.mobileMoneyNumber}
                        </div>
                      )}
                      {app.payoutMethod === "2" && app.branchName && (
                        <div className="text-xs text-muted-foreground">
                          {app.branchName}
                        </div>
                      )}
                      {app.payoutMethod === "3" && app.bankName && (
                        <div className="text-xs text-muted-foreground">
                          {app.bankName}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge 
                      className={statusColors[app.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}
                    >
                      {app.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(app.createdAt), "MMM dd, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(app.createdAt), "HH:mm")}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={async () => {
                          try {
                            const res = await fetch(`/api/ussd-leads/${app.loanApplicationUssdId}/to-lead`, { method: 'POST' });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.error || 'Failed to create lead');
                            const leadId = data.leadId || app.referenceNumber;
                            // After ensuring lead exists, also submit loan with externalId=leadId
                            try {
                              await fetch(`/api/ussd-leads/${app.loanApplicationUssdId}/submit`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ leadId }),
                              });
                            } catch {}
                            window.location.href = `/leads/${leadId}`;
                          } catch (e: any) {
                            alert(e.message || 'Failed to open lead');
                          }
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {app.status === "CREATED" && (
                          <DropdownMenuItem onClick={() => handleMarkAsSubmitted(app)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark as Submitted
                          </DropdownMenuItem>
                        )}
                        {app.status === "SUBMITTED" && (
                          <>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(app.loanApplicationUssdId, "UNDER_REVIEW")}>
                              <Clock className="mr-2 h-4 w-4" />
                              Start Review
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(app.loanApplicationUssdId, "APPROVED")}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(app.loanApplicationUssdId, "REJECTED")}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {app.status === "UNDER_REVIEW" && (
                          <>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(app.loanApplicationUssdId, "APPROVED")}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(app.loanApplicationUssdId, "REJECTED")}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {app.status === "APPROVED" && (
                          <DropdownMenuItem onClick={() => handleStatusUpdate(app.loanApplicationUssdId, "DISBURSED")}>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Mark as Disbursed
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No USSD applications found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


