"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, UserCheck, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";

interface ProspectContinuationDialogProps {
  isOpen: boolean;
  onContinue: () => void;
  onCancel: (reason: string) => void;
  onClose: () => void;
  prospectData?: {
    leadId: string;
    firstname?: string;
    lastname?: string;
    emailAddress?: string;
    mobileNo?: string;
    timestamp: number;
  };
}

export function ProspectContinuationDialog({
  isOpen,
  onContinue,
  onCancel,
  onClose,
  prospectData,
}: Readonly<ProspectContinuationDialogProps>) {
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = () => {
    onContinue();
    resetDialog();
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCancel(cancelReason);
      resetDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const resetDialog = () => {
    setShowCancelForm(false);
    setCancelReason("");
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg w-full max-w-[90vw]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <UserCheck className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <span className="break-words">
              Continue with Existing Prospect?
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm break-words">
            We found an existing prospect that you were working on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          {prospectData && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 overflow-hidden">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 overflow-hidden">
                <div className="space-y-2 text-sm">
                  <div className="break-words overflow-wrap-anywhere">
                    <strong className="font-medium">Prospect:</strong>{" "}
                    <span className="break-all">
                      {prospectData.firstname || prospectData.lastname
                        ? `${prospectData.firstname ?? ""} ${
                            prospectData.lastname ?? ""
                          }`.trim()
                        : "Unnamed prospect"}
                    </span>
                  </div>
                  {prospectData.emailAddress && (
                    <div className="break-words overflow-wrap-anywhere">
                      <strong className="font-medium">Email:</strong>{" "}
                      <span className="break-all font-mono text-xs">
                        {prospectData.emailAddress}
                      </span>
                    </div>
                  )}
                  {prospectData.mobileNo && (
                    <div className="break-words overflow-wrap-anywhere">
                      <strong className="font-medium">Phone:</strong>{" "}
                      <span className="break-all font-mono">
                        {prospectData.mobileNo}
                      </span>
                    </div>
                  )}
                  <div className="break-words">
                    <strong className="font-medium">Last modified:</strong>{" "}
                    {formatTimestamp(prospectData.timestamp)}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!showCancelForm ? (
            <div className="text-sm text-gray-600 dark:text-gray-400 break-words">
              Would you like to continue working on this prospect or start a new
              one?
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cancelReason" className="text-sm font-medium">
                  Reason for canceling this prospect{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="cancelReason"
                  placeholder="Please provide a reason for canceling this prospect..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="min-h-[100px] resize-none text-sm"
                  rows={4}
                />
                <p className="text-xs text-gray-500 break-words">
                  This reason will be saved for record-keeping purposes.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
          {!showCancelForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowCancelForm(true)}
                className="w-full sm:w-auto text-sm min-w-0"
              >
                <X className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Start New Prospect</span>
              </Button>
              <Button
                onClick={handleContinue}
                className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-sm min-w-0"
              >
                <UserCheck className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Continue with This Prospect</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowCancelForm(false)}
                disabled={isSubmitting}
                className="w-full sm:w-auto text-sm min-w-0"
              >
                <span className="truncate">Back</span>
              </Button>
              <Button
                onClick={handleCancel}
                disabled={!cancelReason.trim() || isSubmitting}
                className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-sm min-w-0"
              >
                <span className="truncate">
                  {isSubmitting
                    ? "Canceling..."
                    : "Cancel Prospect & Start New"}
                </span>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
