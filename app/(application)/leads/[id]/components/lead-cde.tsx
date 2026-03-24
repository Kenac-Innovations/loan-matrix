"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface LeadCDEProps {
  leadId: string;
}

export function LeadCDE({ leadId }: LeadCDEProps) {
  const [cdeResult, setCdeResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [callingCDE, setCallingCDE] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCDEData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/leads/${leadId}/complete-details`);

      if (!response.ok) {
        throw new Error("Failed to fetch CDE data");
      }

      const data = await response.json();
      setCdeResult(data.cdeResult || null);
    } catch (err) {
      console.error("Error fetching CDE data:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchCDEData();
  }, [fetchCDEData]);

  const handleCallCDE = async () => {
    try {
      setCallingCDE(true);
      toast({
        title: "Evaluating loan...",
        description: "Running Credit Decision Engine evaluation",
      });

      const response = await fetch(`/api/leads/${leadId}/call-cde`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to call CDE");
      }

      const result = await response.json();
      console.log("CDE evaluation completed:", result.cdeResult?.decision);

      toast({
        title: "CDE evaluation completed",
        description: `Decision: ${result.cdeResult?.decision || "N/A"}`,
      });

      // Refresh CDE data
      await fetchCDEData();
    } catch (err) {
      console.error("Error calling CDE:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to call CDE",
        variant: "destructive",
      });
    } finally {
      setCallingCDE(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading CDE data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500 mb-2">Error loading CDE data</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!cdeResult) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              CDE evaluation not yet performed
            </p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              The Credit Decision Engine evaluation will appear here once the
              loan is created or affordability data is saved.
            </p>
            <Button
              onClick={handleCallCDE}
              disabled={callingCDE}
              className="mt-4"
            >
              {callingCDE ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run CDE Evaluation
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Decision */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>CDE Decision</CardTitle>
              <CardDescription>
                Credit Decision Engine Evaluation Result
              </CardDescription>
            </div>
            <Button
              onClick={handleCallCDE}
              disabled={callingCDE}
              variant="outline"
              size="sm"
            >
              {callingCDE ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-evaluate
                </>
              )}
            </Button>
          </div>
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
        </CardContent>
      </Card>

      {/* Scoring Result */}
      {cdeResult.scoringResult && (
        <Card>
          <CardHeader>
            <CardTitle>Credit Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
            {cdeResult.scoringResult.factorScores &&
              cdeResult.scoringResult.factorScores.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold mb-2">Factor Scores</p>
                  <div className="space-y-2">
                    {cdeResult.scoringResult.factorScores.map(
                      (factor: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {factor.factorName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {factor.bandMatched} • {factor.actualValue}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {factor.pointsEarned} / {factor.maxPoints}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {factor.weightedPoints.toFixed(2)} pts
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fraud Check */}
      {cdeResult.fraudCheck && (
        <Card>
          <CardHeader>
            <CardTitle>Fraud Check</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
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
            </div>
            {cdeResult.fraudCheck.recommendedAction && (
              <p className="text-sm mt-4">
                {cdeResult.fraudCheck.recommendedAction}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
