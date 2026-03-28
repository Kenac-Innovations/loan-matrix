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

interface EditCashierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashier: {
    id: number;
    dbId?: string;
    staffId: number;
    staffName: string;
    startDate: string | Date | number[];
    endDate?: string | Date | number[] | null;
    isFullDay?: boolean;
    startTime?: string | null;
    endTime?: string | null;
  };
}

export function EditCashierModal({
  open,
  onOpenChange,
  tellerId,
  cashier,
}: EditCashierModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    endDate: "",
    isFullDay: true,
    startTime: "",
    endTime: "",
  });

  useEffect(() => {
    if (open && cashier) {
      // Parse dates from cashier
      const parseDate = (date: string | Date | number[] | null | undefined): string => {
        if (!date) return "";
        if (Array.isArray(date)) {
          return new Date(date[0], date[1] - 1, date[2]).toISOString().split("T")[0];
        }
        if (typeof date === "string") {
          return new Date(date).toISOString().split("T")[0];
        }
        return new Date(date).toISOString().split("T")[0];
      };

      setFormData({
        endDate: parseDate(cashier.endDate),
        isFullDay: cashier.isFullDay !== undefined ? cashier.isFullDay : true,
        startTime: cashier.startTime || "",
        endTime: cashier.endTime || "",
      });
    }
  }, [open, cashier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cashierId = cashier.dbId || cashier.id.toString();
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endDate: formData.endDate || null,
            isFullDay: formData.isFullDay,
            startTime: formData.startTime || null,
            endTime: formData.endTime || null,
          }),
        }
      );

      if (response.ok) {
        onOpenChange(false);
        window.location.reload();
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

  const parseStartDate = (date: string | Date | number[] | null | undefined): string => {
    if (!date) return "";
    if (Array.isArray(date)) {
      return new Date(date[0], date[1] - 1, date[2]).toISOString().split("T")[0];
    }
    if (typeof date === "string") {
      return new Date(date).toISOString().split("T")[0];
    }
    return new Date(date).toISOString().split("T")[0];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Cashier</DialogTitle>
          <DialogDescription>
            Update cashier information. Note: Staff member and start date cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-md space-y-1">
              <p className="text-sm">
                <strong>Staff:</strong> {cashier.staffName}
              </p>
              <p className="text-sm">
                <strong>Start Date:</strong> {parseStartDate(cashier.startDate)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                min={parseStartDate(cashier.startDate)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="isFullDay" className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isFullDay"
                  checked={formData.isFullDay}
                  onChange={(e) =>
                    setFormData({ ...formData, isFullDay: e.target.checked })
                  }
                  className="rounded"
                />
                Full Day
              </Label>
            </div>

            {!formData.isFullDay && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
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
              {loading ? "Updating..." : "Update Cashier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



