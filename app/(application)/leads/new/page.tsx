"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "@/contexts/currency-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Receipt, ArrowRight } from "lucide-react";

export default function SelectProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useCurrency();
  const queryString = searchParams?.toString();
  const loanPath = queryString
    ? `/leads/new/loan?${queryString}`
    : "/leads/new/loan";
  const rcfPath = queryString
    ? `/leads/new/rcf?${queryString}`
    : "/leads/new/rcf";

  useEffect(() => {
    if (!locale.hasRevolvingCredit) {
      router.replace(loanPath);
    }
  }, [locale.hasRevolvingCredit, loanPath, router]);

  if (!locale.hasRevolvingCredit) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Select a Product</h1>
        <p className="text-muted-foreground text-sm">
          Choose the type of credit facility for this client.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Term Loan */}
        <Card
          className="cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all group"
          onClick={() => router.push(loanPath)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="secondary">Standard</Badge>
            </div>
            <CardTitle className="text-lg mt-3">Term Loan</CardTitle>
            <CardDescription>
              Fixed amount disbursed once, repaid on a set schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Fixed principal amount
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Fixed repayment schedule
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Single disbursement
              </li>
            </ul>
            <Button
              variant="ghost"
              className="w-full justify-between group-hover:bg-primary/5 mt-2"
            >
              Select Term Loan <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* RCF */}
        <Card
          className="cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all group"
          onClick={() => router.push(rcfPath)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-emerald-600" />
              </div>
              <Badge
                variant="outline"
                className="border-emerald-200 text-emerald-700 bg-emerald-50"
              >
                Revolving
              </Badge>
            </div>
            <CardTitle className="text-lg mt-3">Revolving Credit Facility</CardTitle>
            <CardDescription>
              Reusable credit limit — draw, repay, and redraw within the facility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Flexible partial drawdowns
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Balance restores on repayment
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                Up to 10 configurable tranches
              </li>
            </ul>
            <Button
              variant="ghost"
              className="w-full justify-between group-hover:bg-emerald-500/5 mt-2"
            >
              Select RCF <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
