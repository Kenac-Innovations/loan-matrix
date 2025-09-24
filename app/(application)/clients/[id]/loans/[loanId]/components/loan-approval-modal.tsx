"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

interface LoanApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  onApprovalSuccess: () => void;
}

interface ApprovalTemplate {
  approvalDate: number[];
  approvalAmount: number;
  netDisbursalAmount: number;
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    inMultiplesOf: number;
    displaySymbol: string;
    nameCode: string;
    displayLabel: string;
  };
}

interface MultiDisburseDetails {
  id: number;
  accountNo: string;
  status: {
    id: number;
    code: string;
    value: string;
    pendingApproval: boolean;
    waitingForDisbursal: boolean;
    active: boolean;
    closedObligationsMet: boolean;
    closedWrittenOff: boolean;
    closedRescheduled: boolean;
    closed: boolean;
    overpaid: boolean;
  };
  clientId: number;
  clientAccountNo: string;
  clientName: string;
  clientExternalId: string;
  clientOfficeId: number;
  loanProductId: number;
  loanProductName: string;
  isLoanProductLinkedToFloatingRate: boolean;
  fundId: number;
  fundName: string;
  loanPurposeId: number;
  loanPurposeName: string;
  loanOfficerId: number;
  loanOfficerName: string;
  loanType: {
    id: number;
    code: string;
    value: string;
  };
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
  netDisbursalAmount: number;
  termFrequency: number;
  termPeriodFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  interestRatePerPeriod: number;
  interestRateFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  annualInterestRate: number;
  isFloatingInterestRate: boolean;
  amortizationType: {
    id: number;
    code: string;
    value: string;
  };
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
  allowPartialPeriodInterestCalculation: boolean;
  inArrearsTolerance: number;
  transactionProcessingStrategyCode: string;
  transactionProcessingStrategyName: string;
  interestChargedFromDate: number[];
  expectedFirstRepaymentOnDate: number[];
  syncDisbursementWithMeeting: boolean;
  disallowExpectedDisbursements: boolean;
  timeline: {
    submittedOnDate: number[];
    submittedByUsername: string;
    submittedByFirstname: string;
    submittedByLastname: string;
    expectedDisbursementDate: number[];
    actualMaturityDate: number[];
    expectedMaturityDate: number[];
  };
  collateral: any[];
  disbursementDetails: any[];
  loanScheduleTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  loanScheduleProcessingTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  feeChargesAtDisbursementCharged: number;
  multiDisburseLoan: boolean;
  canDefineInstallmentAmount: boolean;
  canUseForTopup: boolean;
  isTopup: boolean;
  fraud: boolean;
  closureLoanId: number;
  inArrears: boolean;
  isNPA: boolean;
  overdueCharges: Array<{
    id: number;
    name: string;
    active: boolean;
    penalty: boolean;
    freeWithdrawal: boolean;
    isPaymentType: boolean;
    freeWithdrawalChargeFrequency: number;
    restartFrequency: number;
    restartFrequencyEnum: number;
    currency: {
      code: string;
      name: string;
      decimalPlaces: number;
      inMultiplesOf: number;
      displaySymbol: string;
      nameCode: string;
      displayLabel: string;
    };
    amount: number;
    chargeTimeType: {
      id: number;
      code: string;
      value: string;
    };
    chargeAppliesTo: {
      id: number;
      code: string;
      value: string;
    };
    chargeCalculationType: {
      id: number;
      code: string;
      value: string;
    };
    chargePaymentMode: {
      id: number;
      code: string;
      value: string;
    };
  }>;
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
  isInterestRecalculationEnabled: boolean;
  createStandingInstructionAtDisbursement: boolean;
  paidInAdvance: {
    paidInAdvance: number;
  };
  isVariableInstallmentsAllowed: boolean;
  minimumGap: number;
  maximumGap: number;
  isEqualAmortization: boolean;
  isRatesEnabled: boolean;
  delinquent: {
    availableDisbursementAmount: number;
    pastDueDays: number;
    delinquentDays: number;
    delinquentAmount: number;
    lastPaymentAmount: number;
    lastRepaymentAmount: number;
    delinquentPrincipal: number;
    delinquentInterest: number;
    delinquentFee: number;
    delinquentPenalty: number;
  };
  enableInstallmentLevelDelinquency: boolean;
  chargedOff: boolean;
  enableDownPayment: boolean;
  enableAutoRepaymentForDownPayment: boolean;
  interestRecognitionOnDisbursementDate: boolean;
  loanScheduleType: {
    id: number;
    code: string;
    value: string;
  };
  loanScheduleProcessingType: {
    id: number;
    code: string;
    value: string;
  };
  chargeOffBehaviour: {
    id: string;
    code: string;
    value: string;
  };
}

export function LoanApprovalModal({ isOpen, onClose, loanId, onApprovalSuccess }: LoanApprovalModalProps) {
  const [approvalTemplate, setApprovalTemplate] = useState<ApprovalTemplate | null>(null);
  const [multiDisburseDetails, setMultiDisburseDetails] = useState<MultiDisburseDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [approvedLoanAmount, setApprovedLoanAmount] = useState<number>(0);
  const [approvedOnDate, setApprovedOnDate] = useState<Date | undefined>(undefined);
  const [expectedDisbursementDate, setExpectedDisbursementDate] = useState<Date | undefined>(undefined);
  const [note, setNote] = useState("");

  // Fetch approval template and multi-disburse details when modal opens
  useEffect(() => {
    if (isOpen && loanId) {
      fetchApprovalData();
    }
  }, [isOpen, loanId]);

  const fetchApprovalData = async () => {
    setLoading(true);
    try {
      // Fetch approval template
      const templateResponse = await fetch(`/api/fineract/loans/${loanId}/approve?templateType=approval`);
      if (!templateResponse.ok) throw new Error('Failed to fetch approval template');
      const templateData = await templateResponse.json();
      setApprovalTemplate(templateData);

      // Fetch multi-disburse details
      const multiDisburseResponse = await fetch(`/api/fineract/loans/${loanId}?associations=multiDisburseDetails`);
      if (!multiDisburseResponse.ok) throw new Error('Failed to fetch multi-disburse details');
      const multiDisburseData = await multiDisburseResponse.json();
      setMultiDisburseDetails(multiDisburseData);

      // Set form defaults
      setApprovedLoanAmount(templateData.approvalAmount || 0);
      
      // Convert approval date array to Date object
      if (templateData.approvalDate && Array.isArray(templateData.approvalDate) && templateData.approvalDate.length === 3) {
        const [year, month, day] = templateData.approvalDate;
        setApprovedOnDate(new Date(year, month - 1, day));
      }

      // Set expected disbursement date from timeline, but ensure it's after approval date
      if (multiDisburseData.timeline?.expectedDisbursementDate && Array.isArray(multiDisburseData.timeline.expectedDisbursementDate) && multiDisburseData.timeline.expectedDisbursementDate.length === 3) {
        const [year, month, day] = multiDisburseData.timeline.expectedDisbursementDate;
        const timelineDate = new Date(year, month - 1, day);
        
        // If we have an approval date, ensure disbursement date is not before it
        if (approvedOnDate && timelineDate < approvedOnDate) {
          // Set disbursement date to the same as approval date if timeline date is before
          setExpectedDisbursementDate(approvedOnDate);
        } else {
          setExpectedDisbursementDate(timelineDate);
        }
      } else if (approvedOnDate) {
        // If no timeline date, set disbursement date to the same as approval date
        setExpectedDisbursementDate(approvedOnDate);
      }

    } catch (error) {
      console.error('Error fetching approval data:', error);
      toast({
        title: "Error",
        description: "Failed to load approval data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!approvedOnDate || !expectedDisbursementDate) {
      toast({
        title: "Validation Error",
        description: "Please select both approval date and expected disbursement date.",
        variant: "destructive",
      });
      return;
    }

    // Validate that disbursement date is not before approval date
    if (expectedDisbursementDate < approvedOnDate) {
      toast({
        title: "Validation Error",
        description: "Expected disbursement date cannot be before the approval date.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        approvedLoanAmount,
        approvedOnDate: format(approvedOnDate, "dd MMMM yyyy"),
        dateFormat: "dd MMMM yyyy",
        expectedDisbursementDate: format(expectedDisbursementDate, "dd MMMM yyyy"),
        locale: "en",
        note: note || "",
      };

      const response = await fetch(`/api/fineract/loans/${loanId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Extract the specific error message from the backend
        let errorMessage = 'Failed to approve loan';
        if (errorData.errorData?.defaultUserMessage) {
          errorMessage = errorData.errorData.defaultUserMessage;
        } else if (errorData.errorData?.developerMessage) {
          errorMessage = errorData.errorData.developerMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: "Success",
        description: "Loan has been approved successfully.",
      });

      onApprovalSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error approving loan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve loan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number, currency: any) => {
    if (!currency) return `$${amount.toFixed(2)}`;
    return `${currency.displaySymbol}${amount.toFixed(currency.decimalPlaces || 2)}`;
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading approval data...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Approve Loan</DialogTitle>
          <DialogDescription>
            Review and approve the loan application. All fields are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Loan Information Summary */}
          {multiDisburseDetails && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium">Loan Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Account No:</span>
                  <p className="font-medium">{multiDisburseDetails.accountNo}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Client:</span>
                  <p className="font-medium">{multiDisburseDetails.clientName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Product:</span>
                  <p className="font-medium">{multiDisburseDetails.loanProductName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Loan Officer:</span>
                  <p className="font-medium">{multiDisburseDetails.loanOfficerName}</p>
                </div>
              </div>
            </div>
          )}

          {/* Approval Amount */}
          <div className="space-y-2">
            <Label htmlFor="approvedAmount">Approved Loan Amount</Label>
            <div className="relative">
              <Input
                id="approvedAmount"
                type="number"
                step="0.01"
                value={approvedLoanAmount}
                onChange={(e) => setApprovedLoanAmount(parseFloat(e.target.value) || 0)}
                className="pr-20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {approvalTemplate?.currency?.displaySymbol || '$'}
              </div>
            </div>
            {approvalTemplate && (
              <p className="text-sm text-muted-foreground">
                Net Disbursal Amount: {formatCurrency(approvalTemplate.netDisbursalAmount, approvalTemplate.currency)}
              </p>
            )}
          </div>

          {/* Approval Date */}
          <div className="space-y-2">
            <Label>Approval Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !approvedOnDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {approvedOnDate ? format(approvedOnDate, "PPP") : "Select approval date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={approvedOnDate}
                  onSelect={setApprovedOnDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Expected Disbursement Date */}
          <div className="space-y-2">
            <Label>Expected Disbursement Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expectedDisbursementDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expectedDisbursementDate ? format(expectedDisbursementDate, "PPP") : "Select disbursement date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expectedDisbursementDate}
                  onSelect={setExpectedDisbursementDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-sm text-muted-foreground">
              Cannot be before the approval date
            </p>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea
              id="note"
              placeholder="Add any additional notes about the approval..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !approvedOnDate || !expectedDisbursementDate}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve Loan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
