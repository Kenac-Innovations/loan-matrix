"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  CreditCard,
  Briefcase,
  AlertCircle,
  Loader2,
  Clock,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar, Doughnut, PolarArea, Radar } from "react-chartjs-2";
import { useChartTheme } from "@/lib/chart-theme-utils";
import { useCurrency } from "@/contexts/currency-context";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement
);

interface LeadDetailsProps {
  leadId: string;
}

interface LeadData {
  id: string;
  firstname?: string;
  lastname?: string;
  middlename?: string;
  emailAddress?: string;
  mobileNo?: string;
  countryCode?: string;
  dateOfBirth?: string;
  gender?: string;
  officeName?: string;
  clientTypeName?: string;
  clientClassificationName?: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  // Financial Information
  creditScore?: number;
  annualIncome?: number;
  monthlyIncome?: number;
  monthlyIncomeRange?: string;
  monthlyExpenses?: number;
  employmentStatus?: string;
  employerName?: string;
  yearsEmployed?: number;
  yearsAtCurrentJob?: string;
  bankName?: string;
  existingLoans?: number;
  hasExistingLoans?: boolean;
  totalDebt?: number;
  monthlyDebtPayments?: number;
  propertyOwnership?: string;
  businessOwnership?: boolean;
  businessType?: string;
  // Loan Request Information
  requestedAmount?: number;
  loanPurpose?: string;
  loanTerm?: number;
  collateralType?: string;
  collateralValue?: number;
  // Risk Assessment
  riskScore?: number;
  riskCategory?: string;
  riskFactors?: string[];
  riskAssessmentDate?: string;
  riskAssessedBy?: string;
  currentStage?: {
    name: string;
    description?: string;
  };
  familyMembers: Array<{
    id: string;
    firstname: string;
    lastname: string;
    relationship: string;
    mobileNo?: string;
    emailAddress?: string;
  }>;
  stateTransitions: Array<{
    id: string;
    triggeredAt: string;
    fromStage?: {
      name: string;
      description?: string;
    };
    toStage: {
      name: string;
      description?: string;
    };
    duration?: number;
  }>;
  computed: {
    fullName: string;
    timeInCurrentStage: number;
    totalTime: number;
    hasRequiredFields: boolean;
    stageHistory: Array<{
      id: string;
      triggeredAt: string;
      fromStage?: {
        name: string;
        description?: string;
      };
      toStage: {
        name: string;
        description?: string;
      };
      duration: number;
    }>;
  };
}

export function LeadDetails({ leadId }: LeadDetailsProps) {
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [loanInfo, setLoanInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { colors, getOptions } = useChartTheme();
  const { currencyCode } = useCurrency();

  useEffect(() => {
    const fetchLeadData = async () => {
      try {
        setLoading(true);

        // Fetch lead data
        const leadResponse = await fetch(`/api/leads/${leadId}`);
        if (!leadResponse.ok) {
          throw new Error("Failed to fetch lead data");
        }
        const leadData = await leadResponse.json();
        setLeadData(leadData);

        // Fetch loan information
        const loanInfoResponse = await fetch(`/api/leads/${leadId}/loan-info`);
        if (loanInfoResponse.ok) {
          const loanInfoData = await loanInfoResponse.json();
          setLoanInfo(loanInfoData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchLeadData();
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !leadData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          {error || "Failed to load lead data"}
        </p>
      </div>
    );
  }

  // Format phone number
  const phoneNumber = leadData.mobileNo
    ? `${leadData.countryCode} ${leadData.mobileNo}`
    : "Not provided";

  // Use real financial data from the database
  const financialData = {
    creditScore: leadData.creditScore || 0,
    annualIncome: leadData.annualIncome
      ? `${currencyCode} ${leadData.annualIncome.toLocaleString()}`
      : "Not provided",
    monthlyIncome: leadData.monthlyIncome
      ? `${currencyCode} ${leadData.monthlyIncome.toLocaleString()}`
      : "Not provided",
    monthlyExpenses: leadData.monthlyExpenses
      ? `${currencyCode} ${leadData.monthlyExpenses.toLocaleString()}`
      : "Not provided",
    employmentStatus: leadData.employmentStatus || "Not specified",
    employerName: leadData.employerName || "Not provided",
    yearsEmployed: leadData.yearsEmployed
      ? `${leadData.yearsEmployed} years`
      : "Not provided",
    bankName: leadData.bankName || "Not provided",
    existingLoans: leadData.existingLoans || 0,
    totalDebt: leadData.totalDebt
      ? `${currencyCode} ${leadData.totalDebt.toLocaleString()}`
      : `${currencyCode} 0`,
    debtToIncomeRatio:
      leadData.monthlyIncome && leadData.totalDebt
        ? `${Math.round(
            (leadData.totalDebt / (leadData.monthlyIncome * 12)) * 100
          )}%`
        : "Not calculated",
  };

  // Use real loan request data
  const loanData = {
    requestedAmount: leadData.requestedAmount
      ? `${currencyCode} ${leadData.requestedAmount.toLocaleString()}`
      : "Not specified",
    loanPurpose: leadData.loanPurpose || "Not specified",
    loanTerm: leadData.loanTerm
      ? `${leadData.loanTerm} months`
      : "Not specified",
    collateralType: leadData.collateralType || "Not specified",
    collateralValue: leadData.collateralValue
      ? `${currencyCode} ${leadData.collateralValue.toLocaleString()}`
      : "Not specified",
  };

  // Use real risk assessment data
  const riskScore = leadData.riskScore || 0;
  const riskCategory = leadData.riskCategory || "Not assessed";
  const riskFactors =
    leadData.riskFactors && leadData.riskFactors.length > 0
      ? leadData.riskFactors
      : ["Risk assessment pending"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
          <CardDescription>Details about the loan applicant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center md:items-start gap-3">
              <Avatar className="h-20 w-20">
                <AvatarImage
                  src="/placeholder.svg"
                  alt={leadData.computed.fullName}
                />
                <AvatarFallback>
                  {leadData.computed.fullName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="text-center md:text-left">
                <h3 className="text-lg font-medium">
                  {leadData.computed.fullName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {leadData.clientTypeName || "Individual Client"}
                </p>
              </div>
              <Badge className="bg-blue-500 text-white border-0">
                {leadData.clientTypeName || "Individual Client"}
              </Badge>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm">{phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm">
                      {leadData.emailAddress || "Not provided"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Office</p>
                    <p className="text-sm">
                      {leadData.officeName || "Not assigned"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Classification
                    </p>
                    <p className="text-sm">
                      {leadData.clientClassificationName || "Not classified"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Application Date
                    </p>
                    <p className="text-sm">
                      {new Date(leadData.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Current Stage
                    </p>
                    <p className="text-sm">
                      {leadData.currentStage?.name || "Not assigned"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="loan">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="loan">
            <DollarSign className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Loan Details</span>
          </TabsTrigger>
          <TabsTrigger value="financials">
            <CreditCard className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Financial Profile</span>
          </TabsTrigger>
          <TabsTrigger value="risk">
            <AlertCircle className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Risk Assessment</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="loan" className="mt-4">
          <div className="space-y-6">
            {/* Fineract Loan Info */}
            {loanInfo &&
              (loanInfo.fineractClientId || loanInfo.fineractLoanId) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Fineract Integration</CardTitle>
                    <CardDescription>
                      Client and Loan IDs in Fineract system
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Fineract Client ID
                        </p>
                        <p className="text-sm font-medium">
                          {loanInfo.fineractClientId || "Not created"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Fineract Loan ID
                        </p>
                        <p className="text-sm font-medium">
                          {loanInfo.fineractLoanId ? (
                            <Badge className="bg-green-500 text-white border-0">
                              {loanInfo.fineractLoanId}
                            </Badge>
                          ) : (
                            "Not created"
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Loan Details */}
            {loanInfo?.loanDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Loan Details</CardTitle>
                  <CardDescription>
                    Product and disbursement information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Loan Product
                      </p>
                      <p className="text-sm font-medium">
                        {loanInfo.loanDetails.productName || "Not specified"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Loan Officer
                      </p>
                      <p className="text-sm font-medium">
                        {loanInfo.loanDetails.loanOfficerName || "Not assigned"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Loan Purpose
                      </p>
                      <p className="text-sm font-medium">
                        {loanInfo.loanDetails.loanPurposeName ||
                          "Not specified"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Submitted On
                      </p>
                      <p className="text-sm font-medium">
                        {loanInfo.loanDetails.submittedOn
                          ? new Date(
                              loanInfo.loanDetails.submittedOn
                            ).toLocaleDateString()
                          : "Not submitted"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Expected Disbursement
                      </p>
                      <p className="text-sm font-medium">
                        {loanInfo.loanDetails.disbursementOn
                          ? new Date(
                              loanInfo.loanDetails.disbursementOn
                            ).toLocaleDateString()
                          : "Not specified"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Fund</p>
                      <p className="text-sm font-medium">
                        {loanInfo.loanDetails.fundName || "No fund specified"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loan Terms */}
            {loanInfo?.loanTerms && (
              <Card>
                <CardHeader>
                  <CardTitle>Loan Terms & Conditions</CardTitle>
                  <CardDescription>
                    Interest rates, repayment schedule, and charges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Principal and Interest */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">
                        Principal & Interest
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">
                            {currencyCode}{" "}
                            {loanInfo.loanTerms.principal?.toLocaleString() ||
                              0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Principal
                          </p>
                        </div>
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">
                            {loanInfo.loanTerms.nominalInterestRate || 0}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Interest Rate
                          </p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">
                            {loanInfo.loanTerms.numberOfRepayments || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            # of Repayments
                          </p>
                        </div>
                        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-orange-600">
                            {loanInfo.loanTerms.loanTerm || 0} months
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Loan Term
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Charges */}
                    {loanInfo.loanTerms.charges &&
                      loanInfo.loanTerms.charges.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-3">
                            Loan Charges
                          </h4>
                          <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted/50 px-4 py-2 grid grid-cols-3 gap-4 text-xs font-medium">
                              <div>Charge Name</div>
                              <div>Amount</div>
                              <div>Due Date</div>
                            </div>
                            {loanInfo.loanTerms.charges.map(
                              (charge: any, index: number) => (
                                <div
                                  key={index}
                                  className="px-4 py-3 grid grid-cols-3 gap-4 text-sm border-t"
                                >
                                  <div>{charge.chargeName || "N/A"}</div>
                                  <div className="font-medium">
                                    {currencyCode} {charge.amount?.toLocaleString() || 0}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {charge.dueDate || "N/A"}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Repayment Schedule */}
            {loanInfo?.repaymentSchedule && (
              <Card>
                <CardHeader>
                  <CardTitle>Repayment Schedule</CardTitle>
                  <CardDescription>
                    Detailed payment schedule and totals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loanInfo.repaymentSchedule.periods &&
                  loanInfo.repaymentSchedule.periods.length > 0 ? (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="text-center">
                          <p className="text-lg font-bold">
                            {currencyCode}{" "}
                            {loanInfo.repaymentSchedule.totalPrincipalExpected?.toLocaleString() ||
                              0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Principal
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-600">
                            {currencyCode}{" "}
                            {loanInfo.repaymentSchedule.totalInterestCharged?.toLocaleString() ||
                              0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Interest
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-orange-600">
                            {currencyCode}{" "}
                            {loanInfo.repaymentSchedule.totalFeeChargesCharged?.toLocaleString() ||
                              0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Fees
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-600">
                            {currencyCode}{" "}
                            {loanInfo.repaymentSchedule.totalRepaymentExpected?.toLocaleString() ||
                              0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Repayment
                          </p>
                        </div>
                      </div>

                      {/* Schedule Table */}
                      <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-2 text-left">#</th>
                              <th className="px-4 py-2 text-left">Due Date</th>
                              <th className="px-4 py-2 text-right">
                                Principal
                              </th>
                              <th className="px-4 py-2 text-right">Interest</th>
                              <th className="px-4 py-2 text-right">Fees</th>
                              <th className="px-4 py-2 text-right">
                                Total Due
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(loanInfo.repaymentSchedule?.periods || [])
                              .filter((period: any) => period?.period > 0)
                              .map((period: any) => (
                                <tr key={period.period} className="border-t">
                                  <td className="px-4 py-2">{period.period}</td>
                                  <td className="px-4 py-2">
                                    {period.dueDate?.join("-") || "N/A"}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {currencyCode}{" "}
                                    {period.principalDue?.toLocaleString() || 0}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {currencyCode} {period.interestDue?.toLocaleString() || 0}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {currencyCode}{" "}
                                    {period.feeChargesDue?.toLocaleString() ||
                                      0}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    {currencyCode}{" "}
                                    {period.totalDueForPeriod?.toLocaleString() ||
                                      0}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No repayment schedule available
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Signatures */}
            {loanInfo?.signatures && (
              <Card>
                <CardHeader>
                  <CardTitle>Contract Signatures</CardTitle>
                  <CardDescription>
                    Signatures collected during contract signing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">
                        Borrower Signature
                      </p>
                      <div className="flex items-center gap-2">
                        {loanInfo.signatures.borrowerSignature ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <p className="text-sm font-medium">
                          {loanInfo.signatures.borrowerSignature
                            ? "Signed"
                            : "Pending"}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">
                        Guarantor Signature
                      </p>
                      <div className="flex items-center gap-2">
                        {loanInfo.signatures.guarantorSignature ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <p className="text-sm font-medium">
                          {loanInfo.signatures.guarantorSignature
                            ? "Signed"
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">
                        Loan Officer Signature
                      </p>
                      <div className="flex items-center gap-2">
                        {loanInfo.signatures.loanOfficerSignature ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <p className="text-sm font-medium">
                          {loanInfo.signatures.loanOfficerSignature
                            ? "Signed"
                            : "Pending"}
                        </p>
                      </div>
                    </div>
                  </div>
                  {loanInfo.signatures.completedAt && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm">
                        <strong>Completed:</strong>{" "}
                        {new Date(
                          loanInfo.signatures.completedAt
                        ).toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Basic Info (when no loan info available) */}
            {!loanInfo?.loanDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Lead details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm font-medium">{leadData.status}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        External ID
                      </p>
                      <p className="text-sm font-medium">
                        {leadData.externalId || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Gender</p>
                      <p className="text-sm font-medium">
                        {leadData.gender || "Not specified"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Date of Birth
                      </p>
                      <p className="text-sm font-medium">
                        {leadData.dateOfBirth
                          ? new Date(leadData.dateOfBirth).toLocaleDateString()
                          : "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Application Date
                      </p>
                      <p className="text-sm font-medium">
                        {new Date(leadData.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Last Updated
                      </p>
                      <p className="text-sm font-medium">
                        {new Date(leadData.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="col-span-full space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Family Members
                      </p>
                      <p className="text-sm font-medium">
                        {leadData.familyMembers.length > 0
                          ? `${leadData.familyMembers.length} family member(s) registered`
                          : "No family members registered"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        <TabsContent value="financials" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income vs Expenses Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                <CardDescription>Monthly financial breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: [
                        "Monthly Income",
                        "Monthly Expenses",
                        "Net Income",
                      ],
                      datasets: [
                        {
                          label: `Amount (${currencyCode})`,
                          data: [
                            leadData.monthlyIncome || 0,
                            leadData.monthlyExpenses || 0,
                            (leadData.monthlyIncome || 0) -
                              (leadData.monthlyExpenses || 0),
                          ],
                          backgroundColor: [
                            colors.success,
                            colors.error,
                            colors.info,
                          ],
                          borderColor: [
                            colors.success.replace("0.8", "1"),
                            colors.error.replace("0.8", "1"),
                            colors.info.replace("0.8", "1"),
                          ],
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={getOptions({
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          callbacks: {
                            label: function (context: any) {
                              return `${currencyCode} ${context.parsed.y.toLocaleString()}`;
                            },
                          },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function (value: any) {
                              return currencyCode + " " + value.toLocaleString();
                            },
                          },
                        },
                      },
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Credit Score Gauge */}
            <Card>
              <CardHeader>
                <CardTitle>Credit Score</CardTitle>
                <CardDescription>Credit worthiness assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <div className="relative">
                    <Doughnut
                      data={{
                        labels: ["Credit Score", "Remaining"],
                        datasets: [
                          {
                            data: [
                              leadData.creditScore || 0,
                              850 - (leadData.creditScore || 0),
                            ],
                            backgroundColor: [
                              leadData.creditScore &&
                              leadData.creditScore >= 700
                                ? colors.success
                                : leadData.creditScore &&
                                  leadData.creditScore >= 600
                                ? colors.warning
                                : colors.error,
                              colors.muted,
                            ],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={getOptions({
                        cutout: "70%",
                        scales: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            enabled: false,
                          },
                        },
                      })}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold">
                          {leadData.creditScore || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          / 850
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {leadData.creditScore && leadData.creditScore >= 700
                            ? "Excellent"
                            : leadData.creditScore &&
                              leadData.creditScore >= 600
                            ? "Good"
                            : "Fair"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Overview */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Financial Overview</CardTitle>
                <CardDescription>Key financial metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {financialData.annualIncome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Annual Income
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {financialData.debtToIncomeRatio}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Debt-to-Income
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">
                      {financialData.existingLoans}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Existing Loans
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {financialData.totalDebt}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Debt</p>
                  </div>
                </div>

                {/* Enhanced Financial Profile */}
                <div className="mt-6 space-y-6">
                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium mb-4">
                      Employment & Income Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          Employment Status
                        </p>
                        <p className="font-medium">
                          {leadData.employmentStatus || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Employer</p>
                        <p className="font-medium">
                          {leadData.employerName || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Years at Current Job
                        </p>
                        <p className="font-medium">
                          {leadData.yearsAtCurrentJob
                            ? leadData.yearsAtCurrentJob
                                .replace("_", "-")
                                .replace("over_", "Over ") +
                              (leadData.yearsAtCurrentJob.includes("year")
                                ? ""
                                : " years")
                            : "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Monthly Income Range
                        </p>
                        <p className="font-medium">
                          {leadData.monthlyIncomeRange
                            ? leadData.monthlyIncomeRange
                                .replace("under_", `Under ${currencyCode} `)
                                .replace("over_", `Over ${currencyCode} `)
                                .replace("_", ` - ${currencyCode} `)
                            : "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium mb-4">
                      Debt & Financial Obligations
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          Has Existing Loans
                        </p>
                        <p className="font-medium">
                          <Badge
                            variant={
                              leadData.hasExistingLoans
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {leadData.hasExistingLoans ? "Yes" : "No"}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Monthly Debt Payments
                        </p>
                        <p className="font-medium">
                          {leadData.monthlyDebtPayments
                            ? `${currencyCode} ${leadData.monthlyDebtPayments.toLocaleString()}`
                            : `${currencyCode} 0`}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Property Ownership
                        </p>
                        <p className="font-medium">
                          {leadData.propertyOwnership
                            ? leadData.propertyOwnership
                                .replace("_", " ")
                                .toLowerCase()
                                .replace(/\b\w/g, (l) => l.toUpperCase())
                            : "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium mb-4">
                      Business Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          Business Ownership
                        </p>
                        <p className="font-medium">
                          <Badge
                            variant={
                              leadData.businessOwnership
                                ? "default"
                                : "secondary"
                            }
                          >
                            {leadData.businessOwnership
                              ? "Business Owner"
                              : "Not a Business Owner"}
                          </Badge>
                        </p>
                      </div>
                      {leadData.businessOwnership && leadData.businessType && (
                        <div>
                          <p className="text-muted-foreground">Business Type</p>
                          <p className="font-medium">{leadData.businessType}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Score Gauge */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Score</CardTitle>
                <CardDescription>Overall risk assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <div className="relative">
                    <Doughnut
                      data={{
                        labels: ["Risk Score", "Safe Zone"],
                        datasets: [
                          {
                            data: [riskScore, 100 - riskScore],
                            backgroundColor: [
                              riskScore <= 30
                                ? colors.success
                                : riskScore <= 60
                                ? colors.warning
                                : colors.error,
                              colors.muted,
                            ],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={getOptions({
                        cutout: "70%",
                        scales: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            enabled: false,
                          },
                        },
                      })}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold">{riskScore}</div>
                        <div className="text-sm text-muted-foreground">
                          / 100
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {riskCategory}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Factors Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Profile</CardTitle>
                <CardDescription>
                  Multi-dimensional risk analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Radar
                    data={{
                      labels: [
                        "Credit History",
                        "Income Stability",
                        "Debt Ratio",
                        "Employment",
                        "Collateral",
                        "Industry Risk",
                      ],
                      datasets: [
                        {
                          label: "Risk Level",
                          data: [
                            leadData.creditScore
                              ? Math.max(
                                  0,
                                  100 - (leadData.creditScore / 850) * 100
                                )
                              : 50,
                            leadData.yearsEmployed
                              ? Math.max(0, 100 - leadData.yearsEmployed * 10)
                              : 50,
                            leadData.monthlyIncome && leadData.totalDebt
                              ? Math.min(
                                  100,
                                  (leadData.totalDebt /
                                    (leadData.monthlyIncome * 12)) *
                                    100
                                )
                              : 50,
                            leadData.employmentStatus === "EMPLOYED"
                              ? 20
                              : leadData.employmentStatus === "SELF_EMPLOYED"
                              ? 40
                              : 70,
                            leadData.collateralValue && leadData.requestedAmount
                              ? Math.max(
                                  0,
                                  100 -
                                    (leadData.collateralValue /
                                      leadData.requestedAmount) *
                                      100
                                )
                              : 60,
                            40, // Industry risk - could be dynamic based on loan purpose
                          ],
                          backgroundColor: colors.error.replace("0.8", "0.2"),
                          borderColor: colors.error.replace("0.8", "1"),
                          borderWidth: 2,
                          pointBackgroundColor: colors.error.replace(
                            "0.8",
                            "1"
                          ),
                          pointBorderColor: colors.text,
                          pointHoverBackgroundColor: colors.text,
                          pointHoverBorderColor: colors.error.replace(
                            "0.8",
                            "1"
                          ),
                        },
                      ],
                    }}
                    options={getOptions({
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        r: {
                          angleLines: {
                            display: true,
                            color: colors.grid,
                            lineWidth: 1,
                          },
                          grid: {
                            display: true,
                            color: colors.grid,
                            lineWidth: 1,
                          },
                          suggestedMin: 0,
                          suggestedMax: 100,
                          ticks: {
                            display: false,
                            showLabelBackdrop: false,
                            color: "transparent",
                            backdropColor: "transparent",
                          },
                          pointLabels: {
                            color: colors.text,
                            font: {
                              size: 10,
                            },
                          },
                        },
                      },
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Risk Factors List */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Risk Factors Analysis</CardTitle>
                <CardDescription>
                  Detailed risk assessment breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3 text-green-600">
                      Positive Factors
                    </h4>
                    <ul className="space-y-2">
                      {riskFactors
                        .filter(
                          (factor) =>
                            factor.toLowerCase().includes("good") ||
                            factor.toLowerCase().includes("stable") ||
                            factor.toLowerCase().includes("adequate") ||
                            factor.toLowerCase().includes("excellent")
                        )
                        .map((factor: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="rounded-full bg-green-100 p-1 mt-0.5">
                              <AlertCircle className="h-3 w-3 text-green-600" />
                            </div>
                            <span className="text-sm">{factor}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-3 text-red-600">
                      Risk Concerns
                    </h4>
                    <ul className="space-y-2">
                      {riskFactors
                        .filter(
                          (factor) =>
                            !factor.toLowerCase().includes("good") &&
                            !factor.toLowerCase().includes("stable") &&
                            !factor.toLowerCase().includes("adequate") &&
                            !factor.toLowerCase().includes("excellent")
                        )
                        .map((factor: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="rounded-full bg-red-100 p-1 mt-0.5">
                              <AlertCircle className="h-3 w-3 text-red-600" />
                            </div>
                            <span className="text-sm">{factor}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>

                {/* Loan Request Details */}
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-sm font-medium mb-3">
                    Loan Request Details
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-blue-600">
                        {loanData.requestedAmount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested Amount
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-purple-600">
                        {loanData.loanTerm}
                      </p>
                      <p className="text-xs text-muted-foreground">Loan Term</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-orange-600">
                        {loanData.collateralValue}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Collateral Value
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-bold text-gray-600">
                        {loanData.loanPurpose}
                      </p>
                      <p className="text-xs text-muted-foreground">Purpose</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-md border bg-muted/50 p-4">
                  <h4 className="text-sm font-medium mb-2">
                    Risk Assessment Summary
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {riskScore <= 30
                      ? "This application presents a low risk profile. The client demonstrates strong financial stability, excellent credit history, and adequate collateral. Recommend approval with standard terms."
                      : riskScore <= 60
                      ? "This application presents a moderate risk profile. While there are some positive indicators, certain factors require attention. Consider approval with enhanced monitoring or adjusted terms."
                      : "This application presents a high risk profile. Multiple risk factors have been identified that may impact loan performance. Recommend thorough review and potentially enhanced security measures."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
