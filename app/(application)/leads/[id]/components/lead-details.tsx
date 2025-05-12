"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  CreditCard,
  Briefcase,
  AlertCircle,
} from "lucide-react";

interface LeadDetailsProps {
  leadId: string;
}

export function LeadDetails({ leadId }: LeadDetailsProps) {
  // This would normally be fetched from an API
  const leadData = {
    id: leadId,
    client: {
      name: "Robert Johnson",
      company: "Johnson Enterprises",
      phone: "+1 (555) 123-4567",
      email: "robert.johnson@example.com",
      address: "123 Business Ave, Suite 500, New York, NY 10001",
      clientSince: "January 2023",
      avatar: "/robert-johnson-avatar.png",
    },
    loan: {
      type: "Business Loan",
      amount: "$125,000",
      purpose: "Equipment Purchase & Working Capital",
      term: "60 months",
      interestRate: "7.25%",
      collateral: "Equipment being purchased",
      applicationDate: "May 5, 2025",
    },
    financials: {
      creditScore: 720,
      annualRevenue: "$850,000",
      monthlyProfit: "$28,000",
      debtToIncomeRatio: "32%",
      existingLoans: 1,
      totalDebt: "$180,000",
    },
    risk: {
      score: 68,
      category: "Medium",
      factors: [
        "Limited business operating history (2 years)",
        "Strong cash flow",
        "Good credit history",
        "Industry volatility (moderate)",
      ],
    },
  };

  return (
    <div className="space-y-6">
      <Card className="border-[#1a2035] bg-[#0d121f] text-white">
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
          <CardDescription className="text-gray-400">
            Details about the loan applicant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center md:items-start gap-3">
              <Avatar className="h-20 w-20">
                <AvatarImage
                  src={leadData.client.avatar || "/placeholder.svg"}
                  alt={leadData.client.name}
                />
                <AvatarFallback>
                  {leadData.client.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="text-center md:text-left">
                <h3 className="text-lg font-medium">{leadData.client.name}</h3>
                <p className="text-sm text-gray-400">
                  {leadData.client.company}
                </p>
              </div>
              <Badge className="bg-blue-500 text-white border-0">
                Business Client
              </Badge>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm">{leadData.client.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm">{leadData.client.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Address</p>
                    <p className="text-sm">{leadData.client.address}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Company</p>
                    <p className="text-sm">{leadData.client.company}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Client Since</p>
                    <p className="text-sm">{leadData.client.clientSince}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Existing Loans</p>
                    <p className="text-sm">
                      {leadData.financials.existingLoans}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="loan">
        <TabsList className="bg-[#0d121f] border border-[#1a2035] w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="loan" className="data-[state=active]:bg-blue-500">
            <DollarSign className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Loan Details</span>
          </TabsTrigger>
          <TabsTrigger
            value="financials"
            className="data-[state=active]:bg-blue-500"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Financial Profile</span>
          </TabsTrigger>
          <TabsTrigger value="risk" className="data-[state=active]:bg-blue-500">
            <AlertCircle className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Risk Assessment</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="loan" className="mt-4">
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <CardTitle>Loan Information</CardTitle>
              <CardDescription className="text-gray-400">
                Details about the requested loan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Loan Type</p>
                  <p className="text-sm font-medium">{leadData.loan.type}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Amount</p>
                  <p className="text-sm font-medium">{leadData.loan.amount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Term</p>
                  <p className="text-sm font-medium">{leadData.loan.term}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Interest Rate</p>
                  <p className="text-sm font-medium">
                    {leadData.loan.interestRate}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Application Date</p>
                  <p className="text-sm font-medium">
                    {leadData.loan.applicationDate}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Collateral</p>
                  <p className="text-sm font-medium">
                    {leadData.loan.collateral}
                  </p>
                </div>
                <div className="col-span-full space-y-1">
                  <p className="text-xs text-gray-400">Purpose</p>
                  <p className="text-sm font-medium">{leadData.loan.purpose}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="financials" className="mt-4">
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <CardTitle>Financial Profile</CardTitle>
              <CardDescription className="text-gray-400">
                Financial information about the client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">Credit Score</p>
                      <p className="text-xs font-medium text-green-400">Good</p>
                    </div>
                    <p className="text-lg font-medium">
                      {leadData.financials.creditScore}
                    </p>
                    <Progress
                      value={72}
                      className="h-1.5 bg-[#1a2035]"
                      indicatorClassName="bg-green-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Annual Revenue</p>
                  <p className="text-sm font-medium">
                    {leadData.financials.annualRevenue}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Monthly Profit</p>
                  <p className="text-sm font-medium">
                    {leadData.financials.monthlyProfit}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        Debt-to-Income Ratio
                      </p>
                      <p className="text-xs font-medium text-yellow-400">
                        Moderate
                      </p>
                    </div>
                    <p className="text-lg font-medium">
                      {leadData.financials.debtToIncomeRatio}
                    </p>
                    <Progress
                      value={32}
                      className="h-1.5 bg-[#1a2035]"
                      indicatorClassName="bg-yellow-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Existing Loans</p>
                  <p className="text-sm font-medium">
                    {leadData.financials.existingLoans}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Total Debt</p>
                  <p className="text-sm font-medium">
                    {leadData.financials.totalDebt}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
              <CardDescription className="text-gray-400">
                Risk evaluation for this loan application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="relative h-32 w-32 flex-shrink-0 mx-auto sm:mx-0">
                    <div className="absolute inset-0 rounded-full border-8 border-[#1a2035]"></div>
                    <div
                      className="absolute inset-0 rounded-full border-8 border-yellow-500"
                      style={{
                        clipPath: `path('M16,16 L16,${
                          32 + leadData.risk.score * 0.64
                        } A${16 + leadData.risk.score * 0.64},${
                          16 + leadData.risk.score * 0.64
                        } 0 ${leadData.risk.score > 50 ? 1 : 0},1 ${
                          16 +
                          leadData.risk.score *
                            0.64 *
                            Math.cos(leadData.risk.score * 0.0628)
                        },${
                          16 +
                          leadData.risk.score *
                            0.64 *
                            Math.sin(leadData.risk.score * 0.0628)
                        } z')`,
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-2xl font-bold">
                        {leadData.risk.score}
                      </span>
                      <span className="text-xs text-yellow-400">
                        {leadData.risk.category} Risk
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium mb-2">Risk Factors</h4>
                    <ul className="space-y-2">
                      {leadData.risk.factors.map((factor, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="rounded-full bg-[#1a2035] p-1 mt-0.5">
                            <AlertCircle className="h-3 w-3 text-yellow-400" />
                          </div>
                          <span className="text-sm">{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="rounded-md border border-[#1a2035] bg-[#0a0e17] p-3">
                  <h4 className="text-sm font-medium mb-2">
                    Risk Assessment Summary
                  </h4>
                  <p className="text-sm text-gray-400">
                    This application presents a medium risk profile. The
                    business shows strong cash flow and the client has a good
                    credit history, but the limited operating history (2 years)
                    and moderate industry volatility are concerns. Recommend
                    proceeding with additional collateral requirements and
                    potentially a slightly higher interest rate to mitigate
                    risk.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
