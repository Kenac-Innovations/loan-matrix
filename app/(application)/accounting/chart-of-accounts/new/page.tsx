// File: app/(application)/accounting/chart-of-accounts/new/page.tsx

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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

  if (error) return <div className="text-red-600">Error loading template</div>;
  if (!template) return <div>Loading...</div>;

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { resourceId } = await res.json();
      toast({
        title: 'Account Created',
        description: `New GL Account ID: ${resourceId}`,
      });

      router.push('/accounting/chart-of-accounts');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message,
      });
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white dark:bg-[#0d121f] p-6 rounded-lg shadow-sm"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Account Type */}
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

        {/* Account Name */}
        <div>
          <label className="block text-sm font-medium mb-1">Account Name *</label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Account Usage */}
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

        {/* GL Code */}
        <div>
          <label className="block text-sm font-medium mb-1">GL Code *</label>
          <Input
            required
            value={glCode}
            onChange={(e) => setGlCode(e.target.value)}
          />
        </div>

        {/* Parent */}
        <div>
          <label className="block text-sm font-medium mb-1">Parent</label>
          <Select value={parent} onValueChange={setParent}>
            <SelectTrigger>
              <SelectValue placeholder="Select parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {chartAccounts.map((p: any) => (
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
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger>
              <SelectValue placeholder="Select tag" />
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

        {/* Manual Entries Allowed */}
        <div className="flex items-center">
          <Checkbox
            checked={manualAllowed}
            onCheckedChange={(v) => setManualAllowed(Boolean(v))}
          />
          <span className="ml-2">Manual Entries Allowed</span>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Submit'
          )}
        </Button>
      </div>
    </form>
  );
}
