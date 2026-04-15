"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoanProductStepper } from "../components/loan-product-stepper";
import { LoanProductFormSkeleton } from "../components/loan-product-form-skeleton";
import type { LoanProductTemplate } from "@/shared/types/loan-product";

export default function CreateLoanProductPage() {
  const [template, setTemplate] = useState<LoanProductTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/fineract/loanproducts/template");
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "Failed to load template");
        setTemplate(body);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load template");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products/loan-products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loan Products
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Create Loan Product</h1>
        <p className="mt-1 text-muted-foreground">
          Complete all steps to create a new loan product in Fineract.
        </p>
      </div>

      {isLoading && <LoanProductFormSkeleton />}

      {loadError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {template && !isLoading && <LoanProductStepper template={template} />}
    </div>
  );
}
