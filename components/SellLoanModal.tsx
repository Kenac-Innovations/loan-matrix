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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SellLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  onSuccess?: () => void;
}

interface SellLoanForm {
  settlementDate: string;
  purchasePriceRatio: string;
  ownerExternalId: string;
  transferExternalId: string;
}

export default function SellLoanModal({
  isOpen,
  onClose,
  loanId,
  onSuccess,
}: SellLoanModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<SellLoanForm>({
    settlementDate: format(new Date(), "yyyy-MM-dd"), // Default to today
    purchasePriceRatio: "",
    ownerExternalId: "",
    transferExternalId: "",
  });

  const handleSubmit = async () => {
    // Validation
    if (!form.settlementDate) {
      toast({
        title: "Validation Error",
        description: "Settlement date is required.",
        variant: "destructive",
      });
      return;
    }

    if (!form.purchasePriceRatio) {
      toast({
        title: "Validation Error",
        description: "Purchase price ratio is required.",
        variant: "destructive",
      });
      return;
    }

    if (!form.ownerExternalId) {
      toast({
        title: "Validation Error",
        description: "Owner external ID is required.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        settlementDate: format(new Date(form.settlementDate), "dd MMMM yyyy"),
        purchasePriceRatio: parseFloat(form.purchasePriceRatio),
        ownerExternalId: form.ownerExternalId,
        transferExternalId: form.transferExternalId || undefined,
      };

      const response = await fetch(`/api/fineract/external-asset-owners/transfers/loans/${loanId}/sale`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.defaultUserMessage || `Failed to sell loan: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Loan sold successfully.",
      });

      onSuccess?.();
      onClose();
      
      // Reset form
      setForm({
        settlementDate: format(new Date(), "yyyy-MM-dd"),
        purchasePriceRatio: "",
        ownerExternalId: "",
        transferExternalId: "",
      });
    } catch (error) {
      console.error("Error selling loan:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to sell loan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sell Loan</DialogTitle>
          <DialogDescription>
            Enter the details to sell this loan to an external asset owner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Settlement Date */}
          <div className="space-y-2">
            <Label htmlFor="settlementDate">Settlement Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !form.settlementDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.settlementDate ? format(new Date(form.settlementDate), "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={form.settlementDate ? new Date(form.settlementDate) : undefined}
                  onSelect={(date) => setForm(prev => ({ ...prev, settlementDate: date ? format(date, "yyyy-MM-dd") : "" }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Purchase Price Ratio */}
          <div className="space-y-2">
            <Label htmlFor="purchasePriceRatio">Purchase Price Ratio *</Label>
            <Input
              id="purchasePriceRatio"
              type="number"
              step="0.01"
              value={form.purchasePriceRatio}
              onChange={(e) => setForm(prev => ({ ...prev, purchasePriceRatio: e.target.value }))}
              placeholder="Enter purchase price ratio"
            />
          </div>

          {/* Owner External ID */}
          <div className="space-y-2">
            <Label htmlFor="ownerExternalId">Owner External ID *</Label>
            <Input
              id="ownerExternalId"
              type="text"
              value={form.ownerExternalId}
              onChange={(e) => setForm(prev => ({ ...prev, ownerExternalId: e.target.value }))}
              placeholder="Enter owner external ID"
            />
          </div>

          {/* Transfer External ID */}
          <div className="space-y-2">
            <Label htmlFor="transferExternalId">Transfer External ID</Label>
            <Input
              id="transferExternalId"
              type="text"
              value={form.transferExternalId}
              onChange={(e) => setForm(prev => ({ ...prev, transferExternalId: e.target.value }))}
              placeholder="Enter transfer external ID (optional)"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
