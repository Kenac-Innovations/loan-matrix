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
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/searchable-select";

interface EditBankModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: {
    id: string;
    name: string;
    code: string;
    description?: string;
    officeId?: number;
    officeName?: string;
    status: string;
  };
  onSuccess?: () => void;
}

interface Office {
  id: number;
  name: string;
}

export function EditBankModal({
  open,
  onOpenChange,
  bank,
  onSuccess,
}: EditBankModalProps) {
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    officeId: "",
    status: "",
  });

  useEffect(() => {
    if (open && bank) {
      setFormData({
        name: bank.name,
        code: bank.code,
        description: bank.description || "",
        officeId: bank.officeId?.toString() || "",
        status: bank.status,
      });
      fetchOffices();
    }
  }, [open, bank]);

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
      const response = await fetch(`/api/banks/${bank.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          description: formData.description,
          officeId: formData.officeId ? parseInt(formData.officeId) : null,
          officeName: formData.officeId
            ? offices.find((o) => o.id === parseInt(formData.officeId))?.name
            : null,
          status: formData.status,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update bank");
      }
    } catch (error) {
      console.error("Error updating bank:", error);
      alert("Failed to update bank");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Bank</DialogTitle>
          <DialogDescription>
            Update the bank information below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Bank Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Bank Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  required
                  maxLength={20}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="officeId">Office/Branch</Label>
              <SearchableSelect
                options={offices.map((office) => ({
                  value: office.id.toString(),
                  label: office.name,
                }))}
                value={formData.officeId}
                onValueChange={(value) =>
                  setFormData({ ...formData, officeId: value })
                }
                placeholder={
                  loadingOffices ? "Loading offices..." : "Select office"
                }
                emptyMessage="No offices found"
                disabled={loadingOffices}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <SearchableSelect
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "CLOSED", label: "Closed" },
                ]}
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
                placeholder="Select status"
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
                placeholder="Bank description..."
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

