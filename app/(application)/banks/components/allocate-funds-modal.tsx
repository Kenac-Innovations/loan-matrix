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
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AllocateFundsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankId: string;
  bankName: string;
  bankGlAccountId?: number;
  bankGlAccountName?: string;
  bankGlAccountCode?: string;
  bankOfficeId?: number;
  onSuccess?: () => void;
}

interface Currency {
  code: string;
  name: string;
  displaySymbol?: string;
}

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
  type: { value: string };
}

interface PaymentType {
  id: number;
  name: string;
}

interface Office {
  id: number;
  name: string;
}

export function AllocateFundsModal({
  open,
  onOpenChange,
  bankId,
  bankName,
  bankGlAccountId,
  bankGlAccountName,
  bankGlAccountCode,
  bankOfficeId,
  onSuccess,
}: AllocateFundsModalProps) {
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [journalEntryResult, setJournalEntryResult] = useState<{
    success: boolean;
    message: string;
    transactionId?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    amount: "",
    currency: "ZMW",
    sourceGlAccountId: "",
    officeId: "",
    paymentTypeId: "",
    referenceNumber: "",
    transactionDate: new Date().toISOString().split("T")[0],
    accountNumber: "",
    checkNumber: "",
    routingCode: "",
    receiptNumber: "",
    bankNumber: "",
    comments: "",
  });

  useEffect(() => {
    if (open) {
      fetchAllData();
      // Set office if bank has one
      if (bankOfficeId) {
        setFormData((prev) => ({ ...prev, officeId: bankOfficeId.toString() }));
      }
    } else {
      // Reset form when modal closes
      setFormData({
        amount: "",
        currency: "ZMW",
        sourceGlAccountId: "",
        officeId: bankOfficeId?.toString() || "",
        paymentTypeId: "",
        referenceNumber: "",
        transactionDate: new Date().toISOString().split("T")[0],
        accountNumber: "",
        checkNumber: "",
        routingCode: "",
        receiptNumber: "",
        bankNumber: "",
        comments: "",
      });
      setJournalEntryResult(null);
    }
  }, [open, bankOfficeId]);

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      const [currenciesRes, glAccountsRes, paymentTypesRes, officesRes] =
        await Promise.all([
          fetch("/api/fineract/currencies"),
          fetch("/api/fineract/glaccounts/detail?usage=1&disabled=false&manualEntriesAllowed=true"),
          fetch("/api/fineract/paymenttypes"),
          fetch("/api/fineract/offices"),
        ]);

      if (currenciesRes.ok) {
        const data = await currenciesRes.json();
        const currencyList = Array.isArray(data.selectedCurrencyOptions)
          ? data.selectedCurrencyOptions
          : Array.isArray(data)
          ? data
          : data.currencies || [];
        setCurrencies(currencyList);
      }

      if (glAccountsRes.ok) {
        const data = await glAccountsRes.json();
        setGlAccounts(data || []);
      }

      if (paymentTypesRes.ok) {
        const data = await paymentTypesRes.json();
        setPaymentTypes(data || []);
      }

      if (officesRes.ok) {
        const data = await officesRes.json();
        setOffices(data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const formatDateForFineract = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setJournalEntryResult(null);

    if (!bankGlAccountId) {
      setJournalEntryResult({
        success: false,
        message: "This bank does not have a GL account configured. Please edit the bank and assign a GL account first.",
      });
      setLoading(false);
      return;
    }

    if (!formData.sourceGlAccountId) {
      setJournalEntryResult({
        success: false,
        message: "Please select a source GL account (credit side).",
      });
      setLoading(false);
      return;
    }

    if (!formData.officeId) {
      setJournalEntryResult({
        success: false,
        message: "Please select an office.",
      });
      setLoading(false);
      return;
    }

    try {
      const amount = parseFloat(formData.amount);

      // Create journal entry in Fineract
      const journalEntryPayload = {
        officeId: parseInt(formData.officeId),
        currencyCode: formData.currency,
        debits: [
          {
            glAccountId: parseInt(formData.sourceGlAccountId),
            amount: amount,
          },
        ],
        credits: [
          {
            glAccountId: bankGlAccountId,
            amount: amount,
          },
        ],
        referenceNumber: formData.referenceNumber || `BANK-ALLOC-${Date.now()}`,
        transactionDate: formatDateForFineract(formData.transactionDate),
        paymentTypeId: formData.paymentTypeId ? parseInt(formData.paymentTypeId) : undefined,
        accountNumber: formData.accountNumber || undefined,
        checkNumber: formData.checkNumber || undefined,
        routingCode: formData.routingCode || undefined,
        receiptNumber: formData.receiptNumber || undefined,
        bankNumber: formData.bankNumber || undefined,
        comments: formData.comments || `Fund allocation to ${bankName}`,
        locale: "en",
        dateFormat: "dd MMMM yyyy",
      };

      // Post journal entry to Fineract
      const journalResponse = await fetch("/api/fineract/journalentries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(journalEntryPayload),
      });

      if (!journalResponse.ok) {
        const errorData = await journalResponse.json();
        throw new Error(errorData.error || "Failed to create journal entry");
      }

      const journalResult = await journalResponse.json();

      // Also record the allocation in local database
      const allocationResponse = await fetch(`/api/banks/${bankId}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          currency: formData.currency,
          notes: `Journal Entry: ${journalResult.transactionId || "Created"} - ${formData.comments || "Fund allocation"}`,
          journalEntryId: journalResult.transactionId,
        }),
      });

      if (!allocationResponse.ok) {
        console.error("Failed to record allocation locally, but journal entry was created");
      }

      setJournalEntryResult({
        success: true,
        message: "Funds allocated successfully! Journal entry has been created.",
        transactionId: journalResult.transactionId,
      });

      // Close modal after short delay to show success
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error("Error allocating funds:", error);
      setJournalEntryResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to allocate funds",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasGlAccount = !!bankGlAccountId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Funds to Bank</DialogTitle>
          <DialogDescription>
            Add funds to <strong>{bankName}</strong> vault. This will create a journal entry in Fineract.
          </DialogDescription>
        </DialogHeader>

        {!hasGlAccount && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This bank does not have a GL account configured. Please edit the bank and assign a GL account first.
            </AlertDescription>
          </Alert>
        )}

        {hasGlAccount && (
          <div className="bg-muted p-3 rounded-md text-sm">
            <p className="font-medium">Receiving GL Account (Debit)</p>
            <p className="text-muted-foreground">
              {bankGlAccountCode} - {bankGlAccountName}
            </p>
          </div>
        )}

        {journalEntryResult && (
          <Alert variant={journalEntryResult.success ? "default" : "destructive"}>
            {journalEntryResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {journalEntryResult.message}
              {journalEntryResult.transactionId && (
                <span className="block mt-1 font-mono text-xs">
                  Transaction ID: {journalEntryResult.transactionId}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Amount and Currency */}
            <div className="grid grid-cols-2 gap-4">
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
                  disabled={!hasGlAccount}
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
                  placeholder={loadingData ? "Loading..." : "Select currency"}
                  emptyMessage="No currencies found"
                  disabled={loadingData || !hasGlAccount}
                />
              </div>
            </div>

            {/* Source GL Account */}
            <div className="space-y-2">
              <Label htmlFor="sourceGlAccountId">Source GL Account (Credit) *</Label>
              <SearchableSelect
                options={glAccounts
                  .filter((gl) => gl.id !== bankGlAccountId) // Exclude the bank's own GL
                  .map((gl) => ({
                    value: gl.id.toString(),
                    label: `${gl.glCode} - ${gl.name}`,
                  }))}
                value={formData.sourceGlAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, sourceGlAccountId: value })
                }
                placeholder={loadingData ? "Loading..." : "Select source GL account"}
                emptyMessage="No GL accounts found"
                disabled={loadingData || !hasGlAccount}
              />
              <p className="text-xs text-muted-foreground">
                The account that will be credited (source of funds)
              </p>
            </div>

            {/* Office and Payment Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="officeId">Office *</Label>
                <SearchableSelect
                  options={offices.map((o) => ({
                    value: o.id.toString(),
                    label: o.name,
                  }))}
                  value={formData.officeId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, officeId: value })
                  }
                  placeholder={loadingData ? "Loading..." : "Select office"}
                  emptyMessage="No offices found"
                  disabled={loadingData || !hasGlAccount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTypeId">Payment Type</Label>
                <SearchableSelect
                  options={paymentTypes.map((p) => ({
                    value: p.id.toString(),
                    label: p.name,
                  }))}
                  value={formData.paymentTypeId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, paymentTypeId: value })
                  }
                  placeholder={loadingData ? "Loading..." : "Select payment type"}
                  emptyMessage="No payment types found"
                  disabled={loadingData || !hasGlAccount}
                />
              </div>
            </div>

            {/* Transaction Date and Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transactionDate">Transaction Date *</Label>
                <Input
                  id="transactionDate"
                  type="date"
                  value={formData.transactionDate}
                  onChange={(e) =>
                    setFormData({ ...formData, transactionDate: e.target.value })
                  }
                  required
                  disabled={!hasGlAccount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Reference Number</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, referenceNumber: e.target.value })
                  }
                  placeholder="Auto-generated if empty"
                  disabled={!hasGlAccount}
                />
              </div>
            </div>

            <Separator />

            {/* Additional Payment Details */}
            <p className="text-sm font-medium text-muted-foreground">
              Additional Payment Details (Optional)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, accountNumber: e.target.value })
                  }
                  placeholder="Account number"
                  disabled={!hasGlAccount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  value={formData.receiptNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, receiptNumber: e.target.value })
                  }
                  placeholder="Receipt number"
                  disabled={!hasGlAccount}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkNumber">Check Number</Label>
                <Input
                  id="checkNumber"
                  value={formData.checkNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, checkNumber: e.target.value })
                  }
                  placeholder="Check number"
                  disabled={!hasGlAccount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankNumber">Bank Number</Label>
                <Input
                  id="bankNumber"
                  value={formData.bankNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, bankNumber: e.target.value })
                  }
                  placeholder="Bank number"
                  disabled={!hasGlAccount}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) =>
                  setFormData({ ...formData, comments: e.target.value })
                }
                placeholder="Additional notes..."
                rows={2}
                disabled={!hasGlAccount}
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
            <Button
              type="submit"
              disabled={loading || !hasGlAccount || journalEntryResult?.success}
            >
              {loading ? "Processing..." : "Allocate & Create Journal Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
