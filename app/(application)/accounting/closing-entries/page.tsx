'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Building2,
  Calendar,
  User,
  Eye,
  Edit,
  Trash2,
  Filter,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

interface Office {
  id: number;
  name: string;
  nameDecorated: string;
  externalId?: string;
  openingDate: number[];
  hierarchy: string;
  parentId?: number;
  parentName?: string;
}

interface GLClosure {
  id: number;
  officeId: number;
  officeName: string;
  closingDate: string;
  comments: string;
  createdByUserId: number;
  createdByUsername: string;
  createdDate: string;
  lastUpdatedByUserId: number;
  lastUpdatedByUsername: string;
  lastUpdatedDate: string;
  deleted: boolean;
}

export default function ClosingEntriesPage() {
  const [closures, setClosures] = useState<GLClosure[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [selectedOffice]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch offices
      const officesResponse = await fetch('/api/fineract/offices?orderBy=id');
      const officesData = await officesResponse.json();
      setOffices(officesData);

      // Fetch closures with optional office filter
      let closuresUrl = '/api/fineract/glclosures';
      if (selectedOffice && selectedOffice !== 'all') {
        closuresUrl += `?officeId=${selectedOffice}`;
      }
      
      const closuresResponse = await fetch(closuresUrl);
      const closuresData = await closuresResponse.json();
      setClosures(closuresData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load closing entries. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter closures based on search term
  const filteredClosures = closures.filter(closure => {
    const searchLower = searchTerm.toLowerCase();
    return (
      closure.officeName.toLowerCase().includes(searchLower) ||
      closure.comments.toLowerCase().includes(searchLower) ||
      closure.createdByUsername.toLowerCase().includes(searchLower) ||
      closure.closingDate.includes(searchLower)
    );
  });

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this closing entry? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/fineract/glclosures/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || 'Failed to delete closing entry');
      }

      toast({
        title: "Success",
        description: "Closing entry deleted successfully.",
        variant: "success"
      });

      // Refresh the list
      fetchData();
    } catch (error: any) {
      console.error('Error deleting closure:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete closing entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Closing Entries</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage GL closures and period-end procedures
            </p>
          </div>
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-32 animate-pulse"></div>
        </div>

        {/* Filters */}
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full animate-pulse"></div>
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 animate-pulse"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 animate-pulse"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6 animate-pulse"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Closing Entries</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage GL closures and period-end procedures
          </p>
        </div>
        <Link href="/accounting/closing-entries/new">
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Create Closure
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4" />
              <Input
                placeholder="Search by office, comments, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
              />
            </div>
                          <Select
                value={selectedOffice}
                onValueChange={setSelectedOffice}
              >
                <SelectTrigger className="w-48 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
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
            <Button
              variant="outline"
              onClick={fetchData}
              className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Closing Entries ({filteredClosures.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClosures.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No closing entries found
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {searchTerm || (selectedOffice && selectedOffice !== 'all')
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by creating your first closing entry.'
                }
              </p>
              {!searchTerm && (selectedOffice === 'all' || !selectedOffice) && (
                <Link href="/accounting/closing-entries/new">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Closure
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-700">
                    <TableHead className="text-slate-700 dark:text-slate-300 font-medium">Office</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 font-medium">Closure Date</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 font-medium">Comments</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 font-medium">Created By</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 font-medium text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClosures.map((closure) => (
                    <TableRow key={closure.id} className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="font-medium">{closure.officeName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span>{formatDate(closure.closingDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {closure.comments || 'No comments'}
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span>{closure.createdByUsername}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/accounting/closing-entries/${closure.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/accounting/closing-entries/${closure.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(closure.id)}
                            disabled={isDeleting === closure.id}
                            className="h-8 w-8 p-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="w-4 h-4" />
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