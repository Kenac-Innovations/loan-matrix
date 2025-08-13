'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Settings, Building, Tag, CreditCard, Minus, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { FineractAccountingRule } from '@/lib/fineract-api';
import { Label } from '@/components/ui/label';

export default function AccountingRuleViewPage() {
  const params = useParams();

  const [accountingRule, setAccountingRule] = useState<FineractAccountingRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchAccountingRule(params.id as string);
    }
  }, [params.id]);

  const fetchAccountingRule = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/fineract/accountingrules/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch accounting rule: ${response.status}`);
      }
      const data = await response.json();
      setAccountingRule(data);
    } catch (error) {
      console.error('Error fetching accounting rule:', error);
      toast({
        title: "Error",
        description: "Failed to load accounting rule details.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getAccountNames = (accounts?: any[]) => {
    if (!accounts || accounts.length === 0) return '—';
    return accounts.map(acc => `${acc.name} (${acc.glCode})`).join(', ');
  };

  const getTagNames = (tags?: any[]) => {
    if (!tags || tags.length === 0) return '—';
    return tags.map(tag => tag.tag?.name || tag.name).join(', ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!accountingRule) {
    return (
      <div className="text-center py-12">
        <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
          Accounting rule not found
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          The accounting rule you're looking for doesn't exist or has been deleted.
        </p>
        <Link href="/accounting/accounting-rules">
          <Button variant="outline">
            Back to Accounting Rules
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/accounting/accounting-rules">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {accountingRule.name}
            </h1>
            <p className="text-muted-foreground mt-2">
              Accounting Rule Details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/accounting/accounting-rules/${accountingRule.id}/edit`}>
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
              <Edit className="h-4 w-4 mr-2" />
              Edit Rule
            </Button>
          </Link>
        </div>
      </div>

      {/* Basic Information */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Rule Name</Label>
              <p className="text-slate-900 dark:text-slate-100 font-medium">{accountingRule.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Office</Label>
              <p className="text-slate-900 dark:text-slate-100">{accountingRule.officeName}</p>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Description</Label>
            <p className="text-slate-900 dark:text-slate-100">{accountingRule.description || '—'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant={accountingRule.systemDefined ? "default" : "secondary"}>
                {accountingRule.systemDefined ? 'System Defined' : 'User Defined'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debit Configuration */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Minus className="h-5 w-5 text-red-500" />
            Debit Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Debit Accounts</Label>
              <p className="text-slate-900 dark:text-slate-100">{getAccountNames(accountingRule.debitAccounts)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Debit Tags</Label>
              <p className="text-slate-900 dark:text-slate-100">{getTagNames(accountingRule.debitTags)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {accountingRule.allowMultipleDebitEntries ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Multiple Debit Entries Allowed: {accountingRule.allowMultipleDebitEntries ? 'Yes' : 'No'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Credit Configuration */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-500" />
            Credit Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Credit Accounts</Label>
              <p className="text-slate-900 dark:text-slate-100">{getAccountNames(accountingRule.creditAccounts)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Credit Tags</Label>
              <p className="text-slate-900 dark:text-slate-100">{getTagNames(accountingRule.creditTags)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {accountingRule.allowMultipleCreditEntries ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Multiple Credit Entries Allowed: {accountingRule.allowMultipleCreditEntries ? 'Yes' : 'No'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Allowed Offices and Accounts */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building className="h-5 w-5" />
            Permissions & Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Allowed Offices</Label>
            <p className="text-slate-900 dark:text-slate-100">
              {accountingRule.allowedOffices.length > 0 
                ? accountingRule.allowedOffices.map((office: any) => office.name).join(', ')
                : 'All offices'
              }
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Allowed Accounts</Label>
            <p className="text-slate-900 dark:text-slate-100">
              {accountingRule.allowedAccounts.length > 0 
                ? accountingRule.allowedAccounts.map((account: any) => `${account.name} (${account.glCode})`).join(', ')
                : 'All accounts'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 