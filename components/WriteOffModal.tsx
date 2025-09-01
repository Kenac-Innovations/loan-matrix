"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Calendar } from "lucide-react";

interface WriteOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  onSuccess?: () => void;
}

interface WriteOffTemplate {
  loanId: number;
  type: {
    id: number;
    code: string;
    value: string;
    writeOff: boolean;
  };
  date: number[];
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displaySymbol: string;
  };
  amount: number;
  writeOffReasonOptions: Array<{
    id: number;
    name: string;
    description: string;
    active: boolean;
    mandatory: boolean;
  }>;
}

export default function WriteOffModal({ isOpen, onClose, loanId, onSuccess }: WriteOffModalProps) {
  const [template, setTemplate] = useState<WriteOffTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [writeOffDate, setWriteOffDate] = useState<string>("");
  const [note, setNote] = useState("");
  const [writeOffReason, setWriteOffReason] = useState<string>("");

  // Format today's date for the date input (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen && loanId) {
      fetchWriteOffTemplate();
    }
  }, [isOpen, loanId]);

  useEffect(() => {
    if (template) {
      // Set today's date as default
      setWriteOffDate(today);
    }
  }, [template, today]);

  const fetchWriteOffTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fineract/loans/${loanId}/transactions/template?command=writeoff`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch write-off template: ${response.statusText}`);
      }

      const data = await response.json();
      setTemplate(data);
    } catch (error) {
      console.error("Error fetching write-off template:", error);
      toast({
        title: "Error",
        description: "Failed to load write-off template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!writeOffDate || !note.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Format date for Fineract API (dd MMMM yyyy)
      const dateObj = new Date(writeOffDate);
      const formattedDate = dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const payload = {
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        note: note.trim(),
        transactionDate: formattedDate,
        ...(writeOffReason && { writeOffReasonId: parseInt(writeOffReason) })
      };

      const response = await fetch(`/api/fineract/loans/${loanId}/transactions?command=writeoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to submit write-off: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Write-off submitted successfully.",
      });

      onSuccess?.();
      onClose();
      
      // Reset form
      setNote("");
      setWriteOffReason("");
      setWriteOffDate(today);
    } catch (error) {
      console.error("Error submitting write-off:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit write-off. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Write off</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write off</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Write off on */}
          <div className="space-y-2">
            <Label htmlFor="writeOffDate" className="text-sm font-medium text-muted-foreground">
              Write off on *
            </Label>
            <div className="relative">
              <Input
                id="writeOffDate"
                type="date"
                value={writeOffDate}
                onChange={(e) => setWriteOffDate(e.target.value)}
                className="pr-10"
                required
              />
              <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Amount
            </Label>
            <div className="text-lg font-medium text-muted-foreground border-b-2 border-dotted pb-1">
              {template ? `${template.currency.displaySymbol}${template.amount.toFixed(2)}` : "Loading..."}
            </div>
          </div>

          {/* Write-off Reason (if available) */}
          {template?.writeOffReasonOptions && template.writeOffReasonOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="writeOffReason" className="text-sm font-medium text-muted-foreground">
                Write-off Reason
              </Label>
              <select
                id="writeOffReason"
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Select a reason (optional)</option>
                {template.writeOffReasonOptions.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium text-muted-foreground">
              Note
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter a note for this write-off"
              className="resize-none"
              rows={3}
              required
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !writeOffDate || !note.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
