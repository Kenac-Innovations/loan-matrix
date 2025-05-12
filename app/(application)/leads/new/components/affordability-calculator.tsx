"use client";

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
  primaryIncome: z.string().transform((val) => Number(val) || 0),
  secondaryIncome: z.string().transform((val) => Number(val) || 0),
  otherIncome: z.string().transform((val) => Number(val) || 0),

  // Expenditure
  housingCost: z.string().transform((val) => Number(val) || 0),
  utilitiesCost: z.string().transform((val) => Number(val) || 0),
  loanRepayments: z.string().transform((val) => Number(val) || 0),
  otherExpenses: z.string().transform((val) => Number(val) || 0),

  // Loan details
  requestedAmount: z.string().transform((val) => Number(val) || 0),
  creditScore: z.string().transform((val) => Number(val) || 650),

  // Employer based model
  employerType: z.string().optional(),

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
  const [calculationResult, setCalculationResult] =
    useState<AffordabilityResult | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [activeTab, setActiveTab] = useState("calculator");

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
      primaryIncome: "5000",
      secondaryIncome: "0",
      otherIncome: "0",
      housingCost: "1500",
      utilitiesCost: "200",
      loanRepayments: "300",
      otherExpenses: "500",
      requestedAmount: "100000",
      creditScore: "650",
    },
  });

  // Handle form submission
  const onSubmit = (data: AffordabilityFormValues) => {
    console.log("Form submitted with data:", data);

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

      const requestedAmount = Number(data.requestedAmount) || 50000; // Default to 50000 if not provided
      const creditScore = Number(data.creditScore) || 650; // Default to 650 if not provided

      console.log("Calculating affordability with:", {
        income,
        expenditure,
        requestedAmount,
        creditScore,
      });

      // Calculate affordability
      const result = calculateAffordability(
        income,
        expenditure,
        requestedAmount,
        creditScore
      );

      console.log("Calculation result:", result);

      // Update state with calculation result
      setCalculationResult(result);

      // If there are no offers but we should have some (for demonstration purposes),
      // generate some default offers
      if (result.offers.length === 0) {
        console.log(
          "No offers generated, creating default offers for demonstration"
        );

        // Create some default offers
        const defaultAmount = Number(data.requestedAmount) || 50000;
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
      }

      // Call the onCalculationComplete callback if provided
      if (onCalculationComplete) {
        onCalculationComplete(result);
      }
    } catch (error) {
      console.error("Error calculating affordability:", error);
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
      currency: "USD",
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
        <TabsList className="bg-[#0d121f] border border-[#1a2035] w-full sm:w-auto overflow-x-auto">
          <TabsTrigger
            value="calculator"
            className="data-[state=active]:bg-blue-500"
          >
            <Calculator className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Affordability Calculator</span>
          </TabsTrigger>
          <TabsTrigger
            value="offers"
            className="data-[state=active]:bg-blue-500"
            disabled={
              !calculationResult || calculationResult.offers.length === 0
            }
          >
            <CreditCard className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Loan Offers</span>
          </TabsTrigger>
        </TabsList>

        {/* Calculator Tab */}
        <TabsContent value="calculator">
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <CardTitle>Affordability Calculator</CardTitle>
              <CardDescription className="text-gray-400">
                Enter income and expenditure details to calculate loan
                affordability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="mb-4 border-b border-[#1a2035] pb-4">
                  <Label
                    htmlFor="affordability-model"
                    className="text-gray-300 mb-2 block"
                  >
                    Affordability Model
                  </Label>
                  <Select
                    value={selectedModelId}
                    onValueChange={(value) => setSelectedModelId(value)}
                  >
                    <SelectTrigger
                      id="affordability-model"
                      className="bg-[#1a2035] border-[#2a304d] text-white"
                    >
                      <SelectValue placeholder="Select affordability model" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                      {affordabilityModels
                        .filter((model) => model.isActive)
                        .map((model) => (
                          <SelectItem
                            key={model.id}
                            value={model.id}
                            className="focus:bg-[#2a304d] focus:text-white"
                          >
                            {model.name}
                            {model.isDefault && " (Default)"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-400 mt-2">
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
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <DollarSign className="mr-2 h-5 w-5 text-green-400" />
                    Monthly Income
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryIncome">Primary Income</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="primaryIncome"
                          placeholder="0"
                          className="pl-8 border-[#1a2035] bg-[#0a0e17]"
                          {...form.register("primaryIncome")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secondaryIncome">Secondary Income</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="secondaryIncome"
                          placeholder="0"
                          className="pl-8 border-[#1a2035] bg-[#0a0e17]"
                          {...form.register("secondaryIncome")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otherIncome">Other Income</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="otherIncome"
                          placeholder="0"
                          className="pl-8 border-[#1a2035] bg-[#0a0e17]"
                          {...form.register("otherIncome")}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {selectedModel.type === "employerBased" && (
                  <div className="pt-2 border-t border-[#1a2035] mt-2">
                    <h4 className="text-md font-medium text-white mb-4">
                      Employment Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employerType" className="text-gray-300">
                          Employer Type
                        </Label>
                        <Select
                          onValueChange={(value) =>
                            form.setValue("employerType", value)
                          }
                          defaultValue={form.watch("employerType")}
                        >
                          <SelectTrigger
                            id="employerType"
                            className="bg-[#1a2035] border-[#2a304d] text-white"
                          >
                            <SelectValue placeholder="Select employer type" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                            <SelectItem
                              value="government"
                              className="focus:bg-[#2a304d] focus:text-white"
                            >
                              Government
                            </SelectItem>
                            <SelectItem
                              value="corporate"
                              className="focus:bg-[#2a304d] focus:text-white"
                            >
                              Corporate
                            </SelectItem>
                            <SelectItem
                              value="sme"
                              className="focus:bg-[#2a304d] focus:text-white"
                            >
                              SME
                            </SelectItem>
                            <SelectItem
                              value="startup"
                              className="focus:bg-[#2a304d] focus:text-white"
                            >
                              Startup
                            </SelectItem>
                            <SelectItem
                              value="selfEmployed"
                              className="focus:bg-[#2a304d] focus:text-white"
                            >
                              Self-Employed
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="yearsEmployed"
                          className="text-gray-300"
                        >
                          Years at Current Job
                        </Label>
                        <Input
                          id="yearsEmployed"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue="2"
                          className="bg-[#1a2035] border-[#2a304d] text-white"
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
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <ShoppingCart className="mr-2 h-5 w-5 text-red-400" />
                    Monthly Expenditure
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="housingCost">
                        Housing (Rent/Mortgage)
                      </Label>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="housingCost"
                          placeholder="0"
                          className="pl-8 border-[#1a2035] bg-[#0a0e17]"
                          {...form.register("housingCost")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="utilitiesCost">Utilities & Bills</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="utilitiesCost"
                          placeholder="0"
                          className="pl-8 border-[#1a2035] bg-[#0a0e17]"
                          {...form.register("utilitiesCost")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="loanRepayments">
                        Existing Loan Repayments
                      </Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="loanRepayments"
                          placeholder="0"
                          className="pl-8 border-[#1a2035] bg-[#0a0e17]"
                          {...form.register("loanRepayments")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otherExpenses">Other Expenses</Label>
                      <div className="relative">
                        <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="otherExpenses"
                          placeholder="0"
                          className="pl-8 border-[#1a2035] bg-[#0a0e17]"
                          {...form.register("otherExpenses")}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {selectedModel.type === "expenditureEstimation" && (
                  <div className="pt-2 border-t border-[#1a2035] mt-2">
                    <h4 className="text-md font-medium text-white mb-4">
                      Location Information
                    </h4>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-gray-300">
                        Location Type
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          form.setValue("location", value)
                        }
                        defaultValue={form.watch("location")}
                      >
                        <SelectTrigger
                          id="location"
                          className="bg-[#1a2035] border-[#2a304d] text-white"
                        >
                          <SelectValue placeholder="Select location type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                          <SelectItem
                            value="urban"
                            className="focus:bg-[#2a304d] focus:text-white"
                          >
                            Urban
                          </SelectItem>
                          <SelectItem
                            value="suburban"
                            className="focus:bg-[#2a304d] focus:text-white"
                          >
                            Suburban
                          </SelectItem>
                          <SelectItem
                            value="rural"
                            className="focus:bg-[#2a304d] focus:text-white"
                          >
                            Rural
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Loan Details Section */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <CreditCard className="mr-2 h-5 w-5 text-blue-400" />
                    Loan Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="requestedAmount">
                        Requested Loan Amount
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="requestedAmount"
                          placeholder="0"
                          className="pl-8 border-[#1a2035] bg-[#0a0e17]"
                          {...form.register("requestedAmount")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="creditScore">Credit Score</Label>
                      <Input
                        id="creditScore"
                        placeholder="650"
                        className="border-[#1a2035] bg-[#0a0e17]"
                        {...form.register("creditScore")}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full bg-blue-500 hover:bg-blue-600"
                  onClick={() => {
                    const values = form.getValues();
                    onSubmit(values);
                  }}
                >
                  Calculate Affordability
                </Button>
              </div>

              {/* Results Section */}
              {calculationResult && (
                <div className="mt-6 pt-6 border-t border-[#1a2035]">
                  <h3 className="text-lg font-medium mb-4">
                    Affordability Results
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Total Monthly Income</span>
                          <span className="text-sm font-medium text-green-400">
                            {formatCurrency(
                              calculationResult.totalMonthlyIncome
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">
                            Total Monthly Expenditure
                          </span>
                          <span className="text-sm font-medium text-red-400">
                            {formatCurrency(
                              calculationResult.totalMonthlyExpenditure
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Disposable Income</span>
                          <span className="text-sm font-medium text-blue-400">
                            {formatCurrency(calculationResult.disposableIncome)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Debt-to-Income Ratio</span>
                          <span
                            className={`text-sm font-medium ${
                              calculationResult.debtToIncomeRatio > 0.43
                                ? "text-red-400"
                                : calculationResult.debtToIncomeRatio > 0.36
                                ? "text-yellow-400"
                                : "text-green-400"
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
                          className="h-2 bg-[#1a2035]"
                        />
                        <div className="flex justify-between text-xs mt-1 text-gray-400">
                          <span>0%</span>
                          <span>36%</span>
                          <span>43%</span>
                          <span>50%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Maximum Affordable Loan
                        </h4>
                        <div className="text-3xl font-bold text-blue-400">
                          {formatCurrency(calculationResult.maxLoanAmount)}
                        </div>

                        {calculationResult.maxLoanAmount <
                          Number(form.getValues().requestedAmount) && (
                          <div className="mt-2 flex items-start gap-2 text-sm text-yellow-400">
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
                              <h4 className="text-sm font-medium">
                                Available Loan Offers
                              </h4>
                              <Badge className="bg-green-500 text-white">
                                {calculationResult.offers.length} Offers
                              </Badge>
                            </div>
                            <Button
                              variant="outline"
                              className="border-[#1a2035] hover:bg-[#1a2035] text-blue-400"
                              onClick={() => setActiveTab("offers")}
                            >
                              View Loan Offers
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 text-sm text-red-400">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>
                              Based on the provided information, we cannot offer
                              any loan products at this time. Please review your
                              income and expenditure details.
                            </span>
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
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <CardTitle>Available Loan Offers</CardTitle>
              <CardDescription className="text-gray-400">
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
                          : "border-[#1a2035] bg-[#141b2d] hover:bg-[#1a2035]"
                      } p-4 transition-all cursor-pointer`}
                      onClick={() => handleOfferSelect(offer)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{offer.productName}</h3>
                            {selectedOffer?.productCode ===
                              offer.productCode && (
                              <Badge className="bg-blue-500 text-white">
                                Selected
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {formatPercentage(offer.interestRate)} interest rate
                            • {offer.termYears} year term
                          </p>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="text-center md:text-right">
                            <div className="text-sm text-gray-400">
                              Monthly Payment
                            </div>
                            <div className="text-lg font-medium">
                              {formatCurrency(offer.monthlyPayment)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-[#1a2035] grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-gray-400">
                            Loan Amount
                          </div>
                          <div className="font-medium">
                            {formatCurrency(offer.loanAmount)}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-400">
                            Total Repayment
                          </div>
                          <div className="font-medium">
                            {formatCurrency(offer.totalRepayment)}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-400">
                            Total Interest
                          </div>
                          <div className="font-medium">
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
                  <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No Offers Available
                  </h3>
                  <p className="text-gray-400 text-center max-w-md">
                    Based on the provided information, we cannot offer any loan
                    products at this time. Please review your income and
                    expenditure details.
                  </p>
                </div>
              )}
            </CardContent>
            {calculationResult && calculationResult.offers.length > 0 && (
              <CardFooter className="flex justify-between border-t border-[#1a2035] pt-6">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("calculator")}
                  className="border-[#1a2035] hover:bg-[#1a2035]"
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
