// File: app/(application)/accounting/chart-of-accounts/page.tsx

'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ChartOfAccountsPage() {
  const { data, error, mutate } = useSWR('/api/fineract/chart-of-accounts', fetcher);
  const accounts = data?.chartAccounts || [];

  // State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter & paginate
  const filtered = useMemo(
    () => accounts.filter((acc: any) =>
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      String(acc.glCode || acc.glcode).includes(search)
    ),
    [accounts, search]
  );
  const pageCount = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  if (error) return <div className="text-red-600">Error: {error.message}</div>;
  if (!data) return <div>Loading...</div>;

  const handleDisableToggle = async (id: number, disabled: boolean) => {
    try {
      const res = await fetch(`/api/fineract/chart-of-accounts/${id}/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !disabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: `Account ${!disabled ? 'Disabled' : 'Enabled'}` });
      mutate();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return;
    try {
      const res = await fetch(`/api/fineract/chart-of-accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: 'Account Deleted' });
      mutate();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search by name or code"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
        <Link href="/accounting/chart-of-accounts/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1">
            <Plus className="w-4 h-4" /> New Account
          </Button>
        </Link>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>GL Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((acc: any) => (
            <TableRow key={acc.id}>
              <TableCell>{acc.id}</TableCell>
              <TableCell>{acc.glCode || acc.glcode}</TableCell>
              <TableCell>{acc.name}</TableCell>
              <TableCell>{acc.description || '-'}</TableCell>
              <TableCell>{acc.classification?.toUpperCase() || '-'}</TableCell>
              <TableCell>
                <span className={`inline-block h-2 w-2 rounded-full ${acc.disabled ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="ml-1">{acc.disabled ? 'Disabled' : 'Active'}</span>
              </TableCell>
              <TableCell className="flex items-center gap-2">
                <Link href={`/accounting/chart-of-accounts/${acc.id}`}>
                  <Button variant="outline" size="sm" className="p-1">
                    <Eye className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href={`/accounting/chart-of-accounts/${acc.id}/edit`}>
                  <Button variant="outline" size="sm" className="p-1">
                    <Edit className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="p-1"
                  onClick={() => handleDisableToggle(acc.id, acc.disabled)}
                >
                  {acc.disabled ? 'Enable' : 'Disable'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="p-1"
                  onClick={() => handleDelete(acc.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page {page} of {pageCount} ({filtered.length} items)
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <Button size="sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>Next</Button>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Items" />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map(n => (
                <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
