"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  User, 
  Building, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign,
  Users,
  AlertCircle
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface GuarantorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
}

interface Guarantor {
  id: number;
  clientId: number;
  clientName: string;
  clientAccountNo: string;
  clientExternalId?: string;
  clientOfficeId: number;
  clientOfficeName?: string;
  clientMobileNo?: string;
  clientEmailAddress?: string;
  guarantorType: {
    id: number;
    code: string;
    value: string;
  };
  amount: number;
  status: {
    id: number;
    code: string;
    value: string;
  };
  submittedOnDate?: number[];
  guarantorRelationship?: {
    id: number;
    name: string;
  };
}

interface LoanWithGuarantors {
  id: number;
  accountNo: string;
  clientName: string;
  currency: {
    code: string;
    name: string;
    displaySymbol: string;
  };
  guarantors: Guarantor[];
}

export default function GuarantorsModal({ isOpen, onClose, loanId }: GuarantorsModalProps) {
  const [loanData, setLoanData] = useState<LoanWithGuarantors | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch guarantors when modal opens
  useEffect(() => {
    if (isOpen && loanId) {
      fetchGuarantors();
    }
  }, [isOpen, loanId]);

  const fetchGuarantors = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/fineract/loans/${loanId}/guarantors`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch guarantors: ${response.statusText}`);
      }

      const data: LoanWithGuarantors = await response.json();
      setLoanData(data);
    } catch (error) {
      console.error("Error fetching guarantors:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch guarantors");
      toast({
        title: "Error",
        description: "Failed to fetch guarantor information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: number[]): string => {
    if (!date || date.length !== 3) return "N/A";
    const [year, month, day] = date;
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currencyCode: string = "USD"): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleClose = () => {
    if (!loading) {
      setLoanData(null);
      setError(null);
      onClose();
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Guarantors</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Loan Guarantors
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {error ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          ) : loanData ? (
            <>
              {/* Loan Summary */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Loan Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-muted-foreground">Loan Account:</span>
                        <span className="font-mono">{loanData.accountNo}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-muted-foreground">Client:</span>
                        <span>{loanData.clientName}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-muted-foreground">Currency:</span>
                        <span>{loanData.currency.name} ({loanData.currency.code})</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-muted-foreground">Total Guarantors:</span>
                        <Badge variant="secondary">{loanData.guarantors?.length || 0}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Guarantors List */}
              {loanData.guarantors && loanData.guarantors.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Guarantor Details</h3>
                  {loanData.guarantors.map((guarantor) => (
                    <Card key={guarantor.id} className="border shadow-sm">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left Column - Basic Info */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{guarantor.clientName}</span>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Account No:</span>
                                <span className="font-mono">{guarantor.clientAccountNo}</span>
                              </div>
                              {guarantor.clientExternalId && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">External ID:</span>
                                  <span>{guarantor.clientExternalId}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Type:</span>
                                <Badge variant="outline">{guarantor.guarantorType.value}</Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge 
                                  variant={guarantor.status.value === "Active" ? "default" : "secondary"}
                                >
                                  {guarantor.status.value}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Right Column - Contact & Financial */}
                          <div className="space-y-3">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Guaranteed Amount:</span>
                                <span className="font-semibold">
                                  {formatCurrency(guarantor.amount, loanData.currency.code)}
                                </span>
                              </div>
                              {guarantor.guarantorRelationship && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Relationship:</span>
                                  <span>{guarantor.guarantorRelationship.name}</span>
                                </div>
                              )}
                              {guarantor.submittedOnDate && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Submitted:</span>
                                  <span>{formatDate(guarantor.submittedOnDate)}</span>
                                </div>
                              )}
                            </div>

                            {/* Contact Information */}
                            {(guarantor.clientMobileNo || guarantor.clientEmailAddress) && (
                              <div className="space-y-2 text-sm">
                                {guarantor.clientMobileNo && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    <span>{guarantor.clientMobileNo}</span>
                                  </div>
                                )}
                                {guarantor.clientEmailAddress && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span>{guarantor.clientEmailAddress}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border shadow-sm">
                  <CardContent className="p-6 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Guarantors Found</h3>
                    <p className="text-muted-foreground">
                      This loan does not have any guarantors assigned.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
