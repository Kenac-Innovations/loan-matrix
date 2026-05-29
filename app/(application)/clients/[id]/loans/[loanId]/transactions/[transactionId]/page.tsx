"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

interface LoanResponse {
  id: number;
  currency?: { code: string; name: string };
  transactions?: any[];
}

interface PaymentTypeOption {
  id: number;
  name: string;
  isCashPayment?: boolean;
}

interface RepaymentCashLinkData {
  tellerId: string | null;
  cashierId: string | null;
  teller?: {
    id: string;
    name: string;
    fineractTellerId?: number | null;
    officeName?: string | null;
  } | null;
  cashier?: {
    id: string;
    staffName: string;
    fineractCashierId?: number | null;
  } | null;
  reversedAt?: string | null;
}

export default function TransactionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const loanId = params.loanId as string;
  const transactionId = Number(params.transactionId as string);

  const { currencyCode: orgCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<any | null>(null);
  const [loanCurrency, setLoanCurrency] = useState<string>("");
  const [showChargeback, setShowChargeback] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [paymentTypeId, setPaymentTypeId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [postingUndo, setPostingUndo] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [repaymentLink, setRepaymentLink] = useState<RepaymentCashLinkData | null>(null);
  const [loadingRepaymentLink, setLoadingRepaymentLink] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/fineract/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`);
        if (!res.ok) throw new Error(`Failed to fetch loan: ${res.statusText}`);
        const data: LoanResponse = await res.json();
        setLoanCurrency(data.currency?.code || orgCurrency);
        const tx = (data.transactions || []).find((t: any) => Number(t.id) === transactionId);
        setTransaction(tx || null);
        if (!tx) setError("Transaction not found");
      } catch (e: any) {
        setError(e.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [loanId, transactionId]);

  useEffect(() => {
    const fetchPaymentTypes = async () => {
      try {
        const res = await fetch('/api/fineract/paymenttypes');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setPaymentTypes(
            data.map((p: any) => ({
              id: p.id,
              name: p.name,
              isCashPayment: p.isCashPayment,
            }))
          );
        } else if (Array.isArray(data.pageItems)) {
          setPaymentTypes(
            data.pageItems.map((p: any) => ({
              id: p.id,
              name: p.name,
              isCashPayment: p.isCashPayment,
            }))
          );
        }
      } catch {}
    };
    fetchPaymentTypes();
  }, []);

  const isRepaymentTransaction = !!(
    transaction?.type?.repayment || transaction?.type?.recoveryRepayment
  );
  const isDisbursementTransaction = !!transaction?.type?.disbursement;
  const transactionPaymentTypeId = transaction?.paymentDetailData?.paymentType?.id;
  const transactionPaymentType = paymentTypes.find(
    (pt) => pt.id === transactionPaymentTypeId
  );
  const isCashRepaymentUndo =
    isRepaymentTransaction && !!transactionPaymentType?.isCashPayment;

  useEffect(() => {
    if (showUndo && isCashRepaymentUndo) {
      const fetchRepaymentLink = async () => {
        try {
          setLoadingRepaymentLink(true);
          const response = await fetch(
            `/api/loans/${loanId}/repayment-link/${transactionId}`
          );
          if (!response.ok) {
            setRepaymentLink(null);
            return;
          }
          const data = await response.json();
          setRepaymentLink(data);
        } catch (e) {
          console.error("Error fetching repayment link:", e);
          setRepaymentLink(null);
        } finally {
          setLoadingRepaymentLink(false);
        }
      };

      fetchRepaymentLink();
    } else {
      setRepaymentLink(null);
      setLoadingRepaymentLink(false);
    }
  }, [showUndo, isCashRepaymentUndo, loanId, transactionId]);

  const formatDate = (arr?: number[]) => {
    if (!arr || arr.length !== 3) return "";
    const [y, m, d] = arr;
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
  };

  const formatMoney = (amount?: number) => {
    if (amount == null) return "";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: loanCurrency }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-red-600">{error}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {/*
          <Button variant="outline" disabled>
            Edit
          </Button>
          */}
          <Button
            variant="destructive"
            disabled={!(isDisbursementTransaction || isRepaymentTransaction) || transaction?.manuallyReversed}
            onClick={() => {
              setUndoError(null);
              setShowUndo(true);
            }}
          >
            Undo
          </Button>
          <Button
            variant="outline"
            disabled={!(transaction?.type?.repayment) || transaction?.manuallyReversed}
            onClick={() => {
              setPaymentTypeId("");
              setAmount((transaction?.amount ?? 0).toFixed(2));
              setShowChargeback(true);
            }}
          >
            Chargeback
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Transaction Id</div>
              <div className="font-medium">{transaction?.id}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Type</div>
              <div className="font-medium">{transaction?.type?.value}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Transaction Date</div>
              <div className="font-medium">{formatDate(transaction?.date)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Currency</div>
              <div className="font-medium">{loanCurrency}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="font-medium">{formatMoney(transaction?.amount)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Payment Type</div>
              <div className="font-medium">{transaction?.paymentDetailData?.paymentType?.name || ""}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chargeback Modal */}
      <Dialog open={showChargeback} onOpenChange={setShowChargeback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chargeback Repayment Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Type *</Label>
              <Select value={paymentTypeId} onValueChange={setPaymentTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.map((pt) => (
                    <SelectItem key={pt.id} value={String(pt.id)}>{pt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChargeback(false)}>Cancel</Button>
            <Button
              disabled={!paymentTypeId || !amount || posting}
              onClick={async () => {
                try {
                  setPosting(true);
                  const body = {
                    locale: 'en',
                    paymentTypeId: Number(paymentTypeId),
                    transactionAmount: Number(amount),
                  };
                  const resp = await fetch(`/api/fineract/loans/${loanId}/transactions/${transactionId}?command=chargeback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  if (!resp.ok) throw new Error('Chargeback failed');
                  setShowChargeback(false);
                  router.refresh();
                } catch (e) {
                  console.error(e);
                  alert('Chargeback failed');
                } finally {
                  setPosting(false);
                }
              }}
            >
              {posting ? 'Processing...' : 'Chargeback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Undo Disbursement Modal */}
      <Dialog open={showUndo} onOpenChange={setShowUndo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isRepaymentTransaction ? "Undo Repayment" : "Undo Disbursement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              {isRepaymentTransaction
                ? "Are you sure you want to undo this repayment transaction?"
                : "Are you sure you want to undo this disbursement transaction?"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-muted-foreground">Transaction Date</div>
                <div className="font-medium">{formatDate(transaction?.date)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Amount</div>
                <div className="font-medium">{formatMoney(transaction?.amount)}</div>
              </div>
            </div>
            {undoError ? <div className="text-red-600">{undoError}</div> : null}
            {isCashRepaymentUndo ? (
              <div className="space-y-3 border rounded-md p-3">
                <div className="text-sm text-muted-foreground">
                  This repayment used a cash payment type. Loan Matrix will use the teller and cashier linked to the original repayment to reduce the cashier float after the undo succeeds.
                </div>
                {loadingRepaymentLink ? (
                  <div className="text-sm text-muted-foreground">
                    Loading linked teller and cashier...
                  </div>
                ) : repaymentLink?.tellerId && repaymentLink?.cashierId ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Teller</div>
                      <div className="font-medium">
                        {repaymentLink.teller?.name || repaymentLink.tellerId}
                        {repaymentLink.teller?.officeName
                          ? ` - ${repaymentLink.teller.officeName}`
                          : ""}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Cashier</div>
                      <div className="font-medium">
                        {repaymentLink.cashier?.staffName || repaymentLink.cashierId}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-600">
                    No linked teller/cashier was found for this repayment, so Loan Matrix cannot safely reduce the cashier float for the undo.
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUndo(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={postingUndo}
              onClick={async () => {
                try {
                  setPostingUndo(true);
                  setUndoError(null);
                  if (isCashRepaymentUndo) {
                    if (!repaymentLink?.tellerId || !repaymentLink?.cashierId) {
                      setUndoError(
                        "No linked teller/cashier was found for this repayment."
                      );
                      return;
                    }
                  }
                  const df = "dd MMMM yyyy";
                  const dArr = transaction?.date as number[] | undefined;
                  const formatUndoDate = (a?: number[]) => {
                    if (!a || a.length !== 3) return "";
                    const [y, m, d] = a;
                    const month = new Date(y, m - 1, d).toLocaleString('en-US', { month: 'long' });
                    return `${d} ${month} ${y}`;
                  };
                  const body = {
                    dateFormat: df,
                    locale: 'en',
                    transactionAmount: 0,
                    transactionDate: formatUndoDate(dArr),
                  };
                  const resp = await fetch(`/api/fineract/loans/${loanId}/transactions/${transactionId}?command=undo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || 'Undo failed');
                  }

                  if (isCashRepaymentUndo) {
                    const settleResp = await fetch(
                      `/api/tellers/${repaymentLink!.tellerId}/cashiers/${repaymentLink!.cashierId}/settle`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          amount: Number(transaction?.amount || 0),
                          currency: loanCurrency,
                          notes: `Repayment reversal - Loan #${loanId} / Txn #${transactionId}`,
                          date: new Date().toISOString().split("T")[0],
                          transactionType: "EXPENSE",
                        }),
                      }
                    );
                    if (!settleResp.ok) {
                      const err = await settleResp.json().catch(() => ({}));
                      throw new Error(
                        err.details ||
                          err.error ||
                          "Repayment was undone, but cashier float reduction failed"
                      );
                    }
                    await fetch(`/api/loans/${loanId}/repayment-link/${transactionId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        reversalNotes: `Repayment reversal - Loan #${loanId} / Txn #${transactionId}`,
                      }),
                    }).catch((err) => {
                      console.error("Failed to mark repayment link reversed:", err);
                    });
                  }
                  toast({
                    title: "Undo successful",
                    description: isCashRepaymentUndo
                      ? "Transaction was undone and the cashier float was reduced."
                      : "Transaction was undone successfully.",
                  });
                  setShowUndo(false);
                  window.location.reload();
                } catch (e) {
                  console.error(e);
                  const message = e instanceof Error ? e.message : "Undo failed";
                  setUndoError(message);
                  toast({
                    title: "Undo failed",
                    description: message,
                    variant: "destructive",
                  });
                  window.location.reload();
                } finally {
                  setPostingUndo(false);
                }
              }}
            >
              {postingUndo ? 'Processing...' : 'Confirm Undo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
