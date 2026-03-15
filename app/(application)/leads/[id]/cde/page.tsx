import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

async function getCDEData(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        externalId: true,
        stateMetadata: true,
      },
    });

    if (!lead) {
      return { lead: null, cdeResult: null };
    }

    const stateMetadata = (lead.stateMetadata as any) || {};
    const cdeResult = stateMetadata.cdeResult || null;

    return { lead, cdeResult };
  } catch (error) {
    console.error("Error fetching CDE data:", error);
    return { lead: null, cdeResult: null };
  }
}

export default async function CDEDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { lead, cdeResult } = await getCDEData(id);

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    );
  }

  if (!cdeResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild className="h-8 w-8">
            <Link href={`/leads/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="text-2xl font-bold tracking-tight">
            CDE Evaluation Details
          </h2>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                CDE evaluation not yet performed
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                The Credit Decision Engine evaluation will appear here once the
                loan is created or affordability data is saved.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild className="h-8 w-8">
          <Link href={`/leads/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            CDE Evaluation Details
          </h2>
          <p className="text-sm text-muted-foreground">
            Lead #{id} • {lead.firstname} {lead.lastname}
          </p>
        </div>
      </div>

      {/* Overall Decision */}
      <Card>
        <CardHeader>
          <CardTitle>CDE Decision</CardTitle>
          <CardDescription>
            Credit Decision Engine Evaluation Result
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Decision</p>
              <Badge
                className={`mt-2 ${
                  cdeResult.decision === "APPROVED"
                    ? "bg-green-500"
                    : cdeResult.decision === "MANUAL_REVIEW"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                } text-white border-0`}
              >
                {cdeResult.decision}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Evaluated At</p>
              <p className="text-sm font-medium">
                {cdeResult.decisionTimestamp
                  ? format(new Date(cdeResult.decisionTimestamp), "PPp")
                  : "N/A"}
              </p>
            </div>
          </div>
          {cdeResult.recommendation && (
            <div>
              <p className="text-sm text-muted-foreground">Recommendation</p>
              <p className="text-base font-medium mt-1">
                {cdeResult.recommendation}
              </p>
            </div>
          )}
          {cdeResult.decisionId && (
            <div>
              <p className="text-sm text-muted-foreground">Decision ID</p>
              <p className="text-sm font-mono mt-1">{cdeResult.decisionId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scoring Result */}
      {cdeResult.scoringResult && (
        <Card>
          <CardHeader>
            <CardTitle>Credit Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Credit Score</p>
                <p className="text-2xl font-bold text-blue-600">
                  {cdeResult.scoringResult.creditScore || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credit Rating</p>
                <p className="text-lg font-semibold">
                  {cdeResult.scoringResult.creditRating || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Score Percentage
                </p>
                <p className="text-lg font-semibold">
                  {cdeResult.scoringResult.scorePercentage
                    ? `${cdeResult.scoringResult.scorePercentage.toFixed(2)}%`
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-lg font-semibold">
                  {cdeResult.scoringResult.totalPoints || "N/A"}
                </p>
              </div>
            </div>
            {cdeResult.scoringResult.scorecardCode && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Scorecard</p>
                <p className="text-sm font-medium">
                  {cdeResult.scoringResult.scorecardCode}
                  {cdeResult.scoringResult.scorecardVersion &&
                    ` v${cdeResult.scoringResult.scorecardVersion}`}
                </p>
              </div>
            )}
            {cdeResult.scoringResult.factorScores &&
              cdeResult.scoringResult.factorScores.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold mb-2">Factor Scores</p>
                  <div className="space-y-2">
                    {cdeResult.scoringResult.factorScores.map(
                      (factor: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {factor.factorName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {factor.bandMatched} • Value: {factor.actualValue}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-semibold">
                              {factor.pointsEarned} / {factor.maxPoints}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {factor.weightedPoints.toFixed(2)} weighted pts
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            {cdeResult.scoringResult.positiveFactors &&
              cdeResult.scoringResult.positiveFactors.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-semibold mb-2 text-green-600">
                    Positive Factors
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.scoringResult.positiveFactors.map(
                      (factor: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {factor}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            {cdeResult.scoringResult.negativeFactors &&
              cdeResult.scoringResult.negativeFactors.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-semibold mb-2 text-red-600">
                    Negative Factors
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.scoringResult.negativeFactors.map(
                      (factor: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {factor}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Affordability Result */}
      {cdeResult.affordabilityResult && (
        <Card>
          <CardHeader>
            <CardTitle>Affordability Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">DTI Ratio</p>
                <p className="text-xl font-bold">
                  {(cdeResult.affordabilityResult.dtiRatio * 100).toFixed(2)}%
                </p>
                {cdeResult.affordabilityResult.dtiCheckPassed ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 mt-1" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Discretionary Income Ratio
                </p>
                <p className="text-xl font-bold">
                  {(
                    cdeResult.affordabilityResult.discretionaryIncomeRatio * 100
                  ).toFixed(2)}
                  %
                </p>
                {cdeResult.affordabilityResult
                  .discretionaryIncomeCheckPassed ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 mt-1" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Proposed Payment
                </p>
                <p className="text-xl font-bold">
                  $
                  {cdeResult.affordabilityResult.proposedPayment?.toFixed(2) ||
                    "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Monthly Debt
                </p>
                <p className="text-xl font-bold">
                  $
                  {cdeResult.affordabilityResult.totalMonthlyDebt?.toFixed(2) ||
                    "N/A"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">
                  Gross Monthly Income
                </p>
                <p className="text-lg font-semibold">
                  $
                  {cdeResult.affordabilityResult.grossMonthlyIncome?.toFixed(
                    2
                  ) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Net Monthly Income
                </p>
                <p className="text-lg font-semibold">
                  $
                  {cdeResult.affordabilityResult.netMonthlyIncome?.toFixed(2) ||
                    "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Remaining Discretionary Income
                </p>
                <p className="text-lg font-semibold">
                  $
                  {cdeResult.affordabilityResult.remainingDiscretionaryIncome?.toFixed(
                    2
                  ) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Suggested Decision
                </p>
                <p className="text-lg font-semibold">
                  {cdeResult.affordabilityResult.suggestedDecision || "N/A"}
                </p>
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Overall Affordability:</p>
                {cdeResult.affordabilityResult.overallAffordabilityPassed ? (
                  <Badge className="bg-green-500 text-white">Passed</Badge>
                ) : (
                  <Badge className="bg-red-500 text-white">Failed</Badge>
                )}
              </div>
            </div>
            {cdeResult.affordabilityResult.warningMessages &&
              cdeResult.affordabilityResult.warningMessages.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold mb-2 text-yellow-600">
                    Warnings
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.affordabilityResult.warningMessages.map(
                      (warning: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {warning}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            {cdeResult.affordabilityResult.failureReasons &&
              cdeResult.affordabilityResult.failureReasons.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold mb-2 text-red-600">
                    Failure Reasons
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.affordabilityResult.failureReasons.map(
                      (reason: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {reason}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Pricing Result */}
      {cdeResult.pricingResult && (
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">APR</p>
                <p className="text-2xl font-bold text-red-600">
                  {cdeResult.pricingResult.calculatedAPR?.toFixed(2) || "N/A"}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Tier</p>
                <p className="text-lg font-semibold">
                  {cdeResult.pricingResult.riskTier || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Rating</p>
                <p className="text-lg font-semibold">
                  {cdeResult.pricingResult.riskRating || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Probability of Default
                </p>
                <p className="text-lg font-semibold">
                  {cdeResult.pricingResult.probabilityOfDefault?.toFixed(2) ||
                    "N/A"}
                  %
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payment</p>
                <p className="text-lg font-semibold">
                  ${cdeResult.pricingResult.monthlyPayment?.toFixed(2) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Repayment</p>
                <p className="text-lg font-semibold">
                  ${cdeResult.pricingResult.totalRepayment?.toFixed(2) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Interest</p>
                <p className="text-lg font-semibold">
                  ${cdeResult.pricingResult.totalInterest?.toFixed(2) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Term (Months)</p>
                <p className="text-lg font-semibold">
                  {cdeResult.pricingResult.termInMonths || "N/A"}
                </p>
              </div>
            </div>
            {cdeResult.pricingResult.riskDescription && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Risk Description
                </p>
                <p className="text-sm font-medium mt-1">
                  {cdeResult.pricingResult.riskDescription}
                </p>
              </div>
            )}
            {cdeResult.pricingResult.pricingAdjustments &&
              cdeResult.pricingResult.pricingAdjustments.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold mb-2">
                    Pricing Adjustments
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.pricingResult.pricingAdjustments.map(
                      (adjustment: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {adjustment}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            {cdeResult.pricingResult.warnings &&
              cdeResult.pricingResult.warnings.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold mb-2 text-yellow-600">
                    Warnings
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.pricingResult.warnings.map(
                      (warning: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {warning}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Fraud Check */}
      {cdeResult.fraudCheck && (
        <Card>
          <CardHeader>
            <CardTitle>Fraud Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Risk Level</p>
                <Badge
                  className={`mt-2 ${
                    cdeResult.fraudCheck.riskLevel === "NONE"
                      ? "bg-green-500"
                      : cdeResult.fraudCheck.riskLevel === "LOW"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  } text-white border-0`}
                >
                  {cdeResult.fraudCheck.riskLevel}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fraud Score</p>
                <p className="text-lg font-semibold">
                  {cdeResult.fraudCheck.fraudScore || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Indicator Count</p>
                <p className="text-lg font-semibold">
                  {cdeResult.fraudCheck.indicatorCount || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fraudulent</p>
                <p className="text-lg font-semibold">
                  {cdeResult.fraudCheck.fraudulent ? "Yes" : "No"}
                </p>
              </div>
            </div>
            {cdeResult.fraudCheck.recommendedAction && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Recommended Action
                </p>
                <p className="text-sm font-medium mt-1">
                  {cdeResult.fraudCheck.recommendedAction}
                </p>
              </div>
            )}
            {cdeResult.fraudCheck.indicators &&
              cdeResult.fraudCheck.indicators.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold mb-2">Fraud Indicators</p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.fraudCheck.indicators.map(
                      (indicator: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {indicator}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            {cdeResult.fraudCheck.summary && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Summary</p>
                <p className="text-sm font-medium mt-1">
                  {cdeResult.fraudCheck.summary}
                </p>
              </div>
            )}
            {cdeResult.fraudCheck.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm font-medium mt-1">
                  {cdeResult.fraudCheck.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validation Result */}
      {cdeResult.validationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Valid:</p>
              {cdeResult.validationResult.valid ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            {cdeResult.validationResult.errors &&
              cdeResult.validationResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-red-600">
                    Errors ({cdeResult.validationResult.errorCount || 0})
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.validationResult.errors.map(
                      (error: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {error}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            {cdeResult.validationResult.warnings &&
              cdeResult.validationResult.warnings.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-yellow-600">
                    Warnings ({cdeResult.validationResult.warningCount || 0})
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.validationResult.warnings.map(
                      (warning: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {warning}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            {cdeResult.validationResult.triggeredRules &&
              cdeResult.validationResult.triggeredRules.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Triggered Rules</p>
                  <ul className="list-disc list-inside space-y-1">
                    {cdeResult.validationResult.triggeredRules.map(
                      (rule: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {rule}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            {cdeResult.validationResult.executionTimeMs && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Execution Time</p>
                <p className="text-sm font-medium">
                  {cdeResult.validationResult.executionTimeMs}ms
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Decline Reasons */}
      {cdeResult.declineReasons && cdeResult.declineReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Decline Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2">
              {cdeResult.declineReasons.map((reason: string, idx: number) => (
                <li key={idx} className="text-sm text-muted-foreground">
                  {reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
