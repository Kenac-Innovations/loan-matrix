"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format-currency";

interface SettleCashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
  openingBalance?: number;
  currency?: string;
}

export function SettleCashModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
  openingBalance = 0,
  currency = "USD",
}: SettleCashModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    closingBalance: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setFormData({ closingBalance: "", notes: "" });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            closingBalance: parseFloat(formData.closingBalance),
            notes: formData.notes,
          }),
        }
      );

      if (response.ok) {
        onOpenChange(false);
        router.refresh();
        setFormData({ closingBalance: "", notes: "" });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to settle cash");
      }
    } catch (error) {
      console.error("Error settling cash:", error);
      alert("Failed to settle cash");
    } finally {
      setLoading(false);
    }
  };

  const closingBalance = parseFloat(formData.closingBalance) || 0;
  const difference = closingBalance - openingBalance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settle Cash for Cashier</DialogTitle>
          <DialogDescription>
            {cashierName && `Settle cash for ${cashierName}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Opening Balance:</span>
                <span className="font-medium">
                  {formatCurrency(openingBalance, currency)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingBalance">Closing Balance *</Label>
              <Input
                id="closingBalance"
                type="number"
                step="0.01"
                value={formData.closingBalance}
                onChange={(e) =>
                  setFormData({ ...formData, closingBalance: e.target.value })
                }
                required
                placeholder="0.00"
              />
            </div>
            {formData.closingBalance && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Difference:</span>
                  <span
                    className={`font-medium ${
                      difference >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {difference >= 0 ? "+" : ""}
                    {formatCurrency(difference, currency)}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Settlement notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Settling..." : "Settle Cash"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

