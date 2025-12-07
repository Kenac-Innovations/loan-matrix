"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Calendar, FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calender";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RepaymentSchedulePeriod {
  period?: number;
  fromDate?: number[];
  dueDate: number[];
  daysInPeriod?: number;
  principalDue?: number;
  principalDisbursed?: number;
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

interface RepaymentScheduleFormProps {
  leadId?: string;
  clientId?: number;
  onBack: () => void;
  onNext?: () => void;
  onComplete?: (data?: {
    repaymentSchedule: RepaymentSchedule;
    loanDetails: any;
    loanTerms: any;
    loanTemplate: any;
  }) => void;
}

export function RepaymentScheduleForm({
  leadId,
  clientId,
  onBack,
  onNext,
  onComplete,
}: RepaymentScheduleFormProps) {
  console.log("RepaymentScheduleForm props:", { leadId, clientId });

  const [repaymentSchedule, setRepaymentSchedule] =
    useState<RepaymentSchedule | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loanTerms, setLoanTerms] = useState<any>(null);
  const [loanDetails, setLoanDetails] = useState<any>(null);
  const [loanTemplate, setLoanTemplate] = useState<any>(null);
  const [editableCharges, setEditableCharges] = useState<
    Array<{
      chargeId: number;
      name: string;
      amount: number;
      dueDate: string;
      originalCharge?: any;
    }>
  >([]);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [selectedChargeOption, setSelectedChargeOption] = useState<string>("");
  const [newChargeAmount, setNewChargeAmount] = useState<string>("");
  const [newChargeDueDate, setNewChargeDueDate] = useState<Date | undefined>(
    undefined
  );

  // Load loan terms and loan details
  useEffect(() => {
    const loadData = async () => {
      if (!leadId) return;

      try {
        // Load loan details first to get disbursement date
        const detailsResponse = await fetch(
          `/api/leads/${leadId}/loan-details`
        );
        let disbursementDate = format(new Date(), "dd MMMM yyyy");
        let templateData: any = null;

        if (detailsResponse.ok) {
          const detailsResult = await detailsResponse.json();
          if (detailsResult.success && detailsResult.data) {
            setLoanDetails(detailsResult.data);

            // Calculate disbursement date
            if (detailsResult.data.disbursementOn) {
              disbursementDate = format(
                new Date(
                  typeof detailsResult.data.disbursementOn === "string"
                    ? detailsResult.data.disbursementOn
                    : detailsResult.data.disbursementOn
                ),
                "dd MMMM yyyy"
              );
            }

            // Load loan template if we have clientId and productId
            if (clientId && detailsResult.data.productId) {
              const templateResponse = await fetch(
                `/api/fineract/loans/template?clientId=${clientId}&productId=${detailsResult.data.productId}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`
              );
              if (templateResponse.ok) {
                templateData = await templateResponse.json();
                setLoanTemplate(templateData);
              }
            }
          }
        }

        // Load loan terms
        const termsResponse = await fetch(`/api/leads/${leadId}/loan-terms`);
        if (termsResponse.ok) {
          const termsResult = await termsResponse.json();
          if (termsResult.success && termsResult.data) {
            setLoanTerms(termsResult.data);

            // If charges are saved in loan terms, use them
            if (
              termsResult.data.charges &&
              termsResult.data.charges.length > 0
            ) {
              const savedCharges = termsResult.data.charges.map(
                (charge: any) => ({
                  chargeId: charge.chargeId,
                  name: charge.name || "Unknown Charge",
                  amount: charge.amount || 0,
                  dueDate: charge.dueDate || disbursementDate,
                })
              );
              setEditableCharges(savedCharges);
            } else if (
              templateData?.charges &&
              templateData.charges.length > 0
            ) {
              // Fallback to template charges if no saved charges
              const initialCharges = templateData.charges.map(
                (charge: any) => ({
                  chargeId: charge.chargeId || charge.id,
                  name: charge.name || "Unknown Charge",
                  amount: charge.amount || 0,
                  dueDate: disbursementDate,
                  originalCharge: charge,
                })
              );
              setEditableCharges(initialCharges);
            }
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };

    loadData();
  }, [leadId, clientId]);

  const handleGenerateSchedule = useCallback(async () => {
    if (!loanTerms || !loanDetails || !loanTemplate) {
      setError("Please complete loan details and terms first");
      return;
    }

    // Validate that productId exists and is valid
    const productIdStr = loanDetails.productId;
    console.log("Raw productId from loanDetails:", productIdStr);

    if (!productIdStr || productIdStr === "" || productIdStr === "0") {
      setError(
        "Product ID is required. Please ensure loan details are saved correctly."
      );
      return;
    }

    const productId = parseInt(productIdStr, 10);
    console.log("Parsed productId:", productId);

    if (isNaN(productId) || productId <= 0) {
      setError(
        "Invalid Product ID. Please ensure loan details are saved correctly."
      );
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Format dates
      const submittedDate = loanDetails.submittedOn
        ? format(
            new Date(
              typeof loanDetails.submittedOn === "string"
                ? loanDetails.submittedOn
                : loanDetails.submittedOn
            ),
            "dd MMMM yyyy"
          )
        : format(new Date(), "dd MMMM yyyy");

      const disbursementDate = loanDetails.disbursementOn
        ? format(
            new Date(
              typeof loanDetails.disbursementOn === "string"
                ? loanDetails.disbursementOn
                : loanDetails.disbursementOn
            ),
            "dd MMMM yyyy"
          )
        : format(new Date(), "dd MMMM yyyy");

      // Build charges array from editable charges
      const charges = editableCharges.map((charge) => ({
        chargeId: charge.chargeId,
        amount: charge.amount,
        dueDate: charge.dueDate,
      }));

      // Build payload for schedule calculation matching Fineract API structure
      const payload = {
        productId: productId,
        loanOfficerId: loanDetails.loanOfficer || "",
        loanPurposeId: loanDetails.loanPurpose || "",
        fundId: loanDetails.fund || "",
        submittedOnDate: submittedDate,
        expectedDisbursementDate: disbursementDate,
        externalId: "",
        linkAccountId: loanDetails.linkSavings || "",
        createStandingInstructionAtDisbursement:
          loanDetails.createStandingInstructions ? "true" : "",
        loanTermFrequency: loanTerms.loanTerm || 1,
        loanTermFrequencyType: loanTerms.termFrequency
          ? parseInt(loanTerms.termFrequency)
          : loanTemplate?.termPeriodFrequencyType?.id || 2,
        numberOfRepayments: loanTerms.numberOfRepayments || 1,
        repaymentEvery: loanTerms.repaymentEvery || 1,
        repaymentFrequencyType: loanTerms.repaymentFrequency
          ? parseInt(loanTerms.repaymentFrequency)
          : loanTemplate?.repaymentFrequencyType?.id || 2,
        repaymentFrequencyNthDayType: loanTerms.repaymentFrequencyNthDay || "",
        repaymentFrequencyDayOfWeekType:
          loanTerms.repaymentFrequencyDayOfWeek || "",
        repaymentsStartingFromDate: loanTerms.firstRepaymentOn
          ? format(
              new Date(
                typeof loanTerms.firstRepaymentOn === "string"
                  ? loanTerms.firstRepaymentOn
                  : loanTerms.firstRepaymentOn
              ),
              "dd MMMM yyyy"
            )
          : null,
        interestChargedFromDate: loanTerms.interestChargedFrom
          ? format(
              new Date(
                typeof loanTerms.interestChargedFrom === "string"
                  ? loanTerms.interestChargedFrom
                  : loanTerms.interestChargedFrom
              ),
              "dd MMMM yyyy"
            )
          : null,
        interestType: loanTerms.interestMethod
          ? parseInt(loanTerms.interestMethod)
          : loanTemplate?.interestType?.id || 1,
        isEqualAmortization: loanTerms.isEqualAmortization || false,
        amortizationType: loanTerms.amortization
          ? parseInt(loanTerms.amortization)
          : loanTemplate?.amortizationType?.id || 1,
        interestCalculationPeriodType: loanTerms.interestCalculationPeriod
          ? parseInt(loanTerms.interestCalculationPeriod)
          : loanTemplate?.interestCalculationPeriodType?.id || 1,
        loanIdToClose: "",
        isTopup: "",
        transactionProcessingStrategyCode:
          loanTerms.repaymentStrategy ||
          loanTemplate?.transactionProcessingStrategyCode ||
          "creocore-strategy",
        interestRateFrequencyType: loanTerms.interestRateFrequency
          ? parseInt(loanTerms.interestRateFrequency)
          : loanTemplate?.interestRateFrequencyType?.id || 2,
        interestRatePerPeriod: loanTerms.nominalInterestRate || 0,
        charges: charges,
        collateral:
          loanTerms.collaterals?.map((coll: any) => ({
            collateralTypeId: coll.id || 0,
            quantity: coll.quantity || 0,
            totalValue: coll.totalValue || 0,
          })) || [],
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        clientId: clientId,
        loanType: "individual",
        principal: loanTerms.principal || 0,
        allowPartialPeriodInterestCalcualtion: false,
      };

      console.log(
        "Schedule calculation payload:",
        JSON.stringify(payload, null, 2)
      );
      console.log("ProductId in payload:", payload.productId);

      const response = await fetch("/api/fineract/loans/calculate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Schedule calculation error response:", errorData);
        console.error("Full error data:", JSON.stringify(errorData, null, 2));

        // Extract detailed error message from Fineract
        let errorMessage = "Failed to calculate repayment schedule";
        let fineractDetails: any = null;

        // Check for direct error message
        if (errorData.error) {
          errorMessage = errorData.error;
        }

        // Extract Fineract error details
        if (errorData.details) {
          fineractDetails = errorData.details;

          // Try to get the most user-friendly message first
          if (errorData.details.userMessage) {
            errorMessage = errorData.details.userMessage;
          } else if (errorData.details.developerMessage) {
            errorMessage = errorData.details.developerMessage;
          } else if (errorData.details.defaultUserMessage) {
            errorMessage = errorData.details.defaultUserMessage;
          } else if (
            errorData.details.errors &&
            Array.isArray(errorData.details.errors)
          ) {
            // Handle validation errors array
            const errorMessages = errorData.details.errors
              .map(
                (e: any) =>
                  e.defaultUserMessage ||
                  e.userMessage ||
                  e.developerMessage ||
                  e.message
              )
              .filter(Boolean);

            if (errorMessages.length > 0) {
              errorMessage = errorMessages.join("; ");
            }
          }
        }

        // If we still don't have a good message, try to extract from response body
        if (
          errorMessage === "Failed to calculate repayment schedule" &&
          errorData.message
        ) {
          errorMessage = errorData.message;
        }

        // Build comprehensive error message
        let fullErrorMessage = errorMessage;
        if (response.status) {
          fullErrorMessage = `${errorMessage} (HTTP ${response.status})`;
        }

        // Store full error details for display
        const errorWithDetails = {
          message: fullErrorMessage,
          status: response.status,
          fineractDetails: fineractDetails || errorData.details || null,
          rawError: errorData,
        };

        throw new Error(JSON.stringify(errorWithDetails));
      }

      const scheduleData = await response.json();
      setRepaymentSchedule(scheduleData);

      // Mark as complete and pass data
      if (onComplete) {
        onComplete({
          repaymentSchedule: scheduleData,
          loanDetails,
          loanTerms,
          loanTemplate,
        });
      }
    } catch (err) {
      console.error("Error generating repayment schedule:", err);

      // Parse error message - it might be JSON with detailed error info
      let errorMessage = "Failed to generate repayment schedule";
      let errorDetails: any = null;

      if (err instanceof Error) {
        try {
          // Try to parse as JSON (if it contains structured error data)
          const parsed = JSON.parse(err.message);
          if (parsed.message) {
            errorMessage = parsed.message;
            errorDetails = parsed;
          } else {
            errorMessage = err.message;
          }
        } catch {
          // Not JSON, use message as-is
          errorMessage = err.message;
        }
      } else if (typeof err === "string") {
        try {
          const parsed = JSON.parse(err);
          if (parsed.message) {
            errorMessage = parsed.message;
            errorDetails = parsed;
          } else {
            errorMessage = err;
          }
        } catch {
          errorMessage = err;
        }
      }

      // Format error message with Fineract details if available
      if (errorDetails?.fineractDetails) {
        const fineract = errorDetails.fineractDetails;

        // Build detailed error message
        let detailedMessage = errorMessage;

        // Add Fineract-specific error information
        if (
          fineract.errors &&
          Array.isArray(fineract.errors) &&
          fineract.errors.length > 0
        ) {
          const validationErrors = fineract.errors
            .map((e: any) => {
              const msg =
                e.defaultUserMessage ||
                e.userMessage ||
                e.developerMessage ||
                e.message;
              const arg =
                e.args && e.args.length > 0 ? ` (${e.args.join(", ")})` : "";
              return msg ? `${msg}${arg}` : null;
            })
            .filter(Boolean);

          if (validationErrors.length > 0) {
            detailedMessage = `Fineract Error:\n${validationErrors.join("\n")}`;
          }
        } else if (
          fineract.developerMessage &&
          fineract.developerMessage !== errorMessage
        ) {
          detailedMessage = `Fineract Error: ${fineract.developerMessage}`;
        } else if (
          fineract.userMessage &&
          fineract.userMessage !== errorMessage
        ) {
          detailedMessage = `Fineract Error: ${fineract.userMessage}`;
        }

        errorMessage = detailedMessage;
      }

      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [
    loanTerms,
    loanDetails,
    loanTemplate,
    editableCharges,
    clientId,
    onComplete,
  ]);

  const formatDate = (dateArray: number[] | string | undefined): string => {
    if (!dateArray) return "N/A";
    if (typeof dateArray === "string") {
      return format(new Date(dateArray), "MMM dd, yyyy");
    }
    if (Array.isArray(dateArray) && dateArray.length >= 3) {
      const [year, month, day] = dateArray;
      return format(new Date(year, month - 1, day), "MMM dd, yyyy");
    }
    return "N/A";
  };

  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || amount === null) return "0.00";
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Repayment Schedule</CardTitle>
          <CardDescription>
            Review the loan repayment schedule based on the loan terms and
            details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!repaymentSchedule ? (
            <div className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <X className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">
                        Fineract Error: Failed to Generate Schedule
                      </h4>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-red-700 dark:text-red-200 whitespace-pre-wrap font-medium">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-300 mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                    <p className="font-medium mb-1">Troubleshooting:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>
                        Check that all loan details and terms are correctly
                        filled
                      </li>
                      <li>Verify the loan product configuration in Fineract</li>
                      <li>Ensure dates are valid and in the correct format</li>
                      <li>
                        Check the browser console (F12) for detailed error
                        information
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {!loanTerms || !loanDetails ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Please complete loan details and terms first before
                    generating the repayment schedule.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Button
                    onClick={handleGenerateSchedule}
                    disabled={isGenerating}
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Schedule...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Repayment Schedule
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Information */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Principal
                  </p>
                  <p className="text-lg font-semibold">
                    {repaymentSchedule.currency?.code || ""}{" "}
                    {formatCurrency(repaymentSchedule.totalPrincipalExpected)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Interest</p>
                  <p className="text-lg font-semibold">
                    {repaymentSchedule.currency?.code || ""}{" "}
                    {formatCurrency(repaymentSchedule.totalInterestCharged)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Fees</p>
                  <p className="text-lg font-semibold">
                    {repaymentSchedule.currency?.code || ""}{" "}
                    {formatCurrency(repaymentSchedule.totalFeeChargesCharged)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total</p>
                  <p className="text-lg font-semibold">
                    {repaymentSchedule.currency?.code || ""}{" "}
                    {formatCurrency(repaymentSchedule.totalRepaymentExpected)}
                  </p>
                </div>
              </div>

              {/* Schedule Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[60px]">Period</TableHead>
                        <TableHead className="min-w-[120px]">
                          Due Date
                        </TableHead>
                        <TableHead className="min-w-[100px] text-right">
                          Principal
                        </TableHead>
                        <TableHead className="min-w-[100px] text-right">
                          Interest
                        </TableHead>
                        <TableHead className="min-w-[100px] text-right">
                          Fees
                        </TableHead>
                        <TableHead className="min-w-[100px] text-right">
                          Total Due
                        </TableHead>
                        <TableHead className="min-w-[100px] text-right">
                          Outstanding
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repaymentSchedule.periods
                        ?.filter(
                          (period) =>
                            period.period !== undefined &&
                            !period.downPaymentPeriod
                        )
                        .map((period, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {period.period ?? index + 1}
                            </TableCell>
                            <TableCell>{formatDate(period.dueDate)}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                period.principalDue ||
                                  period.principalDisbursed ||
                                  0
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(period.interestDue || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(period.feeChargesDue || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(
                                period.totalDueForPeriod ||
                                  period.totalOriginalDueForPeriod ||
                                  0
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                period.principalLoanBalanceOutstanding || 0
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="px-6"
            >
              Previous
            </Button>
            {repaymentSchedule && (
              <Button
                type="button"
                onClick={() => {
                  if (onComplete) {
                    onComplete({
                      repaymentSchedule,
                      loanDetails,
                      loanTerms,
                      loanTemplate,
                    });
                  }
                  if (onNext) {
                    onNext();
                  }
                }}
                className="px-6 transition-all duration-300"
              >
                {onNext ? "Next: Contracts" : "Complete"}
              </Button>
            )}
          </CardFooter>
        </CardContent>
      </Card>
    </div>
  );
}
