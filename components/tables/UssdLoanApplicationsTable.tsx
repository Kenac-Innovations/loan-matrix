"use client"

import { useState } from "react"
import useSWR from "swr"
import { UssdLoanApplication, UssdLoanApplicationStatus } from "@/shared/types"
import { GenericDataTable } from "./generic-data-table"
import { DataTableColumn, DataTableFilter } from "@/shared/types/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  MoreHorizontal, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign 
} from "lucide-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/format-currency"

interface UssdLoanApplicationsTableProps {
    ussdLoanApplications: UssdLoanApplication[]
    filterStatus?: UssdLoanApplicationStatus
}

// Fetcher function for SWR
const fetcher = (url: string) => 
  fetch(url, {
    headers: {
      'x-tenant-slug': 'goodfellow' // Or get this dynamically
    }
  }).then((res) => res.json())

export default function UssdLoanApplicationsTable({ ussdLoanApplications, filterStatus }: UssdLoanApplicationsTableProps) {
    const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
        { columnId: "status", value: "", type: "select" },
        { columnId: "payoutMethod", value: "", type: "select" },
    ])
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [rejectApplicationId, setRejectApplicationId] = useState<number | null>(null)
    const [rejectionReason, setRejectionReason] = useState("")
    const MAX_REASON_LENGTH = 20

    // Use SWR for real-time updates
    const { data, error, mutate } = useSWR('/api/ussd-leads', fetcher, {
        initialData: { applications: ussdLoanApplications },
        refreshInterval: 5000, // Refresh every 5 seconds
        revalidateOnFocus: true,
    })
    
    // Filter applications by status if filterStatus is provided
    const allApplications = data?.applications || ussdLoanApplications
    const applications = filterStatus 
        ? allApplications.filter((app: UssdLoanApplication) => app.status === filterStatus)
        : allApplications

    // Status update handlers
    const handleStatusUpdate = async (applicationId: number, newStatus: string, notes?: string) => {
        try {
            const response = await fetch(`/api/ussd-leads/${applicationId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus, notes }),
            })

            if (response.ok) {
                // Trigger SWR revalidation to get fresh data
                mutate()
            } else {
                const errorData = await response.json()
                alert(errorData.error || 'Failed to update status')
            }
        } catch (error) {
            console.error('Error updating status:', error)
            alert('Failed to update status')
        }
    }

    const openRejectDialog = (applicationId: number) => {
        setRejectApplicationId(applicationId)
        setRejectionReason("")
        setTimeout(() => {
            setRejectDialogOpen(true)
        }, 100)
    }

    const handleRejectConfirm = async () => {
        if (!rejectApplicationId) return
        
        const trimmedReason = rejectionReason.trim()
        
        if (!trimmedReason) {
            alert("Rejection reason is required")
            return
        }
        
        if (trimmedReason.length > MAX_REASON_LENGTH) {
            alert(`Rejection reason cannot exceed ${MAX_REASON_LENGTH} characters`)
            return
        }
        
        await handleStatusUpdate(rejectApplicationId, "REJECTED", trimmedReason)
        setRejectDialogOpen(false)
        setRejectApplicationId(null)
        setRejectionReason("")
    }

    const handleMarkAsSubmitted = async (app: UssdLoanApplication) => {
        try {
            // Create Fineract loan using backend mapping
            const res = await fetch(`/api/ussd-leads/${app.loanApplicationUssdId}/submit`, {
                method: 'POST',
            })
            const data = await res.json()
            if (!res.ok) {
                const msg = data?.errorData?.defaultUserMessage || data?.error || 'Failed to create loan'
                alert(msg)
                return
            }

            // Update status to SUBMITTED locally and in DB c
            await handleStatusUpdate(app.loanApplicationUssdId, 'SUBMITTED')
            alert('Loan submitted successfully')
        } catch (e: any) {
            console.error(e)
            alert(e.message || 'Failed to submit loan')
        }
    }

    const getStatusBadge = (status: UssdLoanApplicationStatus) => {
        const statusConfig = {
            [UssdLoanApplicationStatus.CREATED]: { variant: "secondary" as const, label: "Created" },
            [UssdLoanApplicationStatus.SUBMITTED]: { variant: "default" as const, label: "Submitted" },
            [UssdLoanApplicationStatus.UNDER_REVIEW]: { variant: "outline" as const, label: "Under Review" },
            [UssdLoanApplicationStatus.APPROVED]: { variant: "default" as const, label: "Approved" },
            [UssdLoanApplicationStatus.REJECTED]: { variant: "destructive" as const, label: "Rejected" },
            [UssdLoanApplicationStatus.DISBURSED]: { variant: "default" as const, label: "Disbursed" },
            [UssdLoanApplicationStatus.CANCELLED]: { variant: "secondary" as const, label: "Cancelled" },
            [UssdLoanApplicationStatus.EXPIRED]: { variant: "outline" as const, label: "Expired" },
        }

        const config = statusConfig[status] || { variant: "secondary" as const, label: status }
        
        return (
            <Badge variant={config.variant} className="capitalize">
                {config.label}
            </Badge>
        )
    }

    const getUssdLoanApplicationsColumns = (): DataTableColumn<UssdLoanApplication>[] => {
        return [
            {
                id: "referenceNumber",
                header: "Reference Number",
                accessorKey: "referenceNumber" as keyof UssdLoanApplication,
                meta: { width: 150 },
                enableSorting: true,
            },
            {
                id: "userFullName",
                header: "Customer Name",
                accessorKey: "userFullName" as keyof UssdLoanApplication,
                meta: { width: 200 },
                enableSorting: true,
            },
            {
                id: "userPhoneNumber",
                header: "Phone Number",
                accessorKey: "userPhoneNumber" as keyof UssdLoanApplication,
                meta: { width: 150 },
                enableSorting: true,
            },
            {
                id: "userNationalId",
                header: "National ID",
                accessorKey: "userNationalId" as keyof UssdLoanApplication,
                meta: { width: 150 },
                enableSorting: true,
            },
            {
                id: "loanProductName",
                header: "Loan Product",
                accessorKey: "loanProductName" as keyof UssdLoanApplication,
                meta: { width: 180 },
                enableSorting: true,
            },
            {
                id: "principalAmount",
                header: "Loan Amount",
                accessorKey: "principalAmount" as keyof UssdLoanApplication,
                cell: ({ getValue }) => {
                    const amount = getValue() as number
                    return formatCurrency(amount)
                },
                meta: { width: 120, align: "right" },
                enableSorting: true,
            },
            {
                id: "loanTermMonths",
                header: "Term (Months)",
                accessorKey: "loanTermMonths" as keyof UssdLoanApplication,
                meta: { width: 120, align: "center" },
                enableSorting: true,
            },
            {
                id: "payoutMethod",
                header: "Payout Method",
                accessorKey: "payoutMethod" as keyof UssdLoanApplication,
                cell: ({ getValue }) => {
                    const method = getValue() as string
                    return (
                        <Badge variant="outline" className="capitalize">
                            {method.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                    )
                },
                meta: { width: 140 },
                enableSorting: true,
                filterType: "select",
                filterOptions: [
                    { label: "Mobile Money", value: "1" },
                    { label: "Cash Pickup", value: "2" },
                    { label: "Bank Transfer", value: "3" },
                ]
            },
            {
                id: "mobileMoneyProvider",
                header: "Mobile Money Provider",
                accessorKey: "mobileMoneyProvider" as keyof UssdLoanApplication,
                cell: ({ getValue }) => {
                    const provider = getValue() as string | undefined
                    return provider ? (
                        <Badge variant="secondary" className="capitalize">
                            {provider}
                        </Badge>
                    ) : "-"
                },
                meta: { width: 160 },
                enableSorting: true,
            },
            {
                id: "status",
                header: "Status",
                accessorKey: "status" as keyof UssdLoanApplication,
                cell: ({ getValue }) => {
                    const status = getValue() as UssdLoanApplicationStatus
                    return getStatusBadge(status)
                },
                meta: { width: 130 },
                enableSorting: true,
                filterType: "select",
                filterOptions: Object.values(UssdLoanApplicationStatus).map(status => ({
                    label: status.replace(/_/g, ' ').toLowerCase(),
                    value: status
                }))
            },
            {
                id: "paymentStatus",
                header: "Payment Status",
                accessorKey: "paymentStatus" as keyof UssdLoanApplication,
                cell: ({ getValue }) => {
                    const status = getValue() as string | null | undefined
                    if (!status) return "-"
                    
                    const variant = status === "COMPLETED" ? "default" : 
                                  status === "PENDING" ? "outline" : "secondary"
                    
                    return (
                        <Badge variant={variant} className="capitalize">
                            {status.toLowerCase()}
                        </Badge>
                    )
                },
                meta: { width: 130 },
                enableSorting: true,
                filterType: "select",
                filterOptions: [
                    { label: "Completed", value: "COMPLETED" },
                    { label: "Pending", value: "PENDING" },
                    { label: "Failed", value: "FAILED" },
                ]
            },
            {
                id: "createdAt",
                header: "Created Date",
                accessorKey: "createdAt" as keyof UssdLoanApplication,
                cell: ({ getValue }) => {
                    const date = getValue() as Date
                    return format(new Date(date), "MMM dd, yyyy")
                },
                meta: { width: 130 },
                enableSorting: true,
            },
            {
                id: "updatedAt",
                header: "Last Updated",
                accessorKey: "updatedAt" as keyof UssdLoanApplication,
                cell: ({ getValue }) => {
                    const date = getValue() as Date
                    return format(new Date(date), "MMM dd, yyyy HH:mm")
                },
                meta: { width: 150 },
                enableSorting: true,
            },
            {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => {
                    const app = row.original as UssdLoanApplication
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={async () => {
                                    try {
                                        const res = await fetch(`/api/ussd-leads/${app.loanApplicationUssdId}/to-lead`, { method: 'POST' })
                                        const data = await res.json()
                                        if (!res.ok) throw new Error(data?.error || 'Failed to create lead')
                                        const leadId = data.leadId || app.referenceNumber
                                        // After ensuring lead exists, also submit loan with externalId=leadId
                                        try {
                                            await fetch(`/api/ussd-leads/${app.loanApplicationUssdId}/submit`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ leadId }),
                                            })
                                        } catch {}
                                        window.location.href = `/leads/${leadId}`
                                    } catch (e: any) {
                                        alert(e.message || 'Failed to open lead')
                                    }
                                }}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                </DropdownMenuItem>
                                {app.status === "CREATED" && (
                                    <>
                                        <DropdownMenuItem onClick={() => handleMarkAsSubmitted(app)}>
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Mark as Submitted
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onSelect={(e) => {
                                                e.preventDefault()
                                                openRejectDialog(app.loanApplicationUssdId)
                                            }}
                                        >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Reject Application
                                        </DropdownMenuItem>
                                    </>
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
                                        <DropdownMenuItem 
                                            onSelect={(e) => {
                                                e.preventDefault()
                                                openRejectDialog(app.loanApplicationUssdId)
                                            }}
                                        >
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
                                        <DropdownMenuItem 
                                            onSelect={(e) => {
                                                e.preventDefault()
                                                openRejectDialog(app.loanApplicationUssdId)
                                            }}
                                        >
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
                    )
                },
                meta: { width: 100 },
                enableSorting: false,
                enableHiding: false,
            },
        ]
    }

    return (
        <>
            <GenericDataTable
                data={applications}
                columns={getUssdLoanApplicationsColumns()}
                searchPlaceholder="Search applications..."
                enableSelection={true}
                enablePagination={true}
                enableColumnVisibility={false}
                enableExport={true}
                enableFilters={true}
                pageSize={20}
                tableId="ussd-loan-applications"
                exportFileName="ussd-loan-applications"
                emptyMessage="No USSD loan applications found."
                customFilters={customFilters}
                onFilterChange={setCustomFilters}
            />

            {/* Rejection Reason Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Application</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this application (maximum {MAX_REASON_LENGTH} characters).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                            <Textarea
                                id="rejection-reason"
                                placeholder="Enter rejection reason..."
                                value={rejectionReason}
                                onChange={(e) => {
                                    const value = e.target.value
                                    if (value.length <= MAX_REASON_LENGTH) {
                                        setRejectionReason(value)
                                    }
                                }}
                                maxLength={MAX_REASON_LENGTH}
                                className="min-h-[100px]"
                            />
                            <div className="text-right text-sm text-muted-foreground">
                                {rejectionReason.length}/{MAX_REASON_LENGTH} characters
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRejectDialogOpen(false)
                                setRejectionReason("")
                                setRejectApplicationId(null)
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRejectConfirm}
                            disabled={!rejectionReason.trim()}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Reject Application
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}