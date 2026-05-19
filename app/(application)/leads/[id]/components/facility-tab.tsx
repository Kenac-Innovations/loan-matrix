"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DrawdownModal } from "./drawdown-modal";
import { RepaymentModal } from "./repayment-modal";
import { useCurrency } from "@/contexts/currency-context";
import {
  TrendingDown,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Loader2,
  CreditCard,
  Clock,
  FileText,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

interface Repayment {
  id: string;
  amount: number;
  repaidAt: string;
  note: string | null;
  recordedByUserName: string | null;
}

interface Drawdown {
  id: string;
  requestedAmount: number;
  disbursedAmount: number | null;
  status: string;
  disbursedAt: string | null;
  note: string | null;
  disbursedByUserName: string | null;
  repayments: Repayment[];
}

interface Facility {
  id: string;
  creditLimit: number;
  availableBalance: number;
  utilizedAmount: number;
  tenorMonths: number | null;
  nominalInterestRate: number | null;
  maxDrawdowns: number;
  drawdownCount: number;
  canDrawdown: boolean;
  activatedAt: string;
  drawdowns: Drawdown[];
}

interface FacilityTabProps {
  leadId: string;
}

export function FacilityTab({ leadId }: FacilityTabProps) {
  const { formatAmount } = useCurrency();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDrawdown, setShowDrawdown] = useState(false);
  const [showRepayment, setShowRepayment] = useState(false);

  const fetchFacility = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/leads/${leadId}/facility`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load facility");
      }
      const data = await res.json();
      setFacility(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchFacility();
  }, [fetchFacility]);

  // Refresh when header action buttons trigger an update
  useEffect(() => {
    const handler = () => { setLoading(true); fetchFacility(); };
    window.addEventListener("rcf-facility-updated", handler);
    return () => window.removeEventListener("rcf-facility-updated", handler);
  }, [fetchFacility]);

  const handleRefresh = () => {
    setLoading(true);
    fetchFacility();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!facility) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Facility not found or not yet activated.</AlertDescription>
      </Alert>
    );
  }

  const utilizationPct =
    facility.creditLimit > 0
      ? Math.round((facility.utilizedAmount / facility.creditLimit) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Credit Limit</p>
            <p className="text-lg font-bold">{formatAmount(facility.creditLimit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-lg font-bold text-green-600">
              {formatAmount(facility.availableBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Utilized</p>
            <p className="text-lg font-bold text-orange-600">
              {formatAmount(facility.utilizedAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Utilization bar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Facility Overview
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Utilization</span>
              <span>{utilizationPct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${Math.min(utilizationPct, 100)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {facility.tenorMonths && (
              <div>
                <span className="text-muted-foreground">Tenor: </span>
                <span className="font-medium">{facility.tenorMonths} months</span>
              </div>
            )}
            {facility.nominalInterestRate && (
              <div>
                <span className="text-muted-foreground">Interest: </span>
                <span className="font-medium">{facility.nominalInterestRate}%</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Drawdowns: </span>
              <span className="font-medium">
                {facility.drawdownCount} / {facility.maxDrawdowns}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setShowDrawdown(true)}
          disabled={!facility.canDrawdown}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <TrendingDown className="h-4 w-4" />
          Drawdown
        </Button>
        <Button
          onClick={() => setShowRepayment(true)}
          disabled={facility.utilizedAmount <= 0}
          variant="outline"
          className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
        >
          <TrendingUp className="h-4 w-4" />
          Repayment
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/leads/${leadId}/rcf-contract`}>
            <FileText className="h-4 w-4" />
            View Agreement
          </Link>
        </Button>
      </div>

      {!facility.canDrawdown && (
        <p className="text-xs text-muted-foreground">
          {facility.drawdownCount >= facility.maxDrawdowns
            ? `Maximum drawdowns (${facility.maxDrawdowns}) reached.`
            : "No available balance for drawdown."}
        </p>
      )}

      {/* Drawdown History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Drawdowns</CardTitle>
          <CardDescription className="text-xs">All disbursements from this facility</CardDescription>
        </CardHeader>
        <CardContent>
          {facility.drawdowns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No drawdowns yet</p>
          ) : (
            <div className="space-y-3">
              {facility.drawdowns.map((d) => (
                <div key={d.id} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {formatAmount(d.disbursedAmount ?? d.requestedAmount)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {d.status}
                        </Badge>
                      </div>
                      {d.disbursedAt && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(d.disbursedAt).toLocaleDateString()}
                          {d.disbursedByUserName && ` · ${d.disbursedByUserName}`}
                        </p>
                      )}
                      {d.note && <p className="text-xs text-muted-foreground">{d.note}</p>}
                    </div>
                  </div>

                  {d.repayments.length > 0 && (
                    <div className="ml-3 border-l-2 border-green-200 pl-3 space-y-1.5">
                      {d.repayments.map((r) => (
                        <div key={r.id} className="flex items-start justify-between text-xs">
                          <div className="space-y-0.5">
                            <span className="font-medium text-green-600">
                              +{formatAmount(r.amount)} repaid
                            </span>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(r.repaidAt).toLocaleDateString()}
                              {r.recordedByUserName && ` · ${r.recordedByUserName}`}
                            </p>
                            {r.note && <p className="text-muted-foreground">{r.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DrawdownModal
        isOpen={showDrawdown}
        onClose={() => setShowDrawdown(false)}
        leadId={leadId}
        availableBalance={facility.availableBalance}
        onSuccess={() => {
          setShowDrawdown(false);
          handleRefresh();
        }}
      />

      <RepaymentModal
        isOpen={showRepayment}
        onClose={() => setShowRepayment(false)}
        leadId={leadId}
        utilizedAmount={facility.utilizedAmount}
        onSuccess={() => {
          setShowRepayment(false);
          handleRefresh();
        }}
      />
    </div>
  );
}
