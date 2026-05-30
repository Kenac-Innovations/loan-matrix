"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/contexts/currency-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  getAllCreditFacilities,
  getFacilityLoansByFacilityRef,
  type CreditFacilityRow,
  type FacilityLoanRow,
} from "@/app/actions/credit-facility-actions";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE") return "default";
  if (status === "CLOSED") return "secondary";
  return "outline";
}

function availabilityTone(availablePct: number): string {
  if (availablePct >= 60) return "text-emerald-700 dark:text-emerald-300";
  if (availablePct >= 30) return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

function FacilityLoans({
  facilityRef,
  currencyCode,
}: {
  facilityRef: string;
  currencyCode: string;
}) {
  const router = useRouter();
  const [loans, setLoans] = useState<FacilityLoanRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFacilityLoansByFacilityRef(facilityRef).then((data) => {
      setLoans(data);
      setLoading(false);
    });
  }, [facilityRef]);

  if (loading) {
    return <FacilityLoansSkeleton />;
  }

  if (!loans || loans.length === 0) {
    return (
      <p className="py-3 px-4 text-sm text-muted-foreground">No loans linked to this facility.</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
          <th className="px-4 py-2 text-left font-medium">Account No</th>
          <th className="px-4 py-2 text-left font-medium">Client</th>
          <th className="px-4 py-2 text-left font-medium">Product</th>
          <th className="px-4 py-2 text-right font-medium">Principal</th>
          <th className="px-4 py-2 text-left font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {loans.map((loan) => {
          const loanHref = `/clients/${loan.client_id}/loans/${loan.loan_id}`;

          return (
            <tr
              key={loan.loan_id}
              className="border-b last:border-0 odd:bg-background even:bg-muted/10 hover:bg-muted/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              tabIndex={0}
              role="link"
              aria-label={`Open loan ${loan.account_no}`}
              onClick={() => router.push(loanHref)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(loanHref);
                }
              }}
            >
              <td className="px-4 py-3 font-mono text-xs text-sky-700 dark:text-sky-300">
                {loan.account_no}
              </td>
              <td className="px-4 py-3 font-medium">{loan.client_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{loan.product_name}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-indigo-700 dark:text-indigo-300">
                {currencyCode}{" "}
                {(loan.approved_principal ?? loan.principal_amount ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs">
                  {loan.loan_status ?? "—"}
                </Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FacilityLoansSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <div className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.7fr] gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={`facility-loan-header-${i}`} className="h-3 w-full" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, rowIndex) => (
        <div
          key={`facility-loan-row-${rowIndex}`}
          className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.7fr] gap-3 py-1"
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}

function CreditFacilitiesSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px] space-y-1 p-4">
        <div className="grid grid-cols-[40px_1.1fr_0.7fr_0.8fr_0.8fr_0.55fr_0.55fr_0.7fr] gap-3 pb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`facility-header-${i}`} className="h-3 w-full" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div
            key={`facility-row-${rowIndex}`}
            className="grid grid-cols-[40px_1.1fr_0.7fr_0.8fr_0.8fr_0.55fr_0.55fr_0.7fr] gap-3 py-2"
          >
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FacilityRow({
  facility,
  currencyCode,
  rowIndex,
}: {
  facility: CreditFacilityRow;
  currencyCode: string;
  rowIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const loansRegionId = `facility-loans-${facility.facility_ref}`;
  const facilityCurrency = facility.currency_code || currencyCode;
  const available = facility.credit_limit - facility.utilized_amount;
  const utilizedPct =
    facility.credit_limit > 0
      ? Math.round((facility.utilized_amount / facility.credit_limit) * 100)
      : 0;
  const availablePct = 100 - utilizedPct;
  const baseRowShade = rowIndex % 2 === 0 ? "bg-background" : "bg-muted/5";
  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <>
      <tr
        className={`group border-b transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${baseRowShade} ${
          expanded ? "bg-muted/15 hover:bg-muted/20" : "hover:bg-muted/15"
        }`}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        aria-controls={loansRegionId}
        onClick={toggleExpanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <td className="px-4 py-4">
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-muted/80"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </td>
        <td className="px-4 py-4 font-semibold text-foreground">{facility.client_name}</td>
        <td className="px-4 py-4 font-mono text-xs text-sky-700 dark:text-sky-300">
          {facility.facility_ref.slice(0, 8)}…
        </td>
        <td className="px-4 py-4 text-right font-medium tabular-nums text-indigo-700 dark:text-indigo-300">
          {facilityCurrency}{" "}
          {facility.credit_limit.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </td>
        <td
          className={`px-4 py-4 text-right font-semibold tabular-nums ${availabilityTone(availablePct)}`}
        >
          {facilityCurrency}{" "}
          {available.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          <span className="ml-2 text-xs text-muted-foreground">({availablePct}% free)</span>
        </td>
        <td className="px-4 py-4 text-center text-sm font-medium tabular-nums">
          {facility.disbursed_tranches} / {facility.drawdown_tranches}
        </td>
        <td className="px-4 py-4">
          <Badge variant={statusVariant(facility.status)} className="text-xs">
            {facility.status}
          </Badge>
        </td>
        <td className="px-4 py-4 text-sm text-muted-foreground">{facility.created_date}</td>
      </tr>
      {expanded && (
        <tr id={loansRegionId} className="border-b bg-muted/10">
          <td colSpan={8} className="p-0">
            <FacilityLoans facilityRef={facility.facility_ref} currencyCode={facilityCurrency} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function CreditFacilitiesPage() {
  const { currencyCode: orgCurrency } = useCurrency();
  const [facilities, setFacilities] = useState<CreditFacilityRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllCreditFacilities();
      setFacilities(data);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to load credit facilities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Credit Facilities</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All credit facilities and their linked loans.
        </p>
      </div>

      <Card>
        <CardHeader>
        <CardTitle className="text-sm font-medium">
          {loading
            ? "Loading…"
            : error
            ? "Error"
              : `${facilities?.length ?? 0} facilit${(facilities?.length ?? 0) === 1 ? "y" : "ies"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && <CreditFacilitiesSkeleton />}
          {error && (
            <div className="p-6 text-sm text-destructive">{error}</div>
          )}
          {!loading && !error && facilities && facilities.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No credit facilities found.</p>
          )}
          {!loading && !error && facilities && facilities.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-3 w-10" />
                    <th className="px-4 py-3 text-left font-medium">Client</th>
                    <th className="px-4 py-3 text-left font-medium">Ref</th>
                    <th className="px-4 py-3 text-right font-medium">Credit Limit</th>
                    <th className="px-4 py-3 text-right font-medium">Available</th>
                    <th className="px-4 py-3 text-center font-medium">Tranches</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.map((facility, rowIndex) => (
                    <FacilityRow
                      key={facility.facility_ref}
                      facility={facility}
                      currencyCode={facility.currency_code || orgCurrency}
                      rowIndex={rowIndex}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
