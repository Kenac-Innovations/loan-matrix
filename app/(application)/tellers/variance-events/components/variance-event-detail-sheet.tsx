"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { ResolveVarianceDialog } from "./resolve-variance-dialog";
import { AddNoteDialog } from "./add-note-dialog";
import { ReopenDialog } from "./reopen-dialog";

interface VarianceEvent {
  id: string;
  type: "SHORTAGE" | "OVERAGE";
  amount: number;
  currency: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  businessDate: string;
  expectedBalance: number;
  countedAmount: number;
  raisedAt: string;
  raisedBy: string;
  resolutionType?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  cashier: {
    id: string;
    staffName: string;
  };
  teller: {
    id: string;
    name: string;
  };
  officeId: string;
  officeName: string;
  sessionId: string;
}

interface SessionInfo {
  declaredAmount: number;
  managerCountedAmount: number;
  closureInitiatedBy: string;
  closedBy: string;
  closedAt: string;
}

interface EventLog {
  id: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  notes?: string;
  performedBy: string;
  createdAt: string;
}

interface DetailResponse {
  event: VarianceEvent;
  session: SessionInfo;
  logs: EventLog[];
  canAct: boolean;
}

interface VarianceEventDetailSheetProps {
  eventId: string;
  onClose: () => void;
  onRefresh: () => void;
}


/** Format an amount in the event's own currency; falls back to "123.45 ZMW". */
function formatInCurrency(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function VarianceEventDetailSheet({
  eventId,
  onClose,
  onRefresh,
}: VarianceEventDetailSheetProps) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tellers/variance-events/${eventId}`);

      if (response.ok) {
        const detailData: DetailResponse = await response.json();
        setData(detailData);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch event details");
      }
    } catch (err) {
      console.error("Error fetching event details:", err);
      setError("Failed to fetch event details");
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- load event details when the sheet opens */
  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleActionSuccess = () => {
    fetchEventDetails();
    onRefresh();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return (
          <Badge variant="outline" className="border-red-200 text-red-700">
            Open
          </Badge>
        );
      case "UNDER_REVIEW":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800"
          >
            Under review
          </Badge>
        );
      case "RESOLVED":
        return <Badge className="bg-green-600">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === "SHORTAGE") {
      return <Badge className="bg-red-600">Shortage</Badge>;
    }
    return <Badge className="bg-amber-600">Overage</Badge>;
  };

  if (error && !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Failed to load details</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (loading || !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading event details...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { event, session, logs, canAct } = data;

  const renderActionButtons = () => {
    if (!canAct) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You can view this event but can&apos;t act on it.
          </AlertDescription>
        </Alert>
      );
    }

    const buttons = [];

    if (event.status === "OPEN") {
      buttons.push(
        <Button
          key="start-review"
          variant="outline"
          className="w-full"
          disabled={isSubmitting}
          onClick={async () => {
            try {
              setIsSubmitting(true);
              const response = await fetch(
                `/api/tellers/variance-events/${event.id}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "start-review" }),
                }
              );

              if (response.ok) {
                handleActionSuccess();
              } else {
                const errorData = await response.json();
                setError(errorData.error || "Failed to start review");
              }
            } catch (err) {
              console.error("Error starting review:", err);
              setError("Failed to start review");
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting review...
            </>
          ) : (
            "Start review"
          )}
        </Button>
      );
    }

    if (event.status === "OPEN" || event.status === "UNDER_REVIEW") {
      buttons.push(
        <Button
          key="resolve"
          variant="default"
          className="w-full"
          onClick={() => setShowResolveDialog(true)}
        >
          Resolve…
        </Button>
      );
    }

    if (
      event.status === "OPEN" ||
      event.status === "UNDER_REVIEW" ||
      event.status === "RESOLVED"
    ) {
      buttons.push(
        <Button
          key="add-note"
          variant="outline"
          className="w-full"
          onClick={() => setShowAddNoteDialog(true)}
        >
          Add note
        </Button>
      );
    }

    if (event.status === "RESOLVED") {
      buttons.push(
        <Button
          key="reopen"
          variant="outline"
          className="w-full"
          onClick={() => setShowReopenDialog(true)}
        >
          Reopen…
        </Button>
      );
    }

    return (
      <div className="space-y-2">
        {buttons}
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Variance Event Details</DialogTitle>
          <DialogDescription>
            View and manage this variance event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Event Summary */}
          <div className="space-y-4">
            <div className="border-b pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Event</h3>
                {getStatusBadge(event.status)}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p>{getTypeBadge(event.type)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-semibold text-lg">
                    {formatInCurrency(event.amount, event.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Business Date</p>
                  <p>
                    {event.businessDate
                      ? new Intl.DateTimeFormat("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        }).format(new Date(event.businessDate + "T00:00:00Z"))
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Currency</p>
                  <p>{event.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cashier</p>
                  <p>{event.cashier?.staffName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Teller/Branch</p>
                  <p>{event.teller?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Office</p>
                  <p>{event.officeName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Raised At</p>
                  <p>
                    {event.raisedAt
                      ? new Date(event.raisedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Raised By</p>
                  <p>{event.raisedBy || "—"}</p>
                </div>
                {event.resolutionType && (
                  <div>
                    <p className="text-muted-foreground">Resolution Type</p>
                    <p>{event.resolutionType}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Session Info */}
            <div className="border-b pb-4">
              <h3 className="font-semibold mb-2">Session</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cashier Declared</p>
                  <p className="font-semibold">
                    {formatInCurrency(session.declaredAmount, event.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Manager Counted</p>
                  <p className="font-semibold">
                    {formatInCurrency(session.managerCountedAmount, event.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expected Balance</p>
                  <p className="font-semibold">
                    {formatInCurrency(event.expectedBalance, event.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Counted Amount</p>
                  <p className="font-semibold">
                    {formatInCurrency(event.countedAmount, event.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Closed By</p>
                  <p>{session.closedBy || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Closed At</p>
                  <p>
                    {session.closedAt
                      ? new Date(session.closedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* History Timeline */}
            {logs.length > 0 && (
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">History</h3>
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="text-sm">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">
                            {log.action}
                            {log.fromStatus && log.toStatus && (
                              <span className="text-muted-foreground ml-1">
                                ({log.fromStatus} → {log.toStatus})
                              </span>
                            )}
                          </p>
                          {log.notes && (
                            <p className="text-muted-foreground text-xs mt-1">
                              {log.notes}
                            </p>
                          )}
                          <p className="text-muted-foreground text-xs mt-1">
                            {log.performedBy} •{" "}
                            {new Date(log.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-4">
              {renderActionButtons()}
            </div>
          </div>
        </div>

        {/* Dialogs */}
        {showResolveDialog && (
          <ResolveVarianceDialog
            eventId={event.id}
            eventType={event.type}
            onClose={() => setShowResolveDialog(false)}
            onSuccess={handleActionSuccess}
          />
        )}

        {showAddNoteDialog && (
          <AddNoteDialog
            eventId={event.id}
            onClose={() => setShowAddNoteDialog(false)}
            onSuccess={handleActionSuccess}
          />
        )}

        {showReopenDialog && (
          <ReopenDialog
            eventId={event.id}
            onClose={() => setShowReopenDialog(false)}
            onSuccess={handleActionSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
