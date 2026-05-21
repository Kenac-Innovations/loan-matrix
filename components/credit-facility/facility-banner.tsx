"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { getFacilityForLoan } from "@/app/actions/credit-facility-actions";
import { parseFineractDateField } from "@/lib/credit-facility-utils";
import type { CreditFacilityInfo as CreditFacility } from "@/lib/credit-facility-utils";
import { addMonths, format } from "date-fns";

interface FacilityBannerProps {
  fineractLoanId: number;
  fineractClientId: number;
}

export function FacilityBanner({ fineractLoanId, fineractClientId }: FacilityBannerProps) {
  const [facility, setFacility] = useState<CreditFacility | null | undefined>(undefined);

  useEffect(() => {
    getFacilityForLoan(fineractLoanId, fineractClientId).then(setFacility);
  }, [fineractLoanId, fineractClientId]);

  if (facility === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking credit facility…
      </div>
    );
  }

  if (!facility) return null;

  const expiry = addMonths(parseFineractDateField(facility.created_date), facility.tenor_months);
  const available = facility.credit_limit - facility.utilized_amount;

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 mb-4">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-blue-700 border-blue-300">
            Credit Facility
          </Badge>
          <span className="text-sm font-medium">{facility.facility_ref.slice(0, 8)}…</span>
          <Badge
            variant={facility.status === "ACTIVE" ? "default" : "secondary"}
            className="text-xs"
          >
            {facility.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground">
          <span>
            Limit:{" "}
            <strong className="text-foreground">
              {facility.currency_code} {facility.credit_limit.toLocaleString()}
            </strong>
          </span>
          <span>
            Available:{" "}
            <strong className="text-foreground">
              {facility.currency_code} {available.toLocaleString()}
            </strong>
          </span>
          <span>
            Tranches:{" "}
            <strong className="text-foreground">
              {facility.disbursed_tranches} / {facility.drawdown_tranches}
            </strong>
          </span>
          <span>
            Expires:{" "}
            <strong className="text-foreground">{format(expiry, "MMM yyyy")}</strong>
          </span>
        </div>
        {available <= 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            Credit limit fully utilized
          </div>
        )}
      </CardContent>
    </Card>
  );
}
