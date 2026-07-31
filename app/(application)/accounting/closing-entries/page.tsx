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
            <h1 className="text-2xl font-bold text-foreground">Closing Entries</h1>
            <p className="text-muted-foreground mt-1">
              Manage GL closures and period-end procedures
            </p>
          </div>
          <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="h-10 bg-muted rounded w-full animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-48 animate-pulse"></div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 bg-muted rounded w-1/4 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-1/4 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-1/3 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-1/6 animate-pulse"></div>
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
          <h1 className="text-2xl font-bold text-foreground">Closing Entries</h1>
          <p className="text-muted-foreground mt-1">
            Manage GL closures and period-end procedures
          </p>
        </div>
        <Link href="/accounting/closing-entries/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Closure
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by office, comments, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
                          <Select
                value={selectedOffice}
                onValueChange={setSelectedOffice}
              >
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Offices
                  </SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id.toString()}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            <Button
              variant="outline"
              onClick={fetchData}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Closing Entries ({filteredClosures.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClosures.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No closing entries found
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || (selectedOffice && selectedOffice !== 'all')
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by creating your first closing entry.'
                }
              </p>
              {!searchTerm && (selectedOffice === 'all' || !selectedOffice) && (
                <Link href="/accounting/closing-entries/new">
                  <Button>
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
                  <TableRow>
                    <TableHead>Office</TableHead>
                    <TableHead>Closure Date</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClosures.map((closure) => (
                    <TableRow key={closure.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{closure.officeName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDate(closure.closingDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {closure.comments || 'No comments'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{closure.createdByUsername}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/accounting/closing-entries/${closure.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/accounting/closing-entries/${closure.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(closure.id)}
                            disabled={isDeleting === closure.id}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
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