// File: app/(application)/accounting/chart-of-accounts/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, BookOpen, CheckCircle, XCircle } from 'lucide-react';
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
    return <p className="text-red-600">Failed to load account</p>;
  }
  if (!acc) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <Loader2 className="animate-spin mr-2" />Loading…
      </div>
    );
  }

  // Toggle disabled / enabled
  const handleDisableToggle = async () => {
    try {
      await fetch(`/api/fineract/glaccounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !acc.disabled }),
      });
      
      // Enhanced notification for enable/disable
      toast({
        title: acc.disabled ? 'GL Account Enabled Successfully! ✅' : 'GL Account Disabled Successfully! ⚠️',
        description: (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{acc.name}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>GL Code: <span className="font-mono bg-muted px-1 rounded">{acc.glCode}</span></div>
              <div>Status: <span className={`font-medium ${acc.disabled ? 'text-green-600' : 'text-orange-600'}`}>
                {acc.disabled ? 'Now Active' : 'Now Inactive'}
              </span></div>
            </div>
          </div>
        ),
        variant: 'success',
      });
      
      mutate();
    } catch (e: any) {
      console.error('Error toggling account status:', e);
      
      toast({
        title: 'Failed to Update Account Status',
        description: (
          <div className="space-y-1">
            <div className="text-sm">{e.message}</div>
            <div className="text-xs text-muted-foreground">
              Please try again. If the problem persists, contact support.
            </div>
          </div>
        ),
        variant: 'destructive',
      });
    }
  };

  // Confirm and perform delete
  const handleDeleteConfirmed = async () => {
    try {
      await fetch(`/api/fineract/glaccounts/${id}`, { method: 'DELETE' });
      
      // Enhanced delete notification
      toast({
        title: 'GL Account Deleted Successfully! 🗑️',
        description: (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-red-500" />
              <span className="font-medium">{acc.name}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>GL Code: <span className="font-mono bg-muted px-1 rounded">{acc.glCode}</span></div>
              <div className="text-xs text-orange-600 font-medium">
                This action cannot be undone.
              </div>
            </div>
          </div>
        ),
        variant: 'success',
        action: {
          label: 'View All Accounts',
          onClick: () => router.push('/accounting/chart-of-accounts'),
        },
      });

      // Navigate after a short delay to allow user to see the notification
      setTimeout(() => {
        router.push('/accounting/chart-of-accounts');
      }, 2000);
      
    } catch (e: any) {
      console.error('Error deleting GL account:', e);
      
      toast({
        title: 'Failed to Delete GL Account',
        description: (
          <div className="space-y-1">
            <div className="text-sm">{e.message}</div>
            <div className="text-xs text-muted-foreground">
              The account may be in use or you may not have permission to delete it.
            </div>
          </div>
        ),
        variant: 'destructive',
      });
      setDialogOpen(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header + Actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Account Details</h1>
        <div className="flex space-x-2">
          {/* Edit */}
          <Link href={`/accounting/chart-of-accounts/${id}/edit`}>
            <Button>Edit</Button>
          </Link>

          {/* Enable / Disable */}
          {acc.disabled ? (
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleDisableToggle}
            >
              Enable
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleDisableToggle}>
              Disable
            </Button>
          )}

          {/* Delete */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this account?</DialogTitle>
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
                  Yes, Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Account Info Card */}
      <Card className="shadow-lg">
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500">Account Type</p>
            <p className="mt-1 text-lg font-medium">{acc.type.value}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">GL Code</p>
            <p className="mt-1 text-lg font-medium">{acc.glCode}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Account Usage</p>
            <p className="mt-1 text-lg font-medium">{acc.usage.value}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Manual Entries Allowed</p>
            <p className="mt-1 text-lg font-medium">
              {acc.manualEntriesAllowed ? 'Yes' : 'No'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-gray-500">Description</p>
            <p className="mt-1 text-lg font-medium">{acc.description || '-'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
