'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Settings, Building, Tag, CreditCard, Minus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { AccountingRuleTemplate, FineractAccountingRule } from '@/lib/fineract-api';

interface Office {
  id: number;
  name: string;
  nameDecorated: string;
}

interface Account {
  id: number;
  name: string;
  glCode: string;
  disabled: boolean;
  manualEntriesAllowed: boolean;
  type: {
    id: number;
    code: string;
    value: string;
  };
  usage: {
    id: number;
    code: string;
    value: string;
  };
  description: string;
  nameDecorated: string;
  tagId: {
    id: number;
    active: boolean;
    mandatory: boolean;
  };
}

interface Tag {
  id: number;
  name: string;
  position: number;
  description: string;
  active: boolean;
  mandatory: boolean;
}

export default function EditAccountingRulePage() {
  const router = useRouter();
  const params = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [template, setTemplate] = useState<AccountingRuleTemplate | null>(null);
  const [accountingRule, setAccountingRule] = useState<FineractAccountingRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    officeId: '',
    // Debit section
    debitRuleType: 'fixed',
    accountToDebit: '',
    debitTags: [] as number[],
    allowMultipleDebitEntries: false,
    // Credit section
    creditRuleType: 'fixed',
    accountToCredit: '',
    creditTags: [] as number[],
    allowMultipleCreditEntries: false,
  });

  useEffect(() => {
    if (params.id) {
      fetchData(params.id as string);
    }
  }, [params.id]);

  const fetchData = async (id: string) => {
    try {
      // Fetch both template and existing rule data
      const [templateResponse, ruleResponse] = await Promise.all([
        fetch('/api/fineract/accountingrules/template'),
        fetch(`/api/fineract/accountingrules/${id}`)
      ]);

      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch template: ${templateResponse.status}`);
      }
      if (!ruleResponse.ok) {
        throw new Error(`Failed to fetch rule: ${ruleResponse.status}`);
      }

      const templateData = await templateResponse.json();
      const ruleData = await ruleResponse.json();

      setTemplate(templateData);
      setAccountingRule(ruleData);

      // Populate form with existing data
      const debitRuleType = ruleData.debitAccounts && ruleData.debitAccounts.length > 0 ? 'fixed' : 'list';
      const creditRuleType = ruleData.creditAccounts && ruleData.creditAccounts.length > 0 ? 'fixed' : 'list';

      setFormData({
        name: ruleData.name,
        description: ruleData.description,
        officeId: ruleData.officeId.toString(),
        // Debit section
        debitRuleType,
        accountToDebit: debitRuleType === 'fixed' && ruleData.debitAccounts?.[0] ? ruleData.debitAccounts[0].id.toString() : '',
        debitTags: ruleData.debitTags ? ruleData.debitTags.map((tag: any) => tag.tag?.id || tag.id) : [],
        allowMultipleDebitEntries: ruleData.allowMultipleDebitEntries,
        // Credit section
        creditRuleType,
        accountToCredit: creditRuleType === 'fixed' && ruleData.creditAccounts?.[0] ? ruleData.creditAccounts[0].id.toString() : '',
        creditTags: ruleData.creditTags ? ruleData.creditTags.map((tag: any) => tag.tag?.id || tag.id) : [],
        allowMultipleCreditEntries: ruleData.allowMultipleCreditEntries,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load accounting rule data.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        officeId: parseInt(formData.officeId),
      };

      // Handle debit side
      if (formData.debitRuleType === 'fixed') {
        payload.accountToDebit = parseInt(formData.accountToDebit);
      } else {
        payload.debitTags = formData.debitTags;
        payload.allowMultipleDebitEntries = formData.allowMultipleDebitEntries;
      }

      // Handle credit side
      if (formData.creditRuleType === 'fixed') {
        payload.accountToCredit = parseInt(formData.accountToCredit);
      } else {
        payload.creditTags = formData.creditTags;
        payload.allowMultipleCreditEntries = formData.allowMultipleCreditEntries;
      }

      const response = await fetch(`/api/fineract/accountingrules/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: "Accounting rule updated successfully.",
        });
        router.push('/accounting/accounting-rules');
      } else {
        throw new Error('Failed to update accounting rule');
      }
    } catch (error) {
      console.error('Error updating accounting rule:', error);
      toast({
        title: "Error",
        description: "Failed to update accounting rule. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagChange = (tagId: number, type: 'debit' | 'credit', checked: boolean) => {
    const field = type === 'debit' ? 'debitTags' : 'creditTags';
    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], tagId]
        : prev[field].filter(id => id !== tagId)
    }));
  };

  if (!template || !accountingRule) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/accounting/accounting-rules/${params.id}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Edit Accounting Rule
            </h1>
            <p className="text-muted-foreground mt-2">
              Update accounting rule configuration
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Define the rule name, description, and office
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-900 dark:text-slate-100">Rule Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter rule name"
                  className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office" className="text-slate-900 dark:text-slate-100">Office *</Label>
                <Select value={formData.officeId} onValueChange={(value) => setFormData(prev => ({ ...prev, officeId: value }))}>
                  <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue placeholder="Select office" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                    {template.allowedOffices.map((office) => (
                      <SelectItem key={office.id} value={office.id.toString()} className="text-slate-900 dark:text-slate-100">
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-900 dark:text-slate-100">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter rule description"
                className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Debit Rule Configuration */}
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Minus className="h-5 w-5 text-red-500" />
              Affected GL Entry (Debit) Rule Type *
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Configure the debit side of the accounting rule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup 
              value={formData.debitRuleType} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, debitRuleType: value }))}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="debit-fixed" />
                <Label htmlFor="debit-fixed" className="text-slate-900 dark:text-slate-100">Fixed Account</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="list" id="debit-list" />
                <Label htmlFor="debit-list" className="text-slate-900 dark:text-slate-100">List of Accounts</Label>
              </div>
            </RadioGroup>

            {formData.debitRuleType === 'fixed' ? (
              <div className="space-y-2">
                <Label htmlFor="debitAccount" className="text-slate-900 dark:text-slate-100">Debit Account *</Label>
                <Select value={formData.accountToDebit} onValueChange={(value) => setFormData(prev => ({ ...prev, accountToDebit: value }))}>
                  <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue placeholder="Select debit account" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                    {template.allowedAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()} className="text-slate-900 dark:text-slate-100">
                        {account.name} ({account.glCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-900 dark:text-slate-100">Debit Tags</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {template.allowedDebitTagOptions.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`debit-tag-${tag.id}`}
                          checked={formData.debitTags.includes(tag.id)}
                          onCheckedChange={(checked) => handleTagChange(tag.id, 'debit', checked as boolean)}
                        />
                        <Label htmlFor={`debit-tag-${tag.id}`} className="text-sm text-slate-900 dark:text-slate-100">
                          {tag.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="multipleDebit"
                    checked={formData.allowMultipleDebitEntries}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowMultipleDebitEntries: checked as boolean }))}
                  />
                  <Label htmlFor="multipleDebit" className="text-slate-900 dark:text-slate-100">
                    Multiple Debit Entries Allowed
                  </Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Rule Configuration */}
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              Affected GL Entry (Credit) Rule Type *
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Configure the credit side of the accounting rule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup 
              value={formData.creditRuleType} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, creditRuleType: value }))}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="credit-fixed" />
                <Label htmlFor="credit-fixed" className="text-slate-900 dark:text-slate-100">Fixed Account</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="list" id="credit-list" />
                <Label htmlFor="credit-list" className="text-slate-900 dark:text-slate-100">List of Accounts</Label>
              </div>
            </RadioGroup>

            {formData.creditRuleType === 'fixed' ? (
              <div className="space-y-2">
                <Label htmlFor="creditAccount" className="text-slate-900 dark:text-slate-100">Credit Account *</Label>
                <Select value={formData.accountToCredit} onValueChange={(value) => setFormData(prev => ({ ...prev, accountToCredit: value }))}>
                  <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue placeholder="Select credit account" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                    {template.allowedAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()} className="text-slate-900 dark:text-slate-100">
                        {account.name} ({account.glCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-900 dark:text-slate-100">Credit Tags</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {template.allowedCreditTagOptions.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`credit-tag-${tag.id}`}
                          checked={formData.creditTags.includes(tag.id)}
                          onCheckedChange={(checked) => handleTagChange(tag.id, 'credit', checked as boolean)}
                        />
                        <Label htmlFor={`credit-tag-${tag.id}`} className="text-sm text-slate-900 dark:text-slate-100">
                          {tag.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="multipleCredit"
                    checked={formData.allowMultipleCreditEntries}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowMultipleCreditEntries: checked as boolean }))}
                  />
                  <Label htmlFor="multipleCredit" className="text-slate-900 dark:text-slate-100">
                    Multiple Credit Entries Allowed
                  </Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link href={`/accounting/accounting-rules/${params.id}`}>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Update Rule
          </Button>
        </div>
      </form>
    </div>
  );
} 