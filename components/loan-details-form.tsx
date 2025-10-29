"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calender";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-currency";

// Form validation schema
const loanDetailsSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  externalId: z.string().optional(),
  loanPurpose: z.string().optional(),
  submittedOn: z.date({
    required_error: "Submitted on date is required",
  }),
  loanOfficer: z.string().optional(),
  fund: z.string().optional(),
  disbursementOn: z.date({
    required_error: "Disbursement date is required",
  }),
  linkSavings: z.string().optional(),
  createStandingInstructions: z.boolean(),
});

type LoanDetailsFormData = z.infer<typeof loanDetailsSchema>;

interface LoanProduct {
  id: number;
  name: string;
}

interface LoanOfficer {
  id: number;
  firstname: string;
  lastname: string;
  displayName: string;
  officeId: number;
  officeName: string;
  isLoanOfficer: boolean;
  isActive: boolean;
}

interface LoanTemplate {
  clientId: number;
  clientAccountNo: string;
  clientName: string;
  clientExternalId: string;
  clientOfficeId: number;
  productOptions: LoanProduct[];
  loanOfficerOptions: LoanOfficer[];
  fundOptions: Array<{
    id: number;
    name: string;
  }>;
  loanPurposeOptions: Array<{
    id: number;
    name: string;
    position: number;
    description: string;
    active: boolean;
    mandatory: boolean;
  }>;
  expectedDisbursementDate: number[];
  principal?: number;
  interestRatePerPeriod?: number;
  loanTermFrequency?: number;
  loanTermFrequencyType?: number;
  numberOfRepayments?: number;
  repaymentEvery?: number;
  repaymentFrequencyType?: number;
  interestRateFrequencyType?: number;
  amortizationType?: { id: number };
  interestType?: { id: number };
  interestCalculationPeriodType?: { id: number };
  transactionProcessingStrategyCode?: string;
  productId?: number;
  fundId?: number;
  isEqualAmortization?: boolean;
  product?: {
    amortizationType?: { id: number };
    interestType?: { id: number };
    interestCalculationPeriodType?: { id: number };
    interestRateFrequencyType?: { id: number };
    repaymentFrequencyType?: { id: number };
    transactionProcessingStrategyCode?: string;
    isEqualAmortization?: boolean;
  };
}

interface RepaymentSchedulePeriod {
  period?: number;
  fromDate?: number[];
  dueDate: number[];
  daysInPeriod?: number;
  principalDue?: number;
  principalOriginalDue?: number;
  principalOutstanding?: number;
  principalLoanBalanceOutstanding?: number;
  interestDue?: number;
  interestOriginalDue?: number;
  interestOutstanding?: number;
  feeChargesDue?: number;
  feeChargesOutstanding?: number;
  penaltyChargesDue?: number;
  penaltyChargesOutstanding?: number;
  totalOriginalDueForPeriod?: number;
  totalDueForPeriod?: number;
  totalOutstandingForPeriod?: number;
  totalActualCostOfLoanForPeriod?: number;
  totalInstallmentAmountForPeriod?: number;
  downPaymentPeriod?: boolean;
}

interface RepaymentSchedule {
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displayLabel: string;
  };
  loanTermInDays: number;
  totalPrincipalDisbursed: number;
  totalPrincipalExpected: number;
  totalPrincipalPaid: number;
  totalInterestCharged: number;
  totalFeeChargesCharged: number;
  totalPenaltyChargesCharged: number;
  totalRepaymentExpected: number;
  totalOutstanding: number;
  periods: RepaymentSchedulePeriod[];
}

interface LoanDetailsFormProps {
  clientId: number;
  onSubmit: (data: LoanDetailsFormData) => void;
  onBack: () => void;
  onNext: (templateData?: LoanTemplate) => void;
}

export function LoanDetailsForm({ clientId, onSubmit, onBack, onNext }: LoanDetailsFormProps) {
  const [loanTemplate, setLoanTemplate] = useState<LoanTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCompleteTemplate, setHasCompleteTemplate] = useState(false);
  const [repaymentSchedule, setRepaymentSchedule] = useState<RepaymentSchedule | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);

  const form = useForm<LoanDetailsFormData>({
    resolver: zodResolver(loanDetailsSchema),
    defaultValues: {
      productName: '',
      externalId: '',
      submittedOn: new Date(),
      disbursementOn: new Date(),
      createStandingInstructions: false,
    },
  });

  // Fetch loan template data
  useEffect(() => {
    const fetchLoanTemplate = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // First, we need to get the product options to get a productId
        const productResponse = await fetch(
          `/api/fineract/loans/template?clientId=${clientId}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`
        );
        
        if (!productResponse.ok) {
          throw new Error('Failed to fetch product options');
        }
        
        const productData = await productResponse.json();
        console.log('Product options data:', productData); // Debug log
        
        // Set the product options
        setLoanTemplate(productData);
        
        // Set default values from template
        if (productData.productOptions && productData.productOptions.length > 0) {
          const firstProduct = productData.productOptions[0];
          form.setValue('productName', firstProduct.name);
          
          // Now fetch the detailed template with the selected product
          const templateResponse = await fetch(
            `/api/fineract/loans/template?clientId=${clientId}&productId=${firstProduct.id}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`
          );
          
          if (!templateResponse.ok) {
            throw new Error('Failed to fetch loan template');
          }
          
          const templateData = await templateResponse.json();
          console.log('Detailed loan template data:', templateData); // Debug log
          
          // Update the template with the detailed data
          setLoanTemplate(templateData);
          setHasCompleteTemplate(true);
          
          if (templateData.expectedDisbursementDate) {
            const [year, month, day] = templateData.expectedDisbursementDate;
            const disbursementDate = new Date(year, month - 1, day);
            form.setValue('disbursementOn', disbursementDate);
          }
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch loan template');
      } finally {
        setIsLoading(false);
      }
    };

    if (clientId) {
      fetchLoanTemplate();
    }
  }, [clientId, form]);

  const handleProductChange = async (productName: string) => {
    try {
      // Find the product by name to get its ID
      const selectedProduct = loanTemplate?.productOptions?.find(
        (product) => product.name === productName
      );
      
      if (selectedProduct) {
        // Fetch the detailed template for the selected product
        const response = await fetch(
          `/api/fineract/loans/template?clientId=${clientId}&productId=${selectedProduct.id}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch loan template for selected product');
        }
        
        const data = await response.json();
        console.log('Updated loan template data:', data); // Debug log
        
        // Update the template with the detailed data
        setLoanTemplate(data);
        
        // Update disbursement date if available
        if (data.expectedDisbursementDate) {
          const [year, month, day] = data.expectedDisbursementDate;
          const disbursementDate = new Date(year, month - 1, day);
          form.setValue('disbursementOn', disbursementDate);
        }
      }
    } catch (err) {
      console.error('Error fetching template for selected product:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch template for selected product');
    }
  };

  const handleGenerateSchedule = async () => {
    try {
      setIsGeneratingSchedule(true);
      setError(null);

      const formData = form.getValues();
      
      // Find selected product
      const selectedProduct = loanTemplate?.productOptions?.find(
        (p) => p.name === formData.productName
      );

      if (!selectedProduct || !loanTemplate) {
        throw new Error('Please select a product first');
      }

      // Build payload from form and template data
      // Use product object if available, otherwise fall back to template fields
      const product = loanTemplate.product;
      const amortizationTypeId = product?.amortizationType?.id || loanTemplate.amortizationType?.id || 1;
      const interestTypeId = product?.interestType?.id || loanTemplate.interestType?.id || 1;
      const interestCalcTypeId = product?.interestCalculationPeriodType?.id || loanTemplate.interestCalculationPeriodType?.id || 1;
      
      const payload = {
        allowPartialPeriodInterestCalcualtion: interestCalcTypeId === 0 || false,
        amortizationType: amortizationTypeId,
        charges: [],
        clientId: loanTemplate.clientId,
        collateral: [],
        createStandingInstructionAtDisbursement: formData.createStandingInstructions ? "true" : "",
        dateFormat: "dd MMMM yyyy",
        expectedDisbursementDate: format(formData.disbursementOn, "dd MMMM yyyy"),
        externalId: formData.externalId || "",
        fundId: formData.fund || loanTemplate.fundId?.toString() || "",
        interestCalculationPeriodType: interestCalcTypeId,
        interestChargedFromDate: null,
        interestRateFrequencyType: (typeof loanTemplate.interestRateFrequencyType === 'number' 
          ? loanTemplate.interestRateFrequencyType 
          : (product?.interestRateFrequencyType as any)?.id || 2),
        interestRatePerPeriod: loanTemplate.interestRatePerPeriod || 10,
        interestType: interestTypeId,
        isEqualAmortization: product?.isEqualAmortization !== undefined ? product.isEqualAmortization : (loanTemplate.isEqualAmortization || false),
        isTopup: "",
        linkAccountId: formData.linkSavings || "",
        loanIdToClose: "",
        loanOfficerId: formData.loanOfficer || "",
        loanPurposeId: formData.loanPurpose || "",
        loanTermFrequency: loanTemplate.loanTermFrequency || 1,
        loanTermFrequencyType: loanTemplate.loanTermFrequencyType || 2,
        loanType: "individual",
        locale: "en",
        numberOfRepayments: loanTemplate.numberOfRepayments || 1,
        principal: loanTemplate.principal || 100,
        productId: selectedProduct.id,
        repaymentEvery: loanTemplate.repaymentEvery || 1,
        repaymentFrequencyDayOfWeekType: "",
        repaymentFrequencyNthDayType: "",
        repaymentFrequencyType: (typeof loanTemplate.repaymentFrequencyType === 'number' 
          ? loanTemplate.repaymentFrequencyType 
          : (product?.repaymentFrequencyType as any)?.id || 2),
        repaymentsStartingFromDate: null,
        submittedOnDate: format(formData.submittedOn, "dd MMMM yyyy"),
        transactionProcessingStrategyCode: product?.transactionProcessingStrategyCode || loanTemplate.transactionProcessingStrategyCode || "creocore-strategy",
      };

      const response = await fetch('/api/fineract/loans/calculate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate repayment schedule');
      }

      const scheduleData = await response.json();
      setRepaymentSchedule(scheduleData);
      setIsScheduleModalOpen(true);
    } catch (err) {
      console.error('Error generating repayment schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate repayment schedule');
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const handleSubmit = (data: LoanDetailsFormData) => {
    console.log('LoanDetailsForm submitting with template:', loanTemplate);
    
    // Ensure we have complete template data before proceeding
    if (!hasCompleteTemplate || !loanTemplate || !loanTemplate.fundOptions || !loanTemplate.loanPurposeOptions) {
      console.error('Incomplete template data, cannot proceed');
      return;
    }
    
    // Set external ID to a placeholder that will be updated to loan ID after creation
    const formDataWithExternalId = {
      ...data,
      externalId: data.externalId || 'TEMP_LOAN_ID', // Will be updated to actual loan ID after creation
    };
    
    onSubmit(formDataWithExternalId);
    onNext(loanTemplate);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading loan template...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  // Don't render form if we don't have the template data
  if (!loanTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground">No loan template data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Loan Details</h2>
        <p className="text-muted-foreground">
          Enter the loan application details and requirements
        </p>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit as any)} className="space-y-8">
        {/* Main Form Fields - Two Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Product Name */}
            <div className="space-y-2">
              <Label htmlFor="productName" className="text-sm font-medium">
                Product Name <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleProductChange(value);
                    }} 
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate?.productOptions?.map((product) => (
                        <SelectItem key={product.id} value={product.name}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.productName && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.productName.message}
                </p>
              )}
            </div>

            {/* External ID: Set to hidden since the user does not need to enter it*/}
            <div className="space-y-2">
              <Input
                id="externalId"
                placeholder="Enter external ID"
                className="h-10"
                hidden={true}
                {...form.register("externalId")}
              />
            </div>

            {/* Loan Purpose */}
            <div className="space-y-2">
              <Label htmlFor="loanPurpose" className="text-sm font-medium">
                Loan Purpose
              </Label>
              <Controller
                control={form.control}
                name="loanPurpose"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate?.loanPurposeOptions?.length > 0 ? (
                        loanTemplate.loanPurposeOptions.map((purpose) => (
                          <SelectItem key={purpose.id} value={purpose.id.toString()}>
                            {purpose.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-options" disabled>No loan purposes available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Submitted On */}
            <div className="space-y-2">
              <Label htmlFor="submittedOn" className="text-sm font-medium">
                Submitted On <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="submittedOn"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-10 w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {form.formState.errors.submittedOn && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.submittedOn.message}
                </p>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Loan Officer */}
            <div className="space-y-2">
              <Label htmlFor="loanOfficer" className="text-sm font-medium">
                Loan Officer
              </Label>
              <Controller
                control={form.control}
                name="loanOfficer"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select loan officer" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate?.loanOfficerOptions?.map((officer) => (
                        <SelectItem key={officer.id} value={officer.displayName}>
                          {officer.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Fund */}
            <div className="space-y-2">
              <Label htmlFor="fund" className="text-sm font-medium">
                Fund
              </Label>
              <Controller
                control={form.control}
                name="fund"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select fund" />
                    </SelectTrigger>
                                            <SelectContent>
                          {loanTemplate?.fundOptions?.length > 0 ? (
                            loanTemplate.fundOptions.map((fund) => (
                              <SelectItem key={fund.id} value={fund.id.toString()}>
                                {fund.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-options" disabled>No funds available</SelectItem>
                          )}
                        </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Disbursement On */}
            <div className="space-y-2">
              <Label htmlFor="disbursementOn" className="text-sm font-medium">
                Disbursement On <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="disbursementOn"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-10 w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {form.formState.errors.disbursementOn && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.disbursementOn.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Savings Linkage Section */}
        <div className="space-y-4">
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">Savings Linkage</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Link Savings */}
              <div className="space-y-2">
                <Label htmlFor="linkSavings" className="text-sm font-medium">
                  Link Savings
                </Label>
                <Controller
                  control={form.control}
                  name="linkSavings"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select savings account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Savings Link</SelectItem>
                        <SelectItem value="auto">Auto-Debit from Savings</SelectItem>
                        <SelectItem value="manual">Manual Savings Link</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Create Standing Instructions */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="createStandingInstructions"
                    checked={form.watch("createStandingInstructions")}
                    onCheckedChange={(checked) =>
                      form.setValue("createStandingInstructions", checked as boolean)
                    }
                  />
                  <Label
                    htmlFor="createStandingInstructions"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Create standing instructions at disbursement
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="px-6"
          >
            Previous
          </Button>
          
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateSchedule}
              disabled={isLoading || !hasCompleteTemplate || isGeneratingSchedule}
              className="px-6"
            >
              {isGeneratingSchedule ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Generate Repayment Schedule
                </>
              )}
            </Button>
            
            <div className="flex flex-col items-end gap-2">
              {!hasCompleteTemplate && !isLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading loan template data...
                </p>
              )}
              <Button 
                type="submit" 
                className="px-6"
                disabled={isLoading || !hasCompleteTemplate}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  'Next'
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Repayment Schedule Modal */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="!max-w-[85vw] !w-[85vw] max-h-[95vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Repayment Schedule</DialogTitle>
            <DialogDescription>
              Loan repayment schedule based on the current loan details
            </DialogDescription>
          </DialogHeader>
          
          {repaymentSchedule && (
            <div className="space-y-6">
              {/* Summary Information */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-muted rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Principal</p>
                  <p className="text-lg font-semibold break-words">
                    {formatCurrency(repaymentSchedule.totalPrincipalExpected, repaymentSchedule.currency.code)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Interest</p>
                  <p className="text-lg font-semibold break-words">
                    {formatCurrency(repaymentSchedule.totalInterestCharged, repaymentSchedule.currency.code)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Total Repayment</p>
                  <p className="text-lg font-semibold break-words">
                    {formatCurrency(repaymentSchedule.totalRepaymentExpected, repaymentSchedule.currency.code)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Term</p>
                  <p className="text-lg font-semibold">{repaymentSchedule.loanTermInDays} days</p>
                </div>
              </div>

              {/* Schedule Table */}
              <div className="rounded-md border w-full">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Period</TableHead>
                      <TableHead className="whitespace-nowrap">Due Date</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Principal Due</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Interest Due</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Fees</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Penalties</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Total Due</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Balance Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repaymentSchedule.periods
                      .filter((period) => period.period !== undefined && !period.downPaymentPeriod)
                      .map((period, index) => {
                        const dueDate = period.dueDate && Array.isArray(period.dueDate)
                          ? new Date(period.dueDate[0], period.dueDate[1] - 1, period.dueDate[2])
                          : null;

                        return (
                          <TableRow key={`period-${period.period || index}`}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {period.period ?? '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {dueDate ? format(dueDate, "MMM dd, yyyy") : '-'}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.principalDue || period.principalOriginalDue || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.interestDue || period.interestOriginalDue || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.feeChargesDue || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.penaltyChargesDue || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">
                              {formatCurrency(
                                period.totalDueForPeriod || period.totalOriginalDueForPeriod || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.principalLoanBalanceOutstanding || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
