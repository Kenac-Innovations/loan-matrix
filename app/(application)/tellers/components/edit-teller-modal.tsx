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
    glAccountId?: number | null;
    glAccountName?: string | null;
    glAccountCode?: string | null;
  };
}

interface Office {
  id: number;
  name: string;
}

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
  type: { value: string };
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
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [loadingGlAccounts, setLoadingGlAccounts] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    officeId: "",
    startDate: "",
    endDate: "",
    status: "ACTIVE",
    glAccountId: "",
  });

  useEffect(() => {
    if (open) {
      fetchOffices();
      fetchGlAccounts();
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
        glAccountId: teller.glAccountId?.toString() || "",
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

  const fetchGlAccounts = async () => {
    setLoadingGlAccounts(true);
    try {
      const response = await fetch(
        "/api/fineract/glaccounts/detail?usage=1&disabled=false&manualEntriesAllowed=true"
      );
      if (response.ok) {
        const data = await response.json();
        setGlAccounts(data || []);
      }
    } catch (error) {
      console.error("Error fetching GL accounts:", error);
    } finally {
      setLoadingGlAccounts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const selectedGlAccount = formData.glAccountId
      ? glAccounts.find((gl) => gl.id === parseInt(formData.glAccountId))
      : null;

    try {
      const response = await fetch(`/api/tellers/${tellerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          endDate: formData.endDate || null,
          status: formData.status,
          glAccountId: selectedGlAccount?.id ?? null,
          glAccountName: selectedGlAccount?.name ?? null,
          glAccountCode: selectedGlAccount?.glCode ?? null,
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

            <div className="space-y-2">
              <Label htmlFor="glAccountId">Branch Cash GL Account</Label>
              <SearchableSelect
                options={[
                  { value: "", label: "None" },
                  ...glAccounts.map((gl) => ({
                    value: gl.id.toString(),
                    label: `${gl.glCode} - ${gl.name}`,
                  })),
                ]}
                value={formData.glAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, glAccountId: value })
                }
                placeholder={
                  loadingGlAccounts
                    ? "Loading GL accounts..."
                    : "Select GL account"
                }
                emptyMessage="No GL accounts found"
                disabled={loadingGlAccounts}
              />
              <p className="text-xs text-muted-foreground">
                When set, the teller&apos;s vault balance is read from this Fineract
                GL account and allocations create journal entries.
              </p>
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



