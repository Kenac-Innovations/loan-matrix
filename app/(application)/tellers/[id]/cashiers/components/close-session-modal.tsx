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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface CloseSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
  expectedBalance?: number;
  openingFloat?: number;
  cashIn?: number;
  cashOut?: number;
}

export function CloseSessionModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
  expectedBalance = 0,
  openingFloat = 0,
  cashIn = 0,
  cashOut = 0,
}: CloseSessionModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    countedCashAmount: "",
    comments: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Pre-fill with expected balance
      setFormData({
        countedCashAmount: expectedBalance.toFixed(2),
        comments: "",
      });
    }
  }, [open, expectedBalance]);

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (
      !formData.countedCashAmount ||
      parseFloat(formData.countedCashAmount) < 0
    ) {
      setError("Please enter a valid counted cash amount");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close",
            countedCashAmount: parseFloat(formData.countedCashAmount),
            comments: formData.comments,
          }),
        }
      );

      if (response.ok) {
        onOpenChange(false);
        router.refresh();
        setFormData({ countedCashAmount: "", comments: "" });
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error ||
          errorData.details ||
          `Failed to close session (${response.status})`;
        setError(errorMessage);
        console.error("Error closing session:", errorData);
      }
    } catch (error) {
      console.error("Error closing session:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to close session. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const difference =
    parseFloat(formData.countedCashAmount || "0") - expectedBalance;
  const isBalanced = Math.abs(difference) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Close Cashier Session</DialogTitle>
          <DialogDescription>
            {cashierName && `Close session for ${cashierName}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleClose}>
          <div className="space-y-4 py-4">
            {/* Session Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Opening Float
                </Label>
                <p className="text-lg font-semibold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(openingFloat)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cash In</Label>
                <p className="text-lg font-semibold text-green-600">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(cashIn)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Cash Out
                </Label>
                <p className="text-lg font-semibold text-red-600">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(cashOut)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Expected Balance
                </Label>
                <p className="text-lg font-semibold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(expectedBalance)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="countedCashAmount">
                Counted Cash Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="countedCashAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.countedCashAmount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    countedCashAmount: e.target.value,
                  })
                }
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Enter the actual cash amount counted physically
              </p>
            </div>

            {formData.countedCashAmount && (
              <Alert
                variant={
                  isBalanced
                    ? "default"
                    : difference > 0
                    ? "default"
                    : "destructive"
                }
              >
                <AlertDescription>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {isBalanced
                        ? "Balanced"
                        : difference > 0
                        ? "Over"
                        : "Short"}
                    </span>
                    <span className="text-lg font-bold">
                      {difference > 0 ? "+" : ""}
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(difference)}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="comments">Comments / Notes</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) =>
                  setFormData({ ...formData, comments: e.target.value })
                }
                placeholder="Add any notes about the session closure..."
                rows={3}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                "Close Session"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
