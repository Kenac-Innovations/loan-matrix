"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Calendar, DollarSign } from "lucide-react";

interface WaiveInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
}

interface WaiveInterestTemplate {
  loanId: number;
  type: {
    id: number;
    code: string;
    value: string;
    waiveInterest: boolean;
  };
  date: number[];
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displaySymbol: string;
  };
  amount: number;
  netDisbursalAmount: number;
  numberOfRepayments: number;
}

export function WaiveInterestModal({ isOpen, onClose, loanId }: WaiveInterestModalProps) {
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState<WaiveInterestTemplate | null>(null);
  const [formData, setFormData] = useState({
    transactionDate: "",
    transactionAmount: "",
    note: "",
  });

  // Fetch template when modal opens
  useEffect(() => {
    if (isOpen && loanId) {
      fetchTemplate();
    }
  }, [isOpen, loanId]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fineract/loans/${loanId}/transactions/template?command=waiveinterest`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }

      const data = await response.json();
      setTemplate(data);

      // Pre-populate form with template data
      if (data.date && data.date.length === 3) {
        const [year, month, day] = data.date;
        const date = new Date(year, month - 1, day);
        setFormData(prev => ({
          ...prev,
          transactionDate: date.toISOString().split('T')[0],
          transactionAmount: data.amount?.toString() || "",
        }));
      }
    } catch (error) {
      console.error("Error fetching template:", error);
      toast({
        title: "Error",
        description: "Failed to fetch waive interest template",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!template) return;

    try {
      setLoading(true);

      // Validate date is not in the future
      const selectedDate = new Date(formData.transactionDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      if (selectedDate > today) {
        toast({
          title: "Invalid Date",
          description: "Transaction date cannot be in the future",
          variant: "destructive",
        });
        return;
      }

      // Format date for Fineract API
      const formattedDate = selectedDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const payload = {
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        transactionDate: formattedDate,
        transactionAmount: parseFloat(formData.transactionAmount),
        note: formData.note,
        // Add any additional fields that might be required
        // These are common fields for loan transactions
        externalId: `WI_${loanId}_${Date.now()}`,
      };

      const response = await fetch(`/api/fineract/loans/${loanId}/transactions?command=waiveinterest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData = {};
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          // Try to parse the response as JSON
          const responseText = await response.text();
          
          if (responseText.trim()) {
            errorData = JSON.parse(responseText);
            
            // Extract the actual error message from the nested structure
            if (errorData.details && errorData.details.defaultUserMessage) {
              errorMessage = errorData.details.defaultUserMessage;
            } else if (errorData.details && errorData.details.developerMessage) {
              errorMessage = errorData.details.developerMessage;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          }
        } catch (e) {
          // Silent error handling - fallback to default error message
        }
        
        // Handle specific business rule errors
        if (errorMessage.includes("client's transfer date to this office")) {
          errorMessage = "The selected date is earlier than when this client was transferred to this office. Please select a later date.";
        }
        
        // Handle 403 Forbidden errors with more specific messages
        if (response.status === 403) {
          if (errorMessage.includes("Forbidden")) {
            errorMessage = "Access denied. You may not have permission to perform this action, or the loan status doesn't allow it.";
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Interest waived successfully",
        variant: "default",
      });

      onClose();
      
      // Optionally refresh the page or update loan data
      window.location.reload();
    } catch (error) {
      console.error("Error waiving interest:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to waive interest",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (!template) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Waive Interest</DialogTitle>
                  <DialogDescription>
          Waive interest on loan #{loanId}. This will create a transaction to reduce the interest amount.
        </DialogDescription>
        {template && (
          <div className="text-xs text-muted-foreground">
            Loan Status: {template.loanStatus || 'Unknown'} | 
            Amount Available: {template.currency?.displaySymbol}{template.amount}
          </div>
        )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Interest waived on */}
            <div className="space-y-2">
              <Label htmlFor="transactionDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Interest waived on *
              </Label>
              <Input
                id="transactionDate"
                type="date"
                value={formData.transactionDate}
                onChange={(e) => handleInputChange("transactionDate", e.target.value)}
                required
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Date must be on or after the client's transfer date to this office
              </p>
            </div>

            {/* Transaction Amount */}
            <div className="space-y-2">
              <Label htmlFor="transactionAmount" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Transaction Amount *
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="transactionAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.transactionAmount}
                    onChange={(e) => handleInputChange("transactionAmount", e.target.value)}
                    required
                    className="w-full pr-16"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                    {template.currency.code}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Amount: {template.currency.displaySymbol}{template.amount}
              </p>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Optional note about this interest waiver..."
                value={formData.note}
                onChange={(e) => handleInputChange("note", e.target.value)}
                rows={3}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
