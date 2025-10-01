import {
  Activity,
  AlertCircle,
  Clock,
  CreditCard,
  DollarSign,
  Shield,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LoanPortfolioChart,
  RiskAssessmentChart,
  ProgressChart,
} from "@/components/charts";
import { DashboardData } from "@/lib/dashboard-service";

interface DashboardContentProps {
  data: DashboardData;
}

export function DashboardContent({ data }: DashboardContentProps) {
  const formatCurrency = (
    amount: number,
    currency?: { code: string; displaySymbol: string; decimalPlaces?: number }
  ) => {
    if (currency) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.code,
        minimumFractionDigits: currency.decimalPlaces || 2,
        maximumFractionDigits: currency.decimalPlaces || 2,
      }).format(amount);
    }
    // Fallback to USD if no currency provided
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "submitted for approval":
      case "pending approval":
        return "bg-yellow-500";
      case "approved":
        return "bg-green-500";
      case "active":
        return "bg-blue-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                data.summary.totalLoans.amount,
                data.summary.totalLoans.currency
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.summary.totalLoans.count} active loans
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Clients
            </CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.activeClients.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total registered clients
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approvals
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.pendingApprovals}
            </div>
            <p className="text-xs text-red-400">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Loans</CardTitle>
            <Shield className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.overdueLoans}
            </div>
            <p className="text-xs text-red-400">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-6">
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <CardTitle>Loan Portfolio Overview</CardTitle>
            <CardDescription>
              Monthly loan distribution by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full rounded-md border bg-muted/50 p-4">
              <LoanPortfolioChart
                type="bar"
                className="h-full"
                portfolioData={data.portfolioDistribution}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Risk Assessment</CardTitle>
            <CardDescription>Current portfolio risk levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium">Low Risk</span>
                <ProgressChart
                  value={
                    data.riskAssessment.total > 0
                      ? Math.round(
                          (data.riskAssessment.low /
                            data.riskAssessment.total) *
                            100
                        )
                      : 0
                  }
                  color="#22C55E"
                  size="sm"
                  showPercentage={true}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {data.riskAssessment.low} loans
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium">Medium Risk</span>
                <ProgressChart
                  value={
                    data.riskAssessment.total > 0
                      ? Math.round(
                          (data.riskAssessment.medium /
                            data.riskAssessment.total) *
                            100
                        )
                      : 0
                  }
                  color="#EAB308"
                  size="sm"
                  showPercentage={true}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {data.riskAssessment.medium} loans
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium">High Risk</span>
                <ProgressChart
                  value={
                    data.riskAssessment.total > 0
                      ? Math.round(
                          (data.riskAssessment.high /
                            data.riskAssessment.total) *
                            100
                        )
                      : 0
                  }
                  color="#EF4444"
                  size="sm"
                  showPercentage={true}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {data.riskAssessment.high} loans
              </p>
            </div>
            <div className="mt-6 h-[150px]">
              <RiskAssessmentChart
                type="doughnut"
                className="h-full"
                riskData={data.riskAssessment}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>
                Latest leads and loan applications
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentApplications.length > 0 ? (
                data.recentApplications.slice(0, 4).map((application) => (
                  <div
                    key={application.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {application.clientName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {application.clientName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {application.productName}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge
                            variant="outline"
                            className={`text-[8px] px-1 py-0 ${
                              application.type === "lead"
                                ? "bg-purple-100 text-purple-700 border-purple-200"
                                : "bg-blue-100 text-blue-700 border-blue-200"
                            }`}
                          >
                            {application.type === "lead" ? "Lead" : "Loan"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(
                          application.amount,
                          application.currency
                        )}
                      </p>
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(
                          application.status
                        )} text-[10px] px-1.5 py-0.5 font-medium text-white border-0`}
                      >
                        {application.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    No recent applications
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Security Alerts</CardTitle>
            <CardDescription>Recent security notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-500/20 p-1.5">
                    <Shield className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Security Audit Completed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      System-wide security audit completed successfully
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Today, 09:42 AM
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-yellow-500/20 p-1.5">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Multiple Login Attempts
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Multiple failed login attempts detected from IP
                      192.168.1.45
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Yesterday, 11:23 PM
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-blue-500/20 p-1.5">
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      System Update Available
                    </p>
                    <p className="text-xs text-muted-foreground">
                      New security patch available for installation
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      May 8, 2025
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-500/20 p-1.5">
                    <Shield className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Firewall Rules Updated
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Firewall rules have been updated and applied successfully
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      May 7, 2025
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Inbox</CardTitle>
              <CardDescription>Items requiring your attention</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-blue-500/20 p-1.5">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Client Approval</p>
                      <Badge
                        variant="outline"
                        className="bg-blue-500 text-white border-0 text-xs"
                      >
                        New
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Robert Johnson - KYC verification needed
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600"
                      >
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 py-1 text-xs"
                      >
                        Later
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-500/20 p-1.5">
                    <CreditCard className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Loan Approval</p>
                      <Badge
                        variant="outline"
                        className="bg-yellow-500 text-white border-0 text-xs"
                      >
                        Urgent
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      $245,000 Mortgage - Final approval needed
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 px-2 py-1 text-xs bg-green-500 hover:bg-green-600"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 py-1 text-xs"
                      >
                        Review Details
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-purple-500/20 p-1.5">
                    <DollarSign className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Disbursement</p>
                      <Badge
                        variant="outline"
                        className="bg-purple-500 text-white border-0 text-xs"
                      >
                        Ready
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      $50,000 Business loan - Ready for disbursement
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 px-2 py-1 text-xs bg-purple-500 hover:bg-purple-600"
                      >
                        Process
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 py-1 text-xs"
                      >
                        Schedule
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-red-500/20 p-1.5">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Risk Assessment</p>
                      <Badge
                        variant="outline"
                        className="bg-red-500 text-white border-0 text-xs"
                      >
                        Action Needed
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      $125,000 Mortgage - Additional verification required
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 px-2 py-1 text-xs bg-red-500 hover:bg-red-600"
                      >
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 py-1 text-xs"
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Table */}
      <div className="mt-6 overflow-hidden">
        <Card>
          <CardHeader>
            <CardTitle>Compliance Dashboard</CardTitle>
            <CardDescription>Regulatory compliance status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium">
                      Regulation
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Last Audit
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Next Review
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Risk Level
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      regulation: "KYC Verification",
                      status: "Compliant",
                      statusColor: "bg-green-500",
                      lastAudit: "Apr 28, 2025",
                      nextReview: "Jul 28, 2025",
                      riskLevel: "Low",
                      riskColor: "text-green-400",
                    },
                    {
                      regulation: "Anti-Money Laundering",
                      status: "Compliant",
                      statusColor: "bg-green-500",
                      lastAudit: "Apr 15, 2025",
                      nextReview: "Jul 15, 2025",
                      riskLevel: "Low",
                      riskColor: "text-green-400",
                    },
                    {
                      regulation: "Data Protection",
                      status: "Attention Needed",
                      statusColor: "bg-yellow-500",
                      lastAudit: "Mar 10, 2025",
                      nextReview: "Jun 10, 2025",
                      riskLevel: "Medium",
                      riskColor: "text-yellow-400",
                    },
                    {
                      regulation: "Financial Reporting",
                      status: "Compliant",
                      statusColor: "bg-green-500",
                      lastAudit: "Apr 01, 2025",
                      nextReview: "Jul 01, 2025",
                      riskLevel: "Low",
                      riskColor: "text-green-400",
                    },
                    {
                      regulation: "Credit Risk Assessment",
                      status: "Compliant",
                      statusColor: "bg-green-500",
                      lastAudit: "Apr 20, 2025",
                      nextReview: "Jul 20, 2025",
                      riskLevel: "Low",
                      riskColor: "text-green-400",
                    },
                  ].map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-3">{item.regulation}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`${item.statusColor} text-xs px-2 py-0.5 font-medium text-white border-0`}
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.lastAudit}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.nextReview}
                      </td>
                      <td className={`px-4 py-3 ${item.riskColor}`}>
                        {item.riskLevel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
