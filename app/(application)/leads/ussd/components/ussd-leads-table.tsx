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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  DollarSign,
  Smartphone,
  User,
  Calendar,
  CreditCard,
} from "lucide-react";
import { UssdLeadsData, UssdLoanApplication, updateUssdApplicationStatus } from "@/app/actions/ussd-leads-actions";
// import { format } from "date-fns";

interface UssdLeadsTableProps {
  initialData: UssdLeadsData;
}

const statusConfig = {
  CREATED: { label: "Created", color: "bg-blue-100 text-blue-800" },
  SUBMITTED: { label: "Submitted", color: "bg-yellow-100 text-yellow-800" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-purple-100 text-purple-800" },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800" },
  DISBURSED: { label: "Disbursed", color: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
  EXPIRED: { label: "Expired", color: "bg-orange-100 text-orange-800" },
};

const payoutMethodConfig = {
  "1": { label: "Mobile Money", icon: Smartphone },
  "2": { label: "Cash Pickup", icon: User },
  "3": { label: "Bank Transfer", icon: CreditCard },
};

export function UssdLeadsTable({ initialData }: UssdLeadsTableProps) {
  const [applications, setApplications] = useState<UssdLoanApplication[]>(initialData.applications);
  const [selectedApplication, setSelectedApplication] = useState<UssdLoanApplication | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    isOpen: boolean;
    action: "approve" | "reject" | null;
  }>({ isOpen: false, action: null });
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusUpdate = async (applicationId: number, newStatus: UssdLoanApplication["status"]) => {
    setIsLoading(true);
    try {
      const result = await updateUssdApplicationStatus(applicationId, newStatus, notes);
      
      if (result.success) {
        // Update local state
        setApplications(prev => 
          prev.map(app => 
            app.loanApplicationUssdId === applicationId 
              ? { ...app, status: newStatus, updatedAt: new Date() }
              : app
          )
        );
        setActionDialog({ isOpen: false, action: null });
        setNotes("");
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update application status");
    } finally {
      setIsLoading(false);
    }
  };

  const openActionDialog = (application: UssdLoanApplication, action: "approve" | "reject") => {
    setSelectedApplication(application);
    setActionDialog({ isOpen: true, action });
    setNotes("");
  };

  const getStatusIcon = (status: UssdLoanApplication["status"]) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "UNDER_REVIEW":
        return <Clock className="h-4 w-4 text-purple-500" />;
      case "DISBURSED":
        return <DollarSign className="h-4 w-4 text-emerald-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display
    if (phone.startsWith('+263')) {
      return `+263 ${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
    }
    return phone;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payout Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((application) => {
              const statusInfo = statusConfig[application.status];
              const payoutInfo = payoutMethodConfig[application.payoutMethod as keyof typeof payoutMethodConfig];
              const PayoutIcon = payoutInfo?.icon || Smartphone;

              return (
                <TableRow key={application.loanApplicationUssdId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{application.referenceNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{application.userFullName}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {application.userNationalId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatPhoneNumber(application.userPhoneNumber)}</div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{application.loanProductDisplayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {application.loanTermMonths} months
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatCurrency(application.principalAmount)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PayoutIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{payoutInfo?.label || "Unknown"}</span>
                    </div>
                    {application.mobileMoneyNumber && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatPhoneNumber(application.mobileMoneyNumber)}
                      </div>
                    )}
                    {application.bankAccountNumber && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {application.bankName} - {application.bankAccountNumber.slice(-4)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(application.status)}
                      <Badge className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(application.createdAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(application.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openActionDialog(application, "approve")}
                          disabled={!["CREATED", "SUBMITTED", "UNDER_REVIEW"].includes(application.status)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openActionDialog(application, "reject")}
                          disabled={!["CREATED", "SUBMITTED", "UNDER_REVIEW"].includes(application.status)}
                        >
                          <XCircle className="mr-2 h-4 w-4 text-red-500" />
                          Reject
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialog.isOpen} onOpenChange={(open) => setActionDialog({ isOpen: open, action: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "approve" ? "Approve Application" : "Reject Application"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === "approve" 
                ? "Are you sure you want to approve this loan application?" 
                : "Are you sure you want to reject this loan application?"
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Application Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Reference:</span>
                    <div className="font-medium">{selectedApplication.referenceNumber}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <div className="font-medium">{selectedApplication.userFullName}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <div className="font-medium">{formatCurrency(selectedApplication.principalAmount)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Product:</span>
                    <div className="font-medium">{selectedApplication.loanProductDisplayName}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">
                  {actionDialog.action === "approve" ? "Approval Notes (Optional)" : "Rejection Reason"}
                </Label>
                <Textarea
                  id="notes"
                  placeholder={
                    actionDialog.action === "approve" 
                      ? "Add any notes about the approval..." 
                      : "Please provide a reason for rejection..."
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ isOpen: false, action: null })}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedApplication && actionDialog.action) {
                  const newStatus = actionDialog.action === "approve" ? "APPROVED" : "REJECTED";
                  handleStatusUpdate(selectedApplication.loanApplicationUssdId, newStatus);
                }
              }}
              disabled={isLoading}
              className={
                actionDialog.action === "approve" 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {isLoading ? "Processing..." : actionDialog.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
