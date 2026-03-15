"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Calendar, DollarSign, Clock, TrendingUp } from "lucide-react";

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
}

interface RescheduleReason {
  id: number;
  name: string;
  position: number;
  description: string;
  active: boolean;
  mandatory: boolean;
}

interface RescheduleTemplate {
  rescheduleReasons: RescheduleReason[];
}

interface LoanDetails {
  disbursementDate: number[];
  loanTermInDays: number;
  numberOfRepayments: number;
  repaymentScheduleInstallments?: Array<{
    dueDate: number[];
    installmentNumber: number;
  }>;
}

export function RescheduleModal({ isOpen, onClose, loanId }: RescheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState<RescheduleTemplate | null>(null);
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);
  const [formData, setFormData] = useState({
    rescheduleFromDate: "",
    rescheduleReasonId: "",
    submittedOnDate: "",
    rescheduleReasonComment: "",
    changeRepaymentDate: false,
    introduceGracePeriods: false,
    extendRepaymentPeriod: false,
    adjustInterestRates: false,
    adjustedDueDate: "",
    graceOnPrincipal: "",
    graceOnInterest: "",
    extraTerms: "",
    newInterestRate: "",
  });

  useEffect(() => {
    if (isOpen) {
      fetchTemplate();
      fetchLoanDetails();
    }
  }, [isOpen]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/fineract/rescheduleloans/template');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }

      const data = await response.json();
      setTemplate(data);
    } catch (error) {
      console.error("Error fetching template:", error);
      toast({
        title: "Error",
        description: "Failed to fetch reschedule template",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanDetails = async () => {
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch loan details: ${response.statusText}`);
      }

      const data = await response.json();
      setLoanDetails(data);
      
      // Set default dates based on loan details
      if (data.disbursementDate && data.disbursementDate.length === 3) {
        const disbursementDate = new Date(data.disbursementDate[0], data.disbursementDate[1] - 1, data.disbursementDate[2]);
        const today = new Date();
        
        // Set submittedOnDate to today or disbursement date + 1 day, whichever is later
        const minSubmittedDate = new Date(disbursementDate);
        minSubmittedDate.setDate(minSubmittedDate.getDate() + 1);
        
        const submittedOnDate = today > minSubmittedDate ? today : minSubmittedDate;
        
        // Set rescheduleFromDate to first installment date or disbursement date + 1 day
        let rescheduleFromDate = minSubmittedDate;
        if (data.repaymentScheduleInstallments && data.repaymentScheduleInstallments.length > 0) {
          const firstInstallment = data.repaymentScheduleInstallments[0];
          if (firstInstallment.dueDate && firstInstallment.dueDate.length === 3) {
            rescheduleFromDate = new Date(firstInstallment.dueDate[0], firstInstallment.dueDate[1] - 1, firstInstallment.dueDate[2]);
          }
        }
        
        setFormData(prev => ({
          ...prev,
          rescheduleFromDate: rescheduleFromDate.toISOString().split('T')[0],
          submittedOnDate: submittedOnDate.toISOString().split('T')[0],
        }));
      }
    } catch (error) {
      console.error("Error fetching loan details:", error);
      // Fallback to today's date if we can't fetch loan details
      const today = new Date().toISOString().split('T')[0];
      setFormData(prev => ({
        ...prev,
        rescheduleFromDate: today,
        submittedOnDate: today,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!template) return;

    try {
      setLoading(true);

      if (!formData.rescheduleFromDate || !formData.rescheduleReasonId || !formData.submittedOnDate) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      // Validate dates
      const dateValidation = validateDates();
      if (!dateValidation.isValid) {
        toast({
          title: "Validation Error",
          description: dateValidation.errors.join(". "),
          variant: "destructive",
        });
        return;
      }

      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      };

      const payload: any = {
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        loanId: loanId.toString(),
        rescheduleFromDate: formatDate(formData.rescheduleFromDate),
        rescheduleReasonId: parseInt(formData.rescheduleReasonId),
        submittedOnDate: formatDate(formData.submittedOnDate),
        rescheduleReasonComment: formData.rescheduleReasonComment,
      };

      if (formData.changeRepaymentDate && formData.adjustedDueDate) {
        payload.adjustedDueDate = formatDate(formData.adjustedDueDate);
      }

      if (formData.introduceGracePeriods) {
        if (formData.graceOnPrincipal) {
          payload.graceOnPrincipal = formData.graceOnPrincipal;
        }
        if (formData.graceOnInterest) {
          payload.graceOnInterest = formData.graceOnInterest;
        }
      }

      if (formData.extendRepaymentPeriod && formData.extraTerms) {
        payload.extraTerms = formData.extraTerms;
      }

      if (formData.adjustInterestRates && formData.newInterestRate) {
        payload.newInterestRate = formData.newInterestRate;
      }

      const response = await fetch('/api/fineract/rescheduleloans?command=reschedule', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData = {};
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const responseText = await response.text();
          if (responseText.trim()) {
            errorData = JSON.parse(responseText);
            
            if (errorData.details && errorData.details.defaultUserMessage) {
              errorMessage = errorData.details.defaultUserMessage;
            } else if (errorData.details && errorData.details.developerMessage) {
              errorMessage = errorData.details.developerMessage;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (e) {
          // Silent error handling
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: "Success",
        description: "Loan rescheduled successfully",
        variant: "default",
      });

      onClose();
      window.location.reload();
    } catch (error) {
      console.error("Error rescheduling loan:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reschedule loan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateDates = () => {
    if (!loanDetails) return { isValid: true, errors: [] };
    
    const errors: string[] = [];
    
    // Validate submittedOnDate is after disbursement date
    if (formData.submittedOnDate && loanDetails.disbursementDate) {
      const submittedDate = new Date(formData.submittedOnDate);
      const disbursementDate = new Date(loanDetails.disbursementDate[0], loanDetails.disbursementDate[1] - 1, loanDetails.disbursementDate[2]);
      
      if (submittedDate <= disbursementDate) {
        errors.push("Submitted date must be after the loan disbursement date");
      }
    }
    
    // Validate rescheduleFromDate is a valid installment date
    if (formData.rescheduleFromDate && loanDetails.repaymentScheduleInstallments) {
      const rescheduleDate = new Date(formData.rescheduleFromDate);
      const hasValidInstallment = loanDetails.repaymentScheduleInstallments.some(installment => {
        if (installment.dueDate && installment.dueDate.length === 3) {
          const installmentDate = new Date(installment.dueDate[0], installment.dueDate[1] - 1, installment.dueDate[2]);
          return installmentDate.getTime() === rescheduleDate.getTime();
        }
        return false;
      });
      
      if (!hasValidInstallment) {
        errors.push("Reschedule date must be a valid installment date from the loan's repayment schedule");
      }
    }
    
    return { isValid: errors.length === 0, errors };
  };

  if (!template) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule Loan</DialogTitle>
          <DialogDescription>
            Modify the loan repayment schedule and terms. Select the options you want to apply.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Reschedule from Installment On */}
            <div className="space-y-2">
              <Label htmlFor="rescheduleFromDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Reschedule from Installment On *
              </Label>
              <Input
                id="rescheduleFromDate"
                type="date"
                value={formData.rescheduleFromDate}
                onChange={(e) => handleInputChange("rescheduleFromDate", e.target.value)}
                required
                className="w-full"
              />
              {loanDetails && (
                <p className="text-xs text-muted-foreground">
                  Must be a valid installment date from the loan's repayment schedule
                </p>
              )}
            </div>

            {/* Reason for Rescheduling */}
            <div className="space-y-2">
              <Label htmlFor="rescheduleReasonId">Reason for Rescheduling *</Label>
              <select
                id="rescheduleReasonId"
                value={formData.rescheduleReasonId}
                onChange={(e) => handleInputChange("rescheduleReasonId", e.target.value)}
                required
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              >
                <option value="">Select a reason</option>
                {template.rescheduleReasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Submitted On */}
            <div className="space-y-2">
              <Label htmlFor="submittedOnDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Submitted On *
              </Label>
              <Input
                id="submittedOnDate"
                type="date"
                value={formData.submittedOnDate}
                onChange={(e) => handleInputChange("submittedOnDate", e.target.value)}
                required
                className="w-full"
              />
              {loanDetails && (
                <p className="text-xs text-muted-foreground">
                  Must be on or after the loan disbursement date
                </p>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="rescheduleReasonComment">Comments</Label>
              <Textarea
                id="rescheduleReasonComment"
                placeholder="Optional comments about the rescheduling..."
                value={formData.rescheduleReasonComment}
                onChange={(e) => handleInputChange("rescheduleReasonComment", e.target.value)}
                rows={3}
                className="w-full"
              />
            </div>

            {/* Available Installment Dates */}
            {loanDetails && loanDetails.repaymentScheduleInstallments && loanDetails.repaymentScheduleInstallments.length > 0 && (
              <div className="space-y-2 p-3 bg-muted rounded-md">
                <Label className="text-sm font-medium">Available Installment Dates</Label>
                <div className="text-xs text-muted-foreground">
                  <p>Select one of these dates for "Reschedule from Installment On":</p>
                  <div className="mt-2 space-y-1">
                    {loanDetails.repaymentScheduleInstallments.map((installment, index) => {
                      if (installment.dueDate && installment.dueDate.length === 3) {
                        const date = new Date(installment.dueDate[0], installment.dueDate[1] - 1, installment.dueDate[2]);
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <span className="font-mono text-xs">
                              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-muted-foreground">(Installment {installment.installmentNumber})</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Checkboxes and Conditional Fields */}
            <div className="space-y-4 border-t pt-4">
              {/* Change Repayment Date */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="changeRepaymentDate"
                    checked={formData.changeRepaymentDate}
                    onCheckedChange={(checked) => 
                      handleInputChange("changeRepaymentDate", checked as boolean)
                    }
                  />
                  <Label htmlFor="changeRepaymentDate">Change Repayment Date</Label>
                </div>
                {formData.changeRepaymentDate && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="adjustedDueDate">Installment Rescheduled to</Label>
                    <Input
                      id="adjustedDueDate"
                      type="date"
                      value={formData.adjustedDueDate}
                      onChange={(e) => handleInputChange("adjustedDueDate", e.target.value)}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Introduce Mid-term grace periods */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="introduceGracePeriods"
                    checked={formData.introduceGracePeriods}
                    onCheckedChange={(checked) => 
                      handleInputChange("introduceGracePeriods", checked as boolean)
                    }
                  />
                  <Label htmlFor="introduceGracePeriods">Introduce Mid-term grace periods</Label>
                </div>
                {formData.introduceGracePeriods && (
                  <div className="ml-6 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="graceOnPrincipal">Principal Grace Periods</Label>
                      <Input
                        id="graceOnPrincipal"
                        type="number"
                        min="0"
                        value={formData.graceOnPrincipal}
                        onChange={(e) => handleInputChange("graceOnPrincipal", e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="graceOnInterest">Interest Grace Periods</Label>
                      <Input
                        id="graceOnInterest"
                        type="number"
                        min="0"
                        value={formData.graceOnInterest}
                        onChange={(e) => handleInputChange("graceOnInterest", e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Extend Repayment Period */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="extendRepaymentPeriod"
                    checked={formData.extendRepaymentPeriod}
                    onCheckedChange={(checked) => 
                      handleInputChange("extendRepaymentPeriod", checked as boolean)
                    }
                  />
                  <Label htmlFor="extendRepaymentPeriod">Extend Repayment Period</Label>
                </div>
                {formData.extendRepaymentPeriod && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="extraTerms">Number Of new Repayments</Label>
                    <Input
                      id="extraTerms"
                      type="number"
                      min="1"
                      value={formData.extraTerms}
                      onChange={(e) => handleInputChange("extraTerms", e.target.value)}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Adjust interest rates */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="adjustInterestRates"
                    checked={formData.adjustInterestRates}
                    onCheckedChange={(checked) => 
                      handleInputChange("adjustInterestRates", checked as boolean)
                    }
                  />
                  <Label htmlFor="adjustInterestRates">Adjust interest rates for remainder of loan</Label>
                </div>
                {formData.adjustInterestRates && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="newInterestRate" className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      New Interest Rate (%)
                    </Label>
                    <Input
                      id="newInterestRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.newInterestRate}
                      onChange={(e) => handleInputChange("newInterestRate", e.target.value)}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
