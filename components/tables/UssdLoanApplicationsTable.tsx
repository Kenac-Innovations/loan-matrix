"use client"

import { UssdLoanApplication, UssdLoanApplicationStatus } from "@/shared/types"
import { GenericDataTable } from "./generic-data-table"
import { DataTableColumn } from "@/shared/types/data-table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/format-currency"

interface UssdLoanApplicationsTableProps {
    ussdLoanApplications: UssdLoanApplication[]
}

export default function UssdLoanApplicationsTable({ ussdLoanApplications }: UssdLoanApplicationsTableProps) {
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
        ]
    }

    return (
        <GenericDataTable
            data={ussdLoanApplications}
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
        />
    )
}