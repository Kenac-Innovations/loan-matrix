"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { AlertTriangle } from "lucide-react";

interface RecoverFromGuarantorModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  onSuccess?: () => void;
}

export default function RecoverFromGuarantorModal({
  isOpen,
  onClose,
  loanId,
  onSuccess,
}: RecoverFromGuarantorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/fineract/loans/${loanId}/recover-guarantees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to recover from guarantor");
      }

      const data = await response.json();
      
      toast({
        title: "Success",
        description: "Successfully recovered from guarantor",
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error recovering from guarantor:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to recover from guarantor",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Recover from Guarantor
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to recover from Guarantor?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {isSubmitting ? "Processing..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
