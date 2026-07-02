"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";

export default function LeadPreparingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const leadId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const applicationId = searchParams.get("applicationId");
  const startedRef = useRef(false);
  const [progress, setProgress] = useState(12);
  const [statusMessage, setStatusMessage] = useState("Preparing lead details...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) return current;
        if (current < 40) return current + 8;
        if (current < 70) return current + 5;
        return current + 2;
      });
    }, 180);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!leadId || !applicationId) {
      setError("Missing lead or application reference.");
      setStatusMessage("We could not prepare this lead.");
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setStatusMessage("Submitting loan to Fineract...");
        const response = await fetch(
          `/api/ussd-leads/${applicationId}/submit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId }),
          }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data?.errorData?.defaultUserMessage ||
              data?.error ||
              "Failed to prepare lead"
          );
        }

        setProgress(100);
        setStatusMessage("Lead ready. Opening details...");

        void fetch(`/api/ussd-leads/${applicationId}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUBMITTED" }),
        }).catch((statusError) => {
          console.warn("Failed to update USSD application status:", statusError);
        });

        window.setTimeout(() => {
          if (!cancelled) {
            router.replace(`/leads/${leadId}`);
          }
        }, 450);
      } catch (submissionError) {
        if (cancelled) return;
        const message =
          submissionError instanceof Error
            ? submissionError.message
            : "Failed to prepare lead";
        setError(message);
        setStatusMessage("We hit a snag while preparing the lead.");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [applicationId, leadId, router]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-10">
      <Card className="w-full border-dashed shadow-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">Preparing lead details</CardTitle>
          <CardDescription>
            We are creating the Fineract loan and getting the lead ready for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{statusMessage}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Working on loan creation
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Lead ID: {leadId || "Unknown"}</p>
              <p>USSD Application ID: {applicationId || "Unknown"}</p>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">Could not continue</p>
              <p className="mt-1">{error}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => window.location.reload()}>Try again</Button>
                <Button variant="outline" onClick={() => router.replace(`/leads/${leadId}`)}>
                  Open lead anyway
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
              Redirecting automatically once everything is ready.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
