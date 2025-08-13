'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Building2,
  DollarSign,
  CreditCard,
  Calendar as CalendarIcon,
  FileText,
  Hash,
  Receipt,
  MessageSquare,
  Banknote,
  Route,
  Hash as HashIcon,
  Plus,
  Minus,
  ArrowLeft,
  Save
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Office {
  id: number;
  name: string;
  nameDecorated: string;
  externalId?: string;
  openingDate: number[];
  hierarchy: string;
  parentId?: number;
  parentName?: string;
}

interface Currency {
  code: string;
  name: string;
  decimalPlaces: number;
  nameCode: string;
  displayLabel: string;
  displaySymbol?: string;
}

interface PaymentType {
  id: number;
  name: string;
  description: string;
  isCashPayment: boolean;
  position: number;
  isSystemDefined: boolean;
  codeName?: string;
}

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
}

interface AccountingRule {
  id: number;
  officeId: number;
  officeName: string;
  name: string;
  description: string;
  systemDefined: boolean;
  allowMultipleDebitEntries: boolean;
  allowMultipleCreditEntries: boolean;
  allowedOffices: any[];
  allowedAccounts: any[];
  creditAccounts: GLAccount[];
  debitAccounts: GLAccount[];
}

interface GLEntry {
  glAccountId: number;
  amount: number;
}

export default function FrequentPostingsPage() {
  const router = useRouter();
  
  // Form state
  const [officeId, setOfficeId] = useState<string>('');
  const [currencyCode, setCurrencyCode] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [paymentTypeId, setPaymentTypeId] = useState<string>('');
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [accountingRuleId, setAccountingRuleId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<Date | undefined>(undefined);
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [routingCode, setRoutingCode] = useState<string>('');
  const [bankNumber, setBankNumber] = useState<string>('');

  // Dynamic GL entries
  const [debitEntries, setDebitEntries] = useState<GLEntry[]>([{ glAccountId: 0, amount: 0 }]);
  const [creditEntries, setCreditEntries] = useState<GLEntry[]>([{ glAccountId: 0, amount: 0 }]);

  // Data fetching
  const [offices, setOffices] = useState<Office[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [accountingRules, setAccountingRules] = useState<AccountingRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<AccountingRule | null>(null);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [officesRes, currenciesRes, paymentTypesRes, accountingRulesRes, glAccountsRes] = await Promise.all([
          fetch('/api/fineract/offices?orderBy=id'),
          fetch('/api/fineract/currencies'),
          fetch('/api/fineract/paymenttypes'),
          fetch('/api/fineract/accountingrules?associations=all'),
          fetch('/api/fineract/glaccounts?manualEntriesAllowed=true&usage=1&disabled=false')
        ]);

        // Check if responses are ok before parsing JSON
        if (!officesRes.ok) throw new Error(`Failed to fetch offices: ${officesRes.status}`);
        if (!currenciesRes.ok) throw new Error(`Failed to fetch currencies: ${currenciesRes.status}`);
        if (!paymentTypesRes.ok) throw new Error(`Failed to fetch payment types: ${paymentTypesRes.status}`);
        if (!accountingRulesRes.ok) throw new Error(`Failed to fetch accounting rules: ${accountingRulesRes.status}`);
        if (!glAccountsRes.ok) throw new Error(`Failed to fetch GL accounts: ${glAccountsRes.status}`);

        const officesData = await officesRes.json();
        const currenciesData = await currenciesRes.json();
        const paymentTypesData = await paymentTypesRes.json();
        const accountingRulesData = await accountingRulesRes.json();
        const glAccountsData = await glAccountsRes.json();

        // Ensure we have arrays for all data
        setOffices(Array.isArray(officesData) ? officesData : []);
        setCurrencies(Array.isArray(currenciesData.selectedCurrencyOptions) ? currenciesData.selectedCurrencyOptions : []);
        setPaymentTypes(Array.isArray(paymentTypesData) ? paymentTypesData : []);
        setAccountingRules(Array.isArray(accountingRulesData) ? accountingRulesData : []);
        setGlAccounts(Array.isArray(glAccountsData.chartAccounts) ? glAccountsData.chartAccounts : []);

        // Set defaults
        if (officesData.length > 0) setOfficeId(officesData[0].id.toString());
        if (currenciesData.selectedCurrencyOptions?.length > 0) {
          setCurrencyCode(currenciesData.selectedCurrencyOptions[0].code);
        }
        if (paymentTypesData.length > 0) setPaymentTypeId(paymentTypesData[0].id.toString());
        setTransactionDate(new Date());
      } catch (error) {
        console.error('Error fetching data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load form data';
        toast({
          title: "Error",
          description: errorMessage.includes('500') 
            ? "Unable to connect to the accounting system. Please check your connection and try again."
            : errorMessage,
          variant: "destructive"
        });
        
        // Set empty arrays to prevent map errors
        setOffices([]);
        setCurrencies([]);
        setPaymentTypes([]);
        setAccountingRules([]);
        setGlAccounts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle accounting rule selection
  useEffect(() => {
    if (accountingRuleId && Array.isArray(accountingRules)) {
      const rule = accountingRules.find(r => r.id.toString() === accountingRuleId);
      setSelectedRule(rule || null);
      
      if (rule && Array.isArray(rule.debitAccounts) && Array.isArray(rule.creditAccounts)) {
        // Set up debit entries
        const debitEntries = rule.debitAccounts.map(account => ({
          glAccountId: account.id,
          amount: 0
        }));
        setDebitEntries(debitEntries.length > 0 ? debitEntries : [{ glAccountId: 0, amount: 0 }]);

        // Set up credit entries
        const creditEntries = rule.creditAccounts.map(account => ({
          glAccountId: account.id,
          amount: 0
        }));
        setCreditEntries(creditEntries.length > 0 ? creditEntries : [{ glAccountId: 0, amount: 0 }]);
      }
    } else {
      setSelectedRule(null);
      setDebitEntries([{ glAccountId: 0, amount: 0 }]);
      setCreditEntries([{ glAccountId: 0, amount: 0 }]);
    }
  }, [accountingRuleId, accountingRules]);

  // Calculate total amounts
  const totalDebit = debitEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const totalCredit = creditEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isBalanced) {
      toast({
        title: "Validation Error",
        description: "Debit and credit amounts must be equal.",
        variant: "destructive"
      });
      return;
    }

    if (!transactionDate) {
      toast({
        title: "Validation Error",
        description: "Transaction date is required.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        officeId: parseInt(officeId),
        currencyCode,
        referenceNumber,
        paymentTypeId: parseInt(paymentTypeId),
        checkNumber,
        receiptNumber,
        comments,
        accountingRule: parseInt(accountingRuleId),
        transactionDate: format(transactionDate, 'dd MMMM yyyy'),
        accountNumber,
        routingCode,
        bankNumber,
        debits: debitEntries.filter(entry => entry.glAccountId > 0 && entry.amount > 0),
        credits: creditEntries.filter(entry => entry.glAccountId > 0 && entry.amount > 0),
        dateFormat: 'dd MMMM yyyy',
        locale: 'en'
      };

      const response = await fetch('/api/fineract/journalentries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || 'Failed to create journal entry');
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: `Journal entry created successfully. Transaction ID: ${result.transactionId}`,
        variant: "success"
      });

      // Redirect to the journal entry view page
      router.push(`/accounting/journal-entries/${result.transactionId}`);
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create journal entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add/remove GL entries
  const addDebitEntry = () => {
    setDebitEntries([...debitEntries, { glAccountId: 0, amount: 0 }]);
  };

  const removeDebitEntry = (index: number) => {
    if (debitEntries.length > 1) {
      setDebitEntries(debitEntries.filter((_, i) => i !== index));
    }
  };

  const addCreditEntry = () => {
    setCreditEntries([...creditEntries, { glAccountId: 0, amount: 0 }]);
  };

  const removeCreditEntry = (index: number) => {
    if (creditEntries.length > 1) {
      setCreditEntries(creditEntries.filter((_, i) => i !== index));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Frequent Postings</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Create journal entries using predefined accounting rules
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Transaction Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="office" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Office *
                  </Label>
                  <Select value={officeId} onValueChange={setOfficeId} required>
                    <SelectTrigger className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                      <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="Select office" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                      {offices.map((office) => (
                        <SelectItem key={office.id} value={office.id.toString()} className="text-slate-900 dark:text-slate-100">
                          {office.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="currency" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Currency *
                  </Label>
                  <Select value={currencyCode} onValueChange={setCurrencyCode} required>
                    <SelectTrigger className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                      <DollarSign className="w-4 h-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code} className="text-slate-900 dark:text-slate-100">
                          {currency.displayLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="referenceNumber" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Reference Number
                  </Label>
                  <div className="relative mt-1">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="referenceNumber"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                      placeholder="Enter reference number"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="paymentType" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Payment Type
                  </Label>
                  <Select value={paymentTypeId} onValueChange={setPaymentTypeId}>
                    <SelectTrigger className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                      <CreditCard className="w-4 h-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                      {paymentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()} className="text-slate-900 dark:text-slate-100">
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="checkNumber" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Cheque Number
                  </Label>
                  <div className="relative mt-1">
                    <Banknote className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="checkNumber"
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                      placeholder="Enter cheque number"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="receiptNumber" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Receipt Number
                  </Label>
                  <div className="relative mt-1">
                    <Receipt className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="receiptNumber"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                      placeholder="Enter receipt number"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="comments" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Comments
                  </Label>
                  <div className="relative mt-1">
                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      id="comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 resize-none"
                      rows={3}
                      placeholder="Enter comments"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="accountingRule" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Accounting Rule *
                  </Label>
                  <Select value={accountingRuleId} onValueChange={setAccountingRuleId} required>
                    <SelectTrigger className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                      <FileText className="w-4 h-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="Select accounting rule" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                      {accountingRules.map((rule) => (
                        <SelectItem key={rule.id} value={rule.id.toString()} className="text-slate-900 dark:text-slate-100">
                          {rule.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="transactionDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Transaction Date *
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600",
                          !transactionDate && "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {transactionDate ? format(transactionDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                      <Calendar
                        mode="single"
                        selected={transactionDate}
                        onSelect={setTransactionDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="accountNumber" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Account Number
                  </Label>
                  <div className="relative mt-1">
                    <HashIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                      placeholder="Enter account number"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="routingCode" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Routing Code
                  </Label>
                  <div className="relative mt-1">
                    <Route className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="routingCode"
                      value={routingCode}
                      onChange={(e) => setRoutingCode(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                      placeholder="Enter routing code"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="bankNumber" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Bank Number
                  </Label>
                  <div className="relative mt-1">
                    <Banknote className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="bankNumber"
                      value={bankNumber}
                      onChange={(e) => setBankNumber(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                      placeholder="Enter bank number"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GL Entries - Only show when accounting rule is selected */}
        {selectedRule && (
          <>
            {/* Debit Entries */}
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Debit Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {debitEntries.map((entry, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Affected GL Entry (Debit) *
                        </Label>
                        <Select
                          value={entry.glAccountId.toString()}
                          onValueChange={(value) => {
                            const newEntries = [...debitEntries];
                            newEntries[index].glAccountId = parseInt(value);
                            setDebitEntries(newEntries);
                          }}
                          required
                        >
                          <SelectTrigger className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                            <SelectValue placeholder="Select GL account" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                            {glAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id.toString()} className="text-slate-900 dark:text-slate-100">
                                {account.name} ({account.glCode})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Debit Amount *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.amount || ''}
                          onChange={(e) => {
                            const newEntries = [...debitEntries];
                            newEntries[index].amount = parseFloat(e.target.value) || 0;
                            setDebitEntries(newEntries);
                          }}
                          className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      {debitEntries.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeDebitEntry(index)}
                          className="mt-6 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {selectedRule.allowMultipleDebitEntries && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addDebitEntry}
                      className="border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Debit Entry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Credit Entries */}
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Credit Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {creditEntries.map((entry, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Affected GL Entry (Credit) *
                        </Label>
                        <Select
                          value={entry.glAccountId.toString()}
                          onValueChange={(value) => {
                            const newEntries = [...creditEntries];
                            newEntries[index].glAccountId = parseInt(value);
                            setCreditEntries(newEntries);
                          }}
                          required
                        >
                          <SelectTrigger className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                            <SelectValue placeholder="Select GL account" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                            {glAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id.toString()} className="text-slate-900 dark:text-slate-100">
                                {account.name} ({account.glCode})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Credit Amount *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.amount || ''}
                          onChange={(e) => {
                            const newEntries = [...creditEntries];
                            newEntries[index].amount = parseFloat(e.target.value) || 0;
                            setCreditEntries(newEntries);
                          }}
                          className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      {creditEntries.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeCreditEntry(index)}
                          className="mt-6 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {selectedRule.allowMultipleCreditEntries && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCreditEntry}
                      className="border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Credit Entry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Balance Summary */}
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Balance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="text-sm font-medium text-red-600 dark:text-red-400">Total Debit</div>
                    <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {currencyCode} {totalDebit.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">Total Credit</div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {currencyCode} {totalCredit.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className={`mt-4 p-3 rounded-lg ${
                  isBalanced 
                    ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                }`}>
                  <div className={`text-sm font-medium ${
                    isBalanced 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {isBalanced ? '✓ Balanced' : '✗ Not Balanced'}
                  </div>
                  <div className={`text-xs ${
                    isBalanced 
                      ? 'text-green-500 dark:text-green-300' 
                      : 'text-red-500 dark:text-red-300'
                  }`}>
                    {isBalanced 
                      ? 'Debit and credit amounts are equal' 
                      : `Difference: ${currencyCode} ${Math.abs(totalDebit - totalCredit).toFixed(2)}`
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Action Buttons */}
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="pt-6">
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !isBalanced || !accountingRuleId || !transactionDate}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Creating...' : 'Create Journal Entry'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
} 