"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
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
  createStandingInstructions: z.boolean().default(false),
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

  const form = useForm<LoanDetailsFormData>({
    resolver: zodResolver(loanDetailsSchema),
    defaultValues: {
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

  const handleSubmit = (data: LoanDetailsFormData) => {
    console.log('LoanDetailsForm submitting with template:', loanTemplate);
    
    // Ensure we have complete template data before proceeding
    if (!hasCompleteTemplate || !loanTemplate || !loanTemplate.fundOptions || !loanTemplate.loanPurposeOptions) {
      console.error('Incomplete template data, cannot proceed');
      return;
    }
    
    onSubmit(data);
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

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
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
                    <SelectTrigger className="h-10">
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

            {/* External ID */}
            <div className="space-y-2">
              <Label htmlFor="externalId" className="text-sm font-medium">
                External ID
              </Label>
              <Input
                id="externalId"
                placeholder="Enter external ID"
                className="h-10"
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
                    <SelectTrigger className="h-10">
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
                    <SelectTrigger className="h-10">
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
                    <SelectTrigger className="h-10">
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
                      <SelectTrigger className="h-10">
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
      </form>
    </div>
  );
}
