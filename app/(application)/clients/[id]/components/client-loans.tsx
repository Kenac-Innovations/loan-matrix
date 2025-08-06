"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  DollarSign,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FineractLoan {
  id: number;
  accountNo: string;
  loanProductName: string;
  principal: number;
  approvedPrincipal: number;
  interestRatePerPeriod: number;
  numberOfRepayments: number;
  status: {
    id: number;
    code: string;
    value: string;
    active: boolean;
    closed: boolean;
  };
  timeline: {
    submittedOnDate: string;
    approvedOnDate?: string;
    expectedDisbursementDate?: string;
    actualDisbursementDate?: string;
    expectedMaturityDate?: string;
  };
  summary: {
    principalOutstanding: number;
    totalOutstanding: number;
    totalOverdue: number;
  };
}

interface ClientLoansProps {
  clientId: number;
}

export function ClientLoans({ clientId }: ClientLoansProps) {
  const [loans, setLoans] = useState<FineractLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClientLoans() {
      try {
        const response = await fetch(`/api/clients/${clientId}/loans`);
        if (!response.ok) {
          throw new Error("Failed to fetch client loans");
        }
        const data = await response.json();
        console.log("==========> loans data ::", data);
        // Ensure data is an array
        if (Array.isArray(data)) {
          // Transform the loan data to match the expected interface
          const transformedLoans = data.map((loan: any) => ({
            id: loan.id,
            accountNo: loan.accountNo,
            loanProductName: loan.productName || loan.loanProductName,
            principal: loan.originalLoan || loan.principal,
            approvedPrincipal: loan.originalLoan || loan.approvedPrincipal,
            interestRatePerPeriod: loan.interestRatePerPeriod || 0,
            numberOfRepayments: loan.numberOfRepayments || 0,
            status: {
              id: loan.status?.id || 0,
              code: loan.status?.code || "",
              value: loan.status?.value || "",
              active: loan.status?.active || false,
              closed: loan.status?.closed || false,
            },
            timeline: {
              submittedOnDate: loan.timeline?.submittedOnDate || "",
              approvedOnDate: loan.timeline?.approvedOnDate || "",
              actualDisbursementDate: loan.timeline?.actualDisbursementDate || "",
              expectedMaturityDate: loan.timeline?.expectedMaturityDate || "",
            },
            summary: {
              principalOutstanding: loan.loanBalance || 0,
              totalOutstanding: loan.loanBalance || 0,
              totalOverdue: loan.inArrears ? (loan.loanBalance || 0) : 0,
            },
          }));
          setLoans(transformedLoans);
        } else if (data && Array.isArray(data.pageItems)) {
          // Handle paginated response
          setLoans(data.pageItems);
        } else {
          console.warn("Unexpected loans data format:", data);
          setLoans([]);
        }
      } catch (err) {
        console.error("Error fetching client loans:", err);
        setError("Failed to load client loans");
        // Set mock data for development
        setLoans([
          {
            id: 1,
            accountNo: "000000001",
            loanProductName: "Personal Loan",
            principal: 50000,
            approvedPrincipal: 50000,
            interestRatePerPeriod: 12,
            numberOfRepayments: 24,
            status: {
              id: 300,
              code: "loanStatusType.active",
              value: "Active",
              active: true,
              closed: false,
            },
            timeline: {
              submittedOnDate: "2024-01-10",
              approvedOnDate: "2024-01-15",
              actualDisbursementDate: "2024-01-20",
              expectedMaturityDate: "2026-01-20",
            },
            summary: {
              principalOutstanding: 35000,
              totalOutstanding: 37500,
              totalOverdue: 0,
            },
          },
          {
            id: 2,
            accountNo: "000000002",
            loanProductName: "Business Loan",
            principal: 100000,
            approvedPrincipal: 100000,
            interestRatePerPeriod: 15,
            numberOfRepayments: 36,
            status: {
              id: 200,
              code: "loanStatusType.approved",
              value: "Approved",
              active: false,
              closed: false,
            },
            timeline: {
              submittedOnDate: "2024-03-01",
              approvedOnDate: "2024-03-05",
              expectedDisbursementDate: "2024-03-10",
              expectedMaturityDate: "2027-03-10",
            },
            summary: {
              principalOutstanding: 100000,
              totalOutstanding: 100000,
              totalOverdue: 0,
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchClientLoans();
  }, [clientId]);

  const getStatusBadge = (status: FineractLoan["status"]) => {
    if (status.active) {
      return (
        <Badge variant="outline" className="bg-green-500 text-white border-0">
          Active
        </Badge>
      );
    }
    if (status.closed) {
      return (
        <Badge variant="outline" className="bg-gray-500 text-white border-0">
          Closed
        </Badge>
      );
    }
    if (status.code === "loanStatusType.approved") {
      return (
        <Badge variant="outline" className="bg-blue-500 text-white border-0">
          Approved
        </Badge>
      );
    }
    if (status.code === "loanStatusType.pending") {
      return (
        <Badge variant="outline" className="bg-yellow-500 text-white border-0">
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-purple-500 text-white border-0">
        {status.value}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate summary metrics
  const totalPrincipal = loans.reduce((sum, loan) => sum + loan.principal, 0);
  const totalOutstanding = loans.reduce(
    (sum, loan) => sum + loan.summary.totalOutstanding,
    0
  );
  const totalOverdue = loans.reduce(
    (sum, loan) => sum + loan.summary.totalOverdue,
    0
  );
  const activeLoans = loans.filter((loan) => loan.status.active).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
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

  return (
    <div className="space-y-6">
      {/* Loan Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loans.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeLoans} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Principal
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalPrincipal)}
            </div>
            <p className="text-xs text-muted-foreground">Approved amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalOutstanding)}
            </div>
            <p className="text-xs text-muted-foreground">Current balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle
              className={`h-4 w-4 ${
                totalOverdue > 0 ? "text-red-400" : "text-green-400"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalOverdue)}
            </div>
            <p
              className={`text-xs ${
                totalOverdue > 0 ? "text-red-400" : "text-green-400"
              }`}
            >
              {totalOverdue > 0 ? "Requires attention" : "All current"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
          <CardDescription>
            Complete list of loans for this client
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No loans found for this client
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan Product</TableHead>
                    <TableHead>Account No</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Maturity Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {loan.loanProductName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {loan.interestRatePerPeriod}% •{" "}
                            {loan.numberOfRepayments} payments
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">
                          {loan.accountNo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency(loan.principal)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {formatCurrency(loan.summary.totalOutstanding)}
                          </div>
                          {loan.summary.totalOverdue > 0 && (
                            <div className="text-sm text-red-500">
                              {formatCurrency(loan.summary.totalOverdue)}{" "}
                              overdue
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(loan.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {loan.timeline.expectedMaturityDate
                            ? formatDate(loan.timeline.expectedMaturityDate)
                            : "Not set"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/clients/${clientId}/loans/${loan.id}`}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
