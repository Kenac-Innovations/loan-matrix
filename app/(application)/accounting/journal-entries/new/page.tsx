'use client';
import React, { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { Plus, Minus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Option { id: number; code?: string; name?: string; displayLabel?: string; }
interface GlAccount { id: number; nameDecorated: string; }

export default function JournalEntriesPage() {
  const { data: offices = [] } = useSWR<Option[]>('/api/fineract/offices?orderBy=id', fetcher);
  const { data: currencies = { selectedCurrencyOptions: [] } } = useSWR<{ selectedCurrencyOptions: Option[] }>('/api/fineract/currencies', fetcher);
  const { data: paymentTypes = [] } = useSWR<Option[]>('/api/fineract/paymenttypes', fetcher);
  //const { data: glAccounts = [] } = useSWR<GlAccount[]>('/api/fineract/glaccounts?manualEntriesAllowed=true&usage=1&disabled=false', fetcher);
  const { data } = useSWR<{ chartAccounts: GlAccount[] }>('/api/fineract/glaccounts?manualEntriesAllowed=true&usage=1&disabled=false', fetcher );
  const glAccounts = data?.chartAccounts || [];

  const [officeId, setOfficeId] = useState<string>('');
  const [currencyCode, setCurrencyCode] = useState<string>('');
  const [paymentTypeId, setPaymentTypeId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [routingCode, setRoutingCode] = useState<string>('');
  const [bankNumber, setBankNumber] = useState<string>('');
  const [comments, setComments] = useState<string>('');

  const [debits, setDebits] = useState<Array<{ glAccountId: string; amount: string }>>([
    { glAccountId: '', amount: '' },
  ]);
  const [credits, setCredits] = useState<Array<{ glAccountId: string; amount: string }>>([
    { glAccountId: '', amount: '' },
  ]);

  const addDebit = () => setDebits([...debits, { glAccountId: '', amount: '' }]);
  const removeDebit = (idx: number) => setDebits(debits.filter((_, i) => i !== idx));
  const updateDebit = (idx: number, field: 'glAccountId' | 'amount', value: string) => {
    setDebits(debits.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addCredit = () => setCredits([...credits, { glAccountId: '', amount: '' }]);
  const removeCredit = (idx: number) => setCredits(credits.filter((_, i) => i !== idx));
  const updateCredit = (idx: number, field: 'glAccountId' | 'amount', value: string) => {
    setCredits(credits.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async () => {
    if (!officeId || !currencyCode || !transactionDate) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }

    const payload = {
      officeId: Number(officeId),
      currencyCode,
      paymentTypeId: paymentTypeId ? Number(paymentTypeId) : undefined,
      transactionDate: format(new Date(transactionDate), 'dd MMMM yyyy'),
      dateFormat: 'dd MMMM yyyy',
      locale: 'en',
      referenceNumber,
      receiptNumber,
      checkNumber,
      accountNumber,
      routingCode,
      bankNumber,
      comments,
      debits: debits.filter(d => d.glAccountId && d.amount).map(d => ({ glAccountId: Number(d.glAccountId), amount: parseFloat(d.amount) })),
      credits: credits.filter(c => c.glAccountId && c.amount).map(c => ({ glAccountId: Number(c.glAccountId), amount: parseFloat(c.amount) })),
    };

    try {
      const res = await fetch('/api/fineract/journalentries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error saving entry');
      toast({ title: `Created TX ${data.transactionId}` });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Create Journal Entry</h1>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label htmlFor="office">Office *</label>
          <Select id="office" value={officeId} onValueChange={setOfficeId}>
            <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
            <SelectContent>{offices.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="currency">Currency *</label>
          <Select id="currency" value={currencyCode} onValueChange={setCurrencyCode}>
            <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
            <SelectContent>{currencies.selectedCurrencyOptions.map(c => <SelectItem key={c.code} value={c.code}>{c.displayLabel}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="transactionDate">Transaction Date *</label>
          <div className="flex items-center">
            <Input id="transactionDate" type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
            <Calendar className="ml-2" />
          </div>
        </div>
        <div>
          <label htmlFor="paymentType">Payment Type</label>
          <Select id="paymentType" value={paymentTypeId} onValueChange={setPaymentTypeId}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{paymentTypes.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <section className="space-y-4">
        <h2 className="flex items-center justify-between">
          Affected GL Entry (Debit)
          <Button size="sm" variant="outline" onClick={addDebit}><Plus /></Button>
        </h2>
        {debits.map((d, idx) => (
          <div key={idx} className="flex gap-4 items-center">
            <Select value={d.glAccountId} onValueChange={v => updateDebit(idx, 'glAccountId', v)} className="flex-1">
              <SelectTrigger><SelectValue placeholder="Select GL account" /></SelectTrigger>
              <SelectContent>{glAccounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.nameDecorated}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Amount" value={d.amount} onChange={e => updateDebit(idx, 'amount', e.target.value)} />
            <Button size="sm" variant="destructive" onClick={() => removeDebit(idx)}><Minus /></Button>
          </div>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="flex items-center justify-between">
          Affected GL Entry (Credit)
          <Button size="sm" variant="outline" onClick={addCredit}><Plus /></Button>
        </h2>
        {credits.map((c, idx) => (
          <div key={idx} className="flex gap-4 items-center">
            <Select value={c.glAccountId} onValueChange={v => updateCredit(idx, 'glAccountId', v)} className="flex-1">
              <SelectTrigger><SelectValue placeholder="Select GL account" /></SelectTrigger>
              <SelectContent>{glAccounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.nameDecorated}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Amount" value={c.amount} onChange={e => updateCredit(idx, 'amount', e.target.value)} />
            <Button size="sm" variant="destructive" onClick={() => removeCredit(idx)}><Minus /></Button>
          </div>
        ))}
      </section>
      <div className="grid grid-cols-2 gap-6">
        <div><label htmlFor="referenceNumber">Reference Number</label><Input id="referenceNumber" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} /></div>
        <div><label htmlFor="accountNumber">Account Number</label><Input id="accountNumber" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
        <div><label htmlFor="checkNumber">Cheque Number</label><Input id="checkNumber" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} /></div>
        <div><label htmlFor="routingCode">Routing Code</label><Input id="routingCode" value={routingCode} onChange={e => setRoutingCode(e.target.value)} /></div>
        <div><label htmlFor="receiptNumber">Receipt Number</label><Input id="receiptNumber" value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} /></div>
        <div><label htmlFor="bankNumber">Bank Number</label><Input id="bankNumber" value={bankNumber} onChange={e => setBankNumber(e.target.value)} /></div>
      </div>
      <Textarea
        value={comments}
        onChange={e => setComments(e.target.value)}
        placeholder="Comments"
      />
      <div className="flex gap-4 justify-center mt-6">
        <Button variant="ghost" onClick={() => {/* reset or navigate back */ }}>Cancel</Button>
        <Button onClick={handleSubmit}>Submit</Button>
      </div>
    </div>
  );
}
