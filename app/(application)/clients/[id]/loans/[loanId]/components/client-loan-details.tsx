"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { AlertCircle, Download, MoreVertical, X, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Edit, Flag, Plus, Heart, Coins, RotateCcw, Calendar, ChevronRight as ChevronRightIcon, User, Building, Phone, Mail, CreditCard, TrendingUp, Clock, FileText, Shield, DollarSign, Percent, CalendarDays, Settings, Trash2, StickyNote } from "lucide-react";
import { ClientTransactions } from "../../../components/client-transactions";
import { RepaymentModal } from "./repayment-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TransactionsDataTable } from "./transactions-data-table";

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
  const router = useRouter();
  const [client, setClient] = useState<FineractClient | null>(null);
  const [loan, setLoan] = useState<FineractLoan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCollateral, setShowAddCollateral] = useState(false);
  const [collateralForm, setCollateralForm] = useState({
    collateralTypeId: "",
    value: "",
    description: "",
    locale: "en"
  });
  const [collaterals, setCollaterals] = useState<any[]>([]);
  const [collateralTypes, setCollateralTypes] = useState<any[]>([]);
  const [loadingCollaterals, setLoadingCollaterals] = useState(false);
  const [submittingCollateral, setSubmittingCollateral] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [reschedules, setReschedules] = useState<any[]>([]);
  const [rescheduleReasons, setRescheduleReasons] = useState<any[]>([]);
  const [loadingReschedules, setLoadingReschedules] = useState(false);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [showUploadDocuments, setShowUploadDocuments] = useState(false);
  const [submittingDocument, setSubmittingDocument] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    fileName: "",
    description: "",
    file: null as File | null,
  });
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showEditNote, setShowEditNote] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    rescheduleFromDate: new Date().toISOString().split('T')[0], // Today's date
    rescheduleReasonId: "",
    rescheduleReasonComment: "",
    submittedOnDate: new Date().toISOString().split('T')[0], // Today's date
    adjustedDueDate: "",
    extraTerms: "",
    newInterestRate: "",
    graceOnPrincipal: "",
    graceOnInterest: "",
    loanId: loanId.toString(),
    locale: "en",
    dateFormat: "dd MMMM yyyy",
    // Legacy fields for form compatibility
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
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState("");

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportDateRange, setExportDateRange] = useState({
    fromDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    toDate: new Date().toISOString().split('T')[0]
  });
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  
  // Add Loan Charge Modal State
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [chargeTemplate, setChargeTemplate] = useState<any>(null);
  const [isLoadingChargeTemplate, setIsLoadingChargeTemplate] = useState(false);
  const [isSubmittingCharge, setIsSubmittingCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    chargeId: '',
    amount: '',
  });

  // Foreclosure Modal State
  const [showForeclosureModal, setShowForeclosureModal] = useState(false);
  const [foreclosureTemplate, setForeclosureTemplate] = useState<any>(null);
  const [isLoadingForeclosureTemplate, setIsLoadingForeclosureTemplate] = useState(false);
  const [isSubmittingForeclosure, setIsSubmittingForeclosure] = useState(false);
  const [foreclosureForm, setForeclosureForm] = useState({
    transactionDate: '',
    principal: '',
    interest: '',
    feeAmount: '',
    penaltyAmount: '',
    transactionAmount: '',
    note: '',
  });

  // Close actions menu when clicking outside


  // Fetch collateral data when collateral tab is active
  useEffect(() => {
    if (activeTab === "collateral" && loan) {
      fetchCollaterals();
    }
  }, [activeTab, loan]);

  // Fetch collateral template when add collateral modal opens
  useEffect(() => {
    if (showAddCollateral) {
      fetchCollateralTemplate();
    }
  }, [showAddCollateral]);

  // Fetch reschedule data when reschedule tab is active
  useEffect(() => {
    if (activeTab === "loan-reschedules" && loan) {
      fetchReschedules();
    }
  }, [activeTab, loan]);

  // Fetch reschedule template when reschedule modal opens
  useEffect(() => {
    if (showReschedule) {
      fetchRescheduleTemplate();
    }
  }, [showReschedule]);

  // Fetch documents data when documents tab is active
  useEffect(() => {
    if (activeTab === "loan-documents" && loan) {
      fetchDocuments();
    }
  }, [activeTab, loan]);

  // Fetch notes data when notes tab is active
  useEffect(() => {
    if (activeTab === "notes" && loan) {
      fetchNotes();
    }
  }, [activeTab, loan]);

  // Mount Loan Actions button to header container
  useEffect(() => {
    const container = document.getElementById('loan-actions-container');
    if (container && loan) {
      // Create the loan actions element with dropdown
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'relative';
      actionsDiv.innerHTML = `
        <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 shadow-sm" id="loan-actions-trigger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Loan Actions</span>
        </button>
        <div class="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 hidden" id="loan-actions-dropdown">
          <div class="py-2">
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="add-charge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/>
                <path d="M12 5v14"/>
              </svg>
              Add Loan Charge
            </button>
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="foreclosure">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              Foreclosure
            </button>
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="make-repayment">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20m9-2-3-3m-6 3-3-3"/>
              </svg>
              Make Repayment
            </button>
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="undo-disbursal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7v6h6"/>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
              </svg>
              Undo Disbursal
            </button>
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="add-interest-pause">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Add Interest Pause
            </button>
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="prepay-loan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20m9-2-3-3m-6 3-3-3"/>
              </svg>
              Prepay Loan
            </button>
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="charge-off">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20m9-2-3-3m-6 3-3-3"/>
              </svg>
              Charge-Off
            </button>
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="re-age">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Re-Age
            </button>
            <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="re-amortize">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Re-Amortize
            </button>
            <div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>
            <div class="relative" id="payments-container">
              <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between text-sm" data-action="payments" id="payments-trigger">
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  Payments
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9,18 15,12 9,6"/>
                </svg>
              </button>
              <!-- Payments Submenu -->
              <div class="absolute right-full top-0 mr-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[60]" id="payments-submenu" style="display: none;">
                <div class="py-2">
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="goodwill-credit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2v20m9-2-3-3m-6 3-3-3"/>
                    </svg>
                    Goodwill Credit
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="interest-payment-waiver">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    Interest Payment Waiver
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="payout-refund">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 7v6h6"/>
                      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                    </svg>
                    Payout Refund
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="merchant-issued-refund">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                    Merchant Issued Refund
                  </button>
                </div>
              </div>
            </div>
            <div class="relative" id="more-container">
              <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between text-sm" data-action="more" id="more-trigger">
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="1"/>
                    <circle cx="19" cy="12" r="1"/>
                    <circle cx="5" cy="12" r="1"/>
                  </svg>
                  More
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9,18 15,12 9,6"/>
                </svg>
              </button>
              <!-- More Submenu -->
              <div class="absolute right-full top-0 mr-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[60]" id="more-submenu" style="display: none;">
                <div class="py-2">
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="waive-interest">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    Waive Interest
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="reschedule">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Reschedule
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="write-off">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    Write Off
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="close-as-rescheduled">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Close (as Rescheduled)
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    Close
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="loan-screen-report">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                    </svg>
                    Loan Screen Report
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="view-guarantors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    View Guarantors
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="create-guarantor">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Create Guarantor
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="recover-from-guarantor">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 7v6h6"/>
                      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                    </svg>
                    Recover From Guarantor
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm" data-action="sell-loan">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"/>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    Sell Loan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      container.appendChild(actionsDiv);
      
              // Add click handlers
        const button = container.querySelector('#loan-actions-trigger');
        const dropdown = container.querySelector('#loan-actions-dropdown');
        const paymentsSubmenu = container.querySelector('#payments-submenu');
        const paymentsTrigger = container.querySelector('#payments-trigger');
        const moreSubmenu = container.querySelector('#more-submenu');
        const moreTrigger = container.querySelector('#more-trigger');

        console.log('Elements found:', {
          button: !!button,
          dropdown: !!dropdown,
          paymentsSubmenu: !!paymentsSubmenu,
          paymentsTrigger: !!paymentsTrigger,
          moreSubmenu: !!moreSubmenu,
          moreTrigger: !!moreTrigger
        });

        if (button && dropdown) {
          // Toggle dropdown on button click
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            if (paymentsSubmenu) paymentsSubmenu.style.display = 'none';
            if (moreSubmenu) moreSubmenu.style.display = 'none';
          });

          // Close dropdown when clicking outside
          document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
            if (paymentsSubmenu) paymentsSubmenu.style.display = 'none';
            if (moreSubmenu) moreSubmenu.style.display = 'none';
          });

          // Handle payments submenu
          if (paymentsTrigger && paymentsSubmenu) {
            console.log('Setting up payments submenu events');
            let submenuTimeout;
            
            // Show submenu on hover
            paymentsTrigger.addEventListener('mouseenter', () => {
              console.log('Payments hover - showing submenu');
              clearTimeout(submenuTimeout);
              paymentsSubmenu.style.display = 'block';
            });
            
            // Hide submenu with delay
            paymentsTrigger.addEventListener('mouseleave', () => {
              submenuTimeout = setTimeout(() => {
                paymentsSubmenu.style.display = 'none';
              }, 200);
            });

            // Keep submenu visible when hovering over it
            paymentsSubmenu.addEventListener('mouseenter', () => {
              clearTimeout(submenuTimeout);
            });

            // Hide submenu when leaving it
            paymentsSubmenu.addEventListener('mouseleave', () => {
              paymentsSubmenu.style.display = 'none';
            });

            // Also show submenu on click for mobile/touch devices
            paymentsTrigger.addEventListener('click', (e) => {
              console.log('Payments clicked - toggling submenu');
              e.preventDefault();
              e.stopPropagation();
              paymentsSubmenu.style.display = paymentsSubmenu.style.display === 'none' ? 'block' : 'none';
            });
          }

          // Handle more submenu
          if (moreTrigger && moreSubmenu) {
            console.log('Setting up more submenu events');
            let moreSubmenuTimeout;
            
            // Show submenu on hover
            moreTrigger.addEventListener('mouseenter', () => {
              console.log('More hover - showing submenu');
              clearTimeout(moreSubmenuTimeout);
              moreSubmenu.style.display = 'block';
            });
            
            // Hide submenu with delay
            moreTrigger.addEventListener('mouseleave', () => {
              moreSubmenuTimeout = setTimeout(() => {
                moreSubmenu.style.display = 'none';
              }, 200);
            });

            // Keep submenu visible when hovering over it
            moreSubmenu.addEventListener('mouseenter', () => {
              clearTimeout(moreSubmenuTimeout);
            });

            // Hide submenu when leaving it
            moreSubmenu.addEventListener('mouseleave', () => {
              moreSubmenu.style.display = 'none';
            });

            // Also show submenu on click for mobile/touch devices
            moreTrigger.addEventListener('click', (e) => {
              console.log('More clicked - toggling submenu');
              e.preventDefault();
              e.stopPropagation();
              moreSubmenu.style.display = moreSubmenu.style.display === 'none' ? 'block' : 'none';
            });
          }

          // Handle action clicks
          const actionButtons = dropdown.querySelectorAll('[data-action]');
          actionButtons.forEach(actionBtn => {
            actionBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const action = actionBtn.getAttribute('data-action');
              
              // Don't close dropdown for submenu triggers
              if (action !== 'payments' && action !== 'more') {
                dropdown.classList.add('hidden');
                if (paymentsSubmenu) paymentsSubmenu.style.display = 'none';
                if (moreSubmenu) moreSubmenu.style.display = 'none';
              }

              switch(action) {
              case 'add-charge':
                openAddChargeModal();
                break;
              case 'foreclosure':
                openForeclosureModal();
                break;
              case 'make-repayment':
                setShowRepaymentModal(true);
                break;
              case 'undo-disbursal':
                console.log("Undo Disbursal");
                break;
              case 'add-interest-pause':
                console.log("Add Interest Pause");
                break;
              case 'prepay-loan':
                console.log("Prepay Loan");
                break;
              case 'charge-off':
                console.log("Charge-Off");
                break;
              case 're-age':
                console.log("Re-Age");
                break;
              case 're-amortize':
                console.log("Re-Amortize");
                break;
              case 'payments':
                // Submenu handled by hover events
                break;
              case 'goodwill-credit':
                console.log("Goodwill Credit");
                break;
              case 'interest-payment-waiver':
                console.log("Interest Payment Waiver");
                break;
              case 'payout-refund':
                console.log("Payout Refund");
                break;
              case 'merchant-issued-refund':
                console.log("Merchant Issued Refund");
                break;
              case 'more':
                // Submenu handled by hover events
                break;
              case 'waive-interest':
                console.log("Waive Interest");
                break;
              case 'reschedule':
                console.log("Reschedule");
                break;
              case 'write-off':
                console.log("Write Off");
                break;
              case 'close-as-rescheduled':
                console.log("Close (as Rescheduled)");
                break;
              case 'close':
                console.log("Close");
                break;
              case 'loan-screen-report':
                console.log("Loan Screen Report");
                break;
              case 'view-guarantors':
                console.log("View Guarantors");
                break;
              case 'create-guarantor':
                console.log("Create Guarantor");
                break;
              case 'recover-from-guarantor':
                console.log("Recover From Guarantor");
                break;
              case 'sell-loan':
                console.log("Sell Loan");
                break;
              case 'view-journal':
                // View Journal Entry logic
                const parseTxDate = (d: any): number => {
                  if (!d) return 0;
                  if (typeof d === "string") return new Date(d).getTime();
                  if (Array.isArray(d) && d.length === 3) {
                    const [y, m, day] = d;
                    return new Date(y, m - 1, day).getTime();
                  }
                  return 0;
                };
                const latestTx = (loan?.transactions || []).reduce((latest: any, curr: any) => {
                  return parseTxDate(curr?.date) > parseTxDate(latest?.date) ? curr : latest;
                }, null as any);
                const chooseTxRef = (tx: any): string | undefined => {
                  if (!tx) return undefined;
                  if (typeof tx.transactionId === 'string' && /^L\\\\d+$/.test(tx.transactionId)) return tx.transactionId;
                  if (typeof tx.id === 'number') return 'L' + tx.id;
                  if (typeof tx.externalId === 'string' && /^L\\\\d+$/.test(tx.externalId)) return tx.externalId;
                  return undefined;
                };
                let txExternalId = chooseTxRef(latestTx);
                if (!txExternalId) {
                  alert('No transaction found with an externalId to view journal entries.');
                  return;
                }
                let txParam = String(txExternalId);
                const url = '/clients/' + clientId + '/loans/' + loanId + '/journal-entries?transactionId=' + encodeURIComponent(txParam);
                window.location.href = url;
                break;
            }
          });
        });
      }
    }
    
    // Cleanup function
    return () => {
      const container = document.getElementById('loan-actions-container');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [loan, clientId, loanId, setShowRepaymentModal]);

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

  const formatCurrency = (amount: number | undefined | null, currencyCode: string = "KES"): string => {
    // Return blank if amount is undefined, null, NaN, or 0
    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
      return "";
    }
    
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  };

  // Fetch collaterals for the loan
  const fetchCollaterals = async () => {
    setLoadingCollaterals(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/collaterals`);
      if (response.ok) {
        const data = await response.json();
        setCollaterals(Array.isArray(data) ? data : []);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch collaterals:", errorData);
        
        // Extract and show user-friendly error message
        let errorMessage = "Failed to fetch collaterals";
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Show error to user (you can replace alert with a proper toast notification)
        console.warn("Collateral fetch error:", errorMessage);
        setCollaterals([]);
      }
    } catch (error) {
      console.error("Error fetching collaterals:", error);
      setCollaterals([]);
    } finally {
      setLoadingCollaterals(false);
    }
  };

  // Fetch collateral types template
  const fetchCollateralTemplate = async () => {
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/collaterals/template`);
      if (response.ok) {
        const data = await response.json();
        setCollateralTypes(data.allowedCollateralTypes || []);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch collateral template:", errorData);
        
        // Extract and show user-friendly error message
        let errorMessage = "Failed to fetch collateral template";
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Show error to user
        console.warn("Collateral template fetch error:", errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        setCollateralTypes([]);
      }
    } catch (error) {
      console.error("Error fetching collateral template:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching collateral types",
        variant: "destructive",
      });
      setCollateralTypes([]);
    }
  };

  // Submit new collateral
  const handleSubmitCollateral = async () => {
    if (!collateralForm.collateralTypeId || !collateralForm.value) {
      return;
    }

    setSubmittingCollateral(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/collaterals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(collateralForm),
      });

      if (response.ok) {
        setShowAddCollateral(false);
        setCollateralForm({ 
          collateralTypeId: "", 
          value: "", 
          description: "",
          locale: "en"
        });
        // Refresh collaterals list
        fetchCollaterals();
        // Show success notification
        toast({
          title: "Success",
          description: "Collateral added successfully!",
          variant: "success",
        });
      } else {
        // Handle error response
        const errorData = await response.json();
        console.error("Failed to create collateral:", errorData);
        
        // Extract error message for user
        let errorMessage = "Failed to create collateral";
        
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Show error notification
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating collateral:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating collateral",
        variant: "destructive",
      });
    } finally {
      setSubmittingCollateral(false);
    }
  };

  // Fetch reschedules for the loan
  const fetchReschedules = async () => {
    setLoadingReschedules(true);
    try {
      const response = await fetch(`/api/fineract/rescheduleloans?loanId=${loanId}`);
      if (response.ok) {
        const data = await response.json();
        setReschedules(Array.isArray(data) ? data : []);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch reschedules:", errorData);
        
        // Extract and show user-friendly error message
        let errorMessage = "Failed to fetch reschedules";
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Show error to user (log for now, can be enhanced with toast later)
        console.warn("Reschedule fetch error:", errorMessage);
        setReschedules([]);
      }
    } catch (error) {
      console.error("Error fetching reschedules:", error);
      setReschedules([]);
    } finally {
      setLoadingReschedules(false);
    }
  };

  // Fetch reschedule reasons template
  const fetchRescheduleTemplate = async () => {
    try {
      const response = await fetch(`/api/fineract/rescheduleloans/template`);
      if (response.ok) {
        const data = await response.json();
        setRescheduleReasons(data.rescheduleReasons || []);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch reschedule template:", errorData);
        
        // Extract and show user-friendly error message
        let errorMessage = "Failed to fetch reschedule template";
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Show error to user
        console.warn("Reschedule template fetch error:", errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        setRescheduleReasons([]);
      }
    } catch (error) {
      console.error("Error fetching reschedule template:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching reschedule reasons",
        variant: "destructive",
      });
      setRescheduleReasons([]);
    }
  };

  // Submit new reschedule
  const handleSubmitReschedule = async () => {
    if (!rescheduleForm.rescheduleFromDate || !rescheduleForm.rescheduleReasonId || !rescheduleForm.submittedOnDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmittingReschedule(true);
    try {
      // Convert dates to required format (dd MMMM yyyy)
      const formatDateForAPI = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        });
      };

      const payload = {
        loanId: rescheduleForm.loanId,
        rescheduleFromDate: formatDateForAPI(rescheduleForm.rescheduleFromDate),
        rescheduleReasonId: rescheduleForm.rescheduleReasonId,
        rescheduleReasonComment: rescheduleForm.rescheduleReasonComment,
        submittedOnDate: formatDateForAPI(rescheduleForm.submittedOnDate),
        locale: rescheduleForm.locale,
        dateFormat: rescheduleForm.dateFormat,
        // Optional fields - include based on form checkboxes and values
        ...(rescheduleForm.changeRepaymentDate && rescheduleForm.installmentRescheduledTo && { 
          adjustedDueDate: formatDateForAPI(rescheduleForm.installmentRescheduledTo) 
        }),
        ...(rescheduleForm.extendRepaymentPeriod && rescheduleForm.numberOfNewRepayments && { 
          extraTerms: rescheduleForm.numberOfNewRepayments 
        }),
        ...(rescheduleForm.introduceGracePeriods && rescheduleForm.principalGracePeriods && { 
          graceOnPrincipal: rescheduleForm.principalGracePeriods 
        }),
        ...(rescheduleForm.introduceGracePeriods && rescheduleForm.interestGracePeriods && { 
          graceOnInterest: rescheduleForm.interestGracePeriods 
        }),
        ...(rescheduleForm.adjustInterestRates && rescheduleForm.interestRate && { 
          newInterestRate: rescheduleForm.interestRate 
        }),
      };

      console.log("Reschedule payload being sent:", payload);
      console.log("Form state:", rescheduleForm);

      const response = await fetch(`/api/fineract/rescheduleloans?command=reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowReschedule(false);
        setRescheduleForm({
          rescheduleFromDate: new Date().toISOString().split('T')[0],
          rescheduleReasonId: "",
          rescheduleReasonComment: "",
          submittedOnDate: new Date().toISOString().split('T')[0],
          adjustedDueDate: "",
          extraTerms: "",
          newInterestRate: "",
          graceOnPrincipal: "",
          graceOnInterest: "",
          loanId: loanId.toString(),
          locale: "en",
          dateFormat: "dd MMMM yyyy",
          // Reset legacy fields
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
          adjustInterestRates: false,
          newInterestRateFromDate: "",
          interestRate: ""
        });
        // Refresh reschedules list
        fetchReschedules();
        // Show success notification
        toast({
          title: "Success",
          description: "Loan reschedule request submitted successfully!",
          variant: "success",
        });
      } else {
        // Handle error response
        const errorData = await response.json();
        console.error("Failed to create reschedule:", errorData);
        
        // Extract error message for user
        let errorMessage = "Failed to create reschedule";
        
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Show error notification
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating reschedule:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating reschedule",
        variant: "destructive",
      });
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Fetch documents for the loan
  const fetchDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(Array.isArray(data) ? data : []);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch documents:", errorData);
        
        // Extract and show user-friendly error message
        let errorMessage = "Failed to fetch documents";
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Show error to user (log for now)
        console.warn("Documents fetch error:", errorMessage);
        setDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Download document
  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/documents/${documentId}/attachment`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Success",
          description: "Document downloaded successfully!",
          variant: "success",
        });
      } else {
        // Try to parse as JSON, but handle cases where it's not JSON
        let errorData: any = {};
        let errorMessage = "Failed to download document";
        
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            errorData = await response.json();
            console.error("Failed to download document:", errorData);
            
            if (errorData.defaultUserMessage) {
              errorMessage = errorData.defaultUserMessage;
            } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
              errorMessage = errorData.errors[0].defaultUserMessage;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } else {
            // Not JSON response, use status text
            const responseText = await response.text();
            console.error("Failed to download document (non-JSON):", response.status, response.statusText, responseText);
            errorMessage = `Download failed: ${response.status} ${response.statusText}`;
          }
        } catch (parseError) {
          console.error("Error parsing download response:", parseError);
          errorMessage = `Download failed: ${response.status} ${response.statusText}`;
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while downloading the document",
        variant: "destructive",
      });
    }
  };

  // Delete document with confirmation
  const handleDeleteDocument = async (documentId: string, fileName: string) => {
    // Simple confirmation dialog (you can replace with a proper modal)
    const confirmed = window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/documents/${documentId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        // Refresh documents list
        fetchDocuments();
        toast({
          title: "Success",
          description: "Document deleted successfully!",
          variant: "success",
        });
      } else {
        const errorData = await response.json();
        console.error("Failed to delete document:", errorData);
        
        let errorMessage = "Failed to delete document";
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the document",
        variant: "destructive",
      });
    }
  };

  // Submit new document
  const handleSubmitDocument = async () => {
    if (!documentForm.fileName || !documentForm.file) {
      toast({
        title: "Validation Error",
        description: "Please provide a file name and select a file",
        variant: "destructive",
      });
      return;
    }

    setSubmittingDocument(true);
    try {
      const formData = new FormData();
      formData.append('name', documentForm.fileName);
      formData.append('file', documentForm.file);
      if (documentForm.description) {
        formData.append('description', documentForm.description);
      }

      const response = await fetch(`/api/fineract/loans/${loanId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setShowUploadDocuments(false);
        setDocumentForm({ 
          fileName: "", 
          description: "", 
          file: null 
        });
        // Refresh documents list
        fetchDocuments();
        // Show success notification
        toast({
          title: "Success",
          description: "Document uploaded successfully!",
          variant: "success",
        });
      } else {
        // Handle error response
        let errorData: any = {};
        let errorMessage = "Failed to upload document";
        
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            errorData = await response.json();
            console.error("Failed to upload document:", errorData);
            
            if (errorData.defaultUserMessage) {
              errorMessage = errorData.defaultUserMessage;
            } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
              errorMessage = errorData.errors[0].defaultUserMessage;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } else {
            // Not JSON response, use status text
            const responseText = await response.text();
            console.error("Failed to upload document (non-JSON):", response.status, response.statusText, responseText);
            errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
          }
        } catch (parseError) {
          console.error("Error parsing upload response:", parseError);
          errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
        }
        
        // Show error notification
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while uploading document",
        variant: "destructive",
      });
    } finally {
      setSubmittingDocument(false);
    }
  };

  // Fetch notes for the loan
  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/notes`);
      if (response.ok) {
        const data = await response.json();
        setNotes(Array.isArray(data) ? data : []);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch notes:", errorData);
        
        // Extract and show user-friendly error message
        let errorMessage = "Failed to fetch notes";
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Show error to user (log for now)
        console.warn("Notes fetch error:", errorMessage);
        setNotes([]);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Add new note
  const handleAddNote = async (noteText: string) => {
    if (!noteText.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a note",
        variant: "destructive",
      });
      return;
    }

    setSubmittingNote(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() }),
      });

      if (response.ok) {
        // Refresh notes list
        fetchNotes();
        // Show success notification
        toast({
          title: "Success",
          description: "Note added successfully!",
          variant: "success",
        });
      } else {
        // Handle error response
        let errorData: any = {};
        let errorMessage = "Failed to add note";
        
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            errorData = await response.json();
            console.error("Failed to add note:", errorData);
            
            if (errorData.defaultUserMessage) {
              errorMessage = errorData.defaultUserMessage;
            } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
              errorMessage = errorData.errors[0].defaultUserMessage;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } else {
            const responseText = await response.text();
            console.error("Failed to add note (non-JSON):", response.status, response.statusText, responseText);
            errorMessage = `Add note failed: ${response.status} ${response.statusText}`;
          }
        } catch (parseError) {
          console.error("Error parsing add note response:", parseError);
          errorMessage = `Add note failed: ${response.status} ${response.statusText}`;
        }
        
        // Show error notification
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding note:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding note",
        variant: "destructive",
      });
    } finally {
      setSubmittingNote(false);
    }
  };

  // Edit note
  const handleEditNote = async (noteId: string, noteText: string) => {
    if (!noteText.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a note",
        variant: "destructive",
      });
      return;
    }

    setSubmittingNote(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() }),
      });

      if (response.ok) {
        setShowEditNote(false);
        setEditingNote(null);
        setEditNoteText("");
        // Refresh notes list
        fetchNotes();
        // Show success notification
        toast({
          title: "Success",
          description: "Note updated successfully!",
          variant: "success",
        });
      } else {
        // Handle error response
        let errorData: any = {};
        let errorMessage = "Failed to update note";
        
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            errorData = await response.json();
            console.error("Failed to update note:", errorData);
            
            if (errorData.defaultUserMessage) {
              errorMessage = errorData.defaultUserMessage;
            } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
              errorMessage = errorData.errors[0].defaultUserMessage;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } else {
            const responseText = await response.text();
            console.error("Failed to update note (non-JSON):", response.status, response.statusText, responseText);
            errorMessage = `Update note failed: ${response.status} ${response.statusText}`;
          }
        } catch (parseError) {
          console.error("Error parsing update note response:", parseError);
          errorMessage = `Update note failed: ${response.status} ${response.statusText}`;
        }
        
        // Show error notification
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating note:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating note",
        variant: "destructive",
      });
    } finally {
      setSubmittingNote(false);
    }
  };

  // Delete note with confirmation
  const handleDeleteNote = async (noteId: string, noteText: string) => {
    // Simple confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete this note? "${noteText.substring(0, 50)}${noteText.length > 50 ? '...' : ''}"\n\nThis action cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/notes/${noteId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        // Refresh notes list
        fetchNotes();
        toast({
          title: "Success",
          description: "Note deleted successfully!",
          variant: "success",
        });
      } else {
        let errorData: any = {};
        let errorMessage = "Failed to delete note";
        
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            errorData = await response.json();
            console.error("Failed to delete note:", errorData);
            
            if (errorData.defaultUserMessage) {
              errorMessage = errorData.defaultUserMessage;
            } else if (errorData.errors && errorData.errors.length > 0 && errorData.errors[0].defaultUserMessage) {
              errorMessage = errorData.errors[0].defaultUserMessage;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } else {
            const responseText = await response.text();
            console.error("Failed to delete note (non-JSON):", response.status, response.statusText, responseText);
            errorMessage = `Delete note failed: ${response.status} ${response.statusText}`;
          }
        } catch (parseError) {
          console.error("Error parsing delete note response:", parseError);
          errorMessage = `Delete note failed: ${response.status} ${response.statusText}`;
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting note",
        variant: "destructive",
      });
    }
  };

  const exportTransactionsToPDF = () => {
    if (!loan || !loan.transactions) {
      console.warn('No transaction data available for PDF export');
      return;
    }

    // Filter transactions by date range
    const filteredTransactions = loan.transactions.filter((transaction: any) => {
      if (!transaction.date) return false;
      const transactionDate = new Date(transaction.date);
      const fromDate = new Date(exportDateRange.fromDate);
      const toDate = new Date(exportDateRange.toDate);
      return transactionDate >= fromDate && transactionDate <= toDate;
    });

    if (filteredTransactions.length === 0) {
      alert('No transactions found for the selected date range');
      return;
    }

    // Import jsPDF dynamically to avoid SSR issues
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then((autoTable) => {
        const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
        
        // Set modern fonts and colors
        pdf.setFont('helvetica');
        
        // Add modern header
        pdf.setFillColor(30, 64, 175); // Dark blue background
        pdf.rect(0, 0, 297, 30, 'F');
        
        // Add title
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Loan Transaction History', 148, 12, { align: 'center' });
        
        // Add client and loan information
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const clientName = client?.displayName || `Client #${clientId}`;
        const loanName = loan.accountNo || `Loan #${loanId}`;
        pdf.text(`Client: ${clientName} | Loan: ${loanName}`, 148, 20, { align: 'center' });
        pdf.text(`Date Range: ${exportDateRange.fromDate} to ${exportDateRange.toDate}`, 148, 26, { align: 'center' });
        pdf.setTextColor(0, 0, 0);

        // Summary section
        const currencyCode = loan.currency?.code || 'USD';
        const totalAmount = filteredTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        const totalPrincipal = filteredTransactions.reduce((sum: number, t: any) => sum + (t.principalPortion || 0), 0);
        const totalInterest = filteredTransactions.reduce((sum: number, t: any) => sum + (t.interestPortion || 0), 0);
        const totalFees = filteredTransactions.reduce((sum: number, t: any) => sum + (t.feeChargesPortion || 0), 0);
        const totalPenalties = filteredTransactions.reduce((sum: number, t: any) => sum + (t.penaltyChargesPortion || 0), 0);

        const summaryData = [
          ['Total Transactions', filteredTransactions.length.toString()],
          ['Total Amount', formatCurrency(totalAmount, currencyCode)],
          ['Total Principal', formatCurrency(totalPrincipal, currencyCode)],
          ['Total Interest', formatCurrency(totalInterest, currencyCode)],
          ['Total Fees', formatCurrency(totalFees, currencyCode)],
          ['Total Penalties', formatCurrency(totalPenalties, currencyCode)],
          ['Currency', currencyCode]
        ];

        autoTable.default(pdf, {
          startY: 35,
          head: [['Category', 'Amount']],
          body: summaryData,
          theme: 'grid',
          headStyles: {
            fillColor: [30, 64, 175],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 9,
            cellPadding: 2
          },
          columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' }
          },
          margin: { left: 15, right: 15 }
        });

        // Prepare transaction data
        const tableData = filteredTransactions.map((transaction: any, index: number) => [
          (index + 1).toString(),
          transaction.id?.toString() || '',
          transaction.officeName || '',
          transaction.externalId || '',
          transaction.date ? formatDate(transaction.date) : '',
          transaction.type?.value || '',
          formatCurrency(transaction.amount, currencyCode),
          formatCurrency(transaction.principalPortion, currencyCode),
          formatCurrency(transaction.interestPortion, currencyCode),
          formatCurrency(transaction.feeChargesPortion, currencyCode),
          formatCurrency(transaction.penaltyChargesPortion, currencyCode),
          formatCurrency(transaction.outstandingLoanBalance, currencyCode)
        ]);

        // Add totals row
        const totalsRow = [
          'Total', '', '', '', '', '',
          formatCurrency(totalAmount, currencyCode),
          formatCurrency(totalPrincipal, currencyCode),
          formatCurrency(totalInterest, currencyCode),
          formatCurrency(totalFees, currencyCode),
          formatCurrency(totalPenalties, currencyCode),
          formatCurrency(filteredTransactions[filteredTransactions.length - 1]?.outstandingLoanBalance || 0, currencyCode)
        ];
        tableData.push(totalsRow);

        autoTable.default(pdf, {
          startY: 80,
          head: [
            ['#', 'Id', 'Office', 'External Id', 'Transaction Date', 'Transaction Type', 'Amount', 'Principal', 'Interest', 'Fees', 'Penalties', 'Loan Balance']
          ],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [30, 64, 175],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 8
          },
          styles: {
            fontSize: 7,
            cellPadding: 2,
            overflow: 'linebreak'
          },
          columnStyles: {
            0: { halign: 'center', fontStyle: 'bold' },
            1: { halign: 'center' },
            2: { halign: 'left' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'left' },
            6: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'right' },
            9: { halign: 'right' },
            10: { halign: 'right' },
            11: { halign: 'right' }
          },
          margin: { left: 15, right: 15 },
          didParseCell: function(data: any) {
            if (data.row.index === tableData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [243, 244, 246];
            }
          },
          didDrawPage: function(data: any) {
            const pageCount = (pdf as any).getNumberOfPages();
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Page ${data.pageNumber} of ${pageCount}`, 148, 205, { align: 'center' });
          }
        });

        const fileName = `loan-transactions-${exportDateRange.fromDate}-to-${exportDateRange.toDate}.pdf`;
        pdf.save(fileName);
        setShowExportDialog(false);
      });
    });
  };

  // Handle Add Loan Charge
  const fetchChargeTemplate = async () => {
    setIsLoadingChargeTemplate(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/charges/template`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || 'Failed to fetch charge template');
      }

      const data = await response.json();
      setChargeTemplate(data);
      
      // Set default values if available
      if (data.chargeOptions && data.chargeOptions.length > 0) {
        const firstCharge = data.chargeOptions[0];
        setChargeForm({
          chargeId: firstCharge.id.toString(),
          amount: firstCharge.amount ? firstCharge.amount.toString() : '',
        });
      }
    } catch (error: any) {
      console.error('Error fetching charge template:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch charge template",
      });
    } finally {
      setIsLoadingChargeTemplate(false);
    }
  };

  const handleSubmitCharge = async () => {
    if (!chargeForm.chargeId || !chargeForm.amount || isSubmittingCharge) return;

    setIsSubmittingCharge(true);
    try {
      const payload = {
        chargeId: parseInt(chargeForm.chargeId),
        amount: parseFloat(chargeForm.amount),
        dateFormat: "dd MMMM yyyy",
        locale: "en"
      };

      const response = await fetch(`/api/fineract/loans/${loanId}/charges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || 'Failed to add loan charge');
      }

      toast({
        title: "Success",
        description: "Loan charge added successfully",
      });

      setShowAddChargeModal(false);
      setChargeForm({ chargeId: '', amount: '' });
      // Refresh loan data if needed
    } catch (error: any) {
      console.error('Error adding loan charge:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add loan charge",
      });
    } finally {
      setIsSubmittingCharge(false);
    }
  };

  const openAddChargeModal = () => {
    setShowAddChargeModal(true);
    fetchChargeTemplate();
  };

  // Handle Foreclosure
  const fetchForeclosureTemplate = async () => {
    setIsLoadingForeclosureTemplate(true);
    try {
      // Get today's date in the required format
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const queryParams = new URLSearchParams({
        command: 'foreclosure',
        locale: 'en',
        dateFormat: 'dd MMMM yyyy',
        transactionDate: formattedDate
      });

      const response = await fetch(`/api/fineract/loans/${loanId}/transactions/template?${queryParams.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || 'Failed to fetch foreclosure template');
      }

      const data = await response.json();
      setForeclosureTemplate(data);
      
      // Set default values from the template
      setForeclosureForm({
        transactionDate: formattedDate,
        principal: data.principalPortion ? data.principalPortion.toString() : '',
        interest: data.interestPortion ? data.interestPortion.toString() : '',
        feeAmount: data.feeChargesPortion ? data.feeChargesPortion.toString() : '',
        penaltyAmount: data.penaltyChargesPortion ? data.penaltyChargesPortion.toString() : '',
        transactionAmount: data.amount ? data.amount.toString() : '',
        note: '',
      });
    } catch (error: any) {
      console.error('Error fetching foreclosure template:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch foreclosure template",
      });
    } finally {
      setIsLoadingForeclosureTemplate(false);
    }
  };

  const handleSubmitForeclosure = async () => {
    if (!foreclosureForm.transactionDate || isSubmittingForeclosure) return;

    setIsSubmittingForeclosure(true);
    try {
      const payload = {
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        transactionDate: foreclosureForm.transactionDate,
        note: foreclosureForm.note || ""
      };

      const response = await fetch(`/api/fineract/loans/${loanId}/transactions?command=foreclosure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || 'Failed to execute foreclosure');
      }

      toast({
        title: "Success",
        description: "Loan foreclosure executed successfully",
      });

      setShowForeclosureModal(false);
      setForeclosureForm({
        transactionDate: '',
        principal: '',
        interest: '',
        feeAmount: '',
        penaltyAmount: '',
        transactionAmount: '',
        note: '',
      });
      // Refresh loan data if needed
    } catch (error: any) {
      console.error('Error executing foreclosure:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to execute foreclosure",
      });
    } finally {
      setIsSubmittingForeclosure(false);
    }
  };

  const openForeclosureModal = () => {
    setShowForeclosureModal(true);
    fetchForeclosureTemplate();
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
    <div className="space-y-6">


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
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Client Information</CardTitle>
              <CardDescription className="text-sm">Basic client details and contact information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Full Name</span>
              </div>
              <p className="text-base font-medium">{client.displayName}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>Account No</span>
              </div>
              <p className="text-base font-medium">{client.accountNo}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Status</span>
              </div>
              <Badge variant={client.active ? "default" : "secondary"} className="text-sm">
                {client.status.value}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                <span>Office</span>
              </div>
              <p className="text-base font-medium">{client.officeName}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>Mobile</span>
              </div>
              <p className="text-base font-medium">{client.mobileNo || "N/A"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>Email</span>
              </div>
              <p className="text-base font-medium">{client.emailAddress || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap w-full bg-muted/50 p-1 rounded-lg gap-1">
          <TabsTrigger value="general" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">General</TabsTrigger>
          <TabsTrigger value="account-details" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Account Details</TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Repayment Schedule</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Transactions</TabsTrigger>
          <TabsTrigger value="collateral" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Collateral</TabsTrigger>
          <TabsTrigger value="overdue-charges" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Overdue</TabsTrigger>
          <TabsTrigger value="charges" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Charges</TabsTrigger>
          <TabsTrigger value="loan-reschedules" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Reschedules</TabsTrigger>
          <TabsTrigger value="loan-documents" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Documents</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap">Notes</TabsTrigger>

        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Performance History */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Performance History</CardTitle>
                  <CardDescription className="text-xs">Loan performance metrics and key dates</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Number of Repayments</p>
                  <p className="text-sm font-medium">{loan.numberOfRepayments}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Maturity Date</p>
                  <p className="text-sm font-medium">{loan.timeline.expectedMaturityDate ? formatDate(loan.timeline.expectedMaturityDate) : "Not set"}</p>
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
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <CreditCard className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Loan Details</CardTitle>
                  <CardDescription className="text-xs">Key loan information and specifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Disbursement Date</p>
                  <p className="text-sm font-medium">{loan.timeline.actualDisbursementDate ? formatDate(loan.timeline.actualDisbursementDate) : "Not disbursed"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Loan Purpose</p>
                  <p className="text-sm font-medium">{loan.loanPurpose?.name || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Loan Officer</p>
                  <p className="text-sm font-medium">{loan.loanOfficerName || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Currency</p>
                  <p className="text-sm font-medium">{loan.currency.name} {loan.currency.code}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">External Id</p>
                  <p className="text-sm font-medium">{loan.externalId || "Not Available"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Proposed Amount</p>
                  <p className="text-sm font-medium">{formatCurrency(loan.proposedPrincipal, loan.currency.code)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Approved Amount</p>
                  <p className="text-sm font-medium">{formatCurrency(loan.approvedPrincipal, loan.currency.code)}</p>
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
            </CardHeader>
            <CardContent>
              <TransactionsDataTable
                transactions={loan.transactions || []}
                clientId={clientId}
                loanId={loanId}
                currencyCode={loan.currency?.code || 'USD'}
                onExport={() => setShowExportDialog(true)}
              />
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
              {loadingCollaterals ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : collaterals && collaterals.length > 0 ? (
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
                      {collaterals.map((item: any, index: number) => (
                        <TableRow key={item.id || index}>
                          <TableCell>{item.type?.name || item.collateralType?.name || "N/A"}</TableCell>
                          <TableCell>{formatCurrency(item.value, loan?.currency?.code || "KES")}</TableCell>
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
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                    <select className="text-sm border rounded px-2 py-1" value="50">
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
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
              {loadingReschedules ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
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
                    {reschedules && reschedules.length > 0 ? (
                      reschedules.map((reschedule: any, index: number) => (
                        <TableRow key={reschedule.id || index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{formatDate(reschedule.rescheduleFromDate || reschedule.fromDate)}</TableCell>
                          <TableCell>{reschedule.rescheduleReason?.name || reschedule.reason || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={reschedule.status?.value === "Approved" ? "default" : "secondary"}>
                              {reschedule.status?.value || reschedule.status || "Pending"}
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
                          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No reschedules found for this loan</p>
                          <p className="text-sm mt-2">Click "Reschedule" to create a reschedule request</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              )}
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
              {loadingDocuments ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>File Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {documents && documents.length > 0 ? (
                        documents.map((document: any, index: number) => (
                          <TableRow key={document.id || index}>
                          <TableCell className="font-medium">{document.name}</TableCell>
                            <TableCell>{document.description || "N/A"}</TableCell>
                          <TableCell>{document.fileName}</TableCell>
                            <TableCell>{document.size ? `${(document.size / 1024).toFixed(1)} KB` : "N/A"}</TableCell>
                            <TableCell>{document.type || "N/A"}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 bg-blue-500 text-white hover:bg-blue-600"
                                  onClick={() => handleDownloadDocument(document.id, document.fileName)}
                                  title="Download"
                                >
                                <Download className="h-4 w-4" />
                              </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 bg-red-500 text-white hover:bg-red-600"
                                  onClick={() => handleDeleteDocument(document.id, document.fileName)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No documents found for this loan</p>
                            <p className="text-sm mt-2">Click "+ Add" to upload documents</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              )}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newNote.trim() && !submittingNote) {
                          handleAddNote(newNote);
                          setNewNote("");
                        }
                      }}
                    />
                    {!newNote && (
                      <p className="text-sm text-muted-foreground text-center mt-1">
                        Please fill in this field.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => {
                        if (newNote.trim() && !submittingNote) {
                          handleAddNote(newNote);
                          setNewNote("");
                        }
                      }}
                      disabled={!newNote.trim() || submittingNote}
                      className="bg-gray-300 text-gray-700 border border-gray-400 hover:bg-gray-400"
                    >
                      {submittingNote ? "Adding..." : "+ Add"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Notes List */}
              {loadingNotes ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
              <div className="space-y-4">
                  {notes && notes.length > 0 ? (
                    notes.map((note: any) => (
                    <div key={note.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        {editingNote === note.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              className="w-full px-2 py-1 border border-input bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && editNoteText.trim() && !submittingNote) {
                                  handleEditNote(note.id, editNoteText);
                                } else if (e.key === 'Escape') {
                                  setEditingNote(null);
                                  setEditNoteText("");
                                }
                              }}
                            />
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleEditNote(note.id, editNoteText)}
                                disabled={!editNoteText.trim() || submittingNote}
                              >
                                {submittingNote ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingNote(null);
                                  setEditNoteText("");
                                }}
                                disabled={submittingNote}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-foreground">{note.note}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <span>By {note.createdByUsername}</span>
                              <span>•</span>
                              <span>{new Date(note.createdOn).toLocaleDateString()} at {new Date(note.createdOn).toLocaleTimeString()}</span>
                              {note.noteType && (
                                <>
                                  <span>•</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {note.noteType.value}
                                  </Badge>
                                </>
                              )}
                              {note.loanTransactionId && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs">
                                    Transaction #{note.loanTransactionId}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {editingNote !== note.id && (
                      <div className="flex space-x-1">
                        <Button
                            variant="ghost"
                          size="sm"
                          onClick={() => {
                              setEditingNote(note.id);
                              setEditNoteText(note.note);
                          }}
                            className="h-6 w-6 p-0"
                            title="Edit note"
                        >
                            <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                          size="sm"
                            onClick={() => handleDeleteNote(note.id, note.note)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            title="Delete note"
                          >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                      <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No notes found for this loan</p>
                      <p className="text-sm mt-2">Add your first note above</p>
                  </div>
                )}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Repayment Modal */}
      <RepaymentModal
        isOpen={showRepaymentModal}
        onClose={() => setShowRepaymentModal(false)}
        loanId={loanId}
        onSuccess={() => {
          // Refresh loan data and switch to transactions tab
          window.location.reload();
          setActiveTab("transactions");
        }}
      />

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
                  value={collateralForm.collateralTypeId}
                  onChange={(e) => setCollateralForm({...collateralForm, collateralTypeId: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  required
                >
                  <option value="">Select collateral type</option>
                  {collateralTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
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
                onClick={() => {
                  setShowAddCollateral(false);
                  setCollateralForm({ 
                    collateralTypeId: "", 
                    value: "", 
                    description: "",
                    locale: "en"
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitCollateral}
                disabled={!collateralForm.collateralTypeId || !collateralForm.value || submittingCollateral}
              >
                {submittingCollateral ? "Submitting..." : "Submit"}
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
                  value={rescheduleForm.rescheduleReasonId}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, rescheduleReasonId: e.target.value, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  required
                >
                  <option value="">Select reason</option>
                  {rescheduleReasons.map((reason) => (
                    <option key={reason.id} value={reason.id}>
                      {reason.name}
                    </option>
                  ))}
                </select>
                {!rescheduleForm.rescheduleReasonId && (
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
                  value={rescheduleForm.submittedOnDate}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, submittedOnDate: e.target.value, submittedOn: e.target.value})}
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
                  value={rescheduleForm.rescheduleReasonComment}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, rescheduleReasonComment: e.target.value, comments: e.target.value})}
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
                onClick={() => {
                  setShowReschedule(false);
                  setRescheduleForm({
                    rescheduleFromDate: new Date().toISOString().split('T')[0],
                    rescheduleReasonId: "",
                    rescheduleReasonComment: "",
                    submittedOnDate: new Date().toISOString().split('T')[0],
                    adjustedDueDate: "",
                    extraTerms: "",
                    newInterestRate: "",
                    graceOnPrincipal: "",
                    graceOnInterest: "",
                    loanId: loanId.toString(),
                    locale: "en",
                    dateFormat: "dd MMMM yyyy",
                    // Reset legacy fields
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
                    adjustInterestRates: false,
                    newInterestRateFromDate: "",
                    interestRate: ""
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReschedule}
                disabled={!rescheduleForm.rescheduleFromDate || !rescheduleForm.rescheduleReasonId || !rescheduleForm.submittedOnDate || submittingReschedule}
              >
                {submittingReschedule ? "Submitting..." : "Submit"}
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
                onClick={() => {
                  setShowUploadDocuments(false);
                  setDocumentForm({ 
                    fileName: "", 
                    description: "", 
                    file: null 
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitDocument}
                disabled={!documentForm.fileName || !documentForm.file || submittingDocument}
                className="bg-gray-400 text-white hover:bg-gray-500"
              >
                {submittingDocument ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Transactions Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Transactions</DialogTitle>
            <DialogDescription>
              Select a date range to export loan transactions
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-date">From Date *</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={exportDateRange.fromDate}
                  onChange={(e) => setExportDateRange({...exportDateRange, fromDate: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-date">To Date *</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={exportDateRange.toDate}
                  onChange={(e) => setExportDateRange({...exportDateRange, toDate: e.target.value})}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={exportTransactionsToPDF} disabled={!exportDateRange.fromDate || !exportDateRange.toDate}>
              <Settings className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Loan Charge Modal */}
      <Dialog open={showAddChargeModal} onOpenChange={setShowAddChargeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Loan Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingChargeTemplate ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="charge">Charge *</Label>
                  <Select
                    value={chargeForm.chargeId}
                    onValueChange={(value) => {
                      setChargeForm(prev => ({ ...prev, chargeId: value }));
                      // Update amount based on selected charge
                      const selectedCharge = chargeTemplate?.chargeOptions?.find((c: any) => c.id.toString() === value);
                      if (selectedCharge?.amount) {
                        setChargeForm(prev => ({ ...prev, amount: selectedCharge.amount.toString() }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a charge" />
                    </SelectTrigger>
                    <SelectContent>
                      {chargeTemplate?.chargeOptions?.map((charge: any) => (
                        <SelectItem key={charge.id} value={charge.id.toString()}>
                          {charge.name} ({charge.currency?.displaySymbol}{charge.amount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={chargeForm.amount}
                    onChange={(e) => setChargeForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount"
                  />
                </div>

                {/* Read-only fields */}
                {chargeForm.chargeId && (() => {
                  const selectedCharge = chargeTemplate?.chargeOptions?.find((c: any) => c.id.toString() === chargeForm.chargeId);
                  return selectedCharge ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="chargeCalculation">Charge Calculation</Label>
                        <Input
                          id="chargeCalculation"
                          value={selectedCharge.chargeCalculationType?.value || '% Amount'}
                          disabled
                          className="bg-gray-100 cursor-not-allowed"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="chargeTime">Charge Time</Label>
                        <Input
                          id="chargeTime"
                          value={selectedCharge.chargeTimeType?.value || 'Disbursement'}
                          disabled
                          className="bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                    </>
                  ) : null;
                })()}
              </>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddChargeModal(false);
                setChargeForm({ chargeId: '', amount: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitCharge}
              disabled={!chargeForm.chargeId || !chargeForm.amount || isSubmittingCharge || isLoadingChargeTemplate}
            >
              {isSubmittingCharge ? "Adding..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Foreclosure Modal */}
      <Dialog open={showForeclosureModal} onOpenChange={setShowForeclosureModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Foreclosure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingForeclosureTemplate ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="transactionDate">Transaction Date *</Label>
                  <Input
                    id="transactionDate"
                    type="date"
                    value={foreclosureForm.transactionDate ? 
                      new Date(foreclosureForm.transactionDate).toISOString().split('T')[0] : 
                      new Date().toISOString().split('T')[0]
                    }
                    onChange={(e) => {
                      const selectedDate = new Date(e.target.value);
                      const formattedDate = selectedDate.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      });
                      setForeclosureForm(prev => ({ ...prev, transactionDate: formattedDate }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="principal">Principal</Label>
                  <Input
                    id="principal"
                    type="number"
                    step="0.01"
                    value={foreclosureForm.principal}
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interest">Interest</Label>
                  <Input
                    id="interest"
                    type="number"
                    step="0.01"
                    value={foreclosureForm.interest}
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feeAmount">Fee Amount</Label>
                  <Input
                    id="feeAmount"
                    type="number"
                    step="0.01"
                    value={foreclosureForm.feeAmount}
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="penaltyAmount">Penalty Amount</Label>
                  <Input
                    id="penaltyAmount"
                    type="number"
                    step="0.01"
                    value={foreclosureForm.penaltyAmount}
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transactionAmount">Transaction Amount</Label>
                  <Input
                    id="transactionAmount"
                    type="number"
                    step="0.01"
                    value={foreclosureForm.transactionAmount}
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note" className="text-blue-600">Note *</Label>
                  <textarea
                    id="note"
                    value={foreclosureForm.note}
                    onChange={(e) => setForeclosureForm(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Enter note"
                    className="w-full min-h-[60px] p-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowForeclosureModal(false);
                setForeclosureForm({
                  transactionDate: '',
                  principal: '',
                  interest: '',
                  feeAmount: '',
                  penaltyAmount: '',
                  transactionAmount: '',
                  note: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitForeclosure}
              disabled={!foreclosureForm.transactionDate || isSubmittingForeclosure || isLoadingForeclosureTemplate}
              className="bg-gray-500 hover:bg-gray-600"
            >
              {isSubmittingForeclosure ? "Processing..." : "Foreclosure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 