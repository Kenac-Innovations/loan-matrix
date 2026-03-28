"use client";

import { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";

interface EditCashierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashier: {
    id: string | number;
    dbId?: string | null;
    staffId: number;
    staffName: string;
    startDate: string | Date | number[];
    endDate?: string | Date | number[] | null;
  };
  onSuccess?: () => void;
}

const toDateInputValue = (
  date: string | Date | number[] | null | undefined
): string => {
  if (!date) return "";

  if (Array.isArray(date)) {
    const [year, month, day] = date;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  if (typeof date === "string") {
    const dateOnlyMatch = date.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateOnlyMatch) {
      return dateOnlyMatch[0];
    }
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return `${parsedDate.getUTCFullYear()}-${String(
    parsedDate.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(parsedDate.getUTCDate()).padStart(2, "0")}`;
};

export function EditCashierModal({
  open,
  onOpenChange,
  tellerId,
  cashier,
  onSuccess,
}: EditCashierModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
  });
  const isEndDateMissing = !formData.endDate;
  const hasDateRangeError =
    !!formData.startDate &&
    !!formData.endDate &&
    new Date(formData.startDate) > new Date(formData.endDate);

  useEffect(() => {
    if (open && cashier) {
      setFormData({
        startDate: toDateInputValue(cashier.startDate),
        endDate: toDateInputValue(cashier.endDate),
      });
    }
  }, [open, cashier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cashierId = cashier.dbId || String(cashier.id);
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: formData.startDate,
            endDate: formData.endDate || null,
          }),
        }
      );

      if (response.ok) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update cashier");
      }
    } catch (error) {
      console.error("Error updating cashier:", error);
      alert("Failed to update cashier");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Edit Cashier Dates</DialogTitle>
          <DialogDescription>
            Update the assignment dates for {cashier.staffName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className={cn(
                  hasDateRangeError &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
                required
              />
              {hasDateRangeError && (
                <p className="text-sm text-red-600">
                  Start date cannot be after end date.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className={cn(
                  isEndDateMissing &&
                    "border-red-500 focus-visible:ring-red-500",
                  hasDateRangeError &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
                min={formData.startDate}
                required
              />
              {isEndDateMissing && (
                <p className="text-sm text-red-600">End date is required.</p>
              )}
              {hasDateRangeError && (
                <p className="text-sm text-red-600">
                  End date cannot be before start date.
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              End date must be on or after the start date.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || isEndDateMissing || hasDateRangeError}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
