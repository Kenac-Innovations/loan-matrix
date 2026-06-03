"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/searchable-select";
import { useToast } from "@/hooks/use-toast";

interface Office {
  id: number;
  name: string;
}

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
}

export interface MobileMoneyConfigValue {
  glAccountId?: number;
  glAccountName?: string;
  glAccountCode?: string;
  defaultOfficeId?: number;
  defaultOfficeName?: string;
  payoutClearingGlAccountId?: number;
  payoutClearingGlAccountName?: string;
  payoutClearingGlAccountCode?: string;
}

interface MobileMoneyConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: MobileMoneyConfigValue | null;
  onSaved: () => void;
}

export function MobileMoneyConfigModal({
  open,
  onOpenChange,
  config,
  onSaved,
}: MobileMoneyConfigModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [formData, setFormData] = useState({
    glAccountId: "",
    defaultOfficeId: "",
    payoutClearingGlAccountId: "",
  });

  useEffect(() => {
    if (!open) return;

    setFormData({
      glAccountId: config?.glAccountId?.toString() || "",
      defaultOfficeId: config?.defaultOfficeId?.toString() || "",
      payoutClearingGlAccountId:
        config?.payoutClearingGlAccountId?.toString() || "",
    });
  }, [open, config]);

  useEffect(() => {
    if (!open) return;

    async function fetchSetupData() {
      setLoadingData(true);
      try {
        const [officesRes, glAccountsRes] = await Promise.all([
          fetch("/api/fineract/offices"),
          fetch(
            "/api/fineract/glaccounts/detail?usage=1&disabled=false&manualEntriesAllowed=true"
          ),
        ]);

        if (!officesRes.ok) {
          throw new Error("Failed to fetch offices");
        }

        if (!glAccountsRes.ok) {
          throw new Error("Failed to fetch GL accounts");
        }

        const [officesData, glAccountsData] = await Promise.all([
          officesRes.json(),
          glAccountsRes.json(),
        ]);

        setOffices(Array.isArray(officesData) ? officesData : []);
        setGlAccounts(Array.isArray(glAccountsData) ? glAccountsData : []);
      } catch (fetchError) {
        console.error("Error loading mobile money config data:", fetchError);
        error({
          title: "Unable to load configuration data",
          description:
            fetchError instanceof Error
              ? fetchError.message
              : "Please try again.",
        });
      } finally {
        setLoadingData(false);
      }
    }

    fetchSetupData();
  }, [open, error]);

  const officeOptions = useMemo(
    () =>
      offices.map((office) => ({
        value: office.id.toString(),
        label: office.name,
      })),
    [offices]
  );

  const glAccountOptions = useMemo(
    () =>
      glAccounts.map((account) => ({
        value: account.id.toString(),
        label: `${account.glCode} - ${account.name}`,
      })),
    [glAccounts]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (
      !formData.glAccountId ||
      !formData.defaultOfficeId ||
      !formData.payoutClearingGlAccountId
    ) {
      error({
        title: "Missing details",
        description:
          "Please select the mobile money GL, default office, and payout clearing GL.",
      });
      return;
    }

    const glAccount = glAccounts.find(
      (account) => account.id === Number(formData.glAccountId)
    );
    const office = offices.find(
      (item) => item.id === Number(formData.defaultOfficeId)
    );
    const clearingAccount = glAccounts.find(
      (account) => account.id === Number(formData.payoutClearingGlAccountId)
    );

    if (!glAccount || !office || !clearingAccount) {
      error({
        title: "Invalid selection",
        description: "Please reselect the mobile money setup values.",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/mobile-money/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          glAccountId: glAccount.id,
          glAccountName: glAccount.name,
          glAccountCode: glAccount.glCode,
          defaultOfficeId: office.id,
          defaultOfficeName: office.name,
          payoutClearingGlAccountId: clearingAccount.id,
          payoutClearingGlAccountName: clearingAccount.name,
          payoutClearingGlAccountCode: clearingAccount.glCode,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save mobile money setup");
      }

      success({
        title: "Configuration saved",
        description: "Mobile money GL setup has been updated.",
      });
      onOpenChange(false);
      onSaved();
    } catch (saveError) {
      console.error("Error saving mobile money config:", saveError);
      error({
        title: "Unable to save configuration",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Configure Mobile Money</DialogTitle>
          <DialogDescription>
            Link the tenant-wide mobile money pool to its GL accounts and default
            office.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Mobile Money GL Account *</Label>
            <SearchableSelect
              options={glAccountOptions}
              value={formData.glAccountId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, glAccountId: value }))
              }
              placeholder={
                loadingData ? "Loading GL accounts..." : "Select mobile money GL"
              }
              emptyMessage="No GL accounts found"
              disabled={loadingData}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Office *</Label>
            <SearchableSelect
              options={officeOptions}
              value={formData.defaultOfficeId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, defaultOfficeId: value }))
              }
              placeholder={loadingData ? "Loading offices..." : "Select office"}
              emptyMessage="No offices found"
              disabled={loadingData}
            />
          </div>

          <div className="space-y-2">
            <Label>Payout Clearing GL Account *</Label>
            <SearchableSelect
              options={glAccountOptions}
              value={formData.payoutClearingGlAccountId}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  payoutClearingGlAccountId: value,
                }))
              }
              placeholder={
                loadingData
                  ? "Loading GL accounts..."
                  : "Select payout clearing GL"
              }
              emptyMessage="No GL accounts found"
              disabled={loadingData}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || loadingData}>
              {loading ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
