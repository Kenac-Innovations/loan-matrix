"use client";

import { useCurrency } from "@/contexts/currency-context";
import { fineractFetch } from "@/lib/fineract-fetch";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  ArrowRightLeft,
  DollarSign,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TransferTemplate {
  currency: { code: string; name: string; decimalPlaces: number };
  transferAmount: number;
  transferDate: number[];
  fromOffice: { id: number; name: string };
  fromClient: { id: number; displayName: string };
  fromAccountType: { id: number; code: string; value: string };
  fromAccount: {
    id: number;
    accountNo: string;
    clientId: number;
    clientName: string;
    productName: string;
    amtForTransfer: number;
  };
  toAccountType: { id: number; code: string; value: string };
}

interface SavingsAccount {
  id: number;
  accountNo: string;
  productName: string;
  status: { id: number; code: string; value: string };
  accountBalance?: number;
  currency?: { code: string; displaySymbol: string };
}

interface TransferFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  clientId: number;
  overpaidAmount: number;
  currencySymbol: string;
  onSuccess: () => void;
}

export function TransferFundsModal({
  isOpen,
  onClose,
  loanId,
  clientId,
  overpaidAmount,
  currencySymbol,
  onSuccess,
}: TransferFundsModalProps) {
  const [template, setTemplate] = useState<TransferTemplate | null>(null);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    toAccountId: "",
    transferDate: "",
    transferAmount: "",
    transferDescription: "",
  });

  useEffect(() => {
    if (isOpen && loanId) {
      fetchData();
    }
  }, [isOpen, loanId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [templateRes, accountsRes] = await Promise.all([
        fetch(
          `/api/fineract/accounttransfers/template?fromAccountId=${loanId}&fromAccountType=1&toAccountType=2`
        ),
        fetch(`/api/fineract/clients/${clientId}/accounts`),
      ]);

      if (!templateRes.ok) {
        throw new Error(
          `Failed to fetch transfer template: ${templateRes.statusText}`
        );
      }

      const templateData: TransferTemplate = await templateRes.json();
      setTemplate(templateData);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const savings: SavingsAccount[] = (
          accountsData.savingsAccounts || []
        ).filter(
          (a: SavingsAccount) =>
            a.status?.code === "savingsAccountStatusType.active" ||
            a.status?.value === "Active"
        );
        setSavingsAccounts(savings);
      }

      const templateDate = Array.isArray(templateData.transferDate)
        ? new Date(
            templateData.transferDate[0],
            templateData.transferDate[1] - 1,
            templateData.transferDate[2]
          )
        : new Date();
      const formattedDate = templateDate.toISOString().split("T")[0];

      setFormData((prev) => ({
        ...prev,
        transferDate: formattedDate,
        transferAmount:
          templateData.fromAccount?.amtForTransfer?.toString() ||
          templateData.transferAmount?.toString() ||
          overpaidAmount?.toString() ||
          "",
      }));
    } catch (err) {
      console.error("Error fetching transfer data:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load transfer data"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (
        !formData.transferDate ||
        !formData.transferAmount ||
        !formData.toAccountId
      ) {
        setError(
          "Transfer Date, Amount, and Destination Account are required"
        );
        return;
      }

      const dateObj = new Date(formData.transferDate);
      const formattedDate = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const payload = {
        fromOfficeId: template?.fromOffice?.id,
        fromClientId: template?.fromClient?.id || clientId,
        fromAccountType: template?.fromAccountType?.id || 1,
        fromAccountId: loanId,
        toOfficeId: template?.fromOffice?.id,
        toClientId: template?.fromClient?.id || clientId,
        toAccountType: template?.toAccountType?.id || 2,
        toAccountId: parseInt(formData.toAccountId),
        transferDate: formattedDate,
        transferAmount: parseFloat(formData.transferAmount),
        transferDescription:
          formData.transferDescription ||
          "Credit balance transfer from loan",
        dateFormat: "dd MMMM yyyy",
        locale: "en",
      };

      await fineractFetch("/api/fineract/accounttransfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setSuccess(true);

      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        resetForm();
      }, 2000);
    } catch (err) {
      console.error("Error transferring funds:", err);
      setError(
        err instanceof Error ? err.message : "Failed to transfer funds"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      toAccountId: "",
      transferDate: "",
      transferAmount: "",
      transferDescription: "",
    });
    setError(null);
    setSuccess(false);
  };

  const { currencyCode: orgCurrency } = useCurrency();
  const normalizeCurrencyCode = (code: string | undefined | null): string => {
    if (!code) return orgCurrency;
    if (code.toUpperCase() === "ZMK") return "ZMW";
    return code;
  };

  const formatCurrency = (
    amount: number,
    currencyCode?: string
  ): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizeCurrencyCode(currencyCode),
    }).format(amount);
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Funds</DialogTitle>
            <DialogDescription>Loading transfer options...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            Transfer Funds
          </DialogTitle>
          <DialogDescription>
            Transfer overpaid balance from loan to a savings account
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Funds transferred successfully!
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-5">
          {template && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-sm">
              <p className="font-medium text-muted-foreground">From</p>
              <div className="grid grid-cols-2 gap-y-1">
                <span className="text-muted-foreground">Client:</span>
                <span>{template.fromClient?.displayName}</span>
                <span className="text-muted-foreground">Loan:</span>
                <span>
                  {template.fromAccount?.accountNo} (
                  {template.fromAccount?.productName})
                </span>
                <span className="text-muted-foreground">
                  Available:
                </span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(
                    template.fromAccount?.amtForTransfer ??
                      template.transferAmount,
                    template.currency?.code
                  )}
                </span>
              </div>
            </div>
          )}

          {savingsAccounts.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="tf-to-account">
                Destination Savings Account *
              </Label>
              <Select
                value={formData.toAccountId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, toAccountId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select savings account" />
                </SelectTrigger>
                <SelectContent>
                  {savingsAccounts.map((account) => (
                    <SelectItem
                      key={account.id}
                      value={account.id.toString()}
                    >
                      {account.accountNo} - {account.productName}
                      {account.accountBalance != null &&
                        ` (Bal: ${account.accountBalance.toLocaleString()})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This client has no active savings accounts. A savings account
                is required to transfer funds. Please create a savings account
                first or use Credit Balance Refund instead.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="tf-transfer-date"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Transfer Date *
            </Label>
            <Input
              id="tf-transfer-date"
              type="date"
              value={formData.transferDate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  transferDate: e.target.value,
                }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="tf-transfer-amount"
              className="flex items-center gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Transfer Amount *
            </Label>
            <Input
              id="tf-transfer-amount"
              type="number"
              step="0.01"
              value={formData.transferAmount}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  transferAmount: e.target.value,
                }))
              }
              className="bg-muted/50"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tf-description">Description</Label>
            <Textarea
              id="tf-description"
              value={formData.transferDescription}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  transferDescription: e.target.value,
                }))
              }
              placeholder="Credit balance transfer from loan"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !formData.transferDate ||
              !formData.transferAmount ||
              !formData.toAccountId ||
              savingsAccounts.length === 0
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Transferring...
              </>
            ) : (
              "Transfer Funds"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
