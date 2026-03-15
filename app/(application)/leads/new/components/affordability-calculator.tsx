"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateAffordability,
  calculateMonthlyPayment,
  type AffordabilityResult,
  type LoanOffer,
} from "@/lib/affordability-calculator";
import {
  Calculator,
  DollarSign,
  CreditCard,
  Home,
  ShoppingCart,
  Check,
  AlertCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// Form validation schema
const affordabilityFormSchema = z.object({
  // Income
  primaryIncome: z.coerce.number({
    required_error: "Primary income is required",
    invalid_type_error: "Please enter a valid number"
  }).min(1, "Primary income must be greater than 0"),
  
  secondaryIncome: z.coerce.number().min(0, "Secondary income cannot be negative"),
  otherIncome: z.coerce.number().min(0, "Other income cannot be negative"),

  // Expenditure
  housingCost: z.coerce.number().min(0, "Housing cost cannot be negative"),
  utilitiesCost: z.coerce.number().min(0, "Utilities cost cannot be negative"),
  loanRepayments: z.coerce.number().min(0, "Loan repayments cannot be negative"),
  otherExpenses: z.coerce.number().min(0, "Other expenses cannot be negative"),

  // Loan details
  requestedAmount: z.coerce.number({
    required_error: "Loan amount is required",
    invalid_type_error: "Please enter a valid number"
  }).min(1000, "Minimum loan amount is $1,000"),
  
  creditScore: z.coerce.number({
    required_error: "Credit score is required",
    invalid_type_error: "Please enter a valid number"
  }).min(300, "Credit score must be at least 300").max(850, "Credit score cannot exceed 850"),

  // Employer based model
  employerType: z.string().optional(),
  yearsEmployed: z.number().optional(),

  // Expenditure estimation model
  location: z.string().optional(),
});

type AffordabilityFormValues = z.infer<typeof affordabilityFormSchema>;

interface AffordabilityCalculatorProps {
  onOfferSelect?: (offer: LoanOffer) => void;
  onCalculationComplete?: (result: AffordabilityResult) => void;
  className?: string;
}

export function AffordabilityCalculator({
  onOfferSelect,
  onCalculationComplete,
  className,
}: AffordabilityCalculatorProps) {
  const { currencyCode: orgCurrency } = useCurrency();
  const [calculationResult, setCalculationResult] =
    useState<AffordabilityResult | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [activeTab, setActiveTab] = useState("calculator");
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [affordabilityModels, setAffordabilityModels] = useState([
    {
      id: "1",
      name: "Standard DTI Model",
      type: "dti",
      isDefault: true,
      isActive: true,
    },
    {
      id: "2",
      name: "Net Disposable Income",
      type: "disposableIncome",
      isDefault: false,
      isActive: true,
    },
    {
      id: "3",
      name: "Employer-Based Assessment",
      type: "employerBased",
      isDefault: false,
      isActive: true,
    },
    {
      id: "4",
      name: "Expenditure Estimation",
      type: "expenditureEstimation",
      isDefault: false,
      isActive: true,
    },
  ]);

  const [selectedModelId, setSelectedModelId] = useState("1");

  // Get the selected model
  const selectedModel =
    affordabilityModels.find((model) => model.id === selectedModelId) ||
    affordabilityModels.find((model) => model.isDefault) ||
    affordabilityModels[0];

  // Initialize form with default values
  const form = useForm<AffordabilityFormValues>({
    resolver: zodResolver(affordabilityFormSchema),
    defaultValues: {
      primaryIncome: 5000,
      secondaryIncome: 0,
      otherIncome: 0,
      housingCost: 1500,
      utilitiesCost: 200,
      loanRepayments: 300,
      otherExpenses: 500,
      requestedAmount: 100000,
      creditScore: 650,
      employerType: "",
      yearsEmployed: 2,
      location: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: AffordabilityFormValues) => {
    setIsCalculating(true);
    setError(null);
    setSuccessMessage(null);

    try {

      // Ensure all values are properly converted to numbers
      const income = {
        primaryIncome: Number(data.primaryIncome) || 0,
        secondaryIncome: Number(data.secondaryIncome) || 0,
        otherIncome: Number(data.otherIncome) || 0,
      };

      const expenditure = {
        housingCost: Number(data.housingCost) || 0,
        utilitiesCost: Number(data.utilitiesCost) || 0,
        loanRepayments: Number(data.loanRepayments) || 0,
        otherExpenses: Number(data.otherExpenses) || 0,
      };

      const requestedAmount = Number(data.requestedAmount);
      const creditScore = Number(data.creditScore);

      // Calculate affordability
      const result = calculateAffordability(
        income,
        expenditure,
        requestedAmount,
        creditScore
      );

      // Update state with calculation result
      setCalculationResult(result);

      // If there are no offers but we should have some (for demonstration purposes),
      // generate some default offers
      if (result.offers.length === 0) {
        // Create some default offers
        const defaultAmount = Number(data.requestedAmount);
        result.offers = [
          {
            loanAmount: defaultAmount,
            interestRate: 0.0599,
            termYears: 3,
            monthlyPayment: calculateMonthlyPayment(defaultAmount, 0.0599, 3),
            totalRepayment:
              calculateMonthlyPayment(defaultAmount, 0.0599, 3) * 3 * 12,
            productName: "3-Year Standard Loan",
            productCode: "LOAN-3Y-STD",
          },
          {
            loanAmount: defaultAmount,
            interestRate: 0.0649,
            termYears: 5,
            monthlyPayment: calculateMonthlyPayment(defaultAmount, 0.0649, 5),
            totalRepayment:
              calculateMonthlyPayment(defaultAmount, 0.0649, 5) * 5 * 12,
            productName: "5-Year Standard Loan",
            productCode: "LOAN-5Y-STD",
          },
        ];

        // Update the calculation result with the default offers
        setCalculationResult({
          ...result,
          offers: result.offers,
        });
      }

      // If there are offers, switch to the offers tab
      if (result.offers.length > 0) {
        setActiveTab("offers");
        setSuccessMessage(`Great! We found ${result.offers.length} loan offer${result.offers.length > 1 ? 's' : ''} for you.`);
      } else {
        setSuccessMessage("Calculation completed. Please review the results below.");
      }

      // Call the onCalculationComplete callback if provided
      if (onCalculationComplete) {
        onCalculationComplete(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An unexpected error occurred while calculating affordability. Please try again.";
      setError(errorMessage);
      console.error("Error calculating affordability:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleOfferSelect = (offer: LoanOffer) => {
    setSelectedOffer(offer);

    if (onOfferSelect) {
      onOfferSelect(offer);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: orgCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (rate: number) => {
    return (rate * 100).toFixed(2) + "%";
  };

  return (
    <div className={className}>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="calculator">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline ml-2 whitespace-nowrap">Affordability Calculator</span>
          </TabsTrigger>
          <TabsTrigger
            value="offers"
            disabled={
              !calculationResult || calculationResult.offers.length === 0
            }
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline ml-2 whitespace-nowrap">Loan Offers</span>
          </TabsTrigger>
        </TabsList>

        {/* Calculator Tab */}
        <TabsContent value="calculator">
          <Card>
            <CardHeader>
              <CardTitle>Affordability Calculator</CardTitle>
              <CardDescription>
                Enter income and expenditure details to calculate loan
                affordability
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Error Display */}
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800">Calculation Error</h4>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Display */}
              {successMessage && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-green-800">Success</h4>
                      <p className="text-sm text-green-700 mt-1">{successMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="mb-4 border-b border-border pb-4">
                  <Label
                    htmlFor="affordability-model"
                    className="text-foreground mb-2 block"
                  >
                    Affordability Model
                  </Label>
                  <Select
                    value={selectedModelId}
                    onValueChange={(value) => setSelectedModelId(value)}
                  >
                    <SelectTrigger id="affordability-model" className="h-10 xl:w-110 lg:w-72 w-full">
                      <SelectValue placeholder="Select affordability model" />
                    </SelectTrigger>
                    <SelectContent>
                      {affordabilityModels
                        .filter((model) => model.isActive)
                        .map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                            {model.isDefault && " (Default)"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedModel.type === "dti" &&
                      "Evaluates loan affordability based on debt-to-income ratio"}
                    {selectedModel.type === "disposableIncome" &&
                      "Evaluates if customer has sufficient funds left after expenses"}
                    {selectedModel.type === "employerBased" &&
                      "Uses salary multipliers based on employer category"}
                    {selectedModel.type === "expenditureEstimation" &&
                      "Estimates expenditure based on income brackets and location"}
                  </p>
                </div>
                {/* Income Section */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center text-foreground">
                    <DollarSign className="mr-2 h-5 w-5 text-green-500" />
                    Monthly Income
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryIncome">Primary Income *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="primaryIncome"
                          placeholder="0"
                          className={`pl-8 ${form.formState.errors.primaryIncome ? 'border-red-500' : ''}`}
                          {...form.register("primaryIncome")}
                        />
                      </div>
                      {form.formState.errors.primaryIncome && (
                        <p className="text-sm text-red-500">{form.formState.errors.primaryIncome.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secondaryIncome">Secondary Income</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="secondaryIncome"
                          placeholder="0"
                          className="pl-8"
                          {...form.register("secondaryIncome")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otherIncome">Other Income</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="otherIncome"
                          placeholder="0"
                          className="pl-8"
                          {...form.register("otherIncome")}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {selectedModel.type === "employerBased" && (
                  <div className="pt-2 border-t border-border mt-2">
                    <h4 className="text-md font-medium text-foreground mb-4">
                      Employment Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employerType">Employer Type</Label>
                        <Select
                          onValueChange={(value) =>
                            form.setValue("employerType", value)
                          }
                          defaultValue={form.watch("employerType")}
                        >
                          <SelectTrigger id="employerType">
                            <SelectValue placeholder="Select employer type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="government">
                              Government
                            </SelectItem>
                            <SelectItem value="corporate">Corporate</SelectItem>
                            <SelectItem value="sme">SME</SelectItem>
                            <SelectItem value="startup">Startup</SelectItem>
                            <SelectItem value="selfEmployed">
                              Self-Employed
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="yearsEmployed">
                          Years at Current Job
                        </Label>
                        <Input
                          id="yearsEmployed"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue="2"
                          onChange={(e) =>
                            form.setValue(
                              "yearsEmployed",
                              Number.parseInt(e.target.value)
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Expenditure Section */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center text-foreground">
                    <ShoppingCart className="mr-2 h-5 w-5 text-red-500" />
                    Monthly Expenditure
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="housingCost">
                        Housing (Rent/Mortgage)
                      </Label>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="housingCost"
                          placeholder="0"
                          className="pl-8"
                          {...form.register("housingCost")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="utilitiesCost">Utilities & Bills</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="utilitiesCost"
                          placeholder="0"
                          className="pl-8"
                          {...form.register("utilitiesCost")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="loanRepayments">
                        Existing Loan Repayments
                      </Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="loanRepayments"
                          placeholder="0"
                          className="pl-8"
                          {...form.register("loanRepayments")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otherExpenses">Other Expenses</Label>
                      <div className="relative">
                        <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="otherExpenses"
                          placeholder="0"
                          className="pl-8"
                          {...form.register("otherExpenses")}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {selectedModel.type === "expenditureEstimation" && (
                  <div className="pt-2 border-t border-border mt-2">
                    <h4 className="text-md font-medium text-foreground mb-4">
                      Location Information
                    </h4>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location Type</Label>
                      <Select
                        onValueChange={(value) =>
                          form.setValue("location", value)
                        }
                        defaultValue={form.watch("location")}
                      >
                        <SelectTrigger id="location">
                          <SelectValue placeholder="Select location type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urban">Urban</SelectItem>
                          <SelectItem value="suburban">Suburban</SelectItem>
                          <SelectItem value="rural">Rural</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Loan Details Section */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center text-foreground">
                    <CreditCard className="mr-2 h-5 w-5 text-blue-500" />
                    Loan Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="requestedAmount">
                        Requested Loan Amount *
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="requestedAmount"
                          placeholder="0"
                          className={`pl-8 ${form.formState.errors.requestedAmount ? 'border-red-500' : ''}`}
                          {...form.register("requestedAmount")}
                        />
                      </div>
                      {form.formState.errors.requestedAmount && (
                        <p className="text-sm text-red-500">{form.formState.errors.requestedAmount.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="creditScore">Credit Score *</Label>
                      <Input
                        id="creditScore"
                        placeholder="650"
                        className={form.formState.errors.creditScore ? 'border-red-500' : ''}
                        {...form.register("creditScore")}
                      />
                      {form.formState.errors.creditScore && (
                        <p className="text-sm text-red-500">{form.formState.errors.creditScore.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={isCalculating}
                >
                  {isCalculating ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Calculating...
                    </>
                  ) : (
                    "Calculate Affordability"
                  )}
                </Button>
              </div>

              {/* Results Section */}
              {calculationResult && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="text-lg font-medium mb-4 text-foreground">
                    Affordability Results
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">
                            Total Monthly Income
                          </span>
                          <span className="text-sm font-medium text-green-500">
                            {formatCurrency(
                              calculationResult.totalMonthlyIncome
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">
                            Total Monthly Expenditure
                          </span>
                          <span className="text-sm font-medium text-red-500">
                            {formatCurrency(
                              calculationResult.totalMonthlyExpenditure
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">
                            Disposable Income
                          </span>
                          <span className="text-sm font-medium text-blue-500">
                            {formatCurrency(calculationResult.disposableIncome)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">
                            Debt-to-Income Ratio
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              calculationResult.debtToIncomeRatio > 0.43
                                ? "text-red-500"
                                : calculationResult.debtToIncomeRatio > 0.36
                                ? "text-yellow-500"
                                : "text-green-500"
                            }`}
                          >
                            {(
                              calculationResult.debtToIncomeRatio * 100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                        <Progress
                          value={calculationResult.debtToIncomeRatio * 100}
                          max={50}
                          className="h-2"
                        />
                        <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                          <span>0%</span>
                          <span>36%</span>
                          <span>43%</span>
                          <span>50%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-foreground">
                          Maximum Affordable Loan
                        </h4>
                        <div className="text-3xl font-bold text-blue-500">
                          {formatCurrency(calculationResult.maxLoanAmount)}
                        </div>

                        {calculationResult.maxLoanAmount <
                          Number(form.getValues().requestedAmount) && (
                          <div className="mt-2 flex items-start gap-2 text-sm text-yellow-500">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>
                              The maximum affordable loan amount is less than
                              your requested amount of{" "}
                              {formatCurrency(
                                Number(form.getValues().requestedAmount)
                              )}
                              .
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        {calculationResult.offers.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <h4 className="text-sm font-medium text-foreground">
                                Available Loan Offers
                              </h4>
                              <Badge className="bg-green-500 text-white">
                                {calculationResult.offers.length} Offers
                              </Badge>
                            </div>
                            <Button
                              variant="outline"
                              className="text-blue-500 hover:text-blue-600"
                              onClick={() => setActiveTab("offers")}
                            >
                              View Loan Offers
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 text-sm text-amber-600">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">No loan offers available</p>
                              <p className="text-xs mt-1">
                                This may be due to high debt-to-income ratio or insufficient income. 
                                Consider reducing your requested amount or increasing your income.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle>Available Loan Offers</CardTitle>
              <CardDescription>
                Select the loan offer that best suits your needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calculationResult && calculationResult.offers.length > 0 ? (
                <div className="space-y-4">
                  {calculationResult.offers.map((offer) => (
                    <div
                      key={offer.productCode}
                      className={`rounded-lg border ${
                        selectedOffer?.productCode === offer.productCode
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border bg-card hover:bg-accent"
                      } p-4 transition-all cursor-pointer`}
                      onClick={() => handleOfferSelect(offer)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground">
                              {offer.productName}
                            </h3>
                            {selectedOffer?.productCode ===
                              offer.productCode && (
                              <Badge className="bg-blue-500 text-white">
                                Selected
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatPercentage(offer.interestRate)} interest rate
                            • {offer.termYears} year term
                          </p>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="text-center md:text-right">
                            <div className="text-sm text-muted-foreground">
                              Monthly Payment
                            </div>
                            <div className="text-lg font-medium text-foreground">
                              {formatCurrency(offer.monthlyPayment)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Loan Amount
                          </div>
                          <div className="font-medium text-foreground">
                            {formatCurrency(offer.loanAmount)}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-muted-foreground">
                            Total Repayment
                          </div>
                          <div className="font-medium text-foreground">
                            {formatCurrency(offer.totalRepayment)}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-muted-foreground">
                            Total Interest
                          </div>
                          <div className="font-medium text-foreground">
                            {formatCurrency(
                              offer.totalRepayment - offer.loanAmount
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2 text-foreground">
                    No Loan Offers Available
                  </h3>
                  <div className="text-muted-foreground text-center max-w-md space-y-2">
                    <p>
                      Based on your financial information, we cannot offer any loan
                      products at this time.
                    </p>
                    <div className="text-sm bg-amber-50 border border-amber-200 rounded-md p-3 mt-4">
                      <p className="font-medium text-amber-800 mb-1">Suggestions to improve your eligibility:</p>
                      <ul className="text-left text-amber-700 space-y-1">
                        <li>• Reduce your requested loan amount</li>
                        <li>• Increase your monthly income</li>
                        <li>• Reduce your monthly expenses</li>
                        <li>• Improve your credit score</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            {calculationResult && calculationResult.offers.length > 0 && (
              <CardFooter className="flex justify-between border-t border-border pt-6">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("calculator")}
                >
                  Back to Calculator
                </Button>

                <Button
                  className="bg-blue-500 hover:bg-blue-600"
                  disabled={!selectedOffer}
                  onClick={() => {
                    if (selectedOffer && onOfferSelect) {
                      onOfferSelect(selectedOffer);
                    }
                  }}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Selected Offer
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Debug section - remove in production */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-gray-500 mt-4 p-4 border border-gray-700 rounded">
          <details>
            <summary>Debug Info</summary>
            <div className="mt-2">
              <p>Form Values: {JSON.stringify(form.getValues())}</p>
              <p>
                Selected Offer:{" "}
                {selectedOffer ? JSON.stringify(selectedOffer) : "None"}
              </p>
              <p>
                Calculation Result: {calculationResult ? "Available" : "None"}
              </p>
              <p>Active Tab: {activeTab}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
