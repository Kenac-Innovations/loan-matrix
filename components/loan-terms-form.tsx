"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
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
import { Calendar } from "@/components/ui/calender";
import { cn } from "@/lib/utils";

// Form validation schema for loan terms
const loanTermsSchema = z.object({
  // Principal
  principal: z.number().min(1, "Principal amount is required"),
  
  // Term Options
  loanTerm: z.number().min(1, "Loan term is required"),
  termFrequency: z.string().min(1, "Term frequency is required"),
  
  // Repayments
  numberOfRepayments: z.number().min(1, "Number of repayments is required"),
  firstRepaymentOn: z.date().optional(),
  interestChargedFrom: z.date().optional(),
  
  // Repaid Every
  repaymentEvery: z.number().min(1, "Repayment frequency is required"),
  repaymentFrequency: z.string().min(1, "Repayment frequency type is required"),
  repaymentFrequencyNthDay: z.string().optional(),
  repaymentFrequencyDayOfWeek: z.string().optional(),
  
  // Nominal Interest Rate
  nominalInterestRate: z.number().min(0, "Interest rate must be positive"),
  interestRateFrequency: z.string().min(1, "Interest rate frequency is required"),
  interestMethod: z.string().min(1, "Interest method is required"),
  amortization: z.string().min(1, "Amortization type is required"),
  isEqualAmortization: z.boolean().default(false),
  
  // Loan Schedule
  loanScheduleType: z.string().optional(),
  repaymentStrategy: z.string().min(1, "Repayment strategy is required"),
  balloonRepaymentAmount: z.number().optional(),
  
  // Interest Calculations
  interestCalculationPeriod: z.string().min(1, "Interest calculation period is required"),
  calculateInterestForExactDays: z.boolean().default(false),
  arrearsTolerance: z.number().optional(),
  interestFreePeriod: z.number().optional(),
  
  // Moratorium
  graceOnPrincipalPayment: z.number().optional(),
  graceOnInterestPayment: z.number().optional(),
  onArrearsAgeing: z.number().optional(),
  
  // Recalculate Interest
  recalculateInterest: z.string().optional(),
  
  // Collaterals
  collaterals: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    totalValue: z.number(),
  })).default([]),
});

type LoanTermsFormData = z.infer<typeof loanTermsSchema>;

interface LoanTemplate {
  principal: number;
  termFrequency: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  interestRatePerPeriod: number;
  expectedDisbursementDate: number[];
  termFrequencyTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  repaymentFrequencyTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  repaymentFrequencyNthDayTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  repaymentFrequencyDaysOfWeekTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  interestRateFrequencyTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  interestTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  amortizationTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  loanScheduleTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  transactionProcessingStrategyOptions: Array<{
    code: string;
    name: string;
  }>;
  interestCalculationPeriodTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  loanCollateralOptions: Array<{
    id: number;
    name: string;
    description: string;
    active: boolean;
  }>;
}

interface LoanTermsFormProps {
  loanTemplate: LoanTemplate | null;
  onSubmit: (data: LoanTermsFormData) => void;
  onBack: () => void;
  onNext: () => void;
}

export function LoanTermsForm({ loanTemplate, onSubmit, onBack, onNext }: LoanTermsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  console.log('LoanTermsForm received loanTemplate:', loanTemplate);

  const form = useForm<LoanTermsFormData>({
    resolver: zodResolver(loanTermsSchema),
    defaultValues: {
      principal: 0,
      loanTerm: 0,
      termFrequency: "",
      numberOfRepayments: 0,
      repaymentEvery: 0,
      repaymentFrequency: "",
      nominalInterestRate: 0,
      interestRateFrequency: "",
      interestMethod: "",
      amortization: "",
      isEqualAmortization: false,
      repaymentStrategy: "",
      interestCalculationPeriod: "",
      calculateInterestForExactDays: false,
      isEqualAmortization: false,
      collaterals: [],
    },
  });

  // Populate form with template data when it changes
  useEffect(() => {
    if (loanTemplate) {
      // Principal
      form.setValue('principal', loanTemplate.principal);
      
      // Term Options
      form.setValue('loanTerm', loanTemplate.termFrequency);
      if (loanTemplate.termFrequencyTypeOptions?.length > 0) {
        const defaultTermType = loanTemplate.termFrequencyTypeOptions.find(t => t.id === loanTemplate.termFrequency) || loanTemplate.termFrequencyTypeOptions[0];
        form.setValue('termFrequency', defaultTermType.id.toString());
      }
      
      // Repayments
      form.setValue('numberOfRepayments', loanTemplate.numberOfRepayments);
      form.setValue('repaymentEvery', loanTemplate.repaymentEvery);
      
      // Repayment Frequency
      if (loanTemplate.repaymentFrequencyTypeOptions?.length > 0) {
        const defaultRepaymentType = loanTemplate.repaymentFrequencyTypeOptions.find(t => t.id === loanTemplate.repaymentEvery) || loanTemplate.repaymentFrequencyTypeOptions[0];
        form.setValue('repaymentFrequency', defaultRepaymentType.id.toString());
      }
      
      // Interest Rate
      form.setValue('nominalInterestRate', loanTemplate.interestRatePerPeriod);
      
      // Interest Rate Frequency
      if (loanTemplate.interestRateFrequencyTypeOptions?.length > 0) {
        const defaultInterestType = loanTemplate.interestRateFrequencyTypeOptions.find(t => t.id === 2) || loanTemplate.interestRateFrequencyTypeOptions[0];
        form.setValue('interestRateFrequency', defaultInterestType.id.toString());
      }
      
      // Interest Method
      if (loanTemplate.interestTypeOptions?.length > 0) {
        const defaultInterestMethod = loanTemplate.interestTypeOptions.find(t => t.id === 1) || loanTemplate.interestTypeOptions[0];
        form.setValue('interestMethod', defaultInterestMethod.id.toString());
      }
      
      // Amortization
      if (loanTemplate.amortizationTypeOptions?.length > 0) {
        const defaultAmortization = loanTemplate.amortizationTypeOptions.find(t => t.id === 1) || loanTemplate.amortizationTypeOptions[0];
        form.setValue('amortization', defaultAmortization.id.toString());
      }
      
      // Repayment Strategy
      if (loanTemplate.transactionProcessingStrategyOptions?.length > 0) {
        const defaultStrategy = loanTemplate.transactionProcessingStrategyOptions.find(t => t.code === 'creocore-strategy') || loanTemplate.transactionProcessingStrategyOptions[0];
        form.setValue('repaymentStrategy', defaultStrategy.code);
      }
      
      // Interest Calculation Period
      if (loanTemplate.interestCalculationPeriodTypeOptions?.length > 0) {
        const defaultCalcPeriod = loanTemplate.interestCalculationPeriodTypeOptions.find(t => t.id === 1) || loanTemplate.interestCalculationPeriodTypeOptions[0];
        form.setValue('interestCalculationPeriod', defaultCalcPeriod.id.toString());
      }
      
      // Set disbursement date for first repayment
      if (loanTemplate.expectedDisbursementDate) {
        const [year, month, day] = loanTemplate.expectedDisbursementDate;
        const disbursementDate = new Date(year, month - 1, day);
        form.setValue('firstRepaymentOn', disbursementDate);
        form.setValue('interestChargedFrom', disbursementDate);
      }
    }
  }, [loanTemplate, form]);

  const handleSubmit = (data: LoanTermsFormData) => {
    onSubmit(data);
    onNext();
  };

  const addCollateral = () => {
    const currentCollaterals = form.getValues('collaterals');
    form.setValue('collaterals', [
      ...currentCollaterals,
      { name: '', quantity: 0, totalValue: 0 }
    ]);
  };

  const removeCollateral = (index: number) => {
    const currentCollaterals = form.getValues('collaterals');
    form.setValue('collaterals', currentCollaterals.filter((_, i) => i !== index));
  };

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
        <h2 className="text-2xl font-bold tracking-tight">Loan Terms</h2>
        <p className="text-muted-foreground">
          Configure the loan terms and repayment schedule
        </p>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {/* Principal */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Principal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="principal" className="text-sm font-medium">
                Principal Amount
              </Label>
              <div className="relative">
                <Input
                  id="principal"
                  type="number"
                  step="0.01"
                  className="h-10 pr-16"
                  {...form.register("principal", { valueAsNumber: true })}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-sm text-muted-foreground">USD</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Term Options */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Term Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="loanTerm" className="text-sm font-medium">
                Loan Term
              </Label>
              <Input
                id="loanTerm"
                type="number"
                className="h-10"
                {...form.register("loanTerm", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="termFrequency" className="text-sm font-medium">
                Frequency
              </Label>
              <Controller
                control={form.control}
                name="termFrequency"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.termFrequencyTypeOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        {/* Repayments */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Repayments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="numberOfRepayments" className="text-sm font-medium">
                Number of repayments <span className="text-red-500">*</span>
              </Label>
              <Input
                id="numberOfRepayments"
                type="number"
                className="h-10"
                {...form.register("numberOfRepayments", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstRepaymentOn" className="text-sm font-medium">
                First repayment on
              </Label>
              <Controller
                control={form.control}
                name="firstRepaymentOn"
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestChargedFrom" className="text-sm font-medium">
                Interest charged from
              </Label>
              <Controller
                control={form.control}
                name="interestChargedFrom"
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
            </div>
          </div>
        </div>

        {/* Repaid Every */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Repaid Every</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="repaymentEvery" className="text-sm font-medium">
                Repaid every <span className="text-red-500">*</span>
              </Label>
              <Input
                id="repaymentEvery"
                type="number"
                className="h-10"
                {...form.register("repaymentEvery", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repaymentFrequency" className="text-sm font-medium">
                Frequency
              </Label>
              <Controller
                control={form.control}
                name="repaymentFrequency"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.repaymentFrequencyTypeOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repaymentFrequencyNthDay" className="text-sm font-medium">
                Select On
              </Label>
              <Controller
                control={form.control}
                name="repaymentFrequencyNthDay"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select On" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.repaymentFrequencyNthDayTypeOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repaymentFrequencyDayOfWeek" className="text-sm font-medium">
                Select Day
              </Label>
              <Controller
                control={form.control}
                name="repaymentFrequencyDayOfWeek"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.repaymentFrequencyDaysOfWeekTypeOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        {/* Nominal Interest Rate */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Nominal Interest Rate</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nominalInterestRate" className="text-sm font-medium">
                Nominal interest rate % <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nominalInterestRate"
                type="number"
                step="0.01"
                className="h-10"
                {...form.register("nominalInterestRate", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestRateFrequency" className="text-sm font-medium">
                Frequency
              </Label>
              <Controller
                control={form.control}
                name="interestRateFrequency"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.interestRateFrequencyTypeOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestMethod" className="text-sm font-medium">
                Interest method
              </Label>
              <Controller
                control={form.control}
                name="interestMethod"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.interestTypeOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amortization" className="text-sm font-medium">
                Amortization <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="amortization"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select amortization" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.amortizationTypeOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isEqualAmortization"
                  checked={form.watch("isEqualAmortization")}
                  onCheckedChange={(checked) => form.setValue("isEqualAmortization", checked as boolean)}
                />
                <Label htmlFor="isEqualAmortization" className="text-sm font-medium">
                  Is Equal Amortization?
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Loan Schedule */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Loan Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="loanScheduleType" className="text-sm font-medium">
                Loan Schedule Type
              </Label>
              <Input
                id="loanScheduleType"
                value={loanTemplate.loanScheduleTypeOptions?.[0]?.value || "Cumulative"}
                readOnly
                className="h-10 bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repaymentStrategy" className="text-sm font-medium">
                Repayment Strategy <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="repaymentStrategy"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.transactionProcessingStrategyOptions?.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balloonRepaymentAmount" className="text-sm font-medium">
                Balloon Repayment Amount
              </Label>
              <Input
                id="balloonRepaymentAmount"
                type="number"
                step="0.01"
                className="h-10"
                {...form.register("balloonRepaymentAmount", { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>

        {/* Interest Calculations */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Interest Calculations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="interestCalculationPeriod" className="text-sm font-medium">
                Interest calculation period
              </Label>
              <Controller
                control={form.control}
                name="interestCalculationPeriod"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.interestCalculationPeriodTypeOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="calculateInterestForExactDays"
                  checked={form.watch("calculateInterestForExactDays")}
                  onCheckedChange={(checked) => form.setValue("calculateInterestForExactDays", checked as boolean)}
                />
                <Label htmlFor="calculateInterestForExactDays" className="text-sm font-medium">
                  Calculate interest for exact days in partial period
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="arrearsTolerance" className="text-sm font-medium">
                Arrears tolerance
              </Label>
              <Input
                id="arrearsTolerance"
                type="number"
                step="0.01"
                className="h-10"
                {...form.register("arrearsTolerance", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestFreePeriod" className="text-sm font-medium">
                Interest free period
              </Label>
              <Input
                id="interestFreePeriod"
                type="number"
                className="h-10"
                {...form.register("interestFreePeriod", { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>

        {/* Moratorium */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Moratorium</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="graceOnPrincipalPayment" className="text-sm font-medium">
                Grace on principal payment
              </Label>
              <Input
                id="graceOnPrincipalPayment"
                type="number"
                className="h-10"
                {...form.register("graceOnPrincipalPayment", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graceOnInterestPayment" className="text-sm font-medium">
                Grace on interest payment
              </Label>
              <Input
                id="graceOnInterestPayment"
                type="number"
                className="h-10"
                {...form.register("graceOnInterestPayment", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onArrearsAgeing" className="text-sm font-medium">
                On arrears ageing
              </Label>
              <Input
                id="onArrearsAgeing"
                type="number"
                className="h-10"
                {...form.register("onArrearsAgeing", { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>

        {/* Recalculate Interest */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Recalculate Interest</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="recalculateInterest" className="text-sm font-medium">
                Recalculate Interest
              </Label>
              <Input
                id="recalculateInterest"
                value="No"
                readOnly
                className="h-10 bg-muted"
              />
            </div>
          </div>
        </div>

        {/* Collaterals Data */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Collaterals Data</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCollateral}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          
          {form.watch("collaterals").length > 0 && (
            <div className="border rounded-lg">
              <div className="grid grid-cols-5 gap-4 p-4 font-medium text-sm border-b bg-muted/50">
                <div>Name</div>
                <div>Quantity</div>
                <div>Total Value</div>
                <div>Total Collateral Value</div>
                <div>Actions</div>
              </div>
              {form.watch("collaterals").map((collateral, index) => (
                <div key={index} className="grid grid-cols-5 gap-4 p-4 border-b">
                  <div>
                    <Controller
                      control={form.control}
                      name={`collaterals.${index}.name`}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select collateral" />
                          </SelectTrigger>
                          <SelectContent>
                            {loanTemplate.loanCollateralOptions?.map((option) => (
                              <SelectItem key={option.id} value={option.name}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      className="h-8"
                      {...form.register(`collaterals.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8"
                      {...form.register(`collaterals.${index}.totalValue`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground">
                      {form.watch(`collaterals.${index}.totalValue`) || 0}
                    </span>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeCollateral(index)}
                      className="h-8 px-2 text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            ← Previous
          </Button>
          <Button
            type="submit"
            className="flex items-center gap-2"
          >
            Next →
          </Button>
        </div>
      </form>
    </div>
  );
}
