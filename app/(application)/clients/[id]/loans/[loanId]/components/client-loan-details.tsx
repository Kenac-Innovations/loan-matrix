"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Download } from "lucide-react";

interface ClientLoanDetailsProps {
  clientId: number;
  loanId: number;
}

interface FineractClient {
  id: number;
  accountNo: string;
  status: {
    id: number;
    code: string;
    value: string;
  };
  active: boolean;
  activationDate?: string | number[];
  officeName: string;
  staffName?: string;
  firstname: string;
  lastname: string;
  displayName: string;
  mobileNo?: string;
  emailAddress?: string;
  dateOfBirth?: string | number[];
  gender?: {
    id: number;
    name: string;
  };
  clientType?: {
    id: number;
    name: string;
  };
  clientClassification?: {
    id: number;
    name: string;
  };
  timeline: {
    submittedOnDate: string | number[];
    submittedByUsername: string;
    activatedOnDate?: string | number[];
    activatedByUsername?: string;
  };
}

interface FineractLoan {
  id: number;
  accountNo: string;
  externalId?: string;
  productId: number;
  productName: string;
  shortProductName: string;
  status: {
    id: number;
    code: string;
    value: string;
    active: boolean;
    closed: boolean;
  };
  loanType: {
    id: number;
    code: string;
    value: string;
  };
  loanPurpose: {
    id: number;
    name: string;
  };
  loanPurposeId: number;
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    inMultiplesOf: number;
    displaySymbol: string;
    nameCode: string;
    displayLabel: string;
  };
  principal: number;
  approvedPrincipal: number;
  proposedPrincipal: number;
  termFrequency: number;
  termPeriodFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  numberOfRepayments: number;
  repaymentEvery: number;
  interestRatePerPeriod: number;
  interestRateFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  annualInterestRate: number;
  interestType: {
    id: number;
    code: string;
    value: string;
  };
  interestCalculationPeriodType: {
    id: number;
    code: string;
    value: string;
  };
  transactionProcessingStrategy: {
    id: number;
    code: string;
    name: string;
  };
  timeline: {
    submittedOnDate: string | number[];
    submittedByUsername: string;
    approvedOnDate?: string | number[];
    approvedByUsername?: string;
    expectedDisbursementDate?: string | number[];
    actualDisbursementDate?: string | number[];
    expectedMaturityDate?: string | number[];
    closedOnDate?: string | number[];
    closedByUsername?: string;
  };
  summary: {
    principalDisbursed: number;
    principalPaid: number;
    principalOutstanding: number;
    principalOverdue: number;
    principalWrittenOff?: number;
    interestCharged: number;
    interestPaid: number;
    interestOutstanding: number;
    interestOverdue: number;
    interestWaived?: number;
    interestWrittenOff?: number;
    feeChargesCharged: number;
    feeChargesPaid: number;
    feeChargesOutstanding: number;
    feeChargesOverdue: number;
    feeChargesWaived?: number;
    feeChargesWrittenOff?: number;
    penaltyChargesCharged: number;
    penaltyChargesPaid: number;
    penaltyChargesOutstanding: number;
    penaltyChargesOverdue: number;
    penaltyChargesWaived?: number;
    penaltyChargesWrittenOff?: number;
    totalExpectedRepayment: number;
    totalRepayment: number;
    totalOutstanding: number;
    totalOverdue: number;
    totalWaived?: number;
    totalWrittenOff?: number;
  };
  schedule: {
    currency: {
      code: string;
      name: string;
      decimalPlaces: number;
      inMultiplesOf: number;
      displaySymbol: string;
      nameCode: string;
      displayLabel: string;
    };
    totalPrincipalDisbursed: number;
    totalPrincipalExpected: number;
    totalPrincipalPaid: number;
    totalInterestCharged: number;
    totalFeeChargesCharged: number;
    totalPenaltyChargesCharged: number;
    totalWaived: number;
    totalWrittenOff: number;
    totalRepaymentExpected: number;
    totalRepayment: number;
    totalOutstanding: number;
    period: number;
    loanTermInDays: number;
    totalFeeChargesAtDisbursement: number;
    fixedEmiAmount: number;
    maxOutstandingLoanBalance: number;
    disbursedAmount: number;
    disbursedAmountPercentage: number;
    feeChargesAtDisbursementCharged: number;
    scheduleRegenerated: boolean;
    futureSchedule: any[];
    schedule: any[];
  };
  loanOfficerId: number;
  loanOfficerName: string;
  loanPurposeName: string;
  useInterestRateCharged: boolean;
  syncDisbursementWithMeeting: boolean;
  loanCollateral: any[];
  loanCharge: any[];
  loanCounter: {
    id: number;
    productId: number;
    clientId: number;
    loanId: number;
    loanAccountId: number;
    loanProductName: string;
    loanExternalId: string;
    loanCounterDate: string | number[];
    loanType: {
      id: number;
      code: string;
      value: string;
    };
    loanStatus: {
      id: number;
      code: string;
      value: string;
    };
    loanProductId: number;
  };
  isNPA: boolean;
  daysInMonthType: {
    id: number;
    code: string;
    value: string;
  };
  daysInYearType: {
    id: number;
    code: string;
    value: string;
  };
  interestRecalculationEnabled: boolean;
  createStandingInstructionAtDisbursement: boolean;
  isVariableInstallmentsAllowed: boolean;
  allowVariableInstallments: boolean;
  minimumGap: number;
  maximumGap: number;
  graceOnPrincipalPayment?: number;
  graceOnInterestPayment?: number;
  graceOnArrearsAgeing?: number;
  interestFreePeriod?: number;
  amortizationType: {
    id: number;
    code: string;
    value: string;
  };
  charges: any[];
  collateral: any[];
  multiDisburseLoan: boolean;
  canDefineInstallmentAmount: boolean;
  canUseForTopup: boolean;
  isTopup: boolean;
  closureDate: string | number[];
  inArrears: boolean;
  overdueCharges: any[];
  linkedAccount: any;
  canDisburse: boolean;
  emiAmountVariations: any[];
  inArrearsTolerance: number;
  originalLoan: number;
  loanBalance: number;
  amountPaid: number;
  lastRepaymentDate?: string | number[];
}

export function ClientLoanDetails({ clientId, loanId }: ClientLoanDetailsProps) {
  const [client, setClient] = useState<FineractClient | null>(null);
  const [loan, setLoan] = useState<FineractLoan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch client details
        const clientResponse = await fetch(`/api/clients/${clientId}`);
        if (!clientResponse.ok) {
          throw new Error(`Failed to fetch client details: ${clientResponse.statusText}`);
        }
        const clientData = await clientResponse.json();
        setClient(clientData);

        // Fetch loan details
        const loanResponse = await fetch(`/api/loans/${loanId}`);
        if (!loanResponse.ok) {
          throw new Error(`Failed to fetch loan details: ${loanResponse.statusText}`);
        }
        const loanData = await loanResponse.json();
        setLoan(loanData);

      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clientId, loanId]);

  const formatDate = (date: string | number[] | undefined): string => {
    if (!date) return "N/A";
    if (typeof date === "string") {
      return new Date(date).toLocaleDateString();
    }
    if (Array.isArray(date) && date.length === 3) {
      const [year, month, day] = date;
      return new Date(year, month - 1, day).toLocaleDateString();
    }
    return "N/A";
  };

  const formatCurrency = (amount: number, currencyCode: string = "KES"): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!client || !loan) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Information */}
      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
          <CardDescription>Basic client details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-lg">{client.displayName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Account No</p>
              <p className="text-lg">{client.accountNo}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={client.active ? "default" : "secondary"}>
                {client.status.value}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Office</p>
              <p className="text-lg">{client.officeName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Mobile</p>
              <p className="text-lg">{client.mobileNo || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-lg">{client.emailAddress || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loan Details */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="account-details">Account Details</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          {/* Performance History */}
          <Card>
            <CardHeader>
              <CardTitle>Performance History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Number of Repayments</p>
                  <p className="text-lg">{loan.numberOfRepayments}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Maturity Date</p>
                  <p className="text-lg">{loan.timeline.expectedMaturityDate ? formatDate(loan.timeline.expectedMaturityDate) : "Not set"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loan Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead>Original</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Waived</TableHead>
                      <TableHead>Written Off</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Over Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Principal</TableCell>
                      <TableCell>{formatCurrency(loan.principal, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.principalPaid, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.principalWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.principalWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.principalOutstanding, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.principalOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Interest</TableCell>
                      <TableCell>{formatCurrency(loan.summary.interestCharged, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.interestPaid, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.interestWaived || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.interestWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.interestOutstanding, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.interestOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Fees</TableCell>
                      <TableCell>{formatCurrency(loan.summary.feeChargesCharged, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.feeChargesPaid, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.feeChargesWaived || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.feeChargesWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.feeChargesOutstanding, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.feeChargesOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Penalties</TableCell>
                      <TableCell>{formatCurrency(loan.summary.penaltyChargesCharged, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.penaltyChargesPaid, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.penaltyChargesWaived || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.penaltyChargesWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.penaltyChargesOutstanding, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.penaltyChargesOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell>{formatCurrency(loan.summary.totalExpectedRepayment, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.totalRepayment, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.totalWaived || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.totalWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.totalOutstanding, loan.currency.code)}</TableCell>
                      <TableCell>{formatCurrency(loan.summary.totalOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Loan Details */}
          <Card>
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Disbursement Date</p>
                  <p className="text-lg">{loan.timeline.actualDisbursementDate ? formatDate(loan.timeline.actualDisbursementDate) : "Not disbursed"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Loan Purpose</p>
                  <p className="text-lg">{loan.loanPurpose?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Loan Officer</p>
                  <p className="text-lg">{loan.loanOfficerName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Currency</p>
                  <p className="text-lg">{loan.currency.name} {loan.currency.code}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">External Id</p>
                  <p className="text-lg">{loan.externalId || "Not Available"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Proposed Amount</p>
                  <p className="text-lg">{formatCurrency(loan.proposedPrincipal, loan.currency.code)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approved Amount</p>
                  <p className="text-lg">{formatCurrency(loan.approvedPrincipal, loan.currency.code)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account-details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Repayment Strategy:</span>
                    <span className="text-sm">Penalties, Fees, Interest, Principal order</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Repayments:</span>
                    <span className="text-sm">{loan.numberOfRepayments} every {loan.repaymentEvery} {loan.termPeriodFrequencyType.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Amortization:</span>
                    <span className="text-sm">Equal installments</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Equal Amortization:</span>
                    <span className="text-sm">No</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Interest:</span>
                    <span className="text-sm">{loan.annualInterestRate}% per annum ({loan.interestRatePerPeriod}% Per {loan.interestRateFrequencyType.value})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Interest Type:</span>
                    <span className="text-sm">{loan.interestType.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Enable Down Payments:</span>
                    <span className="text-sm">No</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Loan Charge-off behaviour:</span>
                    <span className="text-sm">Regular</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Grace: On Principal Payment:</span>
                    <span className="text-sm">{loan.graceOnPrincipalPayment || ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Grace: On Interest Payment:</span>
                    <span className="text-sm">{loan.graceOnInterestPayment || ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Grace on Arrears Ageing:</span>
                    <span className="text-sm">{loan.graceOnArrearsAgeing || ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Enable installment level Delinquency:</span>
                    <span className="text-sm">No</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Fund Source:</span>
                    <span className="text-sm">CEO's Fund</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Interest Free Period:</span>
                    <span className="text-sm">{loan.interestFreePeriod || ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Interest Calculation Period:</span>
                    <span className="text-sm">Same as repayment period</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Allow Partial Interest Calculation with same as repayment:</span>
                    <span className="text-sm">No</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Is interest recognition on disbursement date?:</span>
                    <span className="text-sm">No</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Submitted on:</span>
                    <span className="text-sm">{loan.timeline.submittedOnDate ? formatDate(loan.timeline.submittedOnDate) : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Approved on:</span>
                    <span className="text-sm">{loan.timeline.approvedOnDate ? formatDate(loan.timeline.approvedOnDate) : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Disbursed on:</span>
                    <span className="text-sm">{loan.timeline.actualDisbursementDate ? formatDate(loan.timeline.actualDisbursementDate) : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Matures on:</span>
                    <span className="text-sm">{loan.timeline.expectedMaturityDate ? formatDate(loan.timeline.expectedMaturityDate) : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Recalculate Interest based on new terms:</span>
                    <span className="text-sm">No</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Days in year:</span>
                    <span className="text-sm">{loan.daysInYearType?.value || "Actual"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Days in month:</span>
                    <span className="text-sm">{loan.daysInMonthType?.value || "Actual"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Repayment Schedule</CardTitle>
                <CardDescription>Detailed loan repayment schedule</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export to PDF
              </Button>
            </CardHeader>
            <CardContent>
              {loan.schedule && loan.schedule.schedule ? (
                <div className="space-y-4">
                  {/* Summary Section */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 border rounded">
                      <h4 className="font-medium text-sm text-muted-foreground">Loan Amount and Balance</h4>
                      <p className="text-lg font-bold">{formatCurrency(loan.schedule.totalPrincipalExpected, loan.currency.code)}</p>
                    </div>
                    <div className="text-center p-4 border rounded">
                      <h4 className="font-medium text-sm text-muted-foreground">Total Cost of Loan</h4>
                      <p className="text-lg font-bold">{formatCurrency(loan.schedule.totalRepaymentExpected, loan.currency.code)}</p>
                    </div>
                    <div className="text-center p-4 border rounded">
                      <h4 className="font-medium text-sm text-muted-foreground">Installment Totals</h4>
                      <p className="text-lg font-bold">{loan.schedule.schedule.length} installments</p>
                    </div>
                  </div>

                  {/* Repayment Schedule Table */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Paid Date</TableHead>
                          <TableHead>Balance Of Loan</TableHead>
                          <TableHead>Principal Due</TableHead>
                          <TableHead>Interest</TableHead>
                          <TableHead>Fees</TableHead>
                          <TableHead>Penalties</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>In advance</TableHead>
                          <TableHead>Late</TableHead>
                          <TableHead>Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Pre-installment row (if exists) */}
                        {loan.schedule.schedule.length > 0 && (
                          <TableRow>
                            <TableCell>-</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>{loan.timeline.actualDisbursementDate ? formatDate(loan.timeline.actualDisbursementDate) : ""}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>{formatCurrency(loan.schedule.totalPrincipalExpected, loan.currency.code)}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>{formatCurrency(loan.schedule.totalInterestCharged / loan.schedule.schedule.length, loan.currency.code)}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>{formatCurrency(loan.schedule.totalInterestCharged / loan.schedule.schedule.length, loan.currency.code)}</TableCell>
                            <TableCell>{formatCurrency(loan.schedule.totalInterestCharged / loan.schedule.schedule.length, loan.currency.code)}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>-</TableCell>
                          </TableRow>
                        )}

                        {/* Installment rows */}
                        {loan.schedule.schedule.map((installment: any, index: number) => {
                          const isOverdue = installment.outstanding > 0;
                          return (
                            <TableRow key={index} className={isOverdue ? "bg-red-50" : ""}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>{installment.daysInPeriod || 30}</TableCell>
                              <TableCell>{installment.dueDate ? formatDate(installment.dueDate) : ""}</TableCell>
                              <TableCell>{installment.obligationsMetOnDate ? formatDate(installment.obligationsMetOnDate) : ""}</TableCell>
                              <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                                {formatCurrency(installment.principalLoanBalanceOutstanding, loan.currency.code)}
                              </TableCell>
                              <TableCell>{formatCurrency(installment.principal, loan.currency.code)}</TableCell>
                              <TableCell>{formatCurrency(installment.interest, loan.currency.code)}</TableCell>
                              <TableCell>{formatCurrency(installment.feeCharges, loan.currency.code)}</TableCell>
                              <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                                {formatCurrency(installment.penaltyCharges, loan.currency.code)}
                              </TableCell>
                              <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                                {formatCurrency(installment.totalDueForPeriod, loan.currency.code)}
                              </TableCell>
                              <TableCell>{formatCurrency(installment.totalPaidForPeriod, loan.currency.code)}</TableCell>
                              <TableCell>{formatCurrency(installment.totalInAdvanceForPeriod, loan.currency.code)}</TableCell>
                              <TableCell>{formatCurrency(installment.totalOverdue, loan.currency.code)}</TableCell>
                              <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                                {formatCurrency(installment.outstanding, loan.currency.code)}
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Total row */}
                        <TableRow className="font-bold bg-muted">
                          <TableCell colSpan={4}>Total</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalPrincipalExpected, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalPrincipalExpected, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalInterestCharged, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalFeeChargesCharged, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalPenaltyChargesCharged, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalRepaymentExpected, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalRepayment, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(0, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalOutstanding, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(loan.schedule.totalOutstanding, loan.currency.code)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No schedule available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charges" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Charges</CardTitle>
              <CardDescription>Loan charges and fees</CardDescription>
            </CardHeader>
            <CardContent>
              {loan.charges && loan.charges.length > 0 ? (
                <div className="space-y-2">
                  {loan.charges.map((charge: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <p className="font-medium">{charge.name}</p>
                        <p className="text-sm text-muted-foreground">{charge.chargeCalculationType.value}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(charge.amount, loan.currency.code)}</p>
                        <Badge variant={charge.paid ? "default" : "secondary"}>
                          {charge.paid ? "Paid" : "Outstanding"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No charges available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Loan timeline events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Submitted On</p>
                    <p className="text-lg">{formatDate(loan.timeline.submittedOnDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Submitted By</p>
                    <p className="text-lg">{loan.timeline.submittedByUsername}</p>
                  </div>
                  {loan.timeline.approvedOnDate && (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Approved On</p>
                        <p className="text-lg">{formatDate(loan.timeline.approvedOnDate)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Approved By</p>
                        <p className="text-lg">{loan.timeline.approvedByUsername}</p>
                      </div>
                    </>
                  )}
                  {loan.timeline.expectedDisbursementDate && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Expected Disbursement</p>
                      <p className="text-lg">{formatDate(loan.timeline.expectedDisbursementDate)}</p>
                    </div>
                  )}
                  {loan.timeline.actualDisbursementDate && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Actual Disbursement</p>
                      <p className="text-lg">{formatDate(loan.timeline.actualDisbursementDate)}</p>
                    </div>
                  )}
                  {loan.timeline.expectedMaturityDate && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Expected Maturity</p>
                      <p className="text-lg">{formatDate(loan.timeline.expectedMaturityDate)}</p>
                    </div>
                  )}
                  {loan.timeline.closedOnDate && (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Closed On</p>
                        <p className="text-lg">{formatDate(loan.timeline.closedOnDate)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Closed By</p>
                        <p className="text-lg">{loan.timeline.closedByUsername}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 