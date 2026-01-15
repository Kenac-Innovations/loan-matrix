"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/searchable-select";
import Link from "next/link";

interface Office {
  id: number;
  name: string;
}

interface Bank {
  id: string;
  name: string;
  code: string;
}

export default function NewTellerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(true);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    officeId: "",
    bankId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });

  useEffect(() => {
    fetchOffices();
    fetchBanks();
  }, []);

  const fetchOffices = async () => {
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

  const fetchBanks = async () => {
    try {
      const response = await fetch("/api/banks?status=ACTIVE");
      if (response.ok) {
        const data = await response.json();
        setBanks(data || []);
      }
    } catch (error) {
      console.error("Error fetching banks:", error);
    } finally {
      setLoadingBanks(false);
    }
  };

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
          bankId: formData.bankId || null,
        }),
      });

      if (response.ok) {
        const teller = await response.json();
        router.push(`/tellers/${teller.id}`);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tellers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create New Teller</h1>
            <p className="text-muted-foreground mt-1">
              Set up a new teller (branch) for cash management operations
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Teller Information</CardTitle>
          <CardDescription>
            Enter the details for the new teller. All fields marked with * are
            required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
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
                <Label htmlFor="officeId">
                  Branch (Office) <span className="text-red-500">*</span>
                </Label>
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
                    loadingOffices
                      ? "Loading branches..."
                      : "Search and select branch"
                  }
                  emptyMessage="No branches found"
                  disabled={loadingOffices}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankId">
                Parent Bank (Optional)
              </Label>
              <SearchableSelect
                options={banks.map((bank) => ({
                  value: bank.id,
                  label: `${bank.name} (${bank.code})`,
                }))}
                value={formData.bankId}
                onValueChange={(value) =>
                  setFormData({ ...formData, bankId: value })
                }
                placeholder={
                  loadingBanks
                    ? "Loading banks..."
                    : "Select parent bank (optional)"
                }
                emptyMessage="No banks found. Create a bank first."
                disabled={loadingBanks}
              />
              <p className="text-xs text-muted-foreground">
                Link this teller to a bank to manage fund allocation hierarchy.
                Teller allocations will be limited by the bank's available balance.
              </p>
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

            <div className="grid gap-6 md:grid-cols-2">
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
                  min={formData.startDate}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link href="/tellers">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading || loadingOffices}>
                {loading ? "Creating..." : "Create Teller"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
