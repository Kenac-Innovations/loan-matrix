// File: app/(application)/accounting/chart-of-accounts/new/page.tsx

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { 
  Loader2, 
  BookOpen, 
  CheckCircle, 
  Plus, 
  ArrowLeft,
  Hash,
  Tag,
  FileText,
  Settings,
  Building2,
  TrendingUp,
  TrendingDown,
  Circle,
  AlertCircle
} from 'lucide-react';

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NewAccountPage() {
  const router = useRouter();
  const { data: template, error } = useSWR(
    '/api/fineract/glaccounts/template',
    fetcher
  );

  const [accountType, setAccountType] = useState<string>('');
  const [usage, setUsage] = useState<string>('');
  const [parent, setParent] = useState<string>('none');
  const [tag, setTag] = useState<string>('none');
  const [name, setName] = useState<string>('');
  const [glCode, setGlCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [manualAllowed, setManualAllowed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (template) {
      setAccountType(template.type.id.toString());
      setUsage(template.usage.id.toString());
      setManualAllowed(template.manualEntriesAllowed);
    }
  }, [template]);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <div className="text-red-600 font-medium">Error loading template</div>
            <div className="text-sm text-red-500 mt-1">{error.message}</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!template) {
    return (
      <div className="space-y-4">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accountTypeOptions = template.accountTypeOptions || [];
  const chartAccounts = template.chartAccounts || [];
  const usageOptions = template.usageOptions || [];
  const tagOptions = [
    ...template.allowedAssetsTagOptions,
    ...template.allowedLiabilitiesTagOptions,
    ...template.allowedEquityTagOptions,
    ...template.allowedIncomeTagOptions,
    ...template.allowedExpensesTagOptions,
  ];

  // Type configuration for visual enhancement
  const typeConfig: Record<string, { color: string; bgColor: string; icon: any }> = {
    ASSET: { color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: TrendingUp },
    LIABILITY: { color: 'text-amber-600', bgColor: 'bg-amber-50', icon: TrendingDown },
    INCOME: { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: TrendingUp },
    REVENUE: { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: TrendingUp },
    EQUITY: { color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Circle },
    EXPENSE: { color: 'text-red-600', bgColor: 'bg-red-50', icon: TrendingDown },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      type: Number(accountType),
      usage: Number(usage),
      name,
      glCode,
      parentId: parent !== 'none' ? Number(parent) : null,
      tagId: tag !== 'none' ? Number(tag) : null,
      manualEntriesAllowed: manualAllowed,
      description,
    };

    try {
      const res = await fetch('/api/fineract/glaccounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const responseData = await res.json();
      
      if (!res.ok) {
        const errorMessage = responseData.defaultUserMessage || responseData.developerMessage || 'Failed to create account';
        
        toast({
          title: 'Cannot Create Account',
          description: errorMessage,
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const { resourceId } = responseData;
      
      // Success notification
      toast({
        title: 'Account Created',
        description: `${name} has been successfully created`,
        variant: 'success',
      });

      // Navigate after a short delay
      setTimeout(() => {
        router.push('/accounting/chart-of-accounts');
      }, 2000);
      
    } catch (err: any) {
      console.error('Error creating GL account:', err);
      
      toast({
        title: 'Network Error',
        description: 'Unable to connect to the server. Please try again.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New GL Account</h1>
          <p className="text-muted-foreground mt-1">
            Add a new general ledger account to your chart of accounts
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Accounts
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Basic Information</CardTitle>
                <CardDescription>
                  Essential details for your new general ledger account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Type */}
              <div className="space-y-2">
                <Label htmlFor="accountType" className="text-sm font-medium">
                  Account Type <span className="text-red-500">*</span>
                </Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypeOptions.map((opt: any) => {
                      const config = typeConfig[opt.value?.toUpperCase()] || { color: 'text-gray-600', bgColor: 'bg-gray-50', icon: FileText };
                      const IconComponent = config.icon;
                      return (
                        <SelectItem key={opt.id} value={opt.id.toString()}>
                          <div className="flex items-center gap-2">
                            <IconComponent className={`h-4 w-4 ${config.color}`} />
                            <span>{opt.value}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Account Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter account name"
                  className="h-11"
                />
              </div>

              {/* Account Usage */}
              <div className="space-y-2">
                <Label htmlFor="usage" className="text-sm font-medium">
                  Account Usage <span className="text-red-500">*</span>
                </Label>
                <Select value={usage} onValueChange={setUsage}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select usage type" />
                  </SelectTrigger>
                  <SelectContent>
                    {usageOptions.map((opt: any) => (
                      <SelectItem key={opt.id} value={opt.id.toString()}>
                        {opt.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* GL Code */}
              <div className="space-y-2">
                <Label htmlFor="glCode" className="text-sm font-medium">
                  GL Code <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="glCode"
                    required
                    value={glCode}
                    onChange={(e) => setGlCode(e.target.value)}
                    placeholder="Enter GL code"
                    className="h-11 pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Settings className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Advanced Settings</CardTitle>
                <CardDescription>
                  Optional configurations for your account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Parent Account */}
              <div className="space-y-2">
                <Label htmlFor="parent" className="text-sm font-medium">
                  Parent Account
                </Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select parent account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {chartAccounts.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tag */}
              <div className="space-y-2">
                <Label htmlFor="tag" className="text-sm font-medium">
                  Account Tag
                </Label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select account tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {tagOptions.map((t: any) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-gray-400" />
                          <span>{t.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Manual Entries Allowed */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Manual Entries Allowed</Label>
                <p className="text-xs text-muted-foreground">
                  Allow manual journal entries to this account
                </p>
              </div>
              <Switch
                checked={manualAllowed}
                onCheckedChange={setManualAllowed}
              />
            </div>
          </CardContent>
        </Card>

        {/* Description Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Description</CardTitle>
                <CardDescription>
                  Additional details about this account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Account Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter account description..."
                rows={3}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">
                  Ready to create your new GL account
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex items-center gap-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Account
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
