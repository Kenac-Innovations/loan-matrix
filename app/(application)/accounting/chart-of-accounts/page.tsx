// File: app/(application)/accounting/chart-of-accounts/page.tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Plus, Eye, BookOpen } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ChartOfAccountsPage() {
  const { data, error, mutate } = useSWR('/api/fineract/chart-of-accounts', fetcher);
  const accounts = data?.chartAccounts || [];

  // State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  // Show welcome notification on first load
  useEffect(() => {
    if (data && !hasShownWelcome && accounts.length > 0) {
      const activeAccounts = accounts.filter((acc: any) => !acc.disabled).length;
      const disabledAccounts = accounts.filter((acc: any) => acc.disabled).length;
      
      toast({
        title: 'Chart of Accounts Loaded! 📊',
        description: (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Account Overview</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>Total Accounts: <span className="font-mono bg-muted px-1 rounded">{accounts.length}</span></div>
              <div>Active: <span className="text-green-600 font-medium">{activeAccounts}</span></div>
              <div>Disabled: <span className="text-orange-600 font-medium">{disabledAccounts}</span></div>
            </div>
          </div>
        ),
        variant: 'info',
        action: {
          label: 'Create New Account',
          onClick: () => window.location.href = '/accounting/chart-of-accounts/new',
        },
      });
      
      setHasShownWelcome(true);
    }
  }, [data, accounts, hasShownWelcome]);

  // Filter & paginate
  const filtered = useMemo(
    () =>
      accounts.filter((acc: any) =>
        acc.name.toLowerCase().includes(search.toLowerCase()) ||
        String(acc.glCode || acc.glcode).includes(search)
      ),
    [accounts, search]
  );
  const pageCount = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(
    () =>
      filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  if (error) {
    toast({
      title: 'Failed to Load Chart of Accounts',
      description: 'Please refresh the page or contact support if the problem persists.',
      variant: 'destructive',
    });
    return <div className="text-red-600">Error: {error.message}</div>;
  }
  
  if (!data) return <div>Loading...</div>;

  // --- UPDATED TYPE COLORS MAP ---
  const typeColors: Record<string, string> = {
    ASSET:     'text-green-600',
    LIABILITY: 'text-yellow-600',
    INCOME:    'text-indigo-600',
    REVENUE:   'text-indigo-600', // if you still receive REVENUE keys
    EQUITY:    'text-blue-600',
    EXPENSE:   'text-red-600',
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name or code"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-64"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              toast({
                title: 'Notification System Demo! 🎉',
                description: (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Modern Notifications</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>✅ Success notifications with icons</div>
                      <div>⚠️ Warning notifications with actions</div>
                      <div>❌ Error notifications with details</div>
                      <div>ℹ️ Info notifications with rich content</div>
                    </div>
                  </div>
                ),
                variant: 'info',
                action: {
                  label: 'Learn More',
                  onClick: () => window.open('https://sonner.emilkowal.ski/', '_blank'),
                },
              });
            }}
          >
            Test Notifications
          </Button>
        </div>
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
            <TableHead>GL Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((acc: any) => {
            const typeKey = (acc.type?.value || '').toUpperCase();
            const typeClass = typeColors[typeKey] || 'text-gray-600';
            return (
              <TableRow key={acc.id}>
                <TableCell>{acc.glCode || acc.glcode}</TableCell>
                <TableCell>{acc.name}</TableCell>
                <TableCell>{acc.description || '-'}</TableCell>

                {/* Color‐coded Type */}
                <TableCell>
                  <span className={`${typeClass} font-medium`}>
                    {typeKey || '-'}
                  </span>
                </TableCell>

                <TableCell>{acc.usage?.value.toUpperCase() || '-'}</TableCell>

                {/* Rippling Status Dot */}
                <TableCell>
                  <div className="relative inline-flex items-center">
                    {!acc.disabled && (
                      <span className="absolute inline-flex h-3 w-3 rounded-full bg-green-500 opacity-75 animate-ping" />
                    )}
                    <span
                      className={`relative inline-block h-3 w-3 rounded-full ${
                        acc.disabled ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    />
                    <span className="ml-2 text-sm">
                      {acc.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="flex items-center gap-2">
                  <Link href={`/accounting/chart-of-accounts/${acc.id}`}>
                    <Button variant="outline" size="sm" className="p-1">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page {page} of {pageCount} ({filtered.length} items)
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Prev
          </Button>
          <Button size="sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
          <Select
            value={String(pageSize)}
            onValueChange={v => { setPageSize(Number(v)); setPage(1); }}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Items" />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map(n => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
