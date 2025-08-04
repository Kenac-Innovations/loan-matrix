'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Filter, Settings, Eye, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { FineractAccountingRule } from '@/lib/fineract-api';

interface Office {
  id: number;
  name: string;
}

export default function AccountingRulesPage() {
  const [accountingRules, setAccountingRules] = useState<FineractAccountingRule[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);


  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [selectedOffice]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch offices
      const officesResponse = await fetch('/api/fineract/offices?orderBy=id');
      if (!officesResponse.ok) {
        throw new Error(`Failed to fetch offices: ${officesResponse.status}`);
      }
      const officesData = await officesResponse.json();
      setOffices(officesData);

      // Fetch accounting rules with optional office filter
      let rulesUrl = '/api/fineract/accountingrules';
      if (selectedOffice && selectedOffice !== 'all') {
        rulesUrl += `?officeId=${selectedOffice}`;
      }
      
      const rulesResponse = await fetch(rulesUrl);
      if (!rulesResponse.ok) {
        throw new Error(`Failed to fetch accounting rules: ${rulesResponse.status}`);
      }
      const rulesData = await rulesResponse.json();
      
      // Ensure we have an array, even if empty
      if (Array.isArray(rulesData)) {
        setAccountingRules(rulesData);
      } else if (rulesData.error) {
        throw new Error(rulesData.error);
      } else {
        setAccountingRules([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load accounting rules';
      toast({
        title: "Error",
        description: errorMessage.includes('500') 
          ? "Unable to connect to the accounting system. Please check your connection and try again."
          : errorMessage,
        variant: "destructive"
      });
      // Set empty arrays to prevent map errors
      setOffices([]);
      setAccountingRules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this accounting rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/fineract/accountingrules/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Accounting rule deleted successfully.",
        });
        fetchData(); // Refresh the list
      } else {
        throw new Error('Failed to delete accounting rule');
      }
    } catch (error) {
      console.error('Error deleting accounting rule:', error);
      toast({
        title: "Error",
        description: "Failed to delete accounting rule. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Filter accounting rules based on search term
  const filteredRules = Array.isArray(accountingRules) ? accountingRules.filter(rule =>
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.officeName.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const getAccountNames = (accounts?: any[]) => {
    if (!accounts || accounts.length === 0) return '—';
    return accounts.map(acc => acc.name).join(', ');
  };

  const getTagNames = (tags?: any[]) => {
    if (!tags || tags.length === 0) return '—';
    return tags.map(tag => tag.tag?.name || tag.name).join(', ');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Accounting Rules
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure automatic journal entry rules and account mappings
          </p>
        </div>
        <Link href="/accounting/accounting-rules/new">
          <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search rules by name, description, or office..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={selectedOffice}
                onValueChange={setSelectedOffice}
              >
                <SelectTrigger className="w-full bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                  <Filter className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" />
                  <SelectValue placeholder="Filter by office" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                  <SelectItem value="all" className="text-slate-900 dark:text-slate-100">
                    All Offices
                  </SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id.toString()} className="text-slate-900 dark:text-slate-100">
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Accounting Rules
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            {filteredRules.length} rule{filteredRules.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No accounting rules found
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {searchTerm || (selectedOffice && selectedOffice !== 'all')
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by creating your first accounting rule.'
                }
              </p>
              {!searchTerm && (selectedOffice === 'all' || !selectedOffice) && (
                <Link href="/accounting/accounting-rules/new">
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Rule
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-700">
                    <TableHead className="text-slate-900 dark:text-slate-100">Name</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100">Office</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100">Debit Tags</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100">Debit Account</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100">Credit Tags</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100">Credit Account</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <TableRow key={rule.id} className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        <div>
                          <div className="font-semibold">{rule.name}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">{rule.description}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        {rule.officeName}
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        {getTagNames(rule.debitTags)}
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        {getAccountNames(rule.debitAccounts)}
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        {getTagNames(rule.creditTags)}
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        {getAccountNames(rule.creditAccounts)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/accounting/accounting-rules/${rule.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/accounting/accounting-rules/${rule.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 