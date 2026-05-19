"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { submitRcfApplication } from "@/app/actions/rcf-actions";

interface RcfContractsProps {
  leadId: string | undefined;
  onComplete: () => void | Promise<void>;
  onBack: () => void;
}

export function RcfContracts({ leadId, onComplete, onBack }: RcfContractsProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const contractUrl = useMemo(
    () => (leadId ? `/api/leads/${leadId}/print-rcf-contract?action=view` : null),
    [leadId]
  );

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;

    const validate = async () => {
      setIsValidating(true);
      setValidationError(null);
      try {
        const res = await fetch(
          `/api/leads/${leadId}/print-rcf-contract?action=view&validate=true`,
          { cache: "no-store" }
        );
        const payload = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !payload?.success) {
          setValidationError(payload?.error || "Unable to generate the RCF agreement.");
          return;
        }
        setIsIframeLoading(true);
      } catch {
        if (!cancelled) setValidationError("Unable to generate the RCF agreement.");
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    };

    validate();
    return () => { cancelled = true; };
  }, [leadId]);

  if (!leadId) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">Please complete client registration first.</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Inline contract viewer */}
      <div className="relative rounded-xl border bg-background shadow-sm overflow-hidden" style={{ height: "70vh" }}>
        {(isValidating || isIframeLoading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <div>
                <p className="font-medium">Loading agreement...</p>
                <p className="text-sm text-muted-foreground">Preparing the latest facility data.</p>
              </div>
            </div>
          </div>
        )}

        {validationError && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-base font-semibold">Agreement unavailable</h2>
              <p className="mt-1 text-sm text-muted-foreground">{validationError}</p>
            </div>
          </div>
        )}

        {!isValidating && !validationError && contractUrl && (
          <iframe
            src={contractUrl}
            title="RCF Agreement"
            className="h-full w-full border-0"
            onLoad={() => setIsIframeLoading(false)}
          />
        )}
      </div>

      {submitError && (
        <p className="text-sm text-red-500">{submitError}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button
          type="button"
          disabled={submitting}
          onClick={async () => {
            if (!leadId) return;
            setSubmitting(true);
            setSubmitError(null);
            try {
              const result = await submitRcfApplication(leadId);
              if (!result.success) {
                setSubmitError(result.error || "Submission failed. Please try again.");
                return;
              }
              await onComplete();
            } catch {
              setSubmitError("Submission failed. Please try again.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? "Creating Facility..." : "Submit Application"}
        </Button>
      </div>
    </div>
  );
}
