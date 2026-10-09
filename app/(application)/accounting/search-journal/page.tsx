'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  Search,
  Filter,
  Calendar,
  Building2,
  Hash,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Database,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SearchableSelect, type Option } from '@/components/searchable-select';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Office {
  id: number;
  name: string;
  nameDecorated: string;
}

interface GlAccount {
  id: number;
  name: string;
  glCode: string;
  nameDecorated: string;
}

interface JournalEntry {
  id: number;
  officeId: number;
  officeName: string;
  glAccountName: string;
  glAccountId: number;
  glAccountCode: string;
  glAccountType: {
    id: number;
    code: string;
    value: string;
  };
  transactionDate: number[];
  entryType: {
    id: number;
    code: string;
    value: string;
  };
  amount: number;
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displaySymbol: string;
    nameCode: string;
    displayLabel: string;
  };
  transactionId: string;
  manualEntry: boolean;
  entityType?: {
    id: number;
    code: string;
    value: string;
  };
  entityId?: number;
  createdByUserId: number;
  createdDate: number[];
  createdByUserName: string;
  reversed: boolean;
  submittedOnDate: number[];
}

interface JournalEntriesResponse {
  totalFilteredRecords: number;
  pageItems: JournalEntry[];
}

interface GlAccountsResponse {
  chartAccounts: GlAccount[];
}

export default function SearchJournalPage() {
  const router = useRouter();

  // Filter states
  const [officeName, setOfficeName] = useState('');
  const [glAccountNameOrCode, setGlAccountNameOrCode] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [transactionDateFrom, setTransactionDateFrom] = useState(() => format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), 'yyyy-MM-dd'));
  const [transactionDateTo, setTransactionDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [transactionId, setTransactionId] = useState('');
  const [submittedOnDateFrom, setSubmittedOnDateFrom] = useState('');
  const [submittedOnDateTo, setSubmittedOnDateTo] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Fetch offices and GL accounts
  const { data: offices = [] } = useSWR<Office[]>('/api/fineract/offices?orderBy=id', fetcher);
  const { data: glAccountsResponse, error: glAccountsError } = useSWR<GlAccountsResponse>('/api/fineract/glaccounts?manualEntriesAllowed=true&usage=1&disabled=false', fetcher);

  // Ensure glAccounts is always an array
  const glAccounts = useMemo(
    () => glAccountsResponse?.chartAccounts ?? [],
    [glAccountsResponse?.chartAccounts]
  );
  const glAccountOptions = useMemo<Option[]>(
    () => [
      { value: 'all', label: 'All Accounts' },
      ...glAccounts.map((account) => ({
        value: account.id.toString(),
        label: `${account.glCode} - ${account.name}`,
      })),
    ],
    [glAccounts]
  );

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();

    // Pagination
    const offset = (currentPage - 1) * pageSize;
    params.append('offset', offset.toString());
    params.append('limit', pageSize.toString());
    params.append('sortOrder', '');
    params.append('orderBy', '');

    // Date format
    params.append('dateFormat', 'dd MMMM yyyy');
    params.append('locale', 'en');

    // Filters
    if (officeName && officeName !== 'all') params.append('officeId', officeName);
    if (glAccountNameOrCode && glAccountNameOrCode !== 'all') params.append('glAccountId', glAccountNameOrCode);
    if (transactionDateFrom) params.append('fromDate', format(new Date(transactionDateFrom), 'dd MMMM yyyy'));
    if (transactionDateTo) params.append('toDate', format(new Date(transactionDateTo), 'dd MMMM yyyy'));
    if (transactionId) params.append('transactionId', transactionId);
    if (submittedOnDateFrom) params.append('submittedOnDateFrom', format(new Date(submittedOnDateFrom), 'dd MMMM yyyy'));
    if (submittedOnDateTo) params.append('submittedOnDateTo', format(new Date(submittedOnDateTo), 'dd MMMM yyyy'));

    // Filter type
    if (filterType === 'Manual Entries') params.append('manualEntriesOnly', 'true');
    if (filterType === 'System Entries') params.append('manualEntriesOnly', 'false');

    return params.toString();
  }, [currentPage, pageSize, officeName, glAccountNameOrCode, filterType, transactionDateFrom, transactionDateTo, transactionId, submittedOnDateFrom, submittedOnDateTo]);

  // Fetch journal entries
  const { data: journalEntriesData, error, isLoading } = useSWR<JournalEntriesResponse>(
    `/api/fineract/journalentries?${queryParams}`,
    fetcher
  );

  const journalEntries = journalEntriesData?.pageItems || [];
  const totalRecords = journalEntriesData?.totalFilteredRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  const updateFilter = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (value: string) => {
      setCurrentPage(1);
      setter(value);
    };
  };

  const handleOfficeChange = updateFilter(setOfficeName);
  const handleGlAccountChange = updateFilter(setGlAccountNameOrCode);
  const handleFilterTypeChange = updateFilter(setFilterType);
  const handleTransactionDateFromChange = updateFilter(setTransactionDateFrom);
  const handleTransactionDateToChange = updateFilter(setTransactionDateTo);
  const handleTransactionIdChange = updateFilter(setTransactionId);
  const handleSubmittedOnDateFromChange = updateFilter(setSubmittedOnDateFrom);
  const handleSubmittedOnDateToChange = updateFilter(setSubmittedOnDateTo);

  const handlePageSizeChange = (value: string) => {
    setCurrentPage(1);
    setPageSize(Number(value));
  };

  const formatDate = (dateArray: number[]) => {
    if (dateArray.length >= 3) {
      const [year, month, day] = dateArray;
      return format(new Date(year, month - 1, day), 'dd MMMM yyyy');
    }
    return 'N/A';
  };

  const formatDateTime = (dateArray: number[]) => {
    if (dateArray.length >= 3) {
      const [year, month, day] = dateArray;
      return format(new Date(year, month - 1, day), 'dd MMMM yyyy HH:mm:ss');
    }
    return 'N/A';
  };

  const getAccountTypeBadge = (accountType: string) => {
    const variants: Record<string, { className: string; icon: LucideIcon }> = {
      'ASSET': {
        className: 'bg-blue-500/20 text-blue-500',
        icon: TrendingUp
      },
      'LIABILITY': {
        className: 'bg-orange-500/20 text-orange-500',
        icon: TrendingDown
      },
      'EQUITY': {
        className: 'bg-purple-500/20 text-purple-500',
        icon: Database
      },
      'INCOME': {
        className: 'bg-green-500/20 text-green-500',
        icon: TrendingUp
      },
      'EXPENSE': {
        className: 'bg-red-500/20 text-red-500',
        icon: TrendingDown
      }
    };

    const variant = variants[accountType] || {
      className: 'bg-muted text-muted-foreground',
      icon: Hash
    };
    const Icon = variant.icon;

    return (
      <Badge variant="outline" className={`${variant.className} border-0 px-3 py-1 text-xs font-medium`}>
        <Icon className="h-3 w-3 mr-1" />
        {accountType}
      </Badge>
    );
  };

  const handleViewEntry = (transactionId: string) => {
    router.push(`/accounting/journal-entries/${transactionId}`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Search Journal Entries
            </h1>
            <p className="text-muted-foreground mt-1">
              Advanced filtering and search for financial transactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {totalRecords} entries found
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Filter className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Search Filters</CardTitle>
              <CardDescription>
                Refine your search with advanced filtering options
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Office Name
              </Label>
              <Select value={officeName} onValueChange={handleOfficeChange}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Offices
                  </SelectItem>
                  {offices.map(office => (
                    <SelectItem key={office.id} value={office.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{office.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                GL Account <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={glAccountOptions}
                value={glAccountNameOrCode}
                onValueChange={handleGlAccountChange}
                placeholder="Select GL account"
                emptyMessage={glAccountsError ? "Unable to load GL accounts." : "No GL accounts found."}
                className="h-12"
              />
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Filter Type
              </Label>
              <Select value={filterType} onValueChange={handleFilterTypeChange}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Manual Entries">Manual Entries</SelectItem>
                  <SelectItem value="System Entries">System Entries</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Transaction Date From
              </Label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="date"
                  value={transactionDateFrom}
                  onChange={e => handleTransactionDateFromChange(e.target.value)}
                  className="h-12 pl-12"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Transaction Date To
              </Label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="date"
                  value={transactionDateTo}
                  onChange={e => handleTransactionDateToChange(e.target.value)}
                  className="h-12 pl-12"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Transaction ID
              </Label>
              <Input
                value={transactionId}
                onChange={e => handleTransactionIdChange(e.target.value)}
                placeholder="Enter transaction ID"
                className="h-12"
              />
            </div>
          </div>

          {/* Third Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Submitted on Date From
              </Label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="date"
                  value={submittedOnDateFrom}
                  onChange={e => handleSubmittedOnDateFromChange(e.target.value)}
                  className="h-12 pl-12"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Submitted on Date To
              </Label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="date"
                  value={submittedOnDateTo}
                  onChange={e => handleSubmittedOnDateToChange(e.target.value)}
                  className="h-12 pl-12"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Journal Entries</CardTitle>
              <CardDescription>
                {totalRecords} entries found • Page {currentPage} of {totalPages}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Loading journal entries...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground">Failed to load journal entries</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Entry ID</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Office</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Transaction ID</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Transaction Date</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Created By</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Submitted on date</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Account Code</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Account Name</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Currency</th>
                      <th className="text-right py-4 px-4 font-medium text-muted-foreground">Debit</th>
                      <th className="text-right py-4 px-4 font-medium text-muted-foreground">Credit</th>
                      <th className="text-center py-4 px-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntries.map((entry, index) => (
                      <tr
                        key={entry.id}
                        className={`border-b transition-colors hover:bg-muted/50 ${
                          index % 2 !== 0 ? 'bg-muted/50' : ''
                        }`}
                      >
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm font-medium text-foreground">#{entry.id}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{entry.officeName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm text-muted-foreground">{entry.transactionId}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-foreground">{formatDate(entry.transactionDate)}</span>
                        </td>
                        <td className="py-4 px-4">
                          {getAccountTypeBadge(entry.glAccountType.value)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{entry.createdByUserName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{formatDateTime(entry.submittedOnDate)}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm font-medium text-foreground">{entry.glAccountCode}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-foreground">{entry.glAccountName}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-muted-foreground">{entry.currency.code}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {entry.entryType.value === 'DEBIT' ? (
                            <div className="flex items-center justify-end gap-2">
                              <TrendingDown className="h-4 w-4 text-red-500" />
                              <span className="font-mono text-sm font-medium text-red-500">
                                {entry.currency.displaySymbol} {entry.amount.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {entry.entryType.value === 'CREDIT' ? (
                            <div className="flex items-center justify-end gap-2">
                              <TrendingUp className="h-4 w-4 text-green-500" />
                              <span className="font-mono text-sm font-medium text-green-500">
                                {entry.currency.displaySymbol} {entry.amount.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewEntry(entry.transactionId)}
                            className="h-9 w-9 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Items per page:</span>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="w-20 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
