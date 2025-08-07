"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Download, MoreVertical, X, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Edit, Flag, Plus, Heart, Coins, RotateCcw, Calendar, ChevronRight as ChevronRightIcon, User, Building, Phone, Mail, CreditCard, TrendingUp, Clock, FileText, Shield, DollarSign, Percent, CalendarDays } from "lucide-react";
import { ClientTransactions } from "../../../components/client-transactions";

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
  repaymentSchedule?: {
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
    totalInterestPaid: number;
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
    periods: Array<{
      period: number;
      fromDate: string | number[];
      dueDate: string | number[];
      obligationsMetOnDate?: string | number[];
      completed: boolean;
      daysInPeriod: number;
      principal: number;
      principalLoanBalanceOutstanding: number;
      interest: number;
      feeCharges: number;
      penaltyCharges: number;
      totalDueForPeriod: number;
      totalPaidForPeriod: number;
      totalInAdvanceForPeriod: number;
      totalOverdue: number;
      outstanding: number;
    }>;
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
  reschedules?: any[];
  documents?: any[];
  notes?: any[];
  linkedAccount: any;
  canDisburse: boolean;
  emiAmountVariations: any[];
  inArrearsTolerance: number;
  originalLoan: number;
  loanBalance: number;
  amountPaid: number;
  lastRepaymentDate?: string | number[];
  transactions?: any[];
}

export function ClientLoanDetails({ clientId, loanId }: ClientLoanDetailsProps) {
  const [client, setClient] = useState<FineractClient | null>(null);
  const [loan, setLoan] = useState<FineractLoan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCollateral, setShowAddCollateral] = useState(false);
  const [collateralForm, setCollateralForm] = useState({
    collateralType: "",
    value: "",
    description: ""
  });
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    rescheduleFromDate: "",
    reason: "",
    submittedOn: "",
    comments: "",
    changeRepaymentDate: false,
    installmentRescheduledTo: "",
    introduceGracePeriods: false,
    principalGracePeriods: "",
    interestGracePeriods: "",
    extendRepaymentPeriod: false,
    numberOfNewRepayments: "",
    adjustInterestRate: false,
    newInterestRate: ""
  });
  const [showUploadDocuments, setShowUploadDocuments] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    fileName: "",
    description: "",
    file: null as File | null
  });
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.actions-dropdown')) {
        setShowActionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

        // Fetch loan details with associations
        const loanResponse = await fetch(`/api/fineract/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`);
        if (!loanResponse.ok) {
          throw new Error(`Failed to fetch loan details: ${loanResponse.statusText}`);
        }
        const loanData = await loanResponse.json();
        
        // Log the response structure for debugging
        console.log('Loan API Response:', loanData);
        
        // Handle the API response structure
        // The API response might have repaymentSchedule at the root level
        if (loanData.repaymentSchedule && !loanData.repaymentSchedule.periods) {
          // If repaymentSchedule exists but doesn't have periods, it might be the old structure
          console.log('Using legacy schedule structure');
        } else if (loanData.repaymentSchedule && loanData.repaymentSchedule.periods) {
          console.log('Using new repaymentSchedule structure with periods');
        } else {
          console.log('No repaymentSchedule found in response');
        }
        
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
      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!client || !loan) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">No data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Principal Amount</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(loan.principal, loan.currency.code)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Outstanding Balance</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(loan.summary.totalOutstanding, loan.currency.code)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Interest Rate</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {loan.annualInterestRate}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500 flex items-center justify-center">
                <Percent className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Repayments</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {loan.numberOfRepayments}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-500 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Information */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Client Information</CardTitle>
              <CardDescription>Basic client details and contact information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Full Name</span>
              </div>
              <p className="text-lg font-semibold">{client.displayName}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>Account No</span>
              </div>
              <p className="text-lg font-semibold">{client.accountNo}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Status</span>
              </div>
              <Badge variant={client.active ? "default" : "secondary"} className="text-sm">
                {client.status.value}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                <span>Office</span>
              </div>
              <p className="text-lg font-semibold">{client.officeName}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>Mobile</span>
              </div>
              <p className="text-lg font-semibold">{client.mobileNo || "N/A"}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>Email</span>
              </div>
              <p className="text-lg font-semibold">{client.emailAddress || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loan Actions */}
      <div className="relative actions-dropdown">
        <Button
          variant="outline"
          onClick={() => setShowActionsMenu(!showActionsMenu)}
          className="flex items-center space-x-2 shadow-sm"
        >
          <MoreVertical className="h-4 w-4" />
          <span>Loan Actions</span>
        </Button>

        {showActionsMenu && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-card border rounded-xl shadow-lg z-50">
            <div className="py-2">
              <button
                onClick={() => {
                  console.log("Add Loan Charge");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span>Add Loan Charge</span>
              </button>

              <button
                onClick={() => {
                  console.log("Foreclosure");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <Heart className="h-4 w-4 text-muted-foreground" />
                <span>Foreclosure</span>
              </button>

              <button
                onClick={() => {
                  console.log("Make Repayment");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span>Make Repayment</span>
              </button>

              <button
                onClick={() => {
                  console.log("Undo Disbursal");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                <span>Undo Disbursal</span>
              </button>

              <button
                onClick={() => {
                  console.log("Add Interest Pause");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Add Interest Pause</span>
              </button>

              <button
                onClick={() => {
                  console.log("Prepay Loan");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span>Prepay Loan</span>
              </button>

              <button
                onClick={() => {
                  console.log("Charge-Off");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span>Charge-Off</span>
              </button>

              <button
                onClick={() => {
                  console.log("Re-Age");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Re-Age</span>
              </button>

              <button
                onClick={() => {
                  console.log("Re-Amortize");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center space-x-3 text-foreground transition-colors"
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Re-Amortize</span>
              </button>

              <button
                onClick={() => {
                  console.log("Payments");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center justify-between text-foreground transition-colors"
              >
                <span>Payments</span>
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => {
                  console.log("More");
                  setShowActionsMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent flex items-center justify-between text-foreground transition-colors"
              >
                <span>More</span>
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-12 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="general" className="rounded-md">General</TabsTrigger>
          <TabsTrigger value="account-details" className="rounded-md">Account Details</TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-md">Repayment Schedule</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-md">Transactions</TabsTrigger>
          <TabsTrigger value="collateral" className="rounded-md">Collateral</TabsTrigger>
          <TabsTrigger value="overdue-charges" className="rounded-md">Overdue</TabsTrigger>
          <TabsTrigger value="charges" className="rounded-md">Charges</TabsTrigger>
          <TabsTrigger value="loan-reschedules" className="rounded-md">Reschedules</TabsTrigger>
          <TabsTrigger value="loan-documents" className="rounded-md">Documents</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-md">Notes</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-md">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Performance History */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle>Performance History</CardTitle>
                  <CardDescription>Loan performance metrics and key dates</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Number of Repayments</p>
                  <p className="text-2xl font-bold">{loan.numberOfRepayments}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Maturity Date</p>
                  <p className="text-2xl font-bold">{loan.timeline.expectedMaturityDate ? formatDate(loan.timeline.expectedMaturityDate) : "Not set"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loan Summary */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Loan Summary</CardTitle>
                  <CardDescription>Comprehensive breakdown of loan amounts and payments</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-muted/30">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="font-semibold"></TableHead>
                      <TableHead className="font-semibold">Original</TableHead>
                      <TableHead className="font-semibold">Paid</TableHead>
                      <TableHead className="font-semibold">Waived</TableHead>
                      <TableHead className="font-semibold">Written Off</TableHead>
                      <TableHead className="font-semibold">Outstanding</TableHead>
                      <TableHead className="font-semibold">Over Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-b">
                      <TableCell className="font-semibold">Principal</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.principal, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.principalPaid, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.principalWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.principalWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.principalOutstanding, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.principalOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                    <TableRow className="border-b">
                      <TableCell className="font-semibold">Interest</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.interestCharged, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.interestPaid, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.interestWaived || 0, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.interestWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.interestOutstanding, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.interestOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                    <TableRow className="border-b">
                      <TableCell className="font-semibold">Fees</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.feeChargesCharged, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.feeChargesPaid, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.feeChargesWaived || 0, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.feeChargesWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.feeChargesOutstanding, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.feeChargesOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                    <TableRow className="border-b">
                      <TableCell className="font-semibold">Penalties</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.penaltyChargesCharged, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.penaltyChargesPaid, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.penaltyChargesWaived || 0, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.penaltyChargesWrittenOff || 0, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.penaltyChargesOutstanding, loan.currency.code)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(loan.summary.penaltyChargesOverdue, loan.currency.code)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 font-bold">
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
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle>Loan Details</CardTitle>
                  <CardDescription>Key loan information and specifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Disbursement Date</p>
                  <p className="text-lg font-semibold">{loan.timeline.actualDisbursementDate ? formatDate(loan.timeline.actualDisbursementDate) : "Not disbursed"}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Loan Purpose</p>
                  <p className="text-lg font-semibold">{loan.loanPurpose?.name || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Loan Officer</p>
                  <p className="text-lg font-semibold">{loan.loanOfficerName || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Currency</p>
                  <p className="text-lg font-semibold">{loan.currency.name} {loan.currency.code}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">External Id</p>
                  <p className="text-lg font-semibold">{loan.externalId || "Not Available"}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Proposed Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(loan.proposedPrincipal, loan.currency.code)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Approved Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(loan.approvedPrincipal, loan.currency.code)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account-details" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <CardTitle>Loan Details</CardTitle>
                  <CardDescription>Key loan information and specifications</CardDescription>
                </div>
              </div>
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

        <TabsContent value="schedule" className="space-y-6">
          <ClientTransactions clientId={clientId} loanId={loanId} />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>Loan transaction history</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hide-reversed"
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="hide-reversed" className="text-sm text-muted-foreground">
                    Hide Reversed
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hide-accruals"
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="hide-accruals" className="text-sm text-muted-foreground">
                    Hide Accruals
                  </label>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Id</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>External Id</TableHead>
                      <TableHead>Transaction Date</TableHead>
                      <TableHead>Transaction Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Penalties</TableHead>
                      <TableHead>Loan Balance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.transactions && loan.transactions.length > 0 ? (
                      loan.transactions.map((transaction: any, index: number) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{transaction.id}</TableCell>
                          <TableCell>{transaction.officeName}</TableCell>
                          <TableCell>{transaction.externalId || ""}</TableCell>
                          <TableCell>{transaction.date ? formatDate(transaction.date) : ""}</TableCell>
                          <TableCell>{transaction.type?.value || ""}</TableCell>
                          <TableCell>{formatCurrency(transaction.amount, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(transaction.principalPortion || 0, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(transaction.interestPortion || 0, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(transaction.feeChargesPortion || 0, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(transaction.penaltyChargesPortion || 0, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(transaction.outstandingLoanBalance || 0, loan.currency.code)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collateral" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle>Loan Collateral Details</CardTitle>
                  <CardDescription>Collateral associated with this loan</CardDescription>
                </div>
              </div>
              <Button onClick={() => setShowAddCollateral(true)} className="shadow-sm">
                Add Collateral
              </Button>
            </CardHeader>
            <CardContent>
              {loan.collateral && loan.collateral.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loan.collateral.map((item: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{item.type}</TableCell>
                          <TableCell>{formatCurrency(item.value, loan.currency.code)}</TableCell>
                          <TableCell>{item.description || "N/A"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No collateral found for this loan</p>
                  <p className="text-sm mt-2">Click "Add Collateral" to add collateral details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue-charges" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle>Overdue Charges</CardTitle>
                  <CardDescription>Charges that are overdue for this loan</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Collected On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.overdueCharges && loan.overdueCharges.length > 0 ? (
                      loan.overdueCharges.map((charge: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{charge.name}</TableCell>
                          <TableCell>{charge.chargeCalculationType?.value || charge.type || "N/A"}</TableCell>
                          <TableCell>{formatCurrency(charge.amount, loan.currency.code)}</TableCell>
                          <TableCell>{charge.collectedOn || "Overdue Fees"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No overdue charges found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {loan.overdueCharges && loan.overdueCharges.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Items per page:</span>
                    <select className="text-sm border rounded px-2 py-1">
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      1 - {loan.overdueCharges.length} of {loan.overdueCharges.length}
                    </span>
                    <div className="flex space-x-1">
                      <Button variant="outline" size="sm" disabled>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charges" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <Coins className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <CardTitle>Charges</CardTitle>
                  <CardDescription>All charges associated with this loan</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Fee/Penalty</TableHead>
                      <TableHead>Payment due at</TableHead>
                      <TableHead>Due As Of</TableHead>
                      <TableHead>Calculation Type</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Waived</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.charges && loan.charges.length > 0 ? (
                      loan.charges.map((charge: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{charge.name}</TableCell>
                          <TableCell>
                            <Badge variant={charge.chargeType?.value === "Penalty" ? "destructive" : "default"}>
                              {charge.chargeType?.value || "Fee"}
                            </Badge>
                          </TableCell>
                          <TableCell>{charge.chargeTimeType?.value || "N/A"}</TableCell>
                          <TableCell>{charge.dueDate ? formatDate(charge.dueDate) : "N/A"}</TableCell>
                          <TableCell>{charge.chargeCalculationType?.value || "N/A"}</TableCell>
                          <TableCell>{formatCurrency(charge.amount, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(charge.amountPaid || 0, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(charge.amountWaived || 0, loan.currency.code)}</TableCell>
                          <TableCell>{formatCurrency(charge.amountOutstanding || charge.amount, loan.currency.code)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Flag className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No charges found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {loan.charges && loan.charges.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Items per page:</span>
                    <select className="text-sm border rounded px-2 py-1">
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50" selected>50</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      1 - {loan.charges.length} of {loan.charges.length}
                    </span>
                    <div className="flex space-x-1">
                      <Button variant="outline" size="sm" disabled>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loan-reschedules" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle>Loan Reschedules</CardTitle>
                    <CardDescription>Loan rescheduling events and history</CardDescription>
                  </div>
                </div>
                <Button onClick={() => setShowReschedule(true)} className="shadow-sm">
                  Reschedule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>From Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.reschedules && loan.reschedules.length > 0 ? (
                      loan.reschedules.map((reschedule: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{formatDate(reschedule.fromDate)}</TableCell>
                          <TableCell>{reschedule.reason}</TableCell>
                          <TableCell>
                            <Badge variant={reschedule.status === "Approved" ? "default" : "secondary"}>
                              {reschedule.status || "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No reschedules found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loan-documents" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle>Documents</CardTitle>
                    <CardDescription>Loan documents and files</CardDescription>
                  </div>
                </div>
                <Button onClick={() => setShowUploadDocuments(true)} className="shadow-sm">
                  + Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.documents && loan.documents.length > 0 ? (
                      loan.documents.map((document: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{document.name}</TableCell>
                          <TableCell>{document.description}</TableCell>
                          <TableCell>{document.fileName}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-blue-500 text-white hover:bg-blue-600">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-red-500 text-white hover:bg-red-600">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No documents found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <CardTitle>Notes</CardTitle>
                  <CardDescription>Loan notes and comments</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Add Note Section */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center space-x-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Write a note ..."
                      className="w-full px-3 py-2 border-b-2 border-blue-500 bg-transparent focus:outline-none focus:border-blue-600"
                    />
                    {!newNote && (
                      <p className="text-sm text-muted-foreground text-center mt-1">
                        Please fill in this field.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">G</span>
                    </div>
                    <Button
                      onClick={() => {
                        if (newNote.trim()) {
                          console.log("Adding note:", newNote);
                          setNewNote("");
                        }
                      }}
                      disabled={!newNote.trim()}
                      className="bg-gray-300 text-gray-700 border border-gray-400 hover:bg-gray-400"
                    >
                      + Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-4">
                {loan.notes && loan.notes.length > 0 ? (
                  loan.notes.map((note: any, index: number) => (
                    <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        {editingNote === index ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              className="w-full px-2 py-1 border border-input bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  console.log("Saving edited note:", editNoteText);
                                  setEditingNote(null);
                                  setEditNoteText("");
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingNote(null);
                                  setEditNoteText("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm">{note.content}</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              <p>Created By: {note.createdBy}</p>
                              <p>Date: {formatDate(note.createdOn)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 bg-blue-500 text-white hover:bg-blue-600"
                          onClick={() => {
                            setEditingNote(index);
                            setEditNoteText(note.content);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 bg-red-500 text-white hover:bg-red-600"
                          onClick={() => {
                            console.log("Deleting note:", note);
                          }}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No notes found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <CardTitle>Timeline</CardTitle>
                  <CardDescription>Loan timeline events</CardDescription>
                </div>
              </div>
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

      {/* Add Collateral Modal */}
      {showAddCollateral && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowAddCollateral(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Collateral</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddCollateral(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="collateral-type" className="block text-sm font-medium text-foreground mb-1">
                  Collateral Type *
                </label>
                <select
                  id="collateral-type"
                  value={collateralForm.collateralType}
                  onChange={(e) => setCollateralForm({...collateralForm, collateralType: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  required
                >
                  <option value="">Select collateral type</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="property">Property</option>
                  <option value="equipment">Equipment</option>
                  <option value="inventory">Inventory</option>
                  <option value="securities">Securities</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="collateral-value" className="block text-sm font-medium text-foreground mb-1">
                  Value *
                </label>
                <input
                  type="number"
                  id="collateral-value"
                  value={collateralForm.value}
                  onChange={(e) => setCollateralForm({...collateralForm, value: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="Enter value"
                  required
                />
              </div>

              <div>
                <label htmlFor="collateral-description" className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <input
                  type="text"
                  id="collateral-description"
                  value={collateralForm.description}
                  onChange={(e) => setCollateralForm({...collateralForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="Enter description"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddCollateral(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Handle form submission here
                  console.log("Adding collateral:", collateralForm);
                  setShowAddCollateral(false);
                  setCollateralForm({ collateralType: "", value: "", description: "" });
                }}
                disabled={!collateralForm.collateralType || !collateralForm.value}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showReschedule && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowReschedule(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Reschedule Loan</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReschedule(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Reschedule from Installment On */}
              <div>
                <label htmlFor="reschedule-from-date" className="block text-sm font-medium text-foreground mb-1">
                  Reschedule from Installment On *
                </label>
                <input
                  type="date"
                  id="reschedule-from-date"
                  value={rescheduleForm.rescheduleFromDate}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, rescheduleFromDate: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  required
                />
              </div>

              {/* Reason for Rescheduling */}
              <div>
                <label htmlFor="reschedule-reason" className="block text-sm font-medium text-foreground mb-1">
                  Reason for Rescheduling *
                </label>
                <select
                  id="reschedule-reason"
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  required
                >
                  <option value="">Select reason</option>
                  <option value="client_request">Client Request</option>
                  <option value="financial_hardship">Financial Hardship</option>
                  <option value="natural_disaster">Natural Disaster</option>
                  <option value="business_difficulty">Business Difficulty</option>
                  <option value="other">Other</option>
                </select>
                {!rescheduleForm.reason && (
                  <p className="text-red-500 text-sm mt-1">Reason for Rescheduling is required</p>
                )}
              </div>

              {/* Submitted On */}
              <div>
                <label htmlFor="submitted-on" className="block text-sm font-medium text-foreground mb-1">
                  Submitted On *
                </label>
                <input
                  type="date"
                  id="submitted-on"
                  value={rescheduleForm.submittedOn}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, submittedOn: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  required
                />
              </div>

              {/* Comments */}
              <div>
                <label htmlFor="comments" className="block text-sm font-medium text-foreground mb-1">
                  Comments
                </label>
                <textarea
                  id="comments"
                  value={rescheduleForm.comments}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, comments: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-none"
                  rows={3}
                  placeholder="Enter comments"
                />
              </div>

              {/* Rescheduling Options */}
              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Rescheduling Options</h4>
                
                {/* Change Repayment Date */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="change-repayment-date"
                      checked={rescheduleForm.changeRepaymentDate}
                      onChange={(e) => setRescheduleForm({...rescheduleForm, changeRepaymentDate: e.target.checked})}
                      className="rounded border-input"
                    />
                    <label htmlFor="change-repayment-date" className="text-sm font-medium text-foreground">
                      Change Repayment Date
                    </label>
                  </div>
                  {rescheduleForm.changeRepaymentDate && (
                    <div>
                      <label htmlFor="installment-rescheduled-to" className="block text-sm font-medium text-foreground mb-1">
                        Installment Rescheduled to
                      </label>
                      <input
                        type="date"
                        id="installment-rescheduled-to"
                        value={rescheduleForm.installmentRescheduledTo}
                        onChange={(e) => setRescheduleForm({...rescheduleForm, installmentRescheduledTo: e.target.value})}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      />
                    </div>
                  )}
                </div>

                {/* Introduce Mid-term grace periods */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="introduce-grace-periods"
                      checked={rescheduleForm.introduceGracePeriods}
                      onChange={(e) => setRescheduleForm({...rescheduleForm, introduceGracePeriods: e.target.checked})}
                      className="rounded border-input"
                    />
                    <label htmlFor="introduce-grace-periods" className="text-sm font-medium text-foreground">
                      Introduce Mid-term grace periods
                    </label>
                  </div>
                  {rescheduleForm.introduceGracePeriods && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="principal-grace-periods" className="block text-sm font-medium text-foreground mb-1">
                          Principal Grace Periods
                        </label>
                        <input
                          type="number"
                          id="principal-grace-periods"
                          value={rescheduleForm.principalGracePeriods}
                          onChange={(e) => setRescheduleForm({...rescheduleForm, principalGracePeriods: e.target.value})}
                          className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="Enter periods"
                        />
                      </div>
                      <div>
                        <label htmlFor="interest-grace-periods" className="block text-sm font-medium text-foreground mb-1">
                          Interest Grace Periods
                        </label>
                        <input
                          type="number"
                          id="interest-grace-periods"
                          value={rescheduleForm.interestGracePeriods}
                          onChange={(e) => setRescheduleForm({...rescheduleForm, interestGracePeriods: e.target.value})}
                          className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="Enter periods"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Extend Repayment Period */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="extend-repayment-period"
                      checked={rescheduleForm.extendRepaymentPeriod}
                      onChange={(e) => setRescheduleForm({...rescheduleForm, extendRepaymentPeriod: e.target.checked})}
                      className="rounded border-input"
                    />
                    <label htmlFor="extend-repayment-period" className="text-sm font-medium text-foreground">
                      Extend Repayment Period
                    </label>
                  </div>
                  {rescheduleForm.extendRepaymentPeriod && (
                    <div>
                      <label htmlFor="number-of-new-repayments" className="block text-sm font-medium text-foreground mb-1">
                        Number Of new Repayments
                      </label>
                      <input
                        type="number"
                        id="number-of-new-repayments"
                        value={rescheduleForm.numberOfNewRepayments}
                        onChange={(e) => setRescheduleForm({...rescheduleForm, numberOfNewRepayments: e.target.value})}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                        placeholder="Enter number"
                      />
                    </div>
                  )}
                </div>

                {/* Adjust interest rates */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="adjust-interest-rate"
                      checked={rescheduleForm.adjustInterestRate}
                      onChange={(e) => setRescheduleForm({...rescheduleForm, adjustInterestRate: e.target.checked})}
                      className="rounded border-input"
                    />
                    <label htmlFor="adjust-interest-rate" className="text-sm font-medium text-foreground">
                      Adjust interest rates for remainder of loan
                    </label>
                  </div>
                  {rescheduleForm.adjustInterestRate && (
                    <div>
                      <label htmlFor="new-interest-rate" className="block text-sm font-medium text-foreground mb-1">
                        New Interest Rate
                      </label>
                      <input
                        type="number"
                        id="new-interest-rate"
                        value={rescheduleForm.newInterestRate}
                        onChange={(e) => setRescheduleForm({...rescheduleForm, newInterestRate: e.target.value})}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                        placeholder="Enter rate (%)"
                        step="0.01"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowReschedule(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Handle form submission here
                  console.log("Submitting reschedule:", rescheduleForm);
                  setShowReschedule(false);
                  setRescheduleForm({
                    rescheduleFromDate: "",
                    reason: "",
                    submittedOn: "",
                    comments: "",
                    changeRepaymentDate: false,
                    installmentRescheduledTo: "",
                    introduceGracePeriods: false,
                    principalGracePeriods: "",
                    interestGracePeriods: "",
                    extendRepaymentPeriod: false,
                    numberOfNewRepayments: "",
                    adjustInterestRate: false,
                    newInterestRate: ""
                  });
                }}
                disabled={!rescheduleForm.rescheduleFromDate || !rescheduleForm.reason || !rescheduleForm.submittedOn}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Documents Modal */}
      {showUploadDocuments && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowUploadDocuments(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Upload Documents</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUploadDocuments(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* File Name */}
              <div>
                <label htmlFor="document-file-name" className="block text-sm font-medium text-foreground mb-1">
                  File Name *
                </label>
                <input
                  type="text"
                  id="document-file-name"
                  value={documentForm.fileName}
                  onChange={(e) => setDocumentForm({...documentForm, fileName: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="Enter file name"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="document-description" className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <input
                  type="text"
                  id="document-description"
                  value={documentForm.description}
                  onChange={(e) => setDocumentForm({...documentForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="Enter description"
                />
              </div>

              {/* File Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  File
                </label>
                <div className="flex items-center justify-between p-3 border border-input bg-background rounded-md">
                  <span className="text-sm text-muted-foreground">
                    {documentForm.file ? documentForm.file.name : "No file selected"}
                  </span>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <input
                      type="file"
                      id="file-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDocumentForm({...documentForm, file});
                      }}
                      className="hidden"
                    />
                    <div className="flex items-center space-x-2 text-sm text-foreground hover:text-foreground/80">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8" />
                      </svg>
                      <span>Browse</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowUploadDocuments(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Handle form submission here
                  console.log("Uploading document:", documentForm);
                  setShowUploadDocuments(false);
                  setDocumentForm({ fileName: "", description: "", file: null });
                }}
                disabled={!documentForm.fileName || !documentForm.file}
                className="bg-gray-400 text-white hover:bg-gray-500"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 