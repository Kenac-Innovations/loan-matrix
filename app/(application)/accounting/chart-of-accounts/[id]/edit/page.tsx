'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2, BookOpen, CheckCircle } from 'lucide-react';

// 1) JSON shapes
interface AccountTypeOption { id: number; code: string; value: string }
interface UsageOption       { id: number; code: string; value: string }
interface ChartAccount      { id: number; name: string }
interface TagOption         { id: number; name: string }

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function EditAccountPage() {
  const router = useRouter();
  const { id } = useParams();

  // 2) Fetch the single‐account template
  const { data: template, error: templateError } = useSWR<{
    type:          { id: number; code: string; value: string };
    usage:         { id: number; code: string; value: string };
    manualEntriesAllowed: boolean;
    name:          string;
    glCode:        string;
    description?:  string;
    parentId?:     number;
    tagId?:        { id: number; name: string };
    accountTypeOptions:   AccountTypeOption[];
    usageOptions:         UsageOption[];
    chartAccounts:        ChartAccount[];
    allowedAssetsTagOptions:       TagOption[];
    allowedLiabilitiesTagOptions:  TagOption[];
    allowedEquityTagOptions:       TagOption[];
    allowedIncomeTagOptions:       TagOption[];
    allowedExpensesTagOptions:     TagOption[];
  }>(`/api/fineract/glaccounts/${id}?template=true`, fetcher);

  // 3) Fetch full chart for the “Parent” dropdown
  const { data: allData } = useSWR<{ chartAccounts: ChartAccount[] }>(
    '/api/fineract/chart-of-accounts',
    fetcher
  );

  // 4) Local form state
  const [accountType,   setAccountType]   = useState('');
  const [usage,         setUsage]         = useState('');
  const [parentId,      setParentId]      = useState('none');
  const [tagId,         setTagId]         = useState('none');
  const [name,          setName]          = useState('');
  const [glCode,        setGlCode]        = useState('');
  const [description,   setDescription]   = useState('');
  const [manualAllowed, setManualAllowed] = useState(false);
  const [submitting,    setSubmitting]    = useState(false);

  // 5) Populate once template arrives
  useEffect(() => {
    if (!template) return;
    console.log('Loaded template:', template);
    setAccountType(template.type.id.toString());
    setUsage(      template.usage.id.toString());
    setManualAllowed(template.manualEntriesAllowed);
    setName(       template.name);
    setGlCode(     template.glCode);
    setDescription(template.description || '');
    setParentId(   template.parentId?.toString() || 'none');
    setTagId(      template.tagId?.id.toString()    || 'none');
  }, [template]);

  if (templateError) {
    return <div className="text-red-600">Failed to load account template.</div>;
  }
  if (!template) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <Loader2 className="animate-spin mr-2" />Loading…
      </div>
    );
  }

  // 6) Build our dropdown options
  const accountTypeOptions = template.accountTypeOptions;
  const usageOptions       = template.usageOptions;
  const parentOptions      = allData?.chartAccounts || [];
  const tagOptions: TagOption[] = [
    ...template.allowedAssetsTagOptions,
    ...template.allowedLiabilitiesTagOptions,
    ...template.allowedEquityTagOptions,
    ...template.allowedIncomeTagOptions,
    ...template.allowedExpensesTagOptions,
  ];

  // 7) Submit handler
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      type:                  Number(accountType),
      usage:                 Number(usage),
      name,
      glCode,
      parentId:  parentId !== 'none' ? Number(parentId) : null,
      tagId:     tagId    !== 'none' ? Number(tagId)    : null,
      manualEntriesAllowed: manualAllowed,
      description,
    };

    try {
      const res = await fetch(`/api/fineract/glaccounts/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type':'application/json' },
        body:    JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to update GL account`);
      }
      
      const { resourceId } = await res.json();
      
      // Enhanced success notification
      toast({
        title: 'GL Account Updated Successfully! ✨',
        description: (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{name}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>Account ID: <span className="font-mono bg-muted px-1 rounded">{resourceId}</span></div>
              <div>GL Code: <span className="font-mono bg-muted px-1 rounded">{glCode}</span></div>
              {description && <div className="mt-1">Description: {description}</div>}
            </div>
          </div>
        ),
        variant: 'success',
        action: {
          label: 'View Account',
          onClick: () => router.push(`/accounting/chart-of-accounts/${resourceId}`),
        },
      });

      // Navigate after a short delay to allow user to see the notification
      setTimeout(() => {
        router.push('/accounting/chart-of-accounts');
      }, 2000);
      
    } catch (err: any) {
      console.error('Error updating GL account:', err);
      
      // Enhanced error notification
      toast({
        title: 'Failed to Update GL Account',
        description: (
          <div className="space-y-1">
            <div className="text-sm">{err.message}</div>
            <div className="text-xs text-muted-foreground">
              Please check your changes and try again. If the problem persists, contact support.
            </div>
          </div>
        ),
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleUpdate}
      className="max-w-3xl mx-auto space-y-6 p-6 bg-white dark:bg-[#0d121f] rounded-lg shadow"
    >
      <h2 className="text-2xl font-semibold">Edit GL Account</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Account Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Account Type *</label>
          <Select value={accountType} onValueChange={setAccountType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {accountTypeOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id.toString()}>
                  {opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Account Usage */}
        <div>
          <label className="block text-sm font-medium mb-1">Account Usage *</label>
          <Select value={usage} onValueChange={setUsage}>
            <SelectTrigger>
              <SelectValue placeholder="Select usage" />
            </SelectTrigger>
            <SelectContent>
              {usageOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id.toString()}>
                  {opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* GL Code */}
        <div>
          <label className="block text-sm font-medium mb-1">GL Code *</label>
          <Input value={glCode} onChange={e => setGlCode(e.target.value)} required />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1">Account Name *</label>
          <Input value={name} onChange={e => setName(e.target.value)} required />
        </div>

        {/* Parent */}
        <div>
          <label className="block text-sm font-medium mb-1">Parent</label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {parentOptions.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tag */}
        <div>
          <label className="block text-sm font-medium mb-1">Tag</label>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {tagOptions.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manual Entries */}
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={manualAllowed}
            onCheckedChange={v => setManualAllowed(Boolean(v))}
          />
          <span>Manual Entries Allowed</span>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update'}
        </Button>
      </div>
    </form>
  );
}
