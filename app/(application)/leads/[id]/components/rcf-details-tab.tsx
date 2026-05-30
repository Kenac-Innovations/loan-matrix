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
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrency } from "@/contexts/currency-context";
import {
  AlertCircle,
  Loader2,
  CreditCard,
  Clock,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

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

interface RcfDetailsTabProps {
  leadId: string;
}

export function RcfDetailsTab({ leadId }: RcfDetailsTabProps) {
  const { formatAmount } = useCurrency();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFacility = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/leads/${leadId}/facility`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load facility");
      }
      setFacility(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchFacility(); }, [fetchFacility]);

  useEffect(() => {
    const handler = () => { setLoading(true); fetchFacility(); };
    window.addEventListener("rcf-facility-updated", handler);
    return () => window.removeEventListener("rcf-facility-updated", handler);
  }, [fetchFacility]);

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
        <AlertDescription>Facility not yet activated.</AlertDescription>
      </Alert>
    );
  }

  const utilizationPct =
    facility.creditLimit > 0
      ? Math.round((facility.utilizedAmount / facility.creditLimit) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
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

      {/* Facility overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Facility Overview
          </CardTitle>
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
                <span className="font-medium">{facility.nominalInterestRate}% p.a.</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Drawdowns: </span>
              <span className="font-medium">
                {facility.drawdownCount} / {facility.maxDrawdowns}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Activated: </span>
              <span className="font-medium">
                {new Date(facility.activatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drawdown history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-blue-600" />
            Drawdowns
          </CardTitle>
          <CardDescription className="text-xs">All disbursements from this facility</CardDescription>
        </CardHeader>
        <CardContent>
          {facility.drawdowns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No drawdowns yet</p>
          ) : (
            <div className="space-y-3">
              {facility.drawdowns.map((d, idx) => (
                <div key={d.id} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {formatAmount(d.disbursedAmount ?? d.requestedAmount)}
                        </span>
                        <Badge variant="secondary" className="text-xs">{d.status}</Badge>
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
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-green-600" />
                              <span className="font-medium text-green-600">
                                +{formatAmount(r.amount)} repaid
                              </span>
                            </div>
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

                  {idx < facility.drawdowns.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
