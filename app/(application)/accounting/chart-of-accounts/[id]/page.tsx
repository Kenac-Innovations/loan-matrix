// File: app/(application)/accounting/chart-of-accounts/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { 
  Loader2, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  Edit, 
  Power, 
  PowerOff, 
  Trash2, 
  Building2, 
  Tag, 
  FileText, 
  Hash,
  Settings,
  AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ViewAccountPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: acc, error, mutate } = useSWR<any>(
    `/api/fineract/glaccounts/${id}?template=true`,
    fetcher
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Failed to Load Account
            </CardTitle>
            <CardDescription>
              There was an error loading the account details. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!acc) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Account...
            </CardTitle>
            <CardDescription>
              Please wait while we load the account details.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Toggle disabled / enabled
  const handleDisableToggle = async () => {
    try {
      const response = await fetch(`/api/fineract/glaccounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !acc.disabled }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.defaultUserMessage || responseData.developerMessage || 'Failed to update account status';
        
        toast({
          title: 'Cannot Update Account Status',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }
      
      // Success notification
      toast({
        title: acc.disabled ? 'Account Enabled' : 'Account Disabled',
        description: `${acc.name} is now ${acc.disabled ? 'active' : 'inactive'}`,
        variant: 'success',
      });
      
      mutate();
    } catch (e: any) {
      console.error('Error toggling account status:', e);
      
      toast({
        title: 'Network Error',
        description: 'Unable to connect to the server. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Confirm and perform delete
  const handleDeleteConfirmed = async () => {
    try {
      const response = await fetch(`/api/fineract/glaccounts/${id}`, { method: 'DELETE' });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        const errorMessage = responseData.defaultUserMessage || responseData.developerMessage || 'Failed to delete account';
        
        toast({
          title: 'Cannot Delete Account',
          description: errorMessage,
          variant: 'destructive',
        });
        setDialogOpen(false);
        return;
      }
      
      // Success notification
      toast({
        title: 'Account Deleted',
        description: `${acc.name} has been permanently removed`,
        variant: 'success',
      });

      // Navigate after a short delay
      setTimeout(() => {
        router.push('/accounting/chart-of-accounts');
      }, 2000);
      
    } catch (e: any) {
      console.error('Error deleting GL account:', e);
      
      toast({
        title: 'Network Error',
        description: 'Unable to connect to the server. Please try again.',
        variant: 'destructive',
      });
      setDialogOpen(false);
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    if (acc.disabled) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-100">Inactive</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  };

  // Get type badge color
  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'ASSET': return 'default';
      case 'LIABILITY': return 'destructive';
      case 'EQUITY': return 'secondary';
      case 'INCOME': return 'outline';
      case 'EXPENSE': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">GL Account Details</h1>
            <p className="text-muted-foreground mt-1">View and manage general ledger account information</p>
          </div>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Accounts
          </Button>
        </div>

        {/* Account Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-foreground">{acc.name}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    General Ledger Account
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                <div className="flex space-x-2">
                  <Link href={`/accounting/chart-of-accounts/${id}/edit`}>
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                  
                  <Button
                    size="sm"
                    variant={acc.disabled ? "default" : "outline"}
                    onClick={handleDisableToggle}
                    className={acc.disabled ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    {acc.disabled ? (
                      <>
                        <Power className="h-4 w-4 mr-2" />
                        Enable
                      </>
                    ) : (
                      <>
                        <PowerOff className="h-4 w-4 mr-2" />
                        Disable
                      </>
                    )}
                  </Button>

                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Delete Account
                        </DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. Are you sure you want to permanently
                          delete <strong>{acc.name}</strong>?
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="space-x-2">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteConfirmed}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Yes, Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Account Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-foreground">Basic Information</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground">
                Core account details and identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">GL Code</span>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-foreground font-medium">{acc.glCode}</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Account Type</span>
                <Badge variant={getTypeBadgeVariant(acc.type.value)}>
                  {acc.type.value}
                </Badge>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Account Usage</span>
                <span className="text-foreground font-medium">{acc.usage.value}</span>
              </div>
              
              {acc.description && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm font-medium text-muted-foreground block mb-2">Description</span>
                    <p className="text-foreground text-sm leading-relaxed">{acc.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <CardTitle className="text-foreground">Account Settings</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground">
                Configuration and behavior settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Manual Entries</span>
                <div className="flex items-center gap-2">
                  {acc.manualEntriesAllowed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-foreground font-medium">
                    {acc.manualEntriesAllowed ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Account Status</span>
                <div className="flex items-center gap-2">
                  {acc.disabled ? (
                    <XCircle className="h-4 w-4 text-orange-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <span className="text-foreground font-medium">
                    {acc.disabled ? 'Inactive' : 'Active'}
                  </span>
                </div>
              </div>
              
              {acc.tagId && acc.tagId.id !== 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Account Tag</span>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">{acc.tagId.name}</Badge>
                    </div>
                  </div>
                </>
              )}
              
              {acc.parentId && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Parent Account</span>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{acc.parentId.name}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
