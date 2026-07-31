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
          <div className="h-10 bg-muted rounded w-20 animate-pulse"></div>
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-48 animate-pulse"></div>
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Closing entry not found
              </h3>
              <p className="text-muted-foreground">
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
            <h1 className="text-2xl font-bold text-foreground">Closing Entry Details</h1>
            <p className="text-muted-foreground mt-1">
              View and manage closing entry information
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="w-4 h-4 mr-2" />
            {isEditing ? 'Cancel Edit' : 'Edit'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Closure Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            // Edit Form
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div>
                <Label htmlFor="comments">
                  Comments
                </Label>
                <div className="relative mt-1">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    id="comments"
                    value={editComments}
                    onChange={(e) => setEditComments(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border rounded-md bg-transparent resize-none"
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
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
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
                    <Label>Office</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{closure.officeName}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Closing Date</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{formatDateArray(closure.closingDate)}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Comments</Label>
                    <div className="flex items-start gap-2 mt-1">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">
                        {closure.comments || 'No comments provided'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Created By</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{closure.createdByUsername}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Created Date</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{formatDateArray(closure.createdDate)}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Last Updated</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{formatDateArray(closure.lastUpdatedDate)}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Updated By</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{closure.lastUpdatedByUsername}</span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Closing Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this closing entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
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