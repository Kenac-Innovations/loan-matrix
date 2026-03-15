'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  DollarSign,
  Clock,
  User,
  Database,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  const glAccounts = glAccountsResponse?.chartAccounts || [];

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
  const { data: journalEntriesData, error, isLoading, mutate } = useSWR<JournalEntriesResponse>(
    `/api/fineract/journalentries?${queryParams}`,
    fetcher
  );

  const journalEntries = journalEntriesData?.pageItems || [];
  const totalRecords = journalEntriesData?.totalFilteredRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Auto-refresh when filters change
  useEffect(() => {
    setCurrentPage(1);
    mutate();
  }, [officeName, glAccountNameOrCode, filterType, transactionDateFrom, transactionDateTo, transactionId, submittedOnDateFrom, submittedOnDateTo, mutate]);

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
    const variants: { [key: string]: { bg: string; text: string; icon: any } } = {
      'ASSET': { 
        bg: 'bg-gradient-to-r from-blue-500 to-blue-600', 
        text: 'text-white',
        icon: TrendingUp
      },
      'LIABILITY': { 
        bg: 'bg-gradient-to-r from-orange-500 to-orange-600', 
        text: 'text-white',
        icon: TrendingDown
      },
      'EQUITY': { 
        bg: 'bg-gradient-to-r from-purple-500 to-purple-600', 
        text: 'text-white',
        icon: Database
      },
      'INCOME': { 
        bg: 'bg-gradient-to-r from-green-500 to-green-600', 
        text: 'text-white',
        icon: TrendingUp
      },
      'EXPENSE': { 
        bg: 'bg-gradient-to-r from-red-500 to-red-600', 
        text: 'text-white',
        icon: TrendingDown
      }
    };
    
    const variant = variants[accountType] || { 
      bg: 'bg-gradient-to-r from-gray-500 to-gray-600', 
      text: 'text-white',
      icon: Hash
    };
    const Icon = variant.icon;
    
    return (
      <Badge className={`${variant.bg} ${variant.text} border-0 px-3 py-1 text-xs font-medium`}>
        <Icon className="h-3 w-3 mr-1" />
        {accountType}
      </Badge>
    );
  };

  const handleViewEntry = (transactionId: string) => {
    router.push(`/accounting/journal-entries/${transactionId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="space-y-8 p-6">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl p-8 border border-white/20 dark:border-slate-700/50 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Search className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Search Journal Entries
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">
                      Advanced filtering and search for financial transactions
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {totalRecords} entries found
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 p-6 border-b border-white/20 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Filter className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Search Filters</h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm">
                  Refine your search with advanced filtering options
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-8">
            {/* First Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Office Name
                </Label>
                <Select value={officeName} onValueChange={setOfficeName}>
                  <SelectTrigger className="h-12 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl backdrop-blur-sm">
                    <SelectValue placeholder="Select office" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-slate-200 dark:border-slate-600 rounded-xl">
                    <SelectItem value="all" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                      All Offices
                    </SelectItem>
                    {offices.map(office => (
                      <SelectItem key={office.id} value={office.id.toString()} className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-200">{office.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  GL Account <span className="text-red-500">*</span>
                </Label>
                <Select value={glAccountNameOrCode} onValueChange={setGlAccountNameOrCode}>
                  <SelectTrigger className="h-12 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl backdrop-blur-sm">
                    <SelectValue placeholder="Select GL account" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-slate-200 dark:border-slate-600 rounded-xl">
                    <SelectItem value="all" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                      All Accounts
                    </SelectItem>
                    {glAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id.toString()} className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-200">{account.glCode} - {account.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Filter Type
                </Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-12 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-slate-200 dark:border-slate-600 rounded-xl">
                    <SelectItem value="All" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">All</SelectItem>
                    <SelectItem value="Manual Entries" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Manual Entries</SelectItem>
                    <SelectItem value="System Entries" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">System Entries</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Transaction Date From
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="date"
                    value={transactionDateFrom}
                    onChange={e => setTransactionDateFrom(e.target.value)}
                    className="h-12 pl-12 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl backdrop-blur-sm text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Transaction Date To
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="date"
                    value={transactionDateTo}
                    onChange={e => setTransactionDateTo(e.target.value)}
                    className="h-12 pl-12 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl backdrop-blur-sm text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Transaction ID
                </Label>
                <Input
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  placeholder="Enter transaction ID"
                  className="h-12 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl backdrop-blur-sm text-slate-700 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Third Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Submitted on Date From
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="date"
                    value={submittedOnDateFrom}
                    onChange={e => setSubmittedOnDateFrom(e.target.value)}
                    className="h-12 pl-12 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl backdrop-blur-sm text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Submitted on Date To
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="date"
                    value={submittedOnDateTo}
                    onChange={e => setSubmittedOnDateTo(e.target.value)}
                    className="h-12 pl-12 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl backdrop-blur-sm text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Journal Entries Table */}
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 p-6 border-b border-white/20 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Journal Entries</h2>
                  <p className="text-slate-600 dark:text-slate-300 text-sm">
                    {totalRecords} entries found • Page {currentPage} of {totalPages}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Loading journal entries...</span>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <div className="h-16 w-16 rounded-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <p className="text-slate-600 dark:text-slate-300">Failed to load journal entries</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Entry ID</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Office</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Transaction ID</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Transaction Date</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Type</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Created By</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Submitted on date</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Account Code</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Account Name</th>
                        <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Currency</th>
                        <th className="text-right py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Debit</th>
                        <th className="text-right py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Credit</th>
                        <th className="text-center py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journalEntries.map((entry, index) => (
                        <tr 
                          key={entry.id} 
                          className={`border-b border-slate-100 dark:border-slate-800 transition-all duration-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 ${
                            index % 2 === 0 ? 'bg-white/30 dark:bg-slate-800/30' : 'bg-slate-50/30 dark:bg-slate-700/30'
                          }`}
                        >
                          <td className="py-4 px-4">
                            <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-200">#{entry.id}</span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-700 dark:text-slate-200">{entry.officeName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-mono text-sm text-slate-600 dark:text-slate-300">{entry.transactionId}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-slate-700 dark:text-slate-200">{formatDate(entry.transactionDate)}</span>
                          </td>
                          <td className="py-4 px-4">
                            {getAccountTypeBadge(entry.glAccountType.value)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-700 dark:text-slate-200">{entry.createdByUserName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-700 dark:text-slate-200">{formatDateTime(entry.submittedOnDate)}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-200">{entry.glAccountCode}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-slate-700 dark:text-slate-200">{entry.glAccountName}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-slate-600 dark:text-slate-300">{entry.currency.code}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            {entry.entryType.value === 'DEBIT' ? (
                              <div className="flex items-center justify-end gap-2">
                                <TrendingDown className="h-4 w-4 text-red-500" />
                                <span className="font-mono text-sm font-medium text-red-600 dark:text-red-400">
                                  {entry.currency.displaySymbol} {entry.amount.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {entry.entryType.value === 'CREDIT' ? (
                              <div className="flex items-center justify-end gap-2">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <span className="font-mono text-sm font-medium text-green-600 dark:text-green-400">
                                  {entry.currency.displaySymbol} {entry.amount.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewEntry(entry.transactionId)}
                              className="h-9 w-9 p-0 rounded-xl border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <Eye className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Items per page:</span>
                    <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                      <SelectTrigger className="w-20 h-9 bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-slate-200 dark:border-slate-600 rounded-lg">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 