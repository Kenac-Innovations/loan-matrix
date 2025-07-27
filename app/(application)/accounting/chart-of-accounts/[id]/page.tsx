'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ViewAccountPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: account, error, mutate } = useSWR(
    `/api/fineract/glaccounts/${id}?template=true`, fetcher
  );

  if (error) return <div className="text-red-600">Error loading account</div>;
  if (!account) return <div className="flex items-center justify-center h-32 text-gray-500"><Loader2 className="animate-spin mr-2" />Loading...</div>;

  const {
    name,
    glCode,
    disabled,
    manualEntriesAllowed,
    type,
    usage,
    description,
  } = account;

  const handleDisableToggle = async () => {
    try {
      const res = await fetch(`/api/fineract/glaccounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !disabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: `Account ${disabled ? 'Enabled' : 'Disabled'}` });
      mutate();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this account?')) return;
    try {
      const res = await fetch(`/api/fineract/glaccounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: 'Account Deleted' });
      router.push('/accounting/chart-of-accounts');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Account Details</h1>
        <div className="flex space-x-2">
          <Link href={`/accounting/chart-of-accounts/${id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button variant="outline" onClick={handleDisableToggle}>
            {disabled ? 'Enable' : 'Disable'}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </div>
      <hr className="border-gray-200 dark:border-gray-700" />
      <Card className="shadow-lg">
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500">Account Type</p>
            <p className="mt-1 text-lg font-medium">{type.value}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">GL Code</p>
            <p className="mt-1 text-lg font-medium">{glCode}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Account Usage</p>
            <p className="mt-1 text-lg font-medium">{usage.value}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Manual Entries Allowed</p>
            <p className="mt-1 text-lg font-medium">{manualEntriesAllowed ? 'Yes' : 'No'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-gray-500">Description</p>
            <p className="mt-1 text-lg font-medium">{description || '-'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
