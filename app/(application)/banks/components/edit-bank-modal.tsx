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
    glAccountId?: number;
    glAccountName?: string;
    glAccountCode?: string;
    status: string;
  };
  onSuccess?: () => void;
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

export function EditBankModal({
  open,
  onOpenChange,
  bank,
  onSuccess,
}: EditBankModalProps) {
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [loadingGlAccounts, setLoadingGlAccounts] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    officeId: "",
    glAccountId: "",
    status: "",
  });

  useEffect(() => {
    if (open && bank) {
      setFormData({
        name: bank.name,
        code: bank.code,
        description: bank.description || "",
        officeId: bank.officeId?.toString() || "",
        glAccountId: bank.glAccountId?.toString() || "",
        status: bank.status,
      });
      fetchOffices();
      fetchGlAccounts();
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

  const fetchGlAccounts = async () => {
    setLoadingGlAccounts(true);
    try {
      // Fetch all detail accounts (usage=1) that are not disabled and allow manual entries
      const response = await fetch("/api/fineract/glaccounts/detail?usage=1&disabled=false&manualEntriesAllowed=true");
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

    // Get selected GL account details
    const selectedGlAccount = formData.glAccountId
      ? glAccounts.find((gl) => gl.id === parseInt(formData.glAccountId))
      : null;

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
          glAccountId: selectedGlAccount?.id || null,
          glAccountName: selectedGlAccount?.name || null,
          glAccountCode: selectedGlAccount?.glCode || null,
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
              <Label htmlFor="glAccountId">GL Account</Label>
              <SearchableSelect
                options={glAccounts.map((gl) => ({
                  value: gl.id.toString(),
                  label: `${gl.glCode} - ${gl.name}`,
                }))}
                value={formData.glAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, glAccountId: value })
                }
                placeholder={
                  loadingGlAccounts ? "Loading GL accounts..." : "Select GL account"
                }
                emptyMessage="No GL accounts found"
                disabled={loadingGlAccounts}
              />
              <p className="text-xs text-muted-foreground">
                Link this bank to a GL account for journal entries
              </p>
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

