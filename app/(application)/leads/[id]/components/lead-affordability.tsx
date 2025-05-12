"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, Briefcase, Building } from "lucide-react";

interface LeadAffordabilityProps {
  leadId: string;
}

export function LeadAffordability({ leadId }: LeadAffordabilityProps) {
  // In a real application, this data would be fetched from an API
  const affordabilityData = {
    // DTI Model Results
    dtiModel: {
      modelName: "Standard DTI Model",
      modelType: "dti",
      isDefault: true,
      result: {
        maxLoanAmount: 125000,
        dtiRatio: 0.32,
        monthlyIncome: 5800,
        monthlyDebt: 1856,
        approved: true,
        factors: [
          { name: "DTI Ratio", value: "32%", status: "good" },
          { name: "Mortgage/Rent", value: "$1,200", status: "neutral" },
          { name: "Existing Loans", value: "$300", status: "neutral" },
          { name: "Proposed Loan", value: "$356", status: "neutral" },
        ],
      },
    },

    // Net Disposable Income Model Results
    disposableIncomeModel: {
      modelName: "Net Disposable Income",
      modelType: "disposableIncome",
      isDefault: false,
      result: {
        maxLoanAmount: 110000,
        disposableIncome: 1944,
        requiredDisposableIncome: 1740,
        monthlyIncome: 5800,
        monthlyExpenditure: 3856,
        approved: true,
        factors: [
          { name: "Disposable Income", value: "$1,944", status: "good" },
          { name: "Required Minimum", value: "$1,740", status: "neutral" },
          { name: "Housing Cost", value: "$1,200", status: "neutral" },
          { name: "Basic Needs", value: "$800", status: "neutral" },
          { name: "Transportation", value: "$350", status: "neutral" },
          { name: "Utilities", value: "$250", status: "neutral" },
          { name: "Loan Repayments", value: "$656", status: "neutral" },
          { name: "Other Expenses", value: "$600", status: "neutral" },
        ],
      },
    },

    // Employer-Based Model Results
    employerBasedModel: {
      modelName: "Employer-Based Assessment",
      modelType: "employerBased",
      isDefault: false,
      result: {
        maxLoanAmount: 145000,
        annualSalary: 69600,
        employerType: "corporate",
        salaryMultiplier: 4.5,
        termYears: 5,
        yearsEmployed: 3,
        approved: true,
        factors: [
          { name: "Employer Category", value: "Corporate", status: "good" },
          { name: "Years Employed", value: "3 years", status: "good" },
          { name: "Salary Multiplier", value: "4.5x", status: "neutral" },
          { name: "Annual Salary", value: "$69,600", status: "neutral" },
        ],
      },
    },

    // Expenditure Estimation Model Results
    expenditureEstimationModel: {
      modelName: "Expenditure Estimation",
      modelType: "expenditureEstimation",
      isDefault: false,
      result: {
        maxLoanAmount: 118000,
        incomeBracket: "middle",
        estimatedExpenditure: 3480,
        expenditurePercentage: 0.6,
        location: "urban",
        locationFactor: 1.2,
        approved: true,
        factors: [
          { name: "Income Bracket", value: "Middle", status: "neutral" },
          { name: "Location Type", value: "Urban", status: "neutral" },
          { name: "Est. Expenditure", value: "$3,480", status: "neutral" },
          { name: "Exp. Percentage", value: "60%", status: "neutral" },
          { name: "Location Factor", value: "1.2x", status: "neutral" },
        ],
      },
    },

    // Overall Assessment
    overallAssessment: {
      maxLoanAmount: 125000,
      recommendedModel: "Standard DTI Model",
      requestedAmount: 125000,
      approved: true,
      warnings: [
        "DTI ratio (32%) is close to warning threshold (36%)",
        "Limited employment history (3 years)",
      ],
      approvalFactors: [
        "Strong cash flow",
        "Good credit history (720)",
        "Existing client relationship",
      ],
    },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Overall Assessment Card */}
      <Card className="border-[#1a2035] bg-[#0d121f] text-white">
        <CardHeader>
          <CardTitle>Affordability Assessment</CardTitle>
          <CardDescription className="text-gray-400">
            Overall affordability evaluation for this loan application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Maximum Loan Amount</p>
                <p className="text-2xl font-semibold text-blue-400">
                  {formatCurrency(
                    affordabilityData.overallAssessment.maxLoanAmount
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-400">Requested Amount</p>
                <p className="text-2xl font-semibold text-green-400">
                  {formatCurrency(
                    affordabilityData.overallAssessment.requestedAmount
                  )}
                </p>
                {affordabilityData.overallAssessment.approved ? (
                  <Badge className="bg-green-500 text-white">Approved</Badge>
                ) : (
                  <Badge className="bg-red-500 text-white">Not Approved</Badge>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-400">Recommended Model</p>
                <p className="text-xl font-medium">
                  {affordabilityData.overallAssessment.recommendedModel}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#1a2035]">
              <div className="space-y-2">
                <p className="text-sm font-medium text-white">
                  Approval Factors
                </p>
                <ul className="space-y-1">
                  {affordabilityData.overallAssessment.approvalFactors.map(
                    (factor, index) => (
                      <li
                        key={index}
                        className="flex items-center text-sm text-green-400"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 mr-2"></span>
                        {factor}
                      </li>
                    )
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-white">Warnings</p>
                <ul className="space-y-1">
                  {affordabilityData.overallAssessment.warnings.map(
                    (warning, index) => (
                      <li
                        key={index}
                        className="flex items-center text-sm text-yellow-400"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 mr-2"></span>
                        {warning}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Models Tabs */}
      <Tabs defaultValue="dti">
        <TabsList className="bg-[#0d121f] border border-[#1a2035] w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="dti" className="data-[state=active]:bg-blue-500">
            <Calculator className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">DTI Model</span>
          </TabsTrigger>
          <TabsTrigger
            value="disposable"
            className="data-[state=active]:bg-blue-500"
          >
            <DollarSign className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Disposable Income</span>
          </TabsTrigger>
          <TabsTrigger
            value="employer"
            className="data-[state=active]:bg-blue-500"
          >
            <Building className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Employer-Based</span>
          </TabsTrigger>
          <TabsTrigger
            value="expenditure"
            className="data-[state=active]:bg-blue-500"
          >
            <Briefcase className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Expenditure Estimation</span>
          </TabsTrigger>
        </TabsList>

        {/* DTI Model Tab */}
        <TabsContent value="dti" className="mt-4">
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{affordabilityData.dtiModel.modelName}</CardTitle>
                  <CardDescription className="text-gray-400">
                    Debt-to-Income Ratio Assessment
                  </CardDescription>
                </div>
                {affordabilityData.dtiModel.isDefault && (
                  <Badge className="bg-blue-500 text-white">
                    Default Model
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Maximum Loan Amount</p>
                    <p className="text-2xl font-semibold text-blue-400">
                      {formatCurrency(
                        affordabilityData.dtiModel.result.maxLoanAmount
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Monthly Income</p>
                    <p className="text-2xl font-semibold text-green-400">
                      {formatCurrency(
                        affordabilityData.dtiModel.result.monthlyIncome
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Total Monthly Debt</p>
                    <p className="text-2xl font-semibold text-yellow-400">
                      {formatCurrency(
                        affordabilityData.dtiModel.result.monthlyDebt
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      Debt-to-Income Ratio
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        affordabilityData.dtiModel.result.dtiRatio > 0.43
                          ? "text-red-400"
                          : affordabilityData.dtiModel.result.dtiRatio > 0.36
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {(
                        affordabilityData.dtiModel.result.dtiRatio * 100
                      ).toFixed(0)}
                      %
                    </p>
                  </div>
                  <Progress
                    value={affordabilityData.dtiModel.result.dtiRatio * 100}
                    max={50}
                    className="h-2 bg-[#1a2035]"
                    indicatorClassName={
                      affordabilityData.dtiModel.result.dtiRatio > 0.43
                        ? "bg-red-500"
                        : affordabilityData.dtiModel.result.dtiRatio > 0.36
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0%</span>
                    <span>36%</span>
                    <span>43%</span>
                    <span>50%</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1a2035]">
                  <p className="text-sm font-medium mb-3">
                    Detailed Assessment
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {affordabilityData.dtiModel.result.factors.map(
                      (factor, index) => (
                        <div
                          key={index}
                          className="bg-[#151e36] p-3 rounded-md"
                        >
                          <p className="text-xs text-gray-400">{factor.name}</p>
                          <p
                            className={`text-sm font-medium ${
                              factor.status === "good"
                                ? "text-green-400"
                                : factor.status === "warning"
                                ? "text-yellow-400"
                                : factor.status === "bad"
                                ? "text-red-400"
                                : "text-white"
                            }`}
                          >
                            {factor.value}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disposable Income Tab */}
        <TabsContent value="disposable" className="mt-4">
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {affordabilityData.disposableIncomeModel.modelName}
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Net Disposable Income Assessment
                  </CardDescription>
                </div>
                {affordabilityData.disposableIncomeModel.isDefault && (
                  <Badge className="bg-blue-500 text-white">
                    Default Model
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Maximum Loan Amount</p>
                    <p className="text-2xl font-semibold text-blue-400">
                      {formatCurrency(
                        affordabilityData.disposableIncomeModel.result
                          .maxLoanAmount
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Disposable Income</p>
                    <p className="text-2xl font-semibold text-green-400">
                      {formatCurrency(
                        affordabilityData.disposableIncomeModel.result
                          .disposableIncome
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Required Minimum</p>
                    <p className="text-2xl font-semibold text-yellow-400">
                      {formatCurrency(
                        affordabilityData.disposableIncomeModel.result
                          .requiredDisposableIncome
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      Disposable Income Ratio
                    </p>
                    <p className="text-sm font-medium text-green-400">
                      {(
                        (affordabilityData.disposableIncomeModel.result
                          .disposableIncome /
                          affordabilityData.disposableIncomeModel.result
                            .monthlyIncome) *
                        100
                      ).toFixed(0)}
                      %
                    </p>
                  </div>
                  <Progress
                    value={
                      (affordabilityData.disposableIncomeModel.result
                        .disposableIncome /
                        affordabilityData.disposableIncomeModel.result
                          .monthlyIncome) *
                      100
                    }
                    max={50}
                    className="h-2 bg-[#1a2035]"
                    indicatorClassName="bg-green-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0%</span>
                    <span>15%</span>
                    <span>30%</span>
                    <span>50%</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1a2035]">
                  <p className="text-sm font-medium mb-3">Expense Breakdown</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {affordabilityData.disposableIncomeModel.result.factors.map(
                      (factor, index) => (
                        <div
                          key={index}
                          className="bg-[#151e36] p-3 rounded-md"
                        >
                          <p className="text-xs text-gray-400">{factor.name}</p>
                          <p
                            className={`text-sm font-medium ${
                              factor.status === "good"
                                ? "text-green-400"
                                : factor.status === "warning"
                                ? "text-yellow-400"
                                : factor.status === "bad"
                                ? "text-red-400"
                                : "text-white"
                            }`}
                          >
                            {factor.value}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employer-Based Tab */}
        <TabsContent value="employer" className="mt-4">
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {affordabilityData.employerBasedModel.modelName}
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Employer-Based Salary Assessment
                  </CardDescription>
                </div>
                {affordabilityData.employerBasedModel.isDefault && (
                  <Badge className="bg-blue-500 text-white">
                    Default Model
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Maximum Loan Amount</p>
                    <p className="text-2xl font-semibold text-blue-400">
                      {formatCurrency(
                        affordabilityData.employerBasedModel.result
                          .maxLoanAmount
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Annual Salary</p>
                    <p className="text-2xl font-semibold text-green-400">
                      {formatCurrency(
                        affordabilityData.employerBasedModel.result.annualSalary
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Salary Multiplier</p>
                    <p className="text-2xl font-semibold text-yellow-400">
                      {
                        affordabilityData.employerBasedModel.result
                          .salaryMultiplier
                      }
                      x
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Employer Type</p>
                    <p className="text-xl font-medium capitalize">
                      {affordabilityData.employerBasedModel.result.employerType}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Employment Duration</p>
                    <p className="text-xl font-medium">
                      {
                        affordabilityData.employerBasedModel.result
                          .yearsEmployed
                      }{" "}
                      years
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1a2035]">
                  <p className="text-sm font-medium mb-3">Assessment Factors</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {affordabilityData.employerBasedModel.result.factors.map(
                      (factor, index) => (
                        <div
                          key={index}
                          className="bg-[#151e36] p-3 rounded-md"
                        >
                          <p className="text-xs text-gray-400">{factor.name}</p>
                          <p
                            className={`text-sm font-medium ${
                              factor.status === "good"
                                ? "text-green-400"
                                : factor.status === "warning"
                                ? "text-yellow-400"
                                : factor.status === "bad"
                                ? "text-red-400"
                                : "text-white"
                            }`}
                          >
                            {factor.value}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenditure Estimation Tab */}
        <TabsContent value="expenditure" className="mt-4">
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {affordabilityData.expenditureEstimationModel.modelName}
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Expenditure Estimation Assessment
                  </CardDescription>
                </div>
                {affordabilityData.expenditureEstimationModel.isDefault && (
                  <Badge className="bg-blue-500 text-white">
                    Default Model
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Maximum Loan Amount</p>
                    <p className="text-2xl font-semibold text-blue-400">
                      {formatCurrency(
                        affordabilityData.expenditureEstimationModel.result
                          .maxLoanAmount
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">
                      Estimated Expenditure
                    </p>
                    <p className="text-2xl font-semibold text-yellow-400">
                      {formatCurrency(
                        affordabilityData.expenditureEstimationModel.result
                          .estimatedExpenditure
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Expenditure %</p>
                    <p className="text-2xl font-semibold text-yellow-400">
                      {(
                        affordabilityData.expenditureEstimationModel.result
                          .expenditurePercentage * 100
                      ).toFixed(0)}
                      %
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Income Bracket</p>
                    <p className="text-xl font-medium capitalize">
                      {
                        affordabilityData.expenditureEstimationModel.result
                          .incomeBracket
                      }
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Location Type</p>
                    <p className="text-xl font-medium capitalize">
                      {
                        affordabilityData.expenditureEstimationModel.result
                          .location
                      }
                      <span className="text-sm text-gray-400 ml-2">
                        (Factor:{" "}
                        {
                          affordabilityData.expenditureEstimationModel.result
                            .locationFactor
                        }
                        x)
                      </span>
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1a2035]">
                  <p className="text-sm font-medium mb-3">Assessment Factors</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {affordabilityData.expenditureEstimationModel.result.factors.map(
                      (factor, index) => (
                        <div
                          key={index}
                          className="bg-[#151e36] p-3 rounded-md"
                        >
                          <p className="text-xs text-gray-400">{factor.name}</p>
                          <p
                            className={`text-sm font-medium ${
                              factor.status === "good"
                                ? "text-green-400"
                                : factor.status === "warning"
                                ? "text-yellow-400"
                                : factor.status === "bad"
                                ? "text-red-400"
                                : "text-white"
                            }`}
                          >
                            {factor.value}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
