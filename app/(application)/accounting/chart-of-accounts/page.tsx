// File: app/(application)/accounting/chart-of-accounts/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Eye,
  Search,
  Filter,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Pencil,
  Download,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

type SortKey = 'glCode' | 'name' | 'type';

interface GlAccount {
  id: number;
  name: string;
  glCode?: string;
  glcode?: string;
  parentId?: number | null;
  description?: string;
  disabled?: boolean;
  manualEntriesAllowed?: boolean;
  type?: { value?: string };
  usage?: { value?: string };
}

interface TreeRow {
  acc: GlAccount;
  depth: number;
  hasChildren: boolean;
}

const typeConfig: Record<string, string> = {
  ASSET: 'text-emerald-500 bg-emerald-500/15 border-emerald-500/30',
  LIABILITY: 'text-amber-500 bg-amber-500/15 border-amber-500/30',
  INCOME: 'text-blue-500 bg-blue-500/15 border-blue-500/30',
  REVENUE: 'text-blue-500 bg-blue-500/15 border-blue-500/30',
  EQUITY: 'text-purple-500 bg-purple-500/15 border-purple-500/30',
  EXPENSE: 'text-red-500 bg-red-500/15 border-red-500/30',
};

const glCodeOf = (acc: GlAccount) => String(acc.glCode ?? acc.glcode ?? '');
const typeOf = (acc: GlAccount) => (acc.type?.value || '').toUpperCase();

function compareAccounts(a: GlAccount, b: GlAccount, key: SortKey, dir: 1 | -1) {
  let av: string;
  let bv: string;
  if (key === 'name') {
    av = a.name || '';
    bv = b.name || '';
  } else if (key === 'type') {
    av = typeOf(a);
    bv = typeOf(b);
  } else {
    av = glCodeOf(a);
    bv = glCodeOf(b);
  }
  return av.localeCompare(bv, undefined, { numeric: true }) * dir;
}

function SortIcon({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) return null;
  return dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function toCsvCell(value: unknown) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ChartOfAccountsPage() {
  const router = useRouter();
  const { data, error } = useSWR('/api/fineract/chart-of-accounts', fetcher);
  const accounts: GlAccount[] = useMemo(
    () => (Array.isArray(data?.chartAccounts) ? data.chartAccounts : []),
    [data]
  );

  // State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('glCode');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const isFiltering =
    search.trim() !== '' || filterType !== 'all' || filterStatus !== 'all';

  // Build rows: hierarchical tree when browsing, flat list when filtering
  const rows: TreeRow[] = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorter = (a: GlAccount, b: GlAccount) => compareAccounts(a, b, sortKey, sortDir);

    if (isFiltering) {
      return accounts
        .filter(acc => {
          const matchesSearch =
            !term ||
            (acc.name || '').toLowerCase().includes(term) ||
            glCodeOf(acc).toLowerCase().includes(term);
          const matchesType =
            filterType === 'all' || typeOf(acc) === filterType.toUpperCase();
          const matchesStatus =
            filterStatus === 'all' ||
            (filterStatus === 'active' ? !acc.disabled : !!acc.disabled);
          return matchesSearch && matchesType && matchesStatus;
        })
        .sort(sorter)
        .map(acc => ({ acc, depth: 0, hasChildren: false }));
    }

    const ids = new Set(accounts.map(acc => acc.id));
    const childrenOf = new Map<number, GlAccount[]>();
    const roots: GlAccount[] = [];
    for (const acc of accounts) {
      const parentId = acc.parentId;
      if (parentId != null && ids.has(parentId) && parentId !== acc.id) {
        if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
        childrenOf.get(parentId)!.push(acc);
      } else {
        roots.push(acc);
      }
    }

    const out: TreeRow[] = [];
    const visited = new Set<number>();
    const walk = (list: GlAccount[], depth: number) => {
      for (const acc of [...list].sort(sorter)) {
        if (visited.has(acc.id)) continue;
        visited.add(acc.id);
        const kids = childrenOf.get(acc.id) || [];
        out.push({ acc, depth, hasChildren: kids.length > 0 });
        if (kids.length && !collapsed.has(acc.id)) walk(kids, depth + 1);
      }
    };
    walk(roots, 0);
    return out;
  }, [accounts, search, filterType, filterStatus, sortKey, sortDir, collapsed, isFiltering]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginated = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stats
  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter(acc => !acc.disabled).length;
    const types = new Set(accounts.map(acc => typeOf(acc) || 'UNKNOWN'));
    return { total, active, disabled: total - active, types: types.size };
  }, [accounts]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const toggleCollapsed = (id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const header = ['GL Code', 'Name', 'Type', 'Usage', 'Manual Entries', 'Status', 'Description'];
    const lines = rows.map(({ acc }) =>
      [
        glCodeOf(acc),
        acc.name,
        typeOf(acc),
        acc.usage?.value || '',
        acc.manualEntriesAllowed ? 'Yes' : 'No',
        acc.disabled ? 'Disabled' : 'Active',
        acc.description || '',
      ]
        .map(toCsvCell)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chart-of-accounts.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-destructive font-medium">Error loading accounts</div>
            <div className="text-sm text-destructive mt-1">{error.message}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-10 rounded-lg bg-muted animate-pulse" />
        <div className="rounded-lg border border-border">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-11 border-b border-border last:border-0 px-4 flex items-center">
              <div className="h-3 bg-muted rounded w-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statTiles = [
    { label: 'Total Accounts', value: stats.total, color: 'text-blue-500' },
    { label: 'Active', value: stats.active, color: 'text-emerald-500' },
    { label: 'Disabled', value: stats.disabled, color: 'text-red-500' },
    { label: 'Types', value: stats.types, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage your general ledger accounts and financial structure
          </p>
        </div>
        <Link href="/accounting/chart-of-accounts/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Account
          </Button>
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statTiles.map(tile => (
          <div key={tile.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className={`text-xs font-medium ${tile.color}`}>{tile.label}</p>
            <p className="text-xl font-bold text-foreground">{tile.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search accounts by name or code..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={filterType}
          onValueChange={v => {
            setFilterType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
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
        <Select
          value={filterStatus}
          onValueChange={v => {
            setFilterStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Accounts table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-28">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort('glCode')}
                >
                  GL Code <SortIcon active={sortKey === 'glCode'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort('name')}
                >
                  Account Name <SortIcon active={sortKey === 'name'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="w-32">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort('type')}
                >
                  Type <SortIcon active={sortKey === 'type'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="w-24">Usage</TableHead>
              <TableHead className="w-28 text-center">Manual Entries</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No accounts match your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(({ acc, depth, hasChildren }) => {
                const typeKey = typeOf(acc);
                const isHeader = (acc.usage?.value || '').toUpperCase() === 'HEADER';
                const isCollapsed = collapsed.has(acc.id);
                return (
                  <TableRow
                    key={acc.id}
                    className="group cursor-pointer"
                    onClick={() => router.push(`/accounting/chart-of-accounts/${acc.id}`)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {glCodeOf(acc)}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-1 min-w-0"
                        style={{ paddingLeft: depth * 20 }}
                      >
                        {hasChildren ? (
                          <button
                            type="button"
                            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground flex-shrink-0"
                            onClick={e => {
                              e.stopPropagation();
                              toggleCollapsed(acc.id);
                            }}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          !isFiltering && <span className="w-5 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div
                            className={`truncate text-foreground ${isHeader ? 'font-semibold' : ''}`}
                          >
                            {acc.name}
                          </div>
                          {acc.description && (
                            <div className="truncate text-xs text-muted-foreground">
                              {acc.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          typeConfig[typeKey] || 'text-muted-foreground bg-muted border-border'
                        }`}
                      >
                        {typeKey ? typeKey.charAt(0) + typeKey.slice(1).toLowerCase() : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {acc.usage?.value
                        ? acc.usage.value.charAt(0).toUpperCase() +
                          acc.usage.value.slice(1).toLowerCase()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {acc.manualEntriesAllowed ? (
                        <Check className="h-4 w-4 text-emerald-500 inline" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            acc.disabled ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                        />
                        <span className={acc.disabled ? 'text-red-500' : 'text-foreground'}>
                          {acc.disabled ? 'Disabled' : 'Active'}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Link href={`/accounting/chart-of-accounts/${acc.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="More actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/accounting/chart-of-accounts/${acc.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/accounting/chart-of-accounts/${acc.id}/edit`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Footer / pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3">
          <div className="text-sm text-muted-foreground">
            {rows.length === 0
              ? 'No accounts'
              : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(
                  currentPage * pageSize,
                  rows.length
                )} of ${rows.length} ${isFiltering ? 'matching ' : ''}accounts`}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={v => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map(n => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {currentPage} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              aria-label="Next page"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
