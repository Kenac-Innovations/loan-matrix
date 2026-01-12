"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CheckCircle2,
  DollarSign,
  Briefcase,
  Shield,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

// Form validation schema based on the provided JSON structure
const affordabilitySchema = z
  .object({
    grossMonthlyIncome: z
      .number()
      .min(1, "Gross monthly income must be greater than 0"),
    netMonthlyIncome: z
      .number()
      .min(1, "Net monthly income must be greater than 0"),
    nationality: z.string().optional(),
    mobileInOwnName: z.boolean().default(false),
    hasProofOfIncome: z.boolean().default(false),
    hasValidNationalId: z.boolean().default(false),
    identityVerified: z.boolean().default(false),
    employmentVerified: z.boolean().default(false),
    incomeVerified: z.boolean().default(false),
  })
  .refine((data) => data.netMonthlyIncome <= data.grossMonthlyIncome, {
    message: "Net monthly income cannot be greater than gross monthly income",
    path: ["netMonthlyIncome"],
  })
  .refine(
    (data) =>
      data.mobileInOwnName &&
      data.hasProofOfIncome &&
      data.hasValidNationalId &&
      data.identityVerified &&
      data.employmentVerified &&
      data.incomeVerified,
    {
      message: "All verification checkboxes must be checked to proceed",
      path: ["incomeVerified"], // Show error on the last checkbox
    }
  );

type AffordabilityFormValues = z.infer<typeof affordabilitySchema>;

interface SimplifiedAffordabilityFormProps {
  leadId?: string;
  onComplete?: () => void;
  onBack?: () => void;
}

export function SimplifiedAffordabilityForm({
  leadId,
  onComplete,
  onBack,
}: SimplifiedAffordabilityFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const { toast } = useToast();
  const [grossInputValue, setGrossInputValue] = useState("");
  const [netInputValue, setNetInputValue] = useState("");
  const [sectionCompletion, setSectionCompletion] = useState({
    income: false,
    verification: false,
  });
  const [sectionSaved, setSectionSaved] = useState({
    income: false,
    verification: false,
  });

  // Format number as currency (for display only, not while typing)
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Parse currency string to number
  const parseCurrency = (value: string): number => {
    // Remove all non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Format input while typing (add commas but preserve typing flow)
  const formatInputWhileTyping = (value: string): string => {
    // Remove all non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");

    // Split by decimal point
    const parts = cleaned.split(".");

    // Format the integer part with commas
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // If there's a decimal part, add it back
    if (parts.length > 1) {
      return `${integerPart}.${parts[1].slice(0, 2)}`; // Limit to 2 decimal places
    }

    return integerPart;
  };

  const form = useForm<AffordabilityFormValues>({
    resolver: zodResolver(affordabilitySchema),
    defaultValues: {
      grossMonthlyIncome: 0,
      netMonthlyIncome: 0,
      nationality: "",
      mobileInOwnName: false,
      hasProofOfIncome: false,
      hasValidNationalId: false,
      identityVerified: false,
      employmentVerified: false,
      incomeVerified: false,
    },
  });

  // Check section completion
  const watchedValues = form.watch();
  useEffect(() => {
    const incomeComplete =
      watchedValues.grossMonthlyIncome > 0 &&
      watchedValues.netMonthlyIncome > 0;
    // All verification checkboxes must be checked to be complete
    const verificationComplete =
      watchedValues.mobileInOwnName &&
      watchedValues.hasProofOfIncome &&
      watchedValues.hasValidNationalId &&
      watchedValues.identityVerified &&
      watchedValues.employmentVerified &&
      watchedValues.incomeVerified;

    setSectionCompletion({
      income: incomeComplete,
      verification: verificationComplete,
    });
  }, [
    watchedValues.grossMonthlyIncome,
    watchedValues.netMonthlyIncome,
    watchedValues.mobileInOwnName,
    watchedValues.hasProofOfIncome,
    watchedValues.hasValidNationalId,
    watchedValues.identityVerified,
    watchedValues.employmentVerified,
    watchedValues.incomeVerified,
  ]);

  // Helper function to get section status
  const getSectionStatus = (
    sectionName: keyof typeof sectionCompletion
  ): "incomplete" | "pending" | "saved" => {
    const isComplete = sectionCompletion[sectionName];
    const isSaved = sectionSaved[sectionName];

    if (!isComplete) return "incomplete";
    if (isComplete && !isSaved) return "pending";
    return "saved";
  };

  // Helper function to get section styling classes
  const getSectionClasses = (
    sectionName: keyof typeof sectionCompletion
  ): string => {
    const status = getSectionStatus(sectionName);
    const baseClasses = "space-y-6 mb-8 rounded-lg p-6";

    switch (status) {
      case "incomplete":
        return `${baseClasses} bg-red-50 dark:bg-red-950 border-2 border-red-500 dark:border-red-600`;
      case "pending":
        return `${baseClasses} bg-amber-50 dark:bg-amber-950 border-2 border-amber-500 dark:border-amber-600`;
      case "saved":
        return `${baseClasses} bg-green-50 dark:bg-green-950 border-2 border-green-500 dark:border-green-600`;
    }
  };

  // Load existing affordability data when component mounts
  useEffect(() => {
    const loadAffordabilityData = async () => {
      if (!leadId) return;

      try {
        const response = await fetch(`/api/leads/${leadId}/affordability`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Update form with existing data
            Object.keys(result.data).forEach((key) => {
              const value = result.data[key];
              if (value !== null && value !== undefined) {
                form.setValue(key as any, value);
              }
            });

            // Check if there's existing affordability data
            const hasExistingData =
              result.data.netMonthlyIncome > 0 ||
              result.data.grossMonthlyIncome > 0;

            if (hasExistingData) {
              console.log(
                "Pre-populated affordability form with existing data"
              );
              setIsCompleted(true);
              setSectionSaved({ income: true, verification: true });

              // Set formatted display values for existing data
              if (result.data.grossMonthlyIncome > 0) {
                setGrossInputValue(
                  formatCurrency(result.data.grossMonthlyIncome)
                );
              }
              if (result.data.netMonthlyIncome > 0) {
                setNetInputValue(formatCurrency(result.data.netMonthlyIncome));
              }
            }
          }
        }
      } catch (error) {
        console.error("Error loading affordability data:", error);
      }
    };

    loadAffordabilityData();
  }, [leadId, form]);

  const onSubmit = async (data: AffordabilityFormValues) => {
    if (!leadId) {
      toast({
        title: "Error",
        description:
          "Lead ID is missing. Please save the client information first.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      console.log("Saving affordability data for lead:", leadId);
      console.log("Data to save:", data);

      // Save affordability data to the database
      const response = await fetch(`/api/leads/${leadId}/affordability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      // Check if response has content before trying to parse JSON
      const text = await response.text();
      console.log("Response text:", text);

      let result;
      try {
        result = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error("Failed to parse response as JSON:", e);
        throw new Error("Invalid response from server");
      }

      console.log("API Response:", result);

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to save affordability data (${response.status})`
        );
      }

      setIsCompleted(true);
      setSectionSaved({ income: true, verification: true });
      toast({
        title: "Success",
        description: "Affordability data saved successfully",
      });

      // Call onComplete callback if provided
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("Error saving affordability data:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error",
        description: `Failed to save affordability data: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {!leadId && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <strong>Warning:</strong> Lead ID is missing. Please save the client
            information first before proceeding to affordability assessment.
          </AlertDescription>
        </Alert>
      )}

      {isCompleted && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Affordability Assessment Complete:</strong> The data has
            been saved successfully. You can proceed to the next stage.
          </AlertDescription>
        </Alert>
      )}

      {/* Income Information */}
      <div className={getSectionClasses("income")}>
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
          <div className="flex items-center gap-2 mb-2">
            {getSectionStatus("income") === "saved" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : getSectionStatus("income") === "pending" ? (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <CardTitle className="text-lg font-medium">
              Income Details
            </CardTitle>
            {getSectionStatus("income") === "saved" && (
              <Badge className="ml-2 bg-green-500 text-white">Complete</Badge>
            )}
            {getSectionStatus("income") === "pending" && (
              <Badge className="ml-2 bg-amber-500 text-white">
                Pending Save
              </Badge>
            )}
          </div>
          <CardDescription>
            Provide the client's income information
          </CardDescription>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="grossMonthlyIncome">
              Gross Monthly Income <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                ZMW
              </span>
              <Controller
                control={form.control}
                name="grossMonthlyIncome"
                render={({ field }) => (
                  <Input
                    id="grossMonthlyIncome"
                    type="text"
                    placeholder="0.00"
                    className="pl-12"
                    value={grossInputValue}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      const formattedValue = formatInputWhileTyping(rawValue);
                      setGrossInputValue(formattedValue);
                      const numericValue = parseCurrency(formattedValue);
                      field.onChange(numericValue);
                    }}
                    onBlur={() => {
                      // Format with decimals on blur if there's a value
                      if (field.value > 0) {
                        setGrossInputValue(formatCurrency(field.value));
                      }
                      // Trigger validation on blur
                      form.trigger("netMonthlyIncome");
                    }}
                    onFocus={() => {
                      // Remove decimal formatting when focused for easier editing
                      if (field.value > 0) {
                        setGrossInputValue(field.value.toString());
                      }
                    }}
                  />
                )}
              />
            </div>
            {form.formState.errors.grossMonthlyIncome && (
              <p className="text-sm text-red-500">
                {form.formState.errors.grossMonthlyIncome.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="netMonthlyIncome">
              Net Monthly Income <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                ZMW
              </span>
              <Controller
                control={form.control}
                name="netMonthlyIncome"
                render={({ field }) => (
                  <Input
                    id="netMonthlyIncome"
                    type="text"
                    placeholder="0.00"
                    className="pl-12"
                    value={netInputValue}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      const formattedValue = formatInputWhileTyping(rawValue);
                      setNetInputValue(formattedValue);
                      const numericValue = parseCurrency(formattedValue);
                      field.onChange(numericValue);
                    }}
                    onBlur={() => {
                      // Format with decimals on blur if there's a value
                      if (field.value > 0) {
                        setNetInputValue(formatCurrency(field.value));
                      }
                      // Trigger validation on blur
                      form.trigger("netMonthlyIncome");
                    }}
                    onFocus={() => {
                      // Remove decimal formatting when focused for easier editing
                      if (field.value > 0) {
                        setNetInputValue(field.value.toString());
                      }
                    }}
                  />
                )}
              />
            </div>
            {form.formState.errors.netMonthlyIncome && (
              <p className="text-sm text-red-500">
                {form.formState.errors.netMonthlyIncome.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Net income must not exceed gross income
            </p>
          </div>
        </div>
      </div>

      {/* Verification and Additional Information */}
      <div className={getSectionClasses("verification")}>
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
          <div className="flex items-center gap-2 mb-2">
            {getSectionStatus("verification") === "saved" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : getSectionStatus("verification") === "pending" ? (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <CardTitle className="text-lg font-medium">
              Verification Details
            </CardTitle>
            {getSectionStatus("verification") === "saved" && (
              <Badge className="ml-2 bg-green-500 text-white">Complete</Badge>
            )}
            {getSectionStatus("verification") === "pending" && (
              <Badge className="ml-2 bg-amber-500 text-white">
                Pending Save
              </Badge>
            )}
          </div>
          <CardDescription>
            Identity and income verification status
          </CardDescription>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="nationality">Nationality</Label>
            {/* TODO: Make nationality options configurable via tenant settings */}
            <Controller
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="nationality">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Zambian">Zambian</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Verification Checkboxes */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="mobileInOwnName"
                  render={({ field }) => (
                    <Checkbox
                      id="mobileInOwnName"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor="mobileInOwnName"
                  className="font-normal cursor-pointer"
                >
                  Mobile in own name
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="hasProofOfIncome"
                  render={({ field }) => (
                    <Checkbox
                      id="hasProofOfIncome"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor="hasProofOfIncome"
                  className="font-normal cursor-pointer"
                >
                  Has proof of income
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="hasValidNationalId"
                  render={({ field }) => (
                    <Checkbox
                      id="hasValidNationalId"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor="hasValidNationalId"
                  className="font-normal cursor-pointer"
                >
                  Has valid national ID
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="identityVerified"
                  render={({ field }) => (
                    <Checkbox
                      id="identityVerified"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor="identityVerified"
                  className="font-normal cursor-pointer"
                >
                  Identity verified
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="employmentVerified"
                  render={({ field }) => (
                    <Checkbox
                      id="employmentVerified"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor="employmentVerified"
                  className="font-normal cursor-pointer"
                >
                  Employment verified
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="incomeVerified"
                  render={({ field }) => (
                    <Checkbox
                      id="incomeVerified"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor="incomeVerified"
                  className="font-normal cursor-pointer"
                >
                  Income verified
                </Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
          {onBack && (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="px-6"
            >
              Previous
            </Button>
          )}

          <Button
            type="submit"
            className={`px-6 transition-all duration-300 ${
              isCompleted
                ? "bg-green-500 hover:bg-green-600"
                : sectionCompletion.income && sectionCompletion.verification
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            disabled={
              isSaving ||
              !sectionCompletion.income ||
              !sectionCompletion.verification
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Next
              </>
            ) : (
              "Save & Next"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
