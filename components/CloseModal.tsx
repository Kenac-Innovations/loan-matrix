"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  onSuccess: () => void;
}

interface CloseTemplateResponse {
  type: {
    id: number;
    code: string;
    value: string;
  };
  date: number[];
  manuallyReversed: boolean;
  numberOfRepayments: number;
}

export default function CloseModal({ isOpen, onClose, loanId, onSuccess }: CloseModalProps) {
  const [closedOn, setClosedOn] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  // Fetch template when modal opens
  useEffect(() => {
    if (isOpen && loanId) {
      fetchTemplate();
    }
  }, [isOpen, loanId]);

  const fetchTemplate = async () => {
    try {
      setTemplateLoading(true);
      const response = await fetch(`/api/fineract/loans/${loanId}/transactions/template?command=close`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }

      const template: CloseTemplateResponse = await response.json();
      
      // Auto-populate the closed on date from the response
      if (template.date && template.date.length === 3) {
        const [year, month, day] = template.date;
        const date = new Date(year, month - 1, day);
        setClosedOn(date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        }));
      }
    } catch (error) {
      console.error("Error fetching template:", error);
      toast({
        title: "Error",
        description: "Failed to fetch close template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!closedOn) {
      toast({
        title: "Validation Error",
        description: "Closed On date is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Convert date to the format expected by Fineract (dd MMMM yyyy)
      const date = new Date(closedOn);
      const formattedDate = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const payload = {
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        note: note || "",
        transactionDate: formattedDate
      };

      const response = await fetch(`/api/fineract/loans/${loanId}/transactions?command=close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to close loan: ${response.statusText}`);
      }

      toast({
        title: "Success",
        description: "Loan has been closed successfully.",
      });

      onSuccess();
      onClose();
      
      // Reset form
      setClosedOn("");
      setNote("");
    } catch (error) {
      console.error("Error closing loan:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to close loan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setClosedOn("");
      setNote("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close Loan</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="closedOn" className="text-sm font-medium text-muted-foreground">
              Closed On *
            </Label>
            <div className="relative">
              <Input
                id="closedOn"
                type="text"
                value={closedOn}
                onChange={(e) => setClosedOn(e.target.value)}
                placeholder="MM/DD/YYYY"
                className="pr-10"
                disabled={templateLoading}
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium text-muted-foreground">
              Note
            </Label>
            <Input
              id="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter note (optional)"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || templateLoading}
          >
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
