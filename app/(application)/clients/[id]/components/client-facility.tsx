"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import {
  getActiveFacility,
  getFacilityLoanLinks,
  getClientLoanIds,
} from "@/app/actions/credit-facility-actions";
import { parseFineractDateField } from "@/lib/credit-facility-utils";
import type { CreditFacilityInfo as CreditFacility, CreditFacilityLoanInfo as CreditFacilityLoan } from "@/lib/credit-facility-utils";
import { addMonths, format } from "date-fns";

interface ClientFacilityProps {
  clientId: number;
  readOnly?: boolean;
}

export function ClientFacility({
  clientId,
  readOnly = false,
}: ClientFacilityProps) {
  const [facility, setFacility] = useState<CreditFacility | null | undefined>(undefined);
  const [loanLinks, setLoanLinks] = useState<Record<number, CreditFacilityLoan | null>>({});
  const [loanIds, setLoanIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [f, ids] = await Promise.all([
        getActiveFacility(clientId),
        getClientLoanIds(clientId),
      ]);
      setFacility(f);
      setLoanIds(ids);
      if (ids.length > 0) {
        const links = await getFacilityLoanLinks(ids);
        setLoanLinks(links);
      }
      setLoading(false);
    }
    load();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading facility…
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No active credit facility for this client.
      </div>
    );
  }

  const expiry = addMonths(parseFineractDateField(facility.created_date), facility.tenor_months);
  const available = facility.credit_limit - facility.utilized_amount;
  const linkedLoanIds = loanIds.filter(
    (id) => loanLinks[id]?.facility_ref === facility.facility_ref
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Credit Facility</CardTitle>
            <Badge variant={facility.status === "ACTIVE" ? "default" : "secondary"}>
              {facility.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{facility.facility_ref}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Credit Limit</p>
              <p className="font-semibold">
                {facility.currency_code} {facility.credit_limit.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Available</p>
              <p className="font-semibold">
                {facility.currency_code} {available.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Tranches Used</p>
              <p className="font-semibold">
                {facility.disbursed_tranches} / {facility.drawdown_tranches}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Expires</p>
              <p className="font-semibold">{format(expiry, "dd MMM yyyy")}</p>
            </div>
          </div>

          {available <= 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Credit limit fully utilized
            </div>
          )}
        </CardContent>
      </Card>

      {linkedLoanIds.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Loans Under This Facility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linkedLoanIds.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                >
                  {readOnly ? (
                    <span className="font-mono">Loan #{id}</span>
                  ) : (
                    <a
                      href={`/clients/${clientId}/loans/${id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                    >
                      Loan #{id}
                    </a>
                  )}
                  <Badge variant="outline" className="text-xs">Tranche</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
