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

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
  type: { value: string };
}

export default function NewBankPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(true);
  const [loadingGlAccounts, setLoadingGlAccounts] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    officeId: "",
    glAccountId: "",
  });

  useEffect(() => {
    fetchOffices();
    fetchGlAccounts();
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

  const fetchGlAccounts = async () => {
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

  // Generate code from name
  const generateCode = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 20);
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      code: formData.code || generateCode(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Get selected GL account details
    const selectedGlAccount = formData.glAccountId
      ? glAccounts.find((gl) => gl.id === parseInt(formData.glAccountId))
      : null;

    try {
      const response = await fetch("/api/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          officeId: formData.officeId ? parseInt(formData.officeId) : null,
          officeName: formData.officeId
            ? offices.find((o) => o.id === parseInt(formData.officeId))?.name
            : null,
          glAccountId: selectedGlAccount?.id || null,
          glAccountName: selectedGlAccount?.name || null,
          glAccountCode: selectedGlAccount?.glCode || null,
        }),
      });

      if (response.ok) {
        const bank = await response.json();
        router.push(`/banks/${bank.id}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create bank");
      }
    } catch (error) {
      console.error("Error creating bank:", error);
      alert("Failed to create bank");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/banks">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create New Bank</h1>
            <p className="text-muted-foreground mt-1">
              Set up a new bank (vault) for fund management and distribution to
              tellers
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Bank Information</CardTitle>
          <CardDescription>
            Enter the details for the new bank. Banks are the top level of the
            cash management hierarchy. All fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Bank Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="Main Vault"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">
                  Bank Code <span className="text-red-500">*</span>
                </Label>
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
                  placeholder="MAIN-VAULT"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for this bank (auto-generated from name)
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
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
                    loadingOffices
                      ? "Loading offices..."
                      : "Search and select office"
                  }
                  emptyMessage="No offices found"
                  disabled={loadingOffices}
                />
                <p className="text-xs text-muted-foreground">
                  Optionally link this bank to a specific office/branch
                </p>
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
                    loadingGlAccounts
                      ? "Loading GL accounts..."
                      : "Search and select GL account"
                  }
                  emptyMessage="No GL accounts found"
                  disabled={loadingGlAccounts}
                />
                <p className="text-xs text-muted-foreground">
                  Link this bank to a GL account for journal entries
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Bank description (optional)..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link href="/banks">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Bank"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
