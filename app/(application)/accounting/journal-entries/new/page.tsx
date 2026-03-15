'use client';
import React, { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { 
  Plus, 
  Minus, 
  Calendar, 
  Building2, 
  DollarSign, 
  CreditCard,
  FileText,
  Hash,
  Receipt,
  CheckSquare,
  Banknote,
  ArrowLeft,
  Save,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calculator,
  BookOpen,
  Settings,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Option { id: number; code?: string; name?: string; displayLabel?: string; }
interface GlAccount { id: number; nameDecorated: string; }

export default function JournalEntriesPage() {
  const router = useRouter();
  const { data: offices = [] } = useSWR<Option[]>('/api/fineract/offices?orderBy=id', fetcher);
  const { data: currencies = { selectedCurrencyOptions: [] } } = useSWR<{ selectedCurrencyOptions: Option[] }>('/api/fineract/currencies', fetcher);
  const { data: paymentTypes = [] } = useSWR<Option[]>('/api/fineract/paymenttypes', fetcher);
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
  const [submitting, setSubmitting] = useState<boolean>(false);

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

  // Calculate totals
  const totalDebits = debits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const totalCredits = credits.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const handleSubmit = async () => {
    if (!officeId || !currencyCode || !transactionDate) {
      toast({ 
        title: 'Missing Required Fields', 
        description: 'Please fill in all required fields marked with *',
        variant: 'destructive' 
      });
      return;
    }

    if (!isBalanced) {
      toast({ 
        title: 'Unbalanced Entry', 
        description: 'Total debits must equal total credits',
        variant: 'destructive' 
      });
      return;
    }

    setSubmitting(true);

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
      
      const responseData = await res.json();
      
      if (!res.ok) {
        const errorMessage = responseData.defaultUserMessage || responseData.developerMessage || 'Failed to create journal entry';
        toast({ 
          title: 'Cannot Create Entry', 
          description: errorMessage,
          variant: 'destructive' 
        });
        setSubmitting(false);
        return;
      }

      toast({
        title: 'Journal Entry Created',
        description: `Transaction ${responseData.transactionId} has been successfully created`,
        variant: 'success'
      });

      // Navigate to the journal entry view page
      setTimeout(() => {
        router.push(`/accounting/journal-entries/${responseData.transactionId}`);
      }, 2000);
      
    } catch (err: any) {
      console.error('Error creating journal entry:', err);
      toast({ 
        title: 'Network Error', 
        description: 'Unable to connect to the server. Please try again.',
        variant: 'destructive' 
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Journal Entry</h1>
          <p className="text-muted-foreground mt-1">
            Record financial transactions and post to general ledger
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Entries
        </Button>
      </div>

      <div className="space-y-6">
        {/* Basic Information Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Entry Information</CardTitle>
                <CardDescription>
                  Basic details for your journal entry
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Office */}
              <div className="space-y-2">
                <Label htmlFor="office" className="text-sm font-medium">
                  Office <span className="text-red-500">*</span>
                </Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select office" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    {offices.map(o => (
                      <SelectItem key={o.id} value={String(o.id)} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="text-foreground">{o.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-sm font-medium">
                  Currency <span className="text-red-500">*</span>
                </Label>
                <Select value={currencyCode} onValueChange={setCurrencyCode}>
                  <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    {currencies.selectedCurrencyOptions.map(c => (
                      <SelectItem key={c.code} value={c.code} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="text-foreground">{c.displayLabel}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction Date */}
              <div className="space-y-2">
                <Label htmlFor="transactionDate" className="text-sm font-medium">
                  Transaction Date <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input 
                    id="transactionDate" 
                    type="date" 
                    value={transactionDate} 
                    onChange={e => setTransactionDate(e.target.value)}
                    className="h-11 pl-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                  />
                </div>
              </div>

              {/* Payment Type */}
              <div className="space-y-2">
                <Label htmlFor="paymentType" className="text-sm font-medium">
                  Payment Type
                </Label>
                <Select value={paymentTypeId} onValueChange={setPaymentTypeId}>
                  <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    {paymentTypes.map(p => (
                      <SelectItem key={p.id} value={String(p.id)} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-gray-400" />
                          <span className="text-foreground">{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debits Section */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Debit Entries</CardTitle>
                  <CardDescription>
                    Accounts to be debited in this transaction
                  </CardDescription>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={addDebit}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Debit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {debits.map((d, idx) => (
              <div key={idx} className="flex gap-4 items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <Select 
                  value={d.glAccountId} 
                  onValueChange={v => updateDebit(idx, 'glAccountId', v)}
                  className="flex-1"
                >
                  <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select GL account" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    {glAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-gray-400" />
                          <span className="text-foreground">{a.nameDecorated}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input 
                    type="number" 
                    placeholder="Amount" 
                    value={d.amount} 
                    onChange={e => updateDebit(idx, 'amount', e.target.value)}
                    className="h-11 pl-10 w-32 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                  />
                </div>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => removeDebit(idx)}
                  className="h-11 w-11 p-0"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Credits Section */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Credit Entries</CardTitle>
                  <CardDescription>
                    Accounts to be credited in this transaction
                  </CardDescription>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={addCredit}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Credit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {credits.map((c, idx) => (
              <div key={idx} className="flex gap-4 items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <Select 
                  value={c.glAccountId} 
                  onValueChange={v => updateCredit(idx, 'glAccountId', v)}
                  className="flex-1"
                >
                  <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select GL account" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    {glAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-gray-400" />
                          <span className="text-foreground">{a.nameDecorated}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input 
                    type="number" 
                    placeholder="Amount" 
                    value={c.amount} 
                    onChange={e => updateCredit(idx, 'amount', e.target.value)}
                    className="h-11 pl-10 w-32 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                  />
                </div>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => removeCredit(idx)}
                  className="h-11 w-11 p-0"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Balance Summary */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Entry Balance</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Total debits vs total credits</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Debits</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">${totalDebits.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Credits</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">${totalCredits.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Difference</div>
                  <div className={`text-lg font-bold ${isBalanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    ${Math.abs(totalDebits - totalCredits).toFixed(2)}
                  </div>
                </div>
                <Badge variant={isBalanced ? "default" : "destructive"} className="text-sm">
                  {isBalanced ? 'Balanced' : 'Unbalanced'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reference Information */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Reference Information</CardTitle>
                <CardDescription>
                  Additional reference details for the transaction
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="referenceNumber" className="text-sm font-medium">
                  Reference Number
                </Label>
                <Input 
                  id="referenceNumber" 
                  value={referenceNumber} 
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="Enter reference number"
                  className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiptNumber" className="text-sm font-medium">
                  Receipt Number
                </Label>
                <div className="relative">
                  <Receipt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input 
                    id="receiptNumber" 
                    value={receiptNumber} 
                    onChange={e => setReceiptNumber(e.target.value)}
                    placeholder="Enter receipt number"
                    className="h-11 pl-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkNumber" className="text-sm font-medium">
                  Check Number
                </Label>
                <div className="relative">
                  <CheckSquare className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input 
                    id="checkNumber" 
                    value={checkNumber} 
                    onChange={e => setCheckNumber(e.target.value)}
                    placeholder="Enter check number"
                    className="h-11 pl-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber" className="text-sm font-medium">
                  Account Number
                </Label>
                <Input 
                  id="accountNumber" 
                  value={accountNumber} 
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routingCode" className="text-sm font-medium">
                  Routing Code
                </Label>
                <Input 
                  id="routingCode" 
                  value={routingCode} 
                  onChange={e => setRoutingCode(e.target.value)}
                  placeholder="Enter routing code"
                  className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankNumber" className="text-sm font-medium">
                  Bank Number
                </Label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input 
                    id="bankNumber" 
                    value={bankNumber} 
                    onChange={e => setBankNumber(e.target.value)}
                    placeholder="Enter bank number"
                    className="h-11 pl-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="comments" className="text-sm font-medium">
                Comments
              </Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={e => setComments(e.target.value)}
                placeholder="Enter any additional comments or notes..."
                rows={3}
                className="resize-none bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Ready to create your journal entry
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex items-center gap-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !isBalanced}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Entry...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Create Entry
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
