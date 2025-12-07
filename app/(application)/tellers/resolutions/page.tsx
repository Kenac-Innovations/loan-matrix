"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn } from "@/shared/types/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/format-date";

interface PendingResolution {
  id: string;
  tellerId: string;
  cashierId: string;
  settlementDate: string;
  openingBalance: number;
  closingBalance: number;
  cashIn: number;
  cashOut: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number; // Variance
  notes: string | null;
  varianceResolved: boolean;
  varianceResolvedAt: string | null;
  varianceResolvedBy: string | null;
  varianceResolutionNotes: string | null;
  cashier?: {
    staffName: string;
  };
  teller?: {
    name: string;
  };
}

export default function ResolutionsPage() {
  const [resolutions, setResolutions] = useState<PendingResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResolution, setSelectedResolution] =
    useState<PendingResolution | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingResolutions();
  }, []);

  const fetchPendingResolutions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tellers/resolutions/pending");

      if (response.ok) {
        const data = await response.json();
        setResolutions(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch pending resolutions");
      }
    } catch (error) {
      console.error("Error fetching pending resolutions:", error);
      setError("Failed to fetch pending resolutions");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedResolution || !resolutionNotes.trim()) {
      setError("Please provide resolution notes explaining the variance");
      return;
    }

    setResolving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tellers/${selectedResolution.tellerId}/cashiers/${selectedResolution.cashierId}/settlements/${selectedResolution.id}/resolve-variance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolutionNotes: resolutionNotes.trim(),
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setShowResolveDialog(false);
        setSelectedResolution(null);
        setResolutionNotes("");
        fetchPendingResolutions();
        
        alert(
          `Variance resolved successfully!\n\n` +
          `Variance: ${selectedResolution.difference > 0 ? "+" : ""}${selectedResolution.difference.toFixed(2)}\n` +
          `Vault balance updated: ${result.vaultBalance?.toFixed(2) || "N/A"}\n\n` +
          `The variance has been applied to the vault balance.`
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || errorData.details || "Failed to resolve variance");
      }
    } catch (error) {
      console.error("Error resolving variance:", error);
      setError("Failed to resolve variance");
    } finally {
      setResolving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const columns: DataTableColumn<PendingResolution>[] = [
    {
      id: "settlementDate",
      header: "Date",
      cell: ({ row }) => {
        const date = row.original.settlementDate;
        return (
          <span className="text-sm">
            {date ? formatDate(new Date(date)) : "—"}
          </span>
        );
      },
    },
    {
      id: "teller",
      header: "Teller",
      cell: ({ row }) => {
        return (
          <span className="font-medium">
            {row.original.teller?.name || "—"}
          </span>
        );
      },
    },
    {
      id: "cashier",
      header: "Cashier",
      cell: ({ row }) => {
        return (
          <span className="font-medium">
            {row.original.cashier?.staffName || "—"}
          </span>
        );
      },
    },
    {
      id: "expectedBalance",
      header: "Expected",
      cell: ({ row }) => {
        return formatCurrency(row.original.expectedBalance);
      },
    },
    {
      id: "actualBalance",
      header: "Actual",
      cell: ({ row }) => {
        return formatCurrency(row.original.actualBalance);
      },
    },
    {
      id: "variance",
      header: "Variance",
      cell: ({ row }) => {
        const variance = row.original.difference;
        return (
          <span
            className={`font-semibold ${
              variance > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {variance > 0 ? "+" : ""}
            {formatCurrency(variance)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedResolution(row.original);
              setShowResolveDialog(true);
              setResolutionNotes("");
              setError(null);
            }}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Resolve
          </Button>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading pending resolutions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Variance Resolutions</h1>
        <p className="text-muted-foreground mt-1">
          Review and resolve pending variances from reconciled settlements
        </p>
      </div>

      {/* Pending Resolutions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Resolutions</CardTitle>
          <CardDescription>
            Settlements with variance that need to be explained and resolved.
            Once resolved, the variance will be applied to the vault balance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {resolutions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending resolutions. All variances have been resolved.
            </div>
          ) : (
            <GenericDataTable
              data={resolutions}
              columns={columns}
              searchPlaceholder="Search resolutions..."
              enablePagination={true}
              enableColumnVisibility={true}
              enableExport={true}
              enableFilters={true}
              pageSize={10}
              tableId="resolutions-table"
              exportFileName="variance-resolutions-export"
              emptyMessage="No pending resolutions found"
            />
          )}
        </CardContent>
      </Card>

      {/* Resolve Variance Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Resolve Variance</DialogTitle>
            <DialogDescription>
              Explain the variance and mark it as resolved. The variance will
              be applied to the vault balance.
            </DialogDescription>
          </DialogHeader>

          {selectedResolution && (
            <div className="space-y-4 py-4">
              {/* Variance Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Expected Balance
                  </Label>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedResolution.expectedBalance)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Actual Balance
                  </Label>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedResolution.actualBalance)}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    Variance
                  </Label>
                  <p
                    className={`text-lg font-semibold ${
                      selectedResolution.difference > 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {selectedResolution.difference > 0 ? "+" : ""}
                    {formatCurrency(selectedResolution.difference)}
                    <span className="text-sm text-muted-foreground ml-2">
                      ({selectedResolution.difference > 0 ? "Surplus" : "Shortage"})
                    </span>
                  </p>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Once resolved, the variance amount will be{" "}
                  {selectedResolution.difference > 0
                    ? "added to"
                    : "subtracted from"}{" "}
                  the vault balance. This action cannot be undone.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="resolutionNotes">
                  Resolution Notes <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="resolutionNotes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Explain the variance (e.g., 'Found extra cash in drawer', 'Missing cash due to...', etc.)"
                  rows={5}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Provide a clear explanation of why the variance occurred
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResolveDialog(false);
                setSelectedResolution(null);
                setResolutionNotes("");
                setError(null);
              }}
              disabled={resolving}
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolving || !resolutionNotes.trim()}>
              {resolving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Resolve Variance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
