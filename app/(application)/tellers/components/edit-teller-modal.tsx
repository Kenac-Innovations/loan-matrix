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
import { SearchableSelect } from "@/components/searchable-select";

interface EditTellerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  teller: {
    name: string;
    description?: string;
    officeId: number;
    officeName: string;
    startDate: string | Date | number[];
    endDate?: string | Date | number[] | null;
    status: string;
  };
}

interface Office {
  id: number;
  name: string;
}

export function EditTellerModal({
  open,
  onOpenChange,
  tellerId,
  teller,
}: EditTellerModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    officeId: "",
    startDate: "",
    endDate: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    if (open) {
      fetchOffices();
      // Parse dates from teller
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
        name: teller.name || "",
        description: teller.description || "",
        officeId: teller.officeId?.toString() || "",
        startDate: parseDate(teller.startDate),
        endDate: parseDate(teller.endDate),
        status: teller.status || "ACTIVE",
      });
    }
  }, [open, teller]);

  const fetchOffices = async () => {
    setLoadingOffices(true);
    try {
      const response = await fetch("/api/fineract/offices");
      if (response.ok) {
        const data = await response.json();
        setOffices(data || []);
      }
    } catch (error) {
      console.error("Error fetching offices:", error);
    } finally {
      setLoadingOffices(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/tellers/${tellerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          endDate: formData.endDate || null,
          status: formData.status,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update teller");
      }
    } catch (error) {
      console.error("Error updating teller:", error);
      alert("Failed to update teller");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Teller</DialogTitle>
          <DialogDescription>
            Update the teller information. Note: Office and start date cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Teller Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="Main Teller"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Teller description (optional)..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  min={formData.startDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Office:</strong> {teller.officeName}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Start Date:</strong> {formData.startDate}
              </p>
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
              {loading ? "Updating..." : "Update Teller"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


