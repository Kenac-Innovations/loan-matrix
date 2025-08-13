'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  ArrowLeft,
  RotateCcw,
  FileText,
  Building2,
  Calendar,
  User,
  Hash,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  CheckSquare,
  Banknote,
  CreditCard,
  AlertCircle,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

const fetcher = (url: string) => fetch(url).then(res => res.json());

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
  createdByUserId: number;
  createdDate: number[];
  createdByUserName: string;
  comments: string;
  reversed: boolean;
  referenceNumber: string;
  transactionDetails: {
    paymentDetails: {
      id: number;
      paymentType: {
        id: number;
        name: string;
        isSystemDefined: boolean;
      };
      accountNumber: string;
      checkNumber: string;
      routingCode: string;
      receiptNumber: string;
      bankNumber: string;
    };
  };
  submittedOnDate: number[];
}

interface JournalEntryResponse {
  totalFilteredRecords: number;
  pageItems: JournalEntry[];
}

export default function JournalEntryViewPage() {
  const params = useParams();
  const router = useRouter();
  const transactionId = params.transactionId as string;

  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [revertComments, setRevertComments] = useState('');
  const [newTransactionId, setNewTransactionId] = useState('');
  const [isReverting, setIsReverting] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<JournalEntryResponse>(
    transactionId ? `/api/fineract/journalentries/${transactionId}` : null,
    fetcher
  );

  const journalEntries = data?.pageItems || [];
  const firstEntry = journalEntries[0];

  const handleRevertTransaction = async () => {
    if (!revertComments.trim()) {
      toast({
        title: 'Comments Required',
        description: 'Please provide comments for the transaction reversal',
        variant: 'destructive'
      });
      return;
    }

    setIsReverting(true);

    try {
      const response = await fetch(`/api/fineract/journalentries/${transactionId}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comments: revertComments }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.defaultUserMessage || responseData.developerMessage || 'Failed to revert transaction';
        toast({
          title: 'Cannot Revert Transaction',
          description: errorMessage,
          variant: 'destructive'
        });
        setIsReverting(false);
        return;
      }

      setNewTransactionId(responseData.transactionId);
      setShowRevertDialog(false);
      setShowSuccessDialog(true);
      
      // Refresh the data to update the reversed status
      mutate();

    } catch (err: any) {
      console.error('Error reverting transaction:', err);
      toast({
        title: 'Network Error',
        description: 'Unable to connect to the server. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsReverting(false);
    }
  };

  const handleRedirectToNewTransaction = () => {
    setShowSuccessDialog(false);
    router.push(`/accounting/journal-entries/${newTransactionId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading journal entry details...</span>
        </div>
      </div>
    );
  }

  if (error || !firstEntry) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load journal entry</h3>
          <p className="text-muted-foreground mb-4">
            Unable to fetch the journal entry details. Please try again.
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

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

  const getEntryTypeBadge = (entryType: string) => {
    if (entryType === 'DEBIT') {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">DEBIT</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">CREDIT</Badge>;
  };

  const getAccountTypeBadge = (accountType: string) => {
    const variants: { [key: string]: string } = {
      'ASSET': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'LIABILITY': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      'EQUITY': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      'INCOME': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      'EXPENSE': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    
    return (
      <Badge variant="outline" className={variants[accountType] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'}>
        {accountType}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal Entry Details</h1>
          <p className="text-muted-foreground mt-1">
            Transaction ID: {transactionId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="destructive"
            className="flex items-center gap-2"
            disabled={firstEntry.reversed}
            onClick={() => setShowRevertDialog(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Revert Transaction
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Transaction Summary */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Transaction Summary</CardTitle>
                <CardDescription>
                  Basic information about this journal entry
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Office:</span>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-foreground">{firstEntry.officeName}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Created By:</span>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-foreground">{firstEntry.createdByUserName}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Transaction Date:</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-foreground">{formatDate(firstEntry.transactionDate)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Submitted on:</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-foreground">{formatDateTime(firstEntry.submittedOnDate)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {firstEntry.comments && (
              <>
                <Separator className="my-4" />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Comments:</span>
                  <p className="text-foreground mt-1">{firstEntry.comments}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Entry Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Hash className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Entry Details</CardTitle>
                <CardDescription>
                  Individual debit and credit entries for this transaction
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Entry ID</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Account Code</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Account Name</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Debit</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journalEntries.map((entry, index) => (
                    <tr 
                      key={entry.id} 
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'
                      }`}
                    >
                      <td className="py-3 px-4 text-foreground">{entry.id}</td>
                      <td className="py-3 px-4">
                        {getAccountTypeBadge(entry.glAccountType.value)}
                      </td>
                      <td className="py-3 px-4 text-foreground">{entry.glAccountCode}</td>
                      <td className="py-3 px-4 text-foreground">{entry.glAccountName}</td>
                      <td className="py-3 px-4 text-right">
                        {entry.entryType.value === 'DEBIT' ? (
                          <span className="text-foreground font-medium">
                            {entry.currency.displaySymbol} {entry.amount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {entry.entryType.value === 'CREDIT' ? (
                          <span className="text-foreground font-medium">
                            {entry.currency.displaySymbol} {entry.amount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        {firstEntry.transactionDetails?.paymentDetails && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Payment Details</CardTitle>
                  <CardDescription>
                    Additional payment information for this transaction
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Payment Type:</span>
                    <span className="text-foreground">{firstEntry.transactionDetails.paymentDetails.paymentType.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Account Number:</span>
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-gray-400" />
                      <span className="text-foreground">{firstEntry.transactionDetails.paymentDetails.accountNumber || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Check Number:</span>
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-gray-400" />
                      <span className="text-foreground">{firstEntry.transactionDetails.paymentDetails.checkNumber || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Receipt Number:</span>
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-gray-400" />
                      <span className="text-foreground">{firstEntry.transactionDetails.paymentDetails.receiptNumber || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Routing Code:</span>
                    <span className="text-foreground">{firstEntry.transactionDetails.paymentDetails.routingCode || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Bank Number:</span>
                    <span className="text-foreground">{firstEntry.transactionDetails.paymentDetails.bankNumber || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Revert Transaction Confirmation Dialog */}
      <Dialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revert Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to revert this transaction?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                placeholder="Enter comments for the reversal..."
                value={revertComments}
                onChange={(e) => setRevertComments(e.target.value)}
                className="resize-none bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-foreground"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRevertDialog(false)}
              disabled={isReverting}
            >
              No
            </Button>
            <Button
              onClick={handleRevertTransaction}
              disabled={isReverting || !revertComments.trim()}
              className="flex items-center gap-2"
            >
              {isReverting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reverting...
                </>
              ) : (
                'Yes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Transaction Reverted
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="font-semibold text-green-600 mb-2">Success!</p>
              <p className="text-foreground mb-2">
                A new journal entry has been created to reverse this transaction:
              </p>
              <p className="text-sm text-muted-foreground">
                Transaction ID: {newTransactionId}
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
            >
              Close
            </Button>
            <Button
              onClick={handleRedirectToNewTransaction}
              className="flex items-center gap-2"
            >
              Redirect to New Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 