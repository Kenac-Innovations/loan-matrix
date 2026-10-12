"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect, useMemo } from "react";
import { AlertCircle } from "lucide-react";
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface AllocateCashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId?: string;
  tellerName?: string;
  cashierName?: string;
  tellerGlAccountId?: number | null;
  canOverrideSourceGl?: boolean;
  defaultSourceGlAccountId?: number | null;
  defaultSourceGlAccountName?: string | null;
  defaultSourceGlAccountCode?: string | null;
}

interface Currency {
  code: string;
  name: string;
  displaySymbol?: string;
}

interface Cashier {
  id: number;
  dbId?: string;
  staffName?: string;
  firstName?: string;
  lastName?: string;
}

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
}

const GENERIC_ALLOCATION_ERROR =
  "The cash allocation could not be completed. Please try again or contact your system administrator.";

const ALLOCATION_ERROR_MESSAGES: Record<string, string> = {
  "Tenant not found": "Your organisation could not be found. Refresh the page and try again.",
  Unauthorized: "Your session has expired. Please sign in again.",
  "Amount must be greater than 0": "Enter an amount greater than zero.",
  "Currency is required": "Select a currency before allocating cash.",
  "Teller not found": "The selected teller could not be found.",
  "Invalid cashier ID format": "The selected cashier is invalid.",
  "Teller not found or does not have a Fineract ID":
    "The selected teller is not ready for cashier allocations.",
  "A valid credit GL account is required": "Select a valid credit GL account.",
  "Select a credit GL account to fund this teller allocation":
    "Select the credit GL account that will fund this allocation.",
  "Teller has no destination GL account configured":
    "This teller does not have a destination GL account configured.",
  "The credit GL account must be different from the teller GL account":
    "Choose a credit GL account that is different from the teller GL account.",
  "The selected credit GL must be an active detail account that allows manual entries":
    "Choose an active detail GL account that allows manual entries.",
  "Unable to validate the selected credit GL account":
    "The selected credit GL account could not be validated. Please try again.",
  "Bank not found": "The teller's bank configuration could not be found.",
  "Insufficient bank balance":
    "The teller's bank GL does not have enough available balance for this allocation.",
  "Unable to verify the selected credit GL balance":
    "The selected credit GL balance could not be verified. Please try again.",
  "Insufficient balance in the selected credit GL account":
    "The selected credit GL account does not have enough available balance.",
  "Insufficient available balance in teller vault":
    "The teller vault does not have enough available balance for this allocation.",
  "Fineract did not return a journal entry ID":
    "The allocation could not be confirmed. Please try again or contact your system administrator.",
  "Fineract did not return a valid allocation ID":
    "The allocation could not be confirmed. Please try again or contact your system administrator.",
  "Failed to post the teller allocation journal entry in Fineract":
    "The allocation could not be posted. Please try again or contact your system administrator.",
  "Failed to allocate cash in Fineract":
    "The allocation could not be completed. Please try again or contact your system administrator.",
  "Cashier not found": "The selected cashier could not be found.",
  "Allocation already exists":
    "An allocation with the same amount already exists for this cashier today.",
  "Cash allocation could not be completed": GENERIC_ALLOCATION_ERROR,
  "Failed to allocate cash": GENERIC_ALLOCATION_ERROR,
};

function getAllocationErrorMessage(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return GENERIC_ALLOCATION_ERROR;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string"
    ? ALLOCATION_ERROR_MESSAGES[error] || GENERIC_ALLOCATION_ERROR
    : GENERIC_ALLOCATION_ERROR;
}

export function AllocateCashModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  tellerName,
  cashierName,
  tellerGlAccountId,
  canOverrideSourceGl = false,
  defaultSourceGlAccountId,
  defaultSourceGlAccountName,
  defaultSourceGlAccountCode,
}: AllocateCashModalProps) {
  const { currencyCode: orgCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [sourceGlAccounts, setSourceGlAccounts] = useState<GLAccount[]>([]);
  const [loadingSourceGlAccounts, setLoadingSourceGlAccounts] = useState(false);
  const [showAddCurrencyDialog, setShowAddCurrencyDialog] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState("");
  const [selectedCashierId, setSelectedCashierId] = useState<string>("");
  const [sourceGlAccountId, setSourceGlAccountId] = useState<string>("");
  const [allocationType, setAllocationType] = useState<"teller" | "cashier">(
    "teller"
  );
  const [formData, setFormData] = useState({
    amount: "",
    currency: "",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });
  const defaultSourceGlAccount = useMemo(() => {
    if (
      defaultSourceGlAccountId === null ||
      defaultSourceGlAccountId === undefined ||
      defaultSourceGlAccountId === tellerGlAccountId
    ) {
      return null;
    }

    return {
      id: defaultSourceGlAccountId,
      name: defaultSourceGlAccountName || "Configured bank GL",
      glCode: defaultSourceGlAccountCode || String(defaultSourceGlAccountId),
    };
  }, [
    defaultSourceGlAccountId,
    defaultSourceGlAccountName,
    defaultSourceGlAccountCode,
    tellerGlAccountId,
  ]);

  useEffect(() => {
    if (open) {
      fetchCurrencies();
      setSourceGlAccountId(
        canOverrideSourceGl && defaultSourceGlAccount
          ? defaultSourceGlAccount.id.toString()
          : ""
      );
      setSourceGlAccounts(
        canOverrideSourceGl && defaultSourceGlAccount
          ? [defaultSourceGlAccount]
          : []
      );
      // If cashierId is provided, set allocation type to cashier
      if (cashierId) {
        setAllocationType("cashier");
        setSelectedCashierId(cashierId);
      } else {
        // When called from teller page, default to teller vault allocation
        setAllocationType("teller");
        fetchCashiers();
        if (canOverrideSourceGl) {
          fetchSourceGlAccounts();
        }
      }
    } else {
      // Reset form when modal closes
      setFormData({
        amount: "",
        currency: "",
        notes: "",
        date: new Date().toISOString().split("T")[0],
      });
      setSelectedCashierId("");
      setSourceGlAccountId("");
      setAllocationType("teller");
      setShowAddCurrencyDialog(false);
      setNewCurrencyCode("");
    }
  }, [
    open,
    cashierId,
    defaultSourceGlAccount,
    tellerGlAccountId,
    canOverrideSourceGl,
  ]);

  const fetchCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const response = await fetch("/api/fineract/currencies");
      if (response.ok) {
        const data = await response.json();
        // Handle different response structures
        const currencyList = Array.isArray(data.selectedCurrencyOptions)
          ? data.selectedCurrencyOptions
          : Array.isArray(data)
          ? data
          : data.currencies || [];

        setCurrencies(currencyList);

        // Set default currency if available
        if (currencyList.length > 0 && !formData.currency) {
          const defaultCurrency =
            currencyList.find((c: Currency) => c.code === orgCurrency) ||
            currencyList[0];
          setFormData((prev) => ({ ...prev, currency: defaultCurrency.code }));
        }
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const fetchCashiers = async () => {
    setLoadingCashiers(true);
    try {
      const response = await fetch(`/api/tellers/${tellerId}/cashiers`);
      if (response.ok) {
        const data = await response.json();
        setCashiers(data || []);
      }
    } catch (error) {
      console.error("Error fetching cashiers:", error);
    } finally {
      setLoadingCashiers(false);
    }
  };

  const fetchSourceGlAccounts = async () => {
    setLoadingSourceGlAccounts(true);
    try {
      const response = await fetch(
        "/api/fineract/glaccounts/detail?usage=1&disabled=false&manualEntriesAllowed=true"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch GL accounts");
      }

      const data = await response.json();
      const accounts = (Array.isArray(data) ? data : []).filter(
        (account: GLAccount) => account.id !== tellerGlAccountId
      );

      setSourceGlAccounts(
        defaultSourceGlAccount &&
          !accounts.some(
            (account: GLAccount) => account.id === defaultSourceGlAccount.id
          )
          ? [defaultSourceGlAccount, ...accounts]
          : accounts
      );
    } catch (error) {
      console.error("Error fetching source GL accounts:", error);
    } finally {
      setLoadingSourceGlAccounts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If allocating to cashier, require cashier selection
    if (allocationType === "cashier" && !cashierId && !selectedCashierId) {
      setFormError("Please select a cashier to allocate cash to.");
      return;
    }

    if (
      allocationType === "teller" &&
      canOverrideSourceGl &&
      !sourceGlAccountId
    ) {
      setFormError(
        "Please select the credit GL account that will fund this teller allocation."
      );
      return;
    }

    setFormError(null);
    setLoading(true);

    try {
      let endpoint: string;
      let body: any;

      if (allocationType === "teller") {
        // Allocate to teller vault (local DB only)
        endpoint = `/api/tellers/${tellerId}/allocate`;
        body = {
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          notes: formData.notes,
          ...(canOverrideSourceGl
            ? { sourceGlAccountId: Number(sourceGlAccountId) }
            : {}),
        };
      } else {
        // Allocate to cashier (goes through Fineract)
        const targetCashierId = cashierId || selectedCashierId;
        endpoint = `/api/tellers/${tellerId}/cashiers/${targetCashierId}/allocate`;
        body = {
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          notes: formData.notes,
          date: formData.date,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        handleDialogOpenChange(false);
        // Force page reload for server component
        window.location.reload();
      } else {
        const error = await response.json().catch(() => null);
        setFormError(getAllocationErrorMessage(error));
      }
    } catch (error) {
      console.error("Error allocating cash:", error);
      setFormError(GENERIC_ALLOCATION_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {cashierId ? "Allocate Cash to Cashier" : "Allocate Cash"}
          </DialogTitle>
          <DialogDescription>
            {cashierName
              ? `Allocate cash to ${cashierName}`
              : tellerName
              ? `Allocate cash to ${tellerName} vault or to a cashier`
              : "Allocate cash to teller vault or cashier"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unable to allocate cash</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {!cashierId && (
              <div className="space-y-2">
                <Label>Allocation Type *</Label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="allocationType"
                      value="teller"
                      checked={allocationType === "teller"}
                      onChange={(e) => setAllocationType("teller")}
                      className="w-4 h-4"
                    />
                    <span>Teller Vault</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-not-allowed opacity-50">
                    <input
                      type="radio"
                      name="allocationType"
                      value="cashier"
                      checked={allocationType === "cashier"}
                      onChange={(e) => setAllocationType("cashier")}
                      className="w-4 h-4"
                      disabled
                    />
                    <span>Cashier</span>
                  </label>
                </div>
              </div>
            )}
            {allocationType === "cashier" && !cashierId && (
              <div className="space-y-2">
                <Label htmlFor="cashier">Cashier *</Label>
                <SearchableSelect
                  options={cashiers.map((c) => ({
                    value: c.dbId || c.id.toString(),
                    label:
                      c.staffName ||
                      `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
                      `Cashier ${c.id}`,
                  }))}
                  value={selectedCashierId}
                  onValueChange={(value) => setSelectedCashierId(value)}
                  placeholder={
                    loadingCashiers ? "Loading cashiers..." : "Select a cashier"
                  }
                  emptyMessage="No cashiers found"
                  disabled={loadingCashiers}
                />
              </div>
            )}
            {allocationType === "cashier" && (
              <div className="space-y-2">
                <Label htmlFor="date">Transaction Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
                placeholder="0.00"
              />
            </div>
            {allocationType === "teller" && canOverrideSourceGl && (
              <div className="space-y-2">
                <Label>Credit GL Account (Source of Cash) *</Label>
                <SearchableSelect
                  options={sourceGlAccounts.map((account) => ({
                    value: account.id.toString(),
                    label: `${account.glCode} — ${account.name}`,
                  }))}
                  value={sourceGlAccountId}
                  onValueChange={setSourceGlAccountId}
                  placeholder={
                    loadingSourceGlAccounts
                      ? "Loading GL accounts..."
                      : "Select credit GL account"
                  }
                  emptyMessage="No eligible GL accounts found"
                  disabled={loadingSourceGlAccounts}
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to the teller&apos;s bank GL. Selecting another account overrides the credit side only.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <SearchableSelect
                options={currencies.map((c) => ({
                  value: c.code,
                  label: `${c.code}${c.name ? ` - ${c.name}` : ""}`,
                }))}
                value={formData.currency}
                onValueChange={(value) =>
                  setFormData({ ...formData, currency: value })
                }
                placeholder={
                  loadingCurrencies
                    ? "Loading currencies..."
                    : "Select or add currency"
                }
                emptyMessage="No currencies found"
                disabled={loadingCurrencies}
                onAddNew={() => setShowAddCurrencyDialog(true)}
                addNewLabel="Add new currency"
              />
              {showAddCurrencyDialog && (
                <div className="mt-2 p-3 border rounded-md bg-muted/50">
                  <Label htmlFor="newCurrencyCode" className="text-xs">
                    Currency Code (e.g., USD, EUR)
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="newCurrencyCode"
                      value={newCurrencyCode}
                      onChange={(e) =>
                        setNewCurrencyCode(e.target.value.toUpperCase())
                      }
                      placeholder={orgCurrency}
                      maxLength={3}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (newCurrencyCode && newCurrencyCode.length === 3) {
                          setFormData({
                            ...formData,
                            currency: newCurrencyCode,
                          });
                          setNewCurrencyCode("");
                          setShowAddCurrencyDialog(false);
                        }
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowAddCurrencyDialog(false);
                        setNewCurrencyCode("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Allocating..." : "Allocate Cash"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
