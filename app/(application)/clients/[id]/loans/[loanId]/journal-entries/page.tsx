"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, FileText, Building, User, Calendar, Clock, DollarSign, RotateCcw } from "lucide-react";
import WriteOffModal from "@/components/WriteOffModal";
import CloseAsRescheduledModal from "@/components/CloseAsRescheduledModal";
import CloseModal from "@/components/CloseModal";
import { toast } from "@/components/ui/use-toast";

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
  entityType: {
    id: number;
    code: string;
    value: string;
  };
  entityId: number;
  createdByUserId: number;
  createdDate: number[];
  createdByUserName: string;
  reversed: boolean;
  transactionDetails: {
    transactionId: number;
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
    transactionType: {
      id: number;
      code: string;
      value: string;
    };
  };
  submittedOnDate: number[];
}

interface JournalEntriesResponse {
  totalFilteredRecords: number;
  pageItems: JournalEntry[];
}

export default function JournalEntriesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.id as string;
  const loanId = params.loanId as string;
  
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string>("");
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [closeAsRescheduledModalOpen, setCloseAsRescheduledModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  // Read transactionId from the query string
  useEffect(() => {
    const txId = searchParams.get("transactionId") || "";
    setTransactionId(txId);
  }, [searchParams]);

  // Fetch entries once we have a transactionId
  useEffect(() => {
    const fetchJournalEntries = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch journal entries from the Fineract API
        const response = await fetch(`/api/fineract/journalentries?transactionId=${encodeURIComponent(transactionId)}&transactionDetails=true`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch journal entries: ${response.statusText}`);
        }

        const data: JournalEntriesResponse = await response.json();
        setJournalEntries(data.pageItems || []);

      } catch (err) {
        console.error("Error fetching journal entries:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (!transactionId) {
      setError("Missing transactionId in URL");
      setLoading(false);
      return;
    }
    fetchJournalEntries();
  }, [transactionId]);

  const formatDate = (date: number[]): string => {
    if (!date || date.length !== 3) return "N/A";
    const [year, month, day] = date;
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (date: number[]): string => {
    if (!date || date.length !== 3) return "N/A";
    const [year, month, day] = date;
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + " 00:00:00";
  };

  const formatCurrency = (amount: number, currencyCode: string = "USD"): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertDescription className="text-red-800">{error}</AlertDescription>
      </Alert>
    );
  }

  if (journalEntries.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setWriteOffModalOpen(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
            >
              <DollarSign className="h-4 w-4" />
              Write Off
            </Button>
            
            <Button
              onClick={() => setCloseModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <RotateCcw className="h-4 w-4" />
              Close
            </Button>
            
            <Button
              onClick={() => setCloseAsRescheduledModalOpen(true)}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <RotateCcw className="h-4 w-4" />
              Close (as Rescheduled)
            </Button>
          </div>
        </div>
        <Card className="border shadow-sm">
          <CardContent className="p-6 space-y-2">
            <p className="text-sm text-muted-foreground">No journal entries found for transactionId: <span className="font-mono">{transactionId || 'N/A'}</span></p>
            <p className="text-sm text-muted-foreground">Tip: Fineract expects the loan transaction reference (e.g. L26). If you passed a numeric id, we tried prefixing it with "L" automatically.</p>
          </CardContent>
        </Card>

        {/* Write Off Modal */}
        <WriteOffModal
          isOpen={writeOffModalOpen}
          onClose={() => setWriteOffModalOpen(false)}
          loanId={loanId}
          onSuccess={() => {
            toast({
              title: "Write-off Successful",
              description: "The loan has been written off successfully.",
            });
          }}
        />

        {/* Close Modal */}
        <CloseModal
          isOpen={closeModalOpen}
          onClose={() => setCloseModalOpen(false)}
          loanId={loanId}
          onSuccess={() => {
            toast({
              title: "Close Successful",
              description: "The loan has been closed successfully.",
            });
          }}
        />

        {/* Close (as Rescheduled) Modal */}
        <CloseAsRescheduledModal
          isOpen={closeAsRescheduledModalOpen}
          onClose={() => setCloseAsRescheduledModalOpen(false)}
          loanId={loanId}
          onSuccess={() => {
            toast({
              title: "Close as Rescheduled Successful",
              description: "The loan has been closed as rescheduled successfully.",
            });
          }}
        />
      </div>
    );
  }

  // Get the first entry to extract common information
  const firstEntry = journalEntries[0];

  return (
    <div className="space-y-8">
      {/* Header with Back Button and Write Off Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setWriteOffModalOpen(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
          >
            <DollarSign className="h-4 w-4" />
            Write Off
          </Button>
          
          <Button
            onClick={() => setCloseModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <RotateCcw className="h-4 w-4" />
            Close
          </Button>
          
          <Button
            onClick={() => setCloseAsRescheduledModalOpen(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
          >
            <RotateCcw className="h-4 w-4" />
            Close (as Rescheduled)
          </Button>
        </div>
      </div>

      {/* Transaction Summary Header */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Office</span>
              </div>
              <p className="text-base font-medium">{firstEntry.officeName}</p>
              
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Created By</span>
              </div>
              <p className="text-base font-medium">{firstEntry.createdByUserName}</p>
            </div>

            {/* Middle Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Transaction Date</span>
              </div>
              <p className="text-base font-medium">{formatDate(firstEntry.transactionDate)}</p>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Submitted on</span>
              </div>
              <p className="text-base font-medium">{formatDateTime(firstEntry.submittedOnDate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>Journal Entries</CardTitle>
              <p className="text-sm text-muted-foreground">
                Transaction ID: {firstEntry.transactionId} | {journalEntries.length} entries
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Entry ID</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Account Code</TableHead>
                  <TableHead className="font-semibold">Account Name</TableHead>
                  <TableHead className="font-semibold text-right">Debit</TableHead>
                  <TableHead className="font-semibold text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalEntries.map((entry) => (
                  <TableRow key={entry.id} className="border-b">
                    <TableCell className="font-medium">{entry.id}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={entry.glAccountType.value === "ASSET" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {entry.glAccountType.value}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{entry.glAccountCode}</TableCell>
                    <TableCell className="font-medium">{entry.glAccountName}</TableCell>
                    <TableCell className="text-right">
                      {entry.entryType.value === "DEBIT" ? (
                        <span className="font-medium text-red-600">
                          {formatCurrency(entry.amount, entry.currency.code)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.entryType.value === "CREDIT" ? (
                        <span className="font-medium text-green-600">
                          {formatCurrency(entry.amount, entry.currency.code)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle>Transaction Details</CardTitle>
              <p className="text-sm text-muted-foreground">Additional transaction information</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Transaction Type:</span>
                <span className="text-sm font-medium">
                  {firstEntry.transactionDetails?.transactionType?.value || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Payment Type:</span>
                <span className="text-sm font-medium">
                  {firstEntry.transactionDetails?.paymentDetails?.paymentType?.name || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Currency:</span>
                <span className="text-sm font-medium">
                  {firstEntry.currency.name} ({firstEntry.currency.code})
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Manual Entry:</span>
                <span className="text-sm font-medium">
                  {firstEntry.manualEntry ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Reversed:</span>
                <span className="text-sm font-medium">
                  {firstEntry.reversed ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Entity Type:</span>
                <span className="text-sm font-medium">
                  {firstEntry.entityType.value}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Button at Bottom */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Write Off Modal */}
      <WriteOffModal
        isOpen={writeOffModalOpen}
        onClose={() => setWriteOffModalOpen(false)}
        loanId={loanId}
        onSuccess={() => {
          // Optionally refresh data or show success message
          toast({
            title: "Write-off Successful",
            description: "The loan has been written off successfully.",
          });
        }}
      />

      {/* Close Modal */}
      <CloseModal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        loanId={loanId}
        onSuccess={() => {
          toast({
            title: "Close Successful",
            description: "The loan has been closed successfully.",
          });
        }}
      />

      {/* Close (as Rescheduled) Modal */}
      <CloseAsRescheduledModal
        isOpen={closeAsRescheduledModalOpen}
        onClose={() => setCloseAsRescheduledModalOpen(false)}
        loanId={loanId}
        onSuccess={() => {
          toast({
            title: "Close as Rescheduled Successful",
            description: "The loan has been closed as rescheduled successfully.",
          });
        }}
      />
    </div>
  );
}
