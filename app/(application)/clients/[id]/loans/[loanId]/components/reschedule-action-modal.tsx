"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { fineractFetch } from "@/lib/fineract-fetch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

type RescheduleAction = "approve" | "reject";

interface RescheduleActionModalProps {
  action: RescheduleAction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rescheduleId: number | null;
}

interface RescheduleRequestDetails {
  id: number;
  clientName?: string;
  loanAccountNumber?: string;
  rescheduleFromDate?: number[];
  rescheduleReasonCodeValue?: {
    name?: string;
  };
  statusEnum?: {
    value?: string;
  };
}

function formatDisplayDate(date?: number[]): string {
  if (!date || date.length !== 3) return "N/A";
  const [year, month, day] = date;
  return new Date(year, month - 1, day).toLocaleDateString();
}

export function RescheduleActionModal({
  action,
  isOpen,
  onClose,
  onSuccess,
  rescheduleId,
}: RescheduleActionModalProps) {
  const [details, setDetails] = useState<RescheduleRequestDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !action || !rescheduleId) {
      return;
    }

    let ignore = false;

    async function loadDetails() {
      setIsLoading(true);
      try {
        const response = await fineractFetch(
          `/api/fineract/rescheduleloans/${rescheduleId}?command=${action}`
        );
        const data = (await response.json()) as RescheduleRequestDetails;
        if (!ignore) {
          setDetails(data);
        }
      } catch (error) {
        if (!ignore) {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to load reschedule request details",
            variant: "destructive",
          });
          onClose();
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      ignore = true;
    };
  }, [action, isOpen, onClose, rescheduleId]);

  const handleClose = () => {
    setDetails(null);
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!action || !rescheduleId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const today = format(new Date(), "dd MMMM yyyy");
      const payload =
        action === "approve"
          ? {
              locale: "en",
              dateFormat: "dd MMMM yyyy",
              approvedOnDate: today,
            }
          : {
              locale: "en",
              dateFormat: "dd MMMM yyyy",
              rejectedOnDate: today,
            };

      await fineractFetch(`/api/fineract/rescheduleloans/${rescheduleId}?command=${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      toast({
        title: action === "approve" ? "Reschedule Approved" : "Reschedule Rejected",
        description:
          action === "approve"
            ? "The loan reschedule request was approved successfully."
            : "The loan reschedule request was rejected successfully.",
      });

      handleClose();
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit reschedule action",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionLabel = action === "approve" ? "Approve" : "Reject";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{actionLabel} Loan Reschedule</DialogTitle>
          <DialogDescription>
            Review the loan reschedule request and confirm the {action === "approve" ? "approval" : "rejection"} date.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading request details...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Client</span>
                <span className="text-right font-medium">{details?.clientName || "N/A"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Loan Account</span>
                <span className="text-right font-medium">{details?.loanAccountNumber || "N/A"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Reschedule From</span>
                <span className="text-right font-medium">{formatDisplayDate(details?.rescheduleFromDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Reason</span>
                <span className="text-right font-medium">{details?.rescheduleReasonCodeValue?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Current Status</span>
                <span className="text-right font-medium">{details?.statusEnum?.value || "N/A"}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant={action === "approve" ? "default" : "destructive"}
            onClick={handleSubmit}
            disabled={isLoading || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
