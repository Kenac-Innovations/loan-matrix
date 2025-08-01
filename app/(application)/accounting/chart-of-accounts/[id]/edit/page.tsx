'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Save, BookOpen, Building2, Tag, Settings, FileText } from 'lucide-react';

interface TagOption {
  id: number;
  name: string;
  position: number;
  description: string;
  active: boolean;
  mandatory: boolean;
}

export default function EditAccountPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // State
  const [accountType, setAccountType] = useState('');
  const [usage, setUsage] = useState('');
  const [name, setName] = useState('');
  const [glCode, setGlCode] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('none');
  const [tagId, setTagId] = useState('none');
  const [manualAllowed, setManualAllowed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 1) Fetch template data
  const { data: template, error: templateError } = useSWR(
    id ? `/api/fineract/glaccounts/${id}?template=true` : null,
    (url) => fetch(url).then(res => res.json())
  );

  // 2) Fetch all accounts for parent selection
  const { data: allData } = useSWR(
    '/api/fineract/chart-of-accounts',
    (url) => fetch(url).then(res => res.json())
  );

  // 3) Get allowed tags based on account type
  const getTagOptions = () => {
    if (!template || !accountType) return [];
    
    const accountTypeId = parseInt(accountType);
    let allowedTags: any[] = [];
    
    switch (accountTypeId) {
      case 1: // ASSET
        allowedTags = template.allowedAssetsTagOptions || [];
        break;
      case 2: // LIABILITY
        allowedTags = template.allowedLiabilitiesTagOptions || [];
        break;
      case 3: // EQUITY
        allowedTags = template.allowedEquityTagOptions || [];
        break;
      case 4: // INCOME
        allowedTags = template.allowedIncomeTagOptions || [];
        break;
      case 5: // EXPENSE
        allowedTags = template.allowedExpensesTagOptions || [];
        break;
      default:
        allowedTags = [];
    }
    
    return allowedTags;
  };

  const tagOptions = getTagOptions();

  // 4) Populate form when template loads
  useEffect(() => {
    if (!template) return;
    
    try {
      // Set account type
      const accountTypeValue = template.type?.id?.toString() || '';
      setAccountType(accountTypeValue);
      
      // Set usage
      const usageValue = template.usage?.id?.toString() || '';
      setUsage(usageValue);
      
      // Set manual entries allowed
      setManualAllowed(template.manualEntriesAllowed || false);
      
      // Set name and GL code
      setName(template.name || '');
      setGlCode(template.glCode || '');
      
      // Set description
      setDescription(template.description || '');
      
      // Set parent ID
      const parentIdValue = template.parentId;
      let finalParentId = 'none';
      if (parentIdValue) {
        finalParentId = typeof parentIdValue === 'object' ? parentIdValue.id?.toString() : parentIdValue.toString();
      }
      setParentId(finalParentId);
      
      // Set tag ID
      const tagIdValue = template.tagId;
      let finalTagId = 'none';
      if (tagIdValue && tagIdValue.id !== 0) {
        finalTagId = typeof tagIdValue === 'object' ? tagIdValue.id?.toString() : tagIdValue.toString();
      }
      setTagId(finalTagId);
    } catch (error) {
      toast({
        title: 'Error Loading Form Data',
        description: 'There was an error loading the GL account data. Please refresh the page.',
        variant: 'destructive',
      });
    }
  }, [template]);

  // 5) Ensure form values are always correct when template changes
  useEffect(() => {
    if (template && (accountType === '' || usage === '' || tagId === '')) {
      const accountTypeValue = template.type?.id?.toString() || '';
      const usageValue = template.usage?.id?.toString() || '';
      const tagIdValue = template.tagId;
      let finalTagId = 'none';
      if (tagIdValue && tagIdValue.id !== 0) {
        finalTagId = typeof tagIdValue === 'object' ? tagIdValue.id?.toString() : tagIdValue.toString();
      }
      
      if (accountTypeValue && accountType !== accountTypeValue) {
        setAccountType(accountTypeValue);
      }
      
      if (usageValue && usage !== usageValue) {
        setUsage(usageValue);
      }
      
      if (finalTagId && tagId !== finalTagId) {
        setTagId(finalTagId);
      }
    }
  }, [template, accountType, usage, tagId]);

  // 6) Reset tag when account type changes
  useEffect(() => {
    if (accountType && tagId !== 'none') {
      const currentTagOptions = getTagOptions();
      const currentTagExists = currentTagOptions.some(tag => tag.id.toString() === tagId);
      
      if (!currentTagExists) {
        setTagId('none');
      }
    }
  }, [accountType, tagId]);

  // Early returns after all hooks
  if (templateError) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Account</CardTitle>
            <CardDescription>Failed to load the GL account data. Please try again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Loading Account...</CardTitle>
            <CardDescription>Please wait while we load the account data.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Get options for dropdowns
  const accountTypeOptions = template.accountTypeOptions;
  const usageOptions = template.usageOptions;
  const parentOptions = allData?.chartAccounts || [];

  // 7) Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        name,
        glCode,
        description,
        type: parseInt(accountType),
        usage: parseInt(usage),
        parentId: parentId === 'none' ? null : parseInt(parentId),
        tagId: tagId === 'none' ? null : parseInt(tagId),
        manualEntriesAllowed: manualAllowed,
      };

      const response = await fetch(`/api/fineract/glaccounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.defaultUserMessage || responseData.developerMessage || 'Failed to update account';
        
        toast({
          title: 'Cannot Update Account',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Account Updated',
        description: `${name} has been successfully updated`,
        variant: 'success',
      });

      // Navigate back after a short delay
      setTimeout(() => {
        router.push('/accounting/chart-of-accounts');
      }, 2000);

    } catch (error) {
      console.error('Error updating account:', error);
      toast({
        title: 'Network Error',
        description: 'Unable to connect to the server. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit GL Account</h1>
            <p className="text-muted-foreground mt-1">Update the general ledger account details</p>
          </div>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Accounts
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-foreground">Basic Information</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground">
                Core account details and identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground font-medium">
                  Account Name *
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter account name"
                  className="w-full"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="glCode" className="text-foreground font-medium">
                  GL Code *
                </Label>
                <Input
                  id="glCode"
                  value={glCode}
                  onChange={(e) => setGlCode(e.target.value)}
                  placeholder="Enter GL code"
                  className="w-full font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground font-medium">
                  Description
                </Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter account description"
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Classification Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-foreground">Account Classification</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground">
                Define account type, usage, and hierarchy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="accountType" className="text-foreground font-medium">
                  Account Type *
                </Label>
                <Select value={accountType} onValueChange={setAccountType} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypeOptions?.map((option) => (
                      <SelectItem key={option.id} value={option.id.toString()}>
                        {option.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usage" className="text-foreground font-medium">
                  Account Usage *
                </Label>
                <Select value={usage} onValueChange={setUsage} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select usage" />
                  </SelectTrigger>
                  <SelectContent>
                    {usageOptions?.map((option) => (
                      <SelectItem key={option.id} value={option.id.toString()}>
                        {option.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentId" className="text-foreground font-medium">
                  Parent Account
                </Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select parent account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Parent</SelectItem>
                    {parentOptions?.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name} ({account.glCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Additional Settings Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <CardTitle className="text-foreground">Additional Settings</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground">
                Configure account behavior and categorization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tagId" className="text-foreground font-medium">
                  Account Tag
                </Label>
                <Select value={tagId} onValueChange={setTagId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {tagOptions?.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id.toString()}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manualAllowed" className="text-foreground font-medium">
                  Allow Manual Entries
                </Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="manualAllowed"
                    checked={manualAllowed}
                    onCheckedChange={setManualAllowed}
                  />
                  <span className="text-sm text-muted-foreground">
                    Allow manual journal entries for this account
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <Save className="h-4 w-4 mr-2" />
              Update Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
