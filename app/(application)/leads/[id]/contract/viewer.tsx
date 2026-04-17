"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

interface LeadContractViewerProps {
  leadId: string;
}

export function LeadContractViewer({ leadId }: LeadContractViewerProps) {
  const [isValidating, setIsValidating] = useState(true);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const contractUrl = useMemo(
    () => `/api/leads/${leadId}/print-contract?action=view`,
    [leadId]
  );

  useEffect(() => {
    let cancelled = false;

    const validateContract = async () => {
      try {
        setIsValidating(true);
        setValidationError(null);

        const response = await fetch(
          `/api/leads/${leadId}/print-contract?action=view&validate=true`,
          { cache: "no-store" }
        );
        const payload = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok || !payload?.success) {
          setValidationError(
            payload?.error || "Unable to open the contract for this lead."
          );
          return;
        }

        setIsIframeLoading(true);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to validate contract:", error);
        setValidationError("Unable to open the contract for this lead.");
      } finally {
        if (!cancelled) {
          setIsValidating(false);
        }
      }
    };

    validateContract();

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
      <nav className="flex items-center space-x-2 rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link href="/leads" className="transition-colors hover:text-foreground">
          Leads
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link
          href={`/leads/${leadId}`}
          className="transition-colors hover:text-foreground"
        >
          Lead Details
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium text-foreground">Contract</span>
      </nav>

      <div className="flex items-center gap-4">
        <BackButton className="shadow-sm" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <FileText className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Contract</h1>
            <p className="text-muted-foreground">
              Review, print, or download the contract for this lead.
            </p>
          </div>
        </div>
      </div>

      {validationError ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border bg-background p-8 shadow-sm">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold">Contract unavailable</h2>
            <p className="mt-2 text-muted-foreground">{validationError}</p>
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
          {(isValidating || isIframeLoading) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95">
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                <div>
                  <p className="font-medium">Loading contract...</p>
                  <p className="text-sm text-muted-foreground">
                    Preparing the latest contract data for this lead.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isValidating && (
            <iframe
              src={contractUrl}
              title={`Loan contract for lead ${leadId}`}
              className="h-full w-full border-0"
              onLoad={() => setIsIframeLoading(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
