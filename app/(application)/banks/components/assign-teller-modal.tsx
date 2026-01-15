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
import { SearchableSelect } from "@/components/searchable-select";
import { Label } from "@/components/ui/label";

interface AssignTellerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankId: string;
  bankName: string;
  onSuccess?: () => void;
}

interface Teller {
  id: string;
  name: string;
  fineractTellerId?: number;
  officeName: string;
  bankId?: string;
}

export function AssignTellerModal({
  open,
  onOpenChange,
  bankId,
  bankName,
  onSuccess,
}: AssignTellerModalProps) {
  const [loading, setLoading] = useState(false);
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [loadingTellers, setLoadingTellers] = useState(false);
  const [selectedTellerId, setSelectedTellerId] = useState("");

  useEffect(() => {
    if (open) {
      fetchUnassignedTellers();
    } else {
      setSelectedTellerId("");
    }
  }, [open]);

  const fetchUnassignedTellers = async () => {
    setLoadingTellers(true);
    try {
      // Fetch all tellers
      const response = await fetch("/api/tellers");
      if (response.ok) {
        const data = await response.json();
        // Filter to only show tellers not assigned to any bank
        // or use a dedicated endpoint
        setTellers(data.filter((t: any) => !t.bankId));
      }
    } catch (error) {
      console.error("Error fetching tellers:", error);
    } finally {
      setLoadingTellers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTellerId) {
      alert("Please select a teller");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/banks/${bankId}/tellers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tellerId: selectedTellerId }),
      });

      if (response.ok) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to assign teller");
      }
    } catch (error) {
      console.error("Error assigning teller:", error);
      alert("Failed to assign teller");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Assign Teller to Bank</DialogTitle>
          <DialogDescription>
            Assign an existing teller to <strong>{bankName}</strong>. Only
            tellers not currently assigned to a bank are shown.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="teller">Select Teller *</Label>
              <SearchableSelect
                options={tellers.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.officeName})`,
                }))}
                value={selectedTellerId}
                onValueChange={setSelectedTellerId}
                placeholder={
                  loadingTellers
                    ? "Loading tellers..."
                    : "Search and select a teller"
                }
                emptyMessage="No unassigned tellers found"
                disabled={loadingTellers}
              />
              {tellers.length === 0 && !loadingTellers && (
                <p className="text-sm text-muted-foreground">
                  All tellers are already assigned to banks. Create a new teller
                  first.
                </p>
              )}
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
            <Button
              type="submit"
              disabled={loading || !selectedTellerId || tellers.length === 0}
            >
              {loading ? "Assigning..." : "Assign Teller"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

