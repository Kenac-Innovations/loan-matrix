"use client";

import { useCurrency } from "@/contexts/currency-context";
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

interface AllocateCashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId?: string;
  tellerName?: string;
  cashierName?: string;
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

export function AllocateCashModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  tellerName,
  cashierName,
}: AllocateCashModalProps) {
  const router = useRouter();
  const { currencyCode: orgCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [showAddCurrencyDialog, setShowAddCurrencyDialog] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState("");
  const [selectedCashierId, setSelectedCashierId] = useState<string>("");
  const [allocationType, setAllocationType] = useState<"teller" | "cashier">(
    "teller"
  );
  const [formData, setFormData] = useState({
    amount: "",
    currency: "",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      fetchCurrencies();
      // If cashierId is provided, set allocation type to cashier
      if (cashierId) {
        setAllocationType("cashier");
        setSelectedCashierId(cashierId);
      } else {
        // When called from teller page, default to teller vault allocation
        setAllocationType("teller");
        fetchCashiers();
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
      setAllocationType("teller");
      setShowAddCurrencyDialog(false);
      setNewCurrencyCode("");
    }
  }, [open, cashierId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If allocating to cashier, require cashier selection
    if (allocationType === "cashier" && !cashierId && !selectedCashierId) {
      alert("Please select a cashier to allocate cash to");
      return;
    }

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
        onOpenChange(false);
        // Force page reload for server component
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to allocate cash");
      }
    } catch (error) {
      console.error("Error allocating cash:", error);
      alert("Failed to allocate cash");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onClick={() => onOpenChange(false)}
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
