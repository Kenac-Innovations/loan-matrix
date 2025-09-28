"use client";

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

interface LoanResponse {
  id: number;
  currency?: { code: string; name: string };
  transactions?: any[];
}

export default function TransactionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const loanId = params.loanId as string;
  const transactionId = Number(params.transactionId as string);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<any | null>(null);
  const [loanCurrency, setLoanCurrency] = useState<string>("USD");
  const [showChargeback, setShowChargeback] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [paymentTypes, setPaymentTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [paymentTypeId, setPaymentTypeId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [postingUndo, setPostingUndo] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/fineract/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`);
        if (!res.ok) throw new Error(`Failed to fetch loan: ${res.statusText}`);
        const data: LoanResponse = await res.json();
        setLoanCurrency(data.currency?.code || "USD");
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
          setPaymentTypes(data.map((p: any) => ({ id: p.id, name: p.name })));
        } else if (Array.isArray(data.pageItems)) {
          setPaymentTypes(data.pageItems.map((p: any) => ({ id: p.id, name: p.name })));
        }
      } catch {}
    };
    fetchPaymentTypes();
  }, []);

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
          <Button variant="outline" disabled>
            Edit
          </Button>
          <Button
            variant="destructive"
            disabled={!(transaction?.type?.disbursement) || transaction?.manuallyReversed}
            onClick={() => setShowUndo(true)}
          >
            Undo
          </Button>
          <Button
            variant="outline"
            disabled={!(transaction?.type?.repayment)}
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
            <DialogTitle>Undo Disbursement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Are you sure you want to undo this disbursement transaction?</p>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUndo(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={postingUndo}
              onClick={async () => {
                try {
                  setPostingUndo(true);
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
                  if (!resp.ok) throw new Error('Undo failed');
                  setShowUndo(false);
                  router.refresh();
                } catch (e) {
                  console.error(e);
                  alert('Undo failed');
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
