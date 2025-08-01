// File: app/(application)/accounting/chart-of-accounts/page.tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Plus, 
  Eye, 
  BookOpen, 
  Search, 
  Filter,
  Hash,
  FileText,
  TrendingUp,
  TrendingDown,
  Circle,
  MoreHorizontal,
  ArrowRight,
  Calendar,
  Tag
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ChartOfAccountsPage() {
  const { data, error, mutate } = useSWR('/api/fineract/chart-of-accounts', fetcher);
  const accounts = data?.chartAccounts || [];

  // State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [filterType, setFilterType] = useState('all');

  // Filter & paginate
  const filtered = useMemo(
    () =>
      accounts.filter((acc: any) => {
        const matchesSearch = acc.name.toLowerCase().includes(search.toLowerCase()) ||
          String(acc.glCode || acc.glcode).includes(search);
        const matchesType = filterType === 'all' || 
          (acc.type?.value?.toUpperCase() === filterType.toUpperCase());
        return matchesSearch && matchesType;
      }),
    [accounts, search, filterType]
  );
  const pageCount = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(
    () =>
      filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  // Stats
  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((acc: any) => !acc.disabled).length;
    const disabled = total - active;
    const types = accounts.reduce((acc: any, curr: any) => {
      const type = curr.type?.value?.toUpperCase() || 'UNKNOWN';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return { total, active, disabled, types };
  }, [accounts]);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-red-600 font-medium">Error loading accounts</div>
            <div className="text-sm text-red-500 mt-1">{error.message}</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Type configuration
  const typeConfig: Record<string, { color: string; bgColor: string; icon: any }> = {
    ASSET: { color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: TrendingUp },
    LIABILITY: { color: 'text-amber-600', bgColor: 'bg-amber-50', icon: TrendingDown },
    INCOME: { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: TrendingUp },
    REVENUE: { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: TrendingUp },
    EQUITY: { color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Circle },
    EXPENSE: { color: 'text-red-600', bgColor: 'bg-red-50', icon: TrendingDown },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage your general ledger accounts and financial structure
          </p>
        </div>
        <Link href="/accounting/chart-of-accounts/new">
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
            <Plus className="w-4 h-4 mr-2" /> 
            New Account
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Accounts</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600">Active</p>
                <p className="text-2xl font-bold text-emerald-900">{stats.active}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Circle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-pink-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Disabled</p>
                <p className="text-2xl font-bold text-red-900">{stats.disabled}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <Circle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Types</p>
                <p className="text-2xl font-bold text-purple-900">{Object.keys(stats.types).length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Tag className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search accounts by name or code..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <Select
              value={filterType}
              onValueChange={v => { setFilterType(v); setPage(1); }}
            >
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="liability">Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Grid */}
      <div className="space-y-2">
        {paginated.map((acc: any) => {
          const typeKey = (acc.type?.value || '').toUpperCase();
          const config = typeConfig[typeKey] || { color: 'text-gray-600', bgColor: 'bg-gray-50', icon: FileText };
          const IconComponent = config.icon;
          
          return (
            <Card key={acc.id} className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border-0 bg-white/50 backdrop-blur-sm hover:bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Icon with gradient background */}
                  <div className={`h-10 w-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow duration-300`}>
                    <IconComponent className={`h-5 w-5 ${config.color}`} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Title and Description */}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate group-hover:text-primary transition-colors duration-300">
                            {acc.name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {acc.description || 'General ledger account'}
                          </p>
                        </div>
                        
                        {/* GL Code with modern styling */}
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3 w-3 text-gray-400" />
                          <span className="text-xs font-mono text-gray-600 bg-gray-100/80 px-2.5 py-1 rounded-md border border-gray-200/50 flex-shrink-0">
                            {acc.glCode || acc.glcode}
                          </span>
                        </div>
                      </div>
                      
                      {/* Right side info with enhanced badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Type Badge with gradient */}
                        <Badge 
                          variant="outline" 
                          className={`text-xs h-6 px-3 ${config.color} border-current bg-gradient-to-r ${config.bgColor} hover:shadow-sm transition-all duration-200`}
                        >
                          {typeKey}
                        </Badge>
                        
                        {/* Usage Badge */}
                        {acc.usage?.value && (
                          <Badge 
                            variant="secondary" 
                            className="text-xs h-6 px-3 bg-gray-100/80 hover:bg-gray-200/80 transition-colors duration-200"
                          >
                            {acc.usage.value.toUpperCase()}
                          </Badge>
                        )}
                        
                        {/* Status Badge with animation */}
                        <div className="relative">
                          {!acc.disabled && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          )}
                          <Badge 
                            variant={acc.disabled ? "destructive" : "default"}
                            className={`text-xs h-6 px-3 ${acc.disabled ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'} border transition-all duration-200`}
                          >
                            {acc.disabled ? 'Disabled' : 'Active'}
                          </Badge>
                        </div>
                        
                        {/* Action button with enhanced styling */}
                        <Link href={`/accounting/chart-of-accounts/${acc.id}`}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary/10 hover:text-primary rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} accounts
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={page <= 1} 
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        size="sm"
                        variant={page === pageNum ? "default" : "outline"}
                        onClick={() => setPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={page >= pageCount} 
                  onClick={() => setPage(p => p + 1)}
                >
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
                    {[6, 12, 24, 48].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
