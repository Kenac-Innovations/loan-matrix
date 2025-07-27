"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import {
  ArrowLeft,
  Save,
  Loader2,
  Calculator,
  CreditCard,
  Check,
} from "lucide-react";
import Link from "next/link";
import type {
  AffordabilityResult,
  LoanOffer,
} from "@/lib/affordability-calculator";
import { Badge } from "@/components/ui/badge";
import { AffordabilityCalculator } from "./affordability-calculator";
import { ClientRegistrationForm } from "./client-registration-form";

// Define the type for the client form data
type ClientFormData = {
  offices: any[];
  legalForms: any[];
  genders: any[];
  clientTypes: any[];
  clientClassifications: any[];
  savingsProducts: any[];
  activationDate: Date | null;
};

// Props for the NewLeadForm component
interface NewLeadFormProps {
  clientFormData: ClientFormData;
}

// Form validation schema
const leadFormSchema = z.object({
  // Client Information
  clientName: z.string().min(2, { message: "Client name is required" }),
  clientEmail: z.string().email({ message: "Valid email is required" }),
  clientPhone: z
    .string()
    .min(10, { message: "Valid phone number is required" }),
  clientCompany: z.string().optional(),
  clientAddress: z.string().optional(),
  applicationDate: z.date().default(() => new Date()),

  // Loan Information
  loanType: z.string().min(1, { message: "Loan type is required" }),
  loanAmount: z.string().min(1, { message: "Loan amount is required" }),
  loanPurpose: z.string().optional(),
  loanTerm: z.string().optional(),
  interestRate: z.string().optional(),
  collateral: z.string().optional(),

  // Additional Information
  notes: z.string().optional(),
  priority: z.string().default("medium"),
  assignTo: z.string().optional(),
  isExistingClient: z.boolean().default(false),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

export function NewLeadForm({ clientFormData }: NewLeadFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [affordabilityResult, setAffordabilityResult] =
    useState<AffordabilityResult | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [activeTab, setActiveTab] = useState("client");

  // Initialize form with default values
  const form = useForm({
    resolver: zodResolver(leadFormSchema) as any,
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientCompany: "",
      clientAddress: "",
      applicationDate: new Date(),
      loanType: "",
      loanAmount: "",
      loanPurpose: "",
      loanTerm: "",
      interestRate: "",
      collateral: "",
      notes: "",
      priority: "medium",
      assignTo: "",
      isExistingClient: false,
    },
  });

  // Handle form submission
  const onSubmit = async (data: LeadFormValues) => {
    setIsSubmitting(true);

    try {
      // This would normally be an API call to create the lead
      console.log("Form data:", data);
      console.log("Affordability result:", affordabilityResult);
      console.log("Selected offer:", selectedOffer);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect to leads page after successful submission
      router.push("/leads");
    } catch (error) {
      console.error("Error creating lead:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAffordabilityCalculation = (result: AffordabilityResult) => {
    setAffordabilityResult(result);

    // Update loan amount in the form if offers are available
    if (result.offers.length > 0) {
      // Update the form with the first offer's details
      const firstOffer = result.offers[0];
      form.setValue("loanAmount", firstOffer.loanAmount.toString());
      form.setValue("loanTerm", firstOffer.termYears.toString());
      form.setValue("interestRate", (firstOffer.interestRate * 100).toFixed(2));

      // Add a note about the affordability calculation
      const currentNotes = form.getValues("notes");
      const affordabilityNote =
        `Affordability calculation completed on ${new Date().toLocaleDateString()}.\n` +
        `Monthly income: $${result.totalMonthlyIncome}\n` +
        `Monthly expenditure: $${result.totalMonthlyExpenditure}\n` +
        `Maximum affordable loan: $${result.maxLoanAmount}\n\n`;

      form.setValue("notes", affordabilityNote + (currentNotes || ""));

      // Do NOT automatically move to the loan details tab
      // setActiveTab("loan");
    }
  };

  const handleOfferSelect = (offer: LoanOffer) => {
    setSelectedOffer(offer);

    // Update loan details in the form
    form.setValue("loanAmount", offer.loanAmount.toString());
    form.setValue("loanTerm", offer.termYears.toString());
    form.setValue("interestRate", (offer.interestRate * 100).toString());
  };

  // Format currency
  const formatCurrency = (amount: number | string) => {
    const numAmount =
      typeof amount === "string" ? Number.parseFloat(amount) : amount;
    if (isNaN(numAmount)) return "$0";

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild className="h-8 w-8">
            <Link href="/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Create New Lead</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger
              value="client"
              className="data-[state=active]:bg-blue-500"
            >
              Client Information
            </TabsTrigger>
            <TabsTrigger
              value="affordability"
              className="data-[state=active]:bg-blue-500"
            >
              <Calculator className="mr-2 h-4 w-4" />
              <span className="whitespace-nowrap">Affordability</span>
            </TabsTrigger>
            <TabsTrigger
              value="loan"
              className="data-[state=active]:bg-blue-500"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              <span className="whitespace-nowrap">Loan Details</span>
              {selectedOffer && (
                <Badge className="ml-2 bg-green-500 text-white">
                  Offer Selected
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="additional"
              className="data-[state=active]:bg-blue-500"
            >
              Additional Information
            </TabsTrigger>
          </TabsList>

          {/* Client Information Tab */}
          <TabsContent value="client">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
                <CardDescription>
                  Enter the client's personal and contact information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ClientRegistrationForm formData={clientFormData} />

                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="bg-blue-500 hover:bg-blue-600"
                    onClick={() => setActiveTab("affordability")}
                  >
                    Next: Affordability
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Affordability Tab */}
          <TabsContent value="affordability">
            <Card>
              <CardHeader>
                <CardTitle>Affordability Calculator</CardTitle>
                <CardDescription>
                  Calculate loan affordability and generate offers based on
                  client's financial situation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AffordabilityCalculator
                  onCalculationComplete={handleAffordabilityCalculation}
                  onOfferSelect={handleOfferSelect}
                />

                <div className="flex justify-between mt-6 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("client")}
                  >
                    Back: Client Information
                  </Button>

                  <Button
                    type="button"
                    className="bg-blue-500 hover:bg-blue-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab("loan");
                    }}
                  >
                    Next: Loan Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loan Details Tab */}
          <TabsContent value="loan">
            <Card>
              <CardHeader>
                <CardTitle>Loan Details</CardTitle>
                <CardDescription>
                  {selectedOffer
                    ? "Review and confirm the selected loan offer details"
                    : "Enter information about the requested loan"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedOffer && (
                  <div className="mb-6 p-4 rounded-lg border border-blue-500 bg-blue-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-green-400" />
                      <h3 className="font-medium">
                        Selected Offer: {selectedOffer.productName}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Loan Amount:</span>{" "}
                        <span className="font-medium">
                          {formatCurrency(selectedOffer.loanAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Interest Rate:</span>{" "}
                        <span className="font-medium">
                          {(selectedOffer.interestRate * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Term:</span>{" "}
                        <span className="font-medium">
                          {selectedOffer.termYears} years
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Monthly Payment:</span>{" "}
                        <span className="font-medium">
                          {formatCurrency(selectedOffer.monthlyPayment)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Total Repayment:</span>{" "}
                        <span className="font-medium">
                          {formatCurrency(selectedOffer.totalRepayment)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Product Code:</span>{" "}
                        <span className="font-medium">
                          {selectedOffer.productCode}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="loanType">
                      Loan Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("loanType", value)
                      }
                      defaultValue={form.watch("loanType")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select loan type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="business">Business Loan</SelectItem>
                        <SelectItem value="personal">Personal Loan</SelectItem>
                        <SelectItem value="mortgage">Mortgage</SelectItem>
                        <SelectItem value="auto">Auto Loan</SelectItem>
                        <SelectItem value="education">
                          Education Loan
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.loanType && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.loanType.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loanAmount">
                      Loan Amount <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="loanAmount"
                      placeholder="Enter loan amount"
                      className=""
                      {...form.register("loanAmount")}
                    />
                    {form.formState.errors.loanAmount && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.loanAmount.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loanTerm">Loan Term</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("loanTerm", value)
                      }
                      value={form.watch("loanTerm")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select loan term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 years</SelectItem>
                        <SelectItem value="5">5 years</SelectItem>
                        <SelectItem value="7">7 years</SelectItem>
                        <SelectItem value="10">10 years</SelectItem>
                        <SelectItem value="15">15 years</SelectItem>
                        <SelectItem value="20">20 years</SelectItem>
                        <SelectItem value="30">30 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientAddress">Client Address</Label>
                    <Textarea
                      id="clientAddress"
                      placeholder="Enter client address"
                      className="min-h-[100px]"
                      {...form.register("clientAddress")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="applicationDate">Application Date</Label>
                    <Controller
                      control={form.control}
                      name="applicationDate"
                      render={({ field: { value, onChange } }) => (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {value ? (
                                format(value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={value}
                              onSelect={onChange}
                              initialFocus
                              captionLayout="dropdown-buttons"
                              fromYear={2020}
                              toYear={2030}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loanPurpose">Loan Purpose</Label>
                  <Textarea
                    id="loanPurpose"
                    placeholder="Describe the purpose of the loan"
                    className="min-h-[100px]"
                    {...form.register("loanPurpose")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collateral">Collateral (if any)</Label>
                  <Textarea
                    id="collateral"
                    placeholder="Describe any collateral for the loan"
                    className="min-h-[100px]"
                    {...form.register("collateral")}
                  />
                </div>

                <div className="flex justify-between mt-6 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    className=""
                    onClick={() => setActiveTab("affordability")}
                  >
                    Back: Affordability
                  </Button>

                  <Button
                    type="button"
                    className="bg-blue-500 hover:bg-blue-600"
                    onClick={() => setActiveTab("additional")}
                  >
                    Next: Additional Information
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Additional Information Tab */}
          <TabsContent value="additional">
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
                <CardDescription>
                  Add notes, assign team members, and set priority.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("priority", value)
                      }
                      defaultValue={form.watch("priority")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assignTo">Assign To</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("assignTo", value)
                      }
                      defaultValue={form.watch("assignTo")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jd">
                          John Doe (Lead Qualification)
                        </SelectItem>
                        <SelectItem value="as">
                          Alice Smith (Document Collection)
                        </SelectItem>
                        <SelectItem value="rj">
                          Robert Johnson (Credit Assessment)
                        </SelectItem>
                        <SelectItem value="ad">
                          Alex Donovan (Approval)
                        </SelectItem>
                        <SelectItem value="ms">
                          Maria Santos (Disbursement)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional notes or comments"
                    className="min-h-[150px]"
                    {...form.register("notes")}
                  />
                </div>

                <div className="flex justify-between mt-6 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    className=""
                    onClick={() => setActiveTab("loan")}
                  >
                    Back: Loan Details
                  </Button>

                  <Button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Create Lead
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>

      {/* Debug section - remove in production */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-gray-500 mt-4 p-4 border border-gray-700 rounded">
          <details>
            <summary>Debug Info</summary>
            <div className="mt-2">
              <p>
                Selected Offer:{" "}
                {selectedOffer ? JSON.stringify(selectedOffer) : "None"}
              </p>
              <p>
                Affordability Result:{" "}
                {affordabilityResult ? "Available" : "None"}
              </p>
              <p>Active Tab: {activeTab}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
