'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  Calendar,
  User,
  MessageSquare,
  Clock,
  Edit,
  Trash2,
  ArrowLeft,
  Save,
  X
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

interface GLClosure {
  id: number;
  officeId: number;
  officeName: string;
  closingDate: number[];
  comments: string;
  createdByUserId: number;
  createdByUsername: string;
  createdDate: number[];
  lastUpdatedByUserId: number;
  lastUpdatedByUsername: string;
  lastUpdatedDate: number[];
  deleted: boolean;
  allowedOffices: any[];
}

export default function ViewClosurePage({ params, searchParams }: { params: { id: string }, searchParams: { edit?: string } }) {
  const router = useRouter();
  const { id } = params;
  
  // State
  const [closure, setClosure] = useState<GLClosure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(searchParams.edit === 'true');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Edit form state
  const [editComments, setEditComments] = useState<string>('');

  // Fetch closure data
  useEffect(() => {
    const fetchClosure = async () => {
      try {
        const response = await fetch(`/api/fineract/glclosures/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch closure');
        }
        const data = await response.json();
        setClosure(data);
        setEditComments(data.comments || '');
      } catch (error) {
        console.error('Error fetching closure:', error);
        toast({
          title: "Error",
          description: "Failed to load closing entry. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchClosure();
  }, [id]);

  // Handle edit submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        comments: editComments,
        dateFormat: 'dd MMMM yyyy',
        locale: 'en'
      };

      const response = await fetch(`/api/fineract/glclosures/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || 'Failed to update closing entry');
      }

      toast({
        title: "Success",
        description: "Closing entry updated successfully.",
        variant: "success"
      });

      // Refresh the data
      const updatedResponse = await fetch(`/api/fineract/glclosures/${id}`);
      const updatedData = await updatedResponse.json();
      setClosure(updatedData);
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating closure:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update closing entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true);
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

      // Redirect to the list page
      router.push('/accounting/closing-entries');
    } catch (error: any) {
      console.error('Error deleting closure:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete closing entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Format date array
  const formatDateArray = (dateArray: number[]) => {
    if (!dateArray || dateArray.length !== 3) return 'Invalid date';
    try {
      const [year, month, day] = dateArray;
      return format(new Date(year, month - 1, day), 'dd MMM yyyy');
    } catch {
      return `${dateArray.join(', ')}`;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div>
        </div>
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!closure) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                Closing entry not found
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                The closing entry you're looking for doesn't exist or has been deleted.
              </p>
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Closing Entry Details</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              View and manage closing entry information
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
            className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            {isEditing ? 'Cancel Edit' : 'Edit'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Closure Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            // Edit Form
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div>
                <Label htmlFor="comments" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Comments
                </Label>
                <div className="relative mt-1">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    id="comments"
                    value={editComments}
                    onChange={(e) => setEditComments(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 resize-none"
                    rows={3}
                    placeholder="Enter comments about this closure"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditComments(closure.comments || '');
                  }}
                  className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            // View Mode
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Office</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-900 dark:text-slate-100 font-medium">{closure.officeName}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Closing Date</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-900 dark:text-slate-100">{formatDateArray(closure.closingDate)}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Comments</Label>
                    <div className="flex items-start gap-2 mt-1">
                      <MessageSquare className="h-4 w-4 text-slate-400 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-400">
                        {closure.comments || 'No comments provided'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Created By</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-900 dark:text-slate-100">{closure.createdByUsername}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Created Date</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-900 dark:text-slate-100">{formatDateArray(closure.createdDate)}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Last Updated</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-900 dark:text-slate-100">{formatDateArray(closure.lastUpdatedDate)}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Updated By</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-900 dark:text-slate-100">{closure.lastUpdatedByUsername}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  ID: {closure.id}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Office ID: {closure.officeId}
                </Badge>
                {closure.deleted && (
                  <Badge variant="destructive" className="text-xs">
                    Deleted
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Delete Closing Entry</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this closing entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 