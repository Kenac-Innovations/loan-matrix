"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Loader2,
  Calculator,
  CreditCard,
  Shield,
  User,
  FileText,
  Info,
} from "lucide-react";
import Link from "next/link";
import type {
  AffordabilityResult,
  LoanOffer,
} from "@/lib/affordability-calculator";
import { AffordabilityCalculator } from "./affordability-calculator";
import { ClientRegistrationForm } from "./client-registration-form";
import { CreditScoringCalculator } from "./credit-scoring-calculator";
import { LoanDetailsForm } from "@/components/loan-details-form";
import { LoanTermsForm } from "@/app/(application)/leads/new/components/loan-terms-form";
import { toast } from "@/components/ui/use-toast";
import { LeadLocalStorage } from "@/lib/lead-local-storage";

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

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

// Form validation schema
const leadFormSchema = z.object({
  // Client Information
  officeId: z.string().min(1, { message: "Office is required" }),
  legalFormId: z.string().min(1, { message: "Legal form is required" }),
  externalId: z.string().optional(),
  firstname: z.string().min(2, { message: "First name is required" }),
  middlename: z.string().optional(),
  lastname: z.string().min(2, { message: "Last name is required" }),
  dateOfBirth: z.date().optional(),
  gender: z.string().optional(),
  isStaff: z.boolean().default(false),
  mobileNo: z.string().min(10, { message: "Valid phone number is required" }),
  countryCode: z.string().default("+1"),
  emailAddress: z.string().email({ message: "Valid email is required" }),
  clientTypeId: z.string().optional(),
  clientClassificationId: z.string().optional(),
  submittedOnDate: z.date().default(() => new Date()),
  active: z.boolean().default(true),
  activationDate: z.date().optional(),
  openSavingsAccount: z.boolean().default(false),
  savingsProductId: z.string().optional(),

  // Financial fields
  monthlyIncomeRange: z.string().optional(),
  employmentStatus: z.string().optional(),
  employerName: z.string().optional(),
  yearsAtCurrentJob: z.string().optional(),
  hasExistingLoans: z.boolean().default(false),
  monthlyDebtPayments: z.union([z.number(), z.string()]).transform((val) => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return val;
  }).default(0),
  propertyOwnership: z.string().optional(),
  businessOwnership: z.boolean().default(false),
  businessType: z.string().optional(),

  // Additional Information fields
  priority: z.string().optional(),
  assignTo: z.string().optional(),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

export function NewLeadForm() {
  // ALL HOOKS MUST BE CALLED FIRST, BEFORE ANY CONDITIONAL RETURNS
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [affordabilityResult, setAffordabilityResult] =
    useState<AffordabilityResult | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [activeTab, setActiveTab] = useState("client");
  const [creditScoreResult, setCreditScoreResult] = useState<any>(null);
  const [loanTemplateData, setLoanTemplateData] = useState<any>(null);

  // Fetch template data using SWR
  const { data: templateResult, error: templateError } = useSWR('/api/leads/template', fetcher);
  const clientFormData = templateResult?.data || {
    offices: [],
    legalForms: [],
    genders: [],
    clientTypes: [],
    clientClassifications: [],
    savingsProducts: [],
    activationDate: null,
  };

  // Initialize form with default values - MUST BE BEFORE ANY CONDITIONAL RETURNS
  const form = useForm({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      officeId: "1",
      legalFormId: "1",
      externalId: "",
      firstname: "",
      middlename: "",
      lastname: "",
      dateOfBirth: undefined,
      gender: "",
      isStaff: false,
      mobileNo: "",
      countryCode: "+263",
      emailAddress: "",
      clientTypeId: "",
      clientClassificationId: "",
      submittedOnDate: new Date(),
      active: true,
      activationDate: undefined,
      openSavingsAccount: false,
      savingsProductId: "",
      // Financial fields
      monthlyIncomeRange: "",
      employmentStatus: "",
      employerName: "",
      yearsAtCurrentJob: "",
      hasExistingLoans: false,
      monthlyDebtPayments: 0,
      propertyOwnership: "",
      businessOwnership: false,
      businessType: "",
      // Additional Information fields
      priority: "",
      assignTo: "",
      notes: "",
    },
  });

  // Handle template loading error
  if (templateError) {
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

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-red-600 font-medium">Error loading form data</div>
              <div className="text-sm text-red-500 mt-1">{templateError.message}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle loading state
  if (!templateResult) {
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

        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  // Handle form submission
  const onSubmit = async (data: LeadFormValues) => {
    setIsSubmitting(true);

    try {
      // Validate required fields before submission
      if (!data.officeId || !data.legalFormId) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields (Office and Legal Form)",
          variant: "destructive",
        });
        return;
      }

      console.log("Form data being submitted:", data);

      // Create lead using the new API
      const response = await fetch('/api/leads/operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'saveDraft',
          data: {
            ...data,
            // Convert string IDs to numbers
            officeId: data.officeId ? Number(data.officeId) : undefined,
            legalFormId: data.legalFormId ? Number(data.legalFormId) : undefined,
            clientTypeId: data.clientTypeId ? Number(data.clientTypeId) : undefined,
            clientClassificationId: data.clientClassificationId ? Number(data.clientClassificationId) : undefined,
            genderId: data.gender ? Number(data.gender) : undefined,
            // Convert data types to match the schema expectations
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            submittedOnDate: data.submittedOnDate ? new Date(data.submittedOnDate) : new Date(),
            activationDate: data.activationDate ? new Date(data.activationDate) : undefined,
            savingsProductId: data.savingsProductId ? Number(data.savingsProductId) : undefined,
            monthlyDebtPayments: data.monthlyDebtPayments ? Number(data.monthlyDebtPayments) : undefined,
            // Add affordability and credit score data
            affordabilityResult,
            selectedOffer,
            creditScoreResult,
          },
        }),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.error || 'Failed to create lead');
      }

      const result = await response.json();
      console.log("Lead created successfully:", result);

      // Submit the lead
      const submitResponse = await fetch('/api/leads/operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'submitLead',
          leadId: result.leadId,
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        console.error("Submit Error:", errorData);
        throw new Error(errorData.error || 'Failed to submit lead');
      }

      // Success - redirect
      toast({
        title: "Success",
        description: "Lead created and submitted successfully",
      });
      // Redirect to leads page after successful submission
      router.push("/leads");
    } catch (error) {
      console.error("Error creating lead:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
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
      // Note: We're not updating form fields here since this form is for client registration
      // The loan details will be handled in a separate loan application form
    }
  };

  const handleOfferSelect = (offer: LoanOffer) => {
    toast({
      title: "Selected Offer",
      description: "Offer selected successfully",
    });
    setSelectedOffer(offer);

    // Note: We're not updating form fields here since this form is for client registration
    // The loan details will be handled in a separate loan application form
  };

  const handleCreditScoreCalculated = (result: any) => {
    setCreditScoreResult(result);
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

  // Handle step navigation
  const handleStepNavigation = (stepId: string) => {
    setActiveTab(stepId);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 px-2 py-2 lg:px-6 lg:py-6 border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild className="h-8 w-8">
              <Link href="/leads">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-lg lg:text-2xl font-bold tracking-tight">Create New Lead</h1>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1">
        <div className="px-2 py-2 lg:px-6 lg:py-6 space-y-2 lg:space-y-6">

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList className="w-full grid grid-cols-6 gap-0 lg:grid lg:grid-cols-6 lg:gap-0">
              <TabsTrigger
                value="client"
                className="data-[state=active]:bg-blue-500 flex-1 justify-center"
                title="Client Information"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Client</span>
              </TabsTrigger>
              <TabsTrigger
                value="affordability"
                className="data-[state=active]:bg-blue-500 flex-1 justify-center"
                title="Affordability"
              >
                <Calculator className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Affordability</span>
              </TabsTrigger>
              <TabsTrigger
                value="credit-scoring"
                className="data-[state=active]:bg-blue-500 flex-1 justify-center"
                title="Credit Scoring"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Credit</span>
                {creditScoreResult && (
                  <Badge className="ml-1 bg-green-500 text-white text-xs">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="loan"
                className="data-[state=active]:bg-blue-500 flex-1 justify-center"
                title="Loan Details"
              >
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Loan</span>
              </TabsTrigger>
              <TabsTrigger
                value="terms"
                className="data-[state=active]:bg-blue-500 flex-1 justify-center"
                title="Terms"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Terms</span>
              </TabsTrigger>
              <TabsTrigger
                value="additional"
                className="data-[state=active]:bg-blue-500 flex-1 justify-center"
                title="Additional Information"
              >
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Additional</span>
              </TabsTrigger>
            </TabsList>

            {/* Client Information Tab */}
            <TabsContent value="client" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardHeader className="px-2 lg:px-6">
                  <CardTitle>Client Information</CardTitle>
                  <CardDescription>
                    Enter the client's personal and contact information.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-2 lg:px-6">
                  <ClientRegistrationForm
                    formData={clientFormData}
                    externalForm={form}
                    onFormSubmit={onSubmit}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto"
                      onClick={() => setActiveTab("affordability")}
                    >
                      Next: Affordability
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Affordability Tab */}
            <TabsContent value="affordability" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardHeader className="px-2 lg:px-6">
                  <CardTitle>Affordability Calculator</CardTitle>
                  <CardDescription>
                    Calculate loan affordability and generate offers based on
                    client's financial situation
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 lg:px-6">
                  <AffordabilityCalculator
                    onCalculationComplete={handleAffordabilityCalculation}
                    onOfferSelect={handleOfferSelect}
                  />

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-between mt-6 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setActiveTab("client")}
                    >
                      Back: Client Information
                    </Button>

                    <Button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab("credit-scoring");
                      }}
                    >
                      Next: Credit Scoring
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Credit Scoring Tab */}
            <TabsContent value="credit-scoring" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardHeader className="px-2 lg:px-6">
                  <CardTitle>Credit Scoring Calculator</CardTitle>
                  <CardDescription>
                    Evaluate client creditworthiness using comprehensive scoring factors
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 lg:px-6">
                  <CreditScoringCalculator
                    onScoreCalculated={handleCreditScoreCalculated}
                  />

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-between mt-6 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setActiveTab("affordability")}
                    >
                      Back: Affordability
                    </Button>

                    <Button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto"
                      onClick={() => setActiveTab("loan")}
                    >
                      Next: Loan Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Loan Details Tab */}
            <TabsContent value="loan" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardContent className="p-2 lg:p-6">
                  <LoanDetailsForm
                    clientId={1} // This should come from the client registration
                    onSubmit={(data) => {
                      console.log('Loan details submitted:', data);
                      // Handle loan details submission
                    }}
                    onBack={() => setActiveTab("credit-scoring")}
                    onNext={(templateData) => {
                      console.log('Received template data in main form:', templateData);
                      setLoanTemplateData(templateData);
                      setActiveTab("terms");
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Loan Terms Tab */}
            <TabsContent value="terms" className="mt-0">
              <Card className="p-2 lg:p-6">
                <CardContent className="p-2 lg:p-6">
                  {loanTemplateData ? (
                    <LoanTermsForm
                      loanTemplate={loanTemplateData}
                      onSubmit={(data) => {
                        console.log('Loan terms submitted:', data);
                        // Handle loan terms submission

                        form.handleSubmit(onSubmit)();
                      }}
                      onBack={() => setActiveTab("loan")}
                      onNext={() => setActiveTab("additional")}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No loan template data available</p>
                      <p className="text-sm text-muted-foreground">Please complete the Loan Details tab first to load the template data.</p>
                      <Button
                        onClick={() => setActiveTab("loan")}
                        className="mt-2"
                      >
                        Go to Loan Details
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Additional Information Tab */}
            <TabsContent value="additional" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardHeader className="px-2 lg:px-6">
                  <CardTitle>Additional Information</CardTitle>
                  <CardDescription>
                    Add notes, assign team members, and set priority.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-2 lg:px-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        onValueChange={(value) =>
                          form.setValue("priority", value)
                        }
                        defaultValue={form.watch("priority")}
                      >
                        <SelectTrigger className="h-10 w-full">
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
                        <SelectTrigger className="h-10 w-full">
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

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-between mt-6 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setActiveTab("terms")}
                    >
                      Back: Loan Terms
                    </Button>

                    <Button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto"
                      disabled={isSubmitting}
                      onClick={async () => {
                        // Validate form before submission
                        const isValid = await form.trigger();

                        if (!isValid) {
                          toast({
                            title: "Validation Error",
                            description: "Please fill in all required fields",
                            variant: "destructive",
                          });
                          return;
                        }
                        form.handleSubmit(onSubmit)();
                        LeadLocalStorage.clear();
                      }}
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
        </div>
      </div>
    </div>
  );
}
