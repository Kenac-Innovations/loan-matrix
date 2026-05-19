"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { submitRcfApplication } from "@/app/actions/rcf-actions";

interface RcfContractsProps {
  leadId: string | undefined;
  onComplete: () => void | Promise<void>;
  onBack: () => void;
}

export function RcfContracts({ leadId, onComplete, onBack }: RcfContractsProps) {
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const handlePreview = async () => {
    if (!leadId) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const res = await fetch(
        `/api/leads/${leadId}/print-rcf-contract?action=view&validate=true`,
        { cache: "no-store" }
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setPreviewError(payload?.error || "Unable to generate the RCF agreement.");
        return;
      }
      window.open(`/api/leads/${leadId}/print-rcf-contract?action=view`, "_blank");
      setAcknowledged(true);
    } catch {
      setPreviewError("Unable to open the RCF agreement. Please try again.");
    } finally {
      setPreviewing(false);
    }
  };

  if (!leadId) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Please complete client registration first.
        </p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Revolving Credit Facility Agreement
          </CardTitle>
          <CardDescription>
            Review the facility agreement before submitting the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The agreement will be generated using the facility terms you configured.
            Open it to review, print, or download as PDF.
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={previewing}
            className="gap-2"
          >
            {previewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {previewing ? "Opening..." : "Open RCF Agreement"}
          </Button>

          {previewError && (
            <p className="text-sm text-red-500">{previewError}</p>
          )}

          {acknowledged && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Agreement opened — collect signatures and proceed.
            </div>
          )}
        </CardContent>
      </Card>

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
            setPreviewError(null);
            try {
              const result = await submitRcfApplication(leadId);
              if (!result.success) {
                setPreviewError(result.error || "Submission failed. Please try again.");
                return;
              }
              await onComplete();
            } catch {
              setPreviewError("Submission failed. Please try again.");
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
