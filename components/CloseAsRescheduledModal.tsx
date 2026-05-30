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

interface CloseAsRescheduledModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  onSuccess?: () => void;
}

interface CloseAsRescheduledTemplate {
  type: {
    id: number;
    code: string;
    value: string;
  };
  date: number[];
  manuallyReversed: boolean;
  numberOfRepayments: number;
}

export default function CloseAsRescheduledModal({ 
  isOpen, 
  onClose, 
  loanId, 
  onSuccess 
}: CloseAsRescheduledModalProps) {
  const [template, setTemplate] = useState<CloseAsRescheduledTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closedOnDate, setClosedOnDate] = useState<string>("");
  const [note, setNote] = useState("");

  // Format today's date for the date input (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen && loanId) {
      fetchCloseAsRescheduledTemplate();
    }
  }, [isOpen, loanId]);

  useEffect(() => {
    if (template) {
      // Set today's date as default
      setClosedOnDate(today);
    }
  }, [template, today]);

  const fetchCloseAsRescheduledTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fineract/loans/${loanId}/transactions/template?command=close-rescheduled`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch close as rescheduled template: ${response.statusText}`);
      }

      const data = await response.json();
      setTemplate(data);
    } catch (error) {
      console.error("Error fetching close as rescheduled template:", error);
      toast({
        title: "Error",
        description: "Failed to load close as rescheduled template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!closedOnDate || !note.trim()) {
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
      const dateObj = new Date(closedOnDate);
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
      };

      const response = await fetch(`/api/fineract/loans/${loanId}/transactions?command=close-rescheduled`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to submit close as rescheduled: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Loan closed as rescheduled successfully.",
      });

      onSuccess?.();
      onClose();
      
      // Reset form
      setNote("");
      setClosedOnDate(today);
    } catch (error) {
      console.error("Error submitting close as rescheduled:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit close as rescheduled. Please try again.",
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
            <DialogTitle>Close (as Rescheduled)</DialogTitle>
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
          <DialogTitle>Close (as Rescheduled)</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Closed On */}
          <div className="space-y-2">
            <Label htmlFor="closedOnDate" className="text-sm font-medium text-muted-foreground">
              Closed On *
            </Label>
            <div className="relative">
              <Input
                id="closedOnDate"
                type="date"
                value={closedOnDate}
                onChange={(e) => setClosedOnDate(e.target.value)}
                className="pr-10"
                required
              />
              <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium text-muted-foreground">
              Note
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter a note for closing this loan as rescheduled"
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
            disabled={submitting || !closedOnDate || !note.trim()}
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
