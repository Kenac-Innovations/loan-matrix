"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface ManagerCloseSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
  onSuccess?: () => void;
}

interface SessionData {
  session: {
    declaredAmount: number;
    closureInitiatedAt?: string;
    comments?: string;
    sessionStatus: string;
  } | null;
  balances: {
    expectedBalance: number;
    balanceSource: "FINERACT_BASELINE" | "NO_BASELINE" | "UNAVAILABLE";
  };
  closureWorkflow?: string;
  canManagerClose: boolean;
}

export function ManagerCloseSessionModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
  onSuccess,
}: ManagerCloseSessionModalProps) {
  const router = useRouter();
  const { currencyCode: orgCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [formData, setFormData] = useState({
    managerCountedAmount: "",
    comments: "",
    rejectReason: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"close" | "reject" | null>(null);

  const fetchSessionData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`
      );

      if (response.ok) {
        const data = (await response.json()) as SessionData;
        setSessionData(data);
      } else {
        console.error("Failed to fetch session data");
        setSessionData(null);
        setError("Failed to load session data");
      }
    } catch (error) {
      console.error("Error fetching session data:", error);
      setSessionData(null);
      setError("Error loading session data");
    } finally {
      setLoadingData(false);
    }
  };

  // Fetch session data when modal opens
  /* eslint-disable react-hooks/set-state-in-effect -- load data when the dialog opens */
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(null);
      setShowRejectReason(false);
      setFormData({
        managerCountedAmount: "",
        comments: "",
        rejectReason: "",
      });
      setActionMode(null);
      fetchSessionData();
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const formatAmount = (amount: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: orgCurrency,
      }).format(amount);
    } catch {
      return `${orgCurrency} ${amount.toFixed(2)}`;
    }
  };

  const handleManagerClose = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    if (
      !formData.managerCountedAmount ||
      parseFloat(formData.managerCountedAmount) < 0
    ) {
      setError("Please enter a valid manager counted amount");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "manager-close",
            managerCountedAmount: parseFloat(formData.managerCountedAmount),
            comments: formData.comments,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        let message = "Session closed.";
        if (result.varianceEvent) {
          const eventType = result.varianceEvent.type || "variance";
          const eventAmount = result.varianceEvent.amount || 0;
          const eventTypeLabel =
            eventType === "SHORTAGE"
              ? "shortage"
              : eventType === "OVERAGE"
                ? "overage"
                : "variance";
          message = `Session closed. A ${eventTypeLabel} of ${formatAmount(Math.abs(eventAmount))} was raised for reconciliation.`;
        }
        setSuccess(message);
        setTimeout(() => {
          onOpenChange(false);
          router.refresh();
          if (onSuccess) {
            onSuccess();
          }
          setFormData({
            managerCountedAmount: "",
            comments: "",
            rejectReason: "",
          });
          setSessionData(null);
        }, 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.details ||
          errorData.error ||
          `Failed to close session (${response.status})`;
        setError(errorMessage);
        console.error("Error closing session:", errorData);
      }
    } catch (error) {
      console.error("Error closing session:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to close session. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClosure = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!formData.rejectReason.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject-closure",
            reason: formData.rejectReason,
          }),
        }
      );

      if (response.ok) {
        setSuccess("Closure rejected; the session is active again.");
        setTimeout(() => {
          onOpenChange(false);
          router.refresh();
          if (onSuccess) {
            onSuccess();
          }
          setFormData({
            managerCountedAmount: "",
            comments: "",
            rejectReason: "",
          });
          setSessionData(null);
        }, 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.details ||
          errorData.error ||
          `Failed to reject closure (${response.status})`;
        setError(errorMessage);
        console.error("Error rejecting closure:", errorData);
      }
    } catch (error) {
      console.error("Error rejecting closure:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to reject closure. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const declaredAmount = sessionData?.session?.declaredAmount || 0;
  const expectedCash = sessionData?.balances?.expectedBalance;
  const balanceSource = sessionData?.balances?.balanceSource;
  const canManagerClose = sessionData?.canManagerClose ?? false;
  const sessionStatus = sessionData?.session?.sessionStatus;

  const expectedCashDisplay =
    balanceSource === "NO_BASELINE"
      ? "Not available (first close)"
      : balanceSource === "UNAVAILABLE"
        ? "Error loading from Fineract"
        : expectedCash;

  const managerCountedAmt = parseFloat(formData.managerCountedAmount || "0");
  const varianceFromExpected =
    typeof expectedCash === "number" && balanceSource === "FINERACT_BASELINE"
      ? managerCountedAmt - expectedCash
      : null;
  const varianceFromDeclared =
    managerCountedAmt - declaredAmount;
  const isBalanced =
    varianceFromExpected !== null && Math.abs(varianceFromExpected) < 0.01;
  const isDeclaredMatch = Math.abs(varianceFromDeclared) < 0.01;

  const closureInitiatedAt = sessionData?.session?.closureInitiatedAt
    ? new Date(sessionData.session.closureInitiatedAt).toLocaleString()
    : "Unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Count & Close Session</DialogTitle>
          <DialogDescription>
            {cashierName ? `Review and close session for ${cashierName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading session data...</span>
          </div>
        ) : !sessionData || !sessionData.session ? (
          <Alert variant="destructive">
            <AlertDescription>Failed to load session data</AlertDescription>
          </Alert>
        ) : (
          <>
            {sessionStatus && sessionStatus !== "PENDING_CLOSURE" ? (
              <Alert variant="destructive">
                <AlertDescription>
                  This session is no longer awaiting closure. Refresh the page.
                </AlertDescription>
              </Alert>
            ) : (
              !canManagerClose && (
                <Alert variant="default" className="mb-4 border-orange-200 bg-orange-50">
                  <AlertDescription className="text-orange-800">
                    You can&apos;t close this session. A different user with branch
                    manager rights must count and close it.
                  </AlertDescription>
                </Alert>
              )
            )}

            <form
              onSubmit={handleManagerClose}
            >
              <div className="space-y-4 py-4">
                {/* Cashier's Declaration */}
                <div className="p-4 border rounded-lg bg-blue-50">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs font-semibold text-blue-900">
                        Cashier Declared Amount
                      </Label>
                      <span className="text-lg font-bold text-blue-900">
                        {formatAmount(declaredAmount)}
                      </span>
                    </div>
                    <p className="text-xs text-blue-700">
                      Submitted: {closureInitiatedAt}
                    </p>
                    {sessionData.session.comments && (
                      <p className="text-xs text-blue-700 mt-2 italic">
                        Cashier notes: {sessionData.session.comments}
                      </p>
                    )}
                  </div>
                </div>

                {/* Expected Cash */}
                <div className="p-4 border rounded-lg bg-muted/50">
                  <Label className="text-xs text-muted-foreground">
                    Expected Cash
                  </Label>
                  {typeof expectedCashDisplay === "number" ? (
                    <p className="text-2xl font-bold mt-2">
                      {formatAmount(expectedCashDisplay)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      {expectedCashDisplay}
                    </p>
                  )}
                </div>

                {/* Manager Count Input */}
                <div className="space-y-2">
                  <Label htmlFor="managerCountedAmount">
                    Manager Count <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="managerCountedAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.managerCountedAmount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        managerCountedAmount: e.target.value,
                      })
                    }
                    required
                    disabled={!canManagerClose || actionMode === "reject"}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the amount counted by branch manager
                  </p>
                </div>

                {/* Variance Display */}
                {formData.managerCountedAmount !== "" && (
                  <div className="space-y-2">
                    {/* Variance vs Expected */}
                    {varianceFromExpected !== null && (
                      <Alert
                        variant={
                          isBalanced
                            ? "default"
                            : varianceFromExpected > 0
                              ? "default"
                              : "destructive"
                        }
                      >
                        <AlertDescription>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              vs Expected:{" "}
                              {isBalanced
                                ? "✓ Balanced"
                                : varianceFromExpected > 0
                                  ? "↑ Over"
                                  : "↓ Short"}
                            </span>
                            <span className="text-lg font-bold">
                              {varianceFromExpected > 0 ? "+" : ""}
                              {formatAmount(varianceFromExpected)}
                            </span>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Variance vs Declared */}
                    <Alert variant="default">
                      <AlertDescription>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            vs Declared:{" "}
                            {isDeclaredMatch ? "✓ Match" : "Difference"}
                          </span>
                          <span
                            className={`text-lg font-bold ${
                              isDeclaredMatch
                                ? "text-green-600"
                                : varianceFromDeclared > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                            }`}
                          >
                            {varianceFromDeclared > 0 ? "+" : ""}
                            {formatAmount(varianceFromDeclared)}
                          </span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Manager Comments */}
                <div className="space-y-2">
                  <Label htmlFor="comments">Manager Comments (Optional)</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) =>
                      setFormData({ ...formData, comments: e.target.value })
                    }
                    placeholder="Add any notes about the closure..."
                    rows={2}
                    disabled={!canManagerClose || actionMode === "reject"}
                  />
                </div>

                {/* Reject Reason (shown only when rejecting) */}
                {showRejectReason && (
                  <div className="space-y-2">
                    <Label htmlFor="rejectReason">
                      Reason for Rejection{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="rejectReason"
                      value={formData.rejectReason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rejectReason: e.target.value,
                        })
                      }
                      placeholder="Explain why you are rejecting this closure..."
                      rows={3}
                      disabled={loading}
                    />
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert
                    variant="default"
                    className="bg-green-50 text-green-800"
                  >
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                {!showRejectReason ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowRejectReason(true);
                      }}
                      disabled={loading || !canManagerClose || (sessionStatus !== undefined && sessionStatus !== "PENDING_CLOSURE")}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        loading ||
                        !canManagerClose ||
                        !formData.managerCountedAmount ||
                        (sessionStatus !== undefined && sessionStatus !== "PENDING_CLOSURE")
                      }
                      onClick={() => handleManagerClose()}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Closing...
                        </>
                      ) : (
                        "Close Session"
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowRejectReason(false);
                        setFormData({
                          ...formData,
                          rejectReason: "",
                        });
                      }}
                      disabled={loading}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      disabled={loading || !formData.rejectReason.trim()}
                      onClick={() => handleRejectClosure()}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Rejecting...
                        </>
                      ) : (
                        "Confirm Rejection"
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
