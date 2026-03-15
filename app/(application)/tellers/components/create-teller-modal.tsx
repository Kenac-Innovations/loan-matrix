"use client";

import { useState } from "react";
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

interface CreateTellerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offices?: Array<{ id: number; name: string }>;
}

export function CreateTellerModal({
  open,
  onOpenChange,
  offices = [],
}: CreateTellerModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    officeId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/tellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          officeId: parseInt(formData.officeId),
          officeName: offices.find((o) => o.id === parseInt(formData.officeId))
            ?.name,
        }),
      });

      if (response.ok) {
        const teller = await response.json();
        onOpenChange(false);
        router.push(`/tellers/${teller.id}`);
        router.refresh();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create teller");
      }
    } catch (error) {
      console.error("Error creating teller:", error);
      alert("Failed to create teller");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Teller</DialogTitle>
          <DialogDescription>
            Create a new teller for cash management operations
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Teller Name *</Label>
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
                placeholder="Teller description..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="officeId">Office *</Label>
              <Select
                value={formData.officeId}
                onValueChange={(value) =>
                  setFormData({ ...formData, officeId: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id.toString()}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
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
              {loading ? "Creating..." : "Create Teller"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


