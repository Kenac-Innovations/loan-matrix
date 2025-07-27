// File: app/(application)/accounting/chart-of-accounts/[id]/edit/page.tsx

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
import { Loader2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function EditAccountPage() {
  const router = useRouter();
  const { id } = useParams();

  // Fetch single-account template
  const { data: template, error: templateError } = useSWR(
    `/api/fineract/glaccounts/${id}?template=true`,
    fetcher
  );

  // Fetch full chart for parent options
  const { data: allData } = useSWR('/api/fineract/chart-of-accounts', fetcher);

  // Form state
  const [accountType, setAccountType] = useState('');
  const [usage, setUsage] = useState('');
  const [parentId, setParentId] = useState('none');
  const [tagId, setTagId] = useState('none');
  const [name, setName] = useState('');
  const [glCode, setGlCode] = useState('');
  const [description, setDescription] = useState('');
  const [manualAllowed, setManualAllowed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Populate form when template loads
  useEffect(() => {
    if (template) {
      setAccountType(template.type.id.toString());
      setUsage(template.usage.id.toString());
      setManualAllowed(template.manualEntriesAllowed);
      setName(template.name);
      setGlCode(template.glCode);
      setDescription(template.description || '');
      setParentId(template.parentId?.toString() || 'none');
      setTagId(template.tagId?.id?.toString() || 'none');
    }
  }, [template]);

  if (templateError) return <div className="text-red-600">Error loading account</div>;
  if (!template) return (
    <div className="flex items-center justify-center h-32 text-gray-500">
      <Loader2 className="animate-spin mr-2" />Loading...
    </div>
  );

  // Options
  const accountTypeOptions = template.accountTypeOptions || [];
  const usageOptions = template.usageOptions || [];
  const parentOptions = allData?.chartAccounts || [];
  const tagOptions = [
    ...template.allowedAssetsTagOptions,
    ...template.allowedLiabilitiesTagOptions,
    ...template.allowedEquityTagOptions,
    ...template.allowedIncomeTagOptions,
    ...template.allowedExpensesTagOptions,
  ];

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      type: Number(accountType),
      usage: Number(usage),
      name,
      glCode,
      parentId: parentId !== 'none' ? Number(parentId) : null,
      tagId: tagId !== 'none' ? Number(tagId) : null,
      manualEntriesAllowed: manualAllowed,
      description,
    };
    try {
      const res = await fetch(`/api/fineract/glaccounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { resourceId } = await res.json();
      toast({ title: 'Account Updated', description: `ID ${resourceId}` });
      router.push('/accounting/chart-of-accounts');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleUpdate} className="max-w-3xl mx-auto space-y-6 p-6 bg-white dark:bg-[#0d121f] rounded-lg shadow">
      <h2 className="text-2xl font-semibold">Edit GL Account</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">Account Type *</label>
          <Select value={accountType} onValueChange={setAccountType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {accountTypeOptions.map((opt: any) => (
                <SelectItem key={opt.id} value={opt.id.toString()}>
                  {opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Account Usage *</label>
          <Select value={usage} onValueChange={setUsage}>
            <SelectTrigger>
              <SelectValue placeholder="Select usage" />
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
        <div>
          <label className="block text-sm font-medium mb-1">GL Code *</label>
          <Input value={glCode} onChange={e => setGlCode(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Account Name *</label>
          <Input value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Parent</label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {parentOptions.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tag</label>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {tagOptions.map((t: any) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox checked={manualAllowed} onCheckedChange={v => setManualAllowed(Boolean(v))} />
          <span>Manual Entries Allowed</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={submitting} className="flex items-center gap-2">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Updating...</> : 'Update'}
        </Button>
      </div>
    </form>
  );
}
