"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Loader2,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Users,
  UserCircle,
  RotateCcw,
  BarChart3,
  Hand,
  UserCheck,
  Banknote,
  ShieldCheck,
  Smartphone,
  Building2,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface AvailableTransition {
  stageId: string;
  stageName: string;
  stageColor: string;
  stageDescription: string | null;
  isFinalState: boolean;
  fineractAction: string | null;
  isBackward?: boolean;
  undoAction?: string | null;
  willSkip?: boolean;
  skipToStageId?: string | null;
  skipToStageName?: string | null;
  skipToStageColor?: string | null;
  skipToFineractAction?: string | null;
  skippedActions?: { stageName: string; action: string }[];
  skipToFineractAction?: string | null;
  receivingTeam: {
    id: string;
    name: string;
    assignmentStrategy: string;
    memberCount: number;
  } | null;
}

interface StateTransitionManagerProps {
  leadId: string;
  currentStage: string;
  currentStageColor?: string;
  assignedToUserId?: number | null;
  currentUserId?: string;
  isUserInStageTeam?: boolean;
  onTransitionComplete?: () => void;
}

const strategyLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  round_robin: { label: "Round Robin", icon: <RotateCcw className="h-3 w-3" /> },
  least_loaded: { label: "Least Loaded", icon: <BarChart3 className="h-3 w-3" /> },
  manual: { label: "Manual Assignment", icon: <Hand className="h-3 w-3" /> },
  specific_member: { label: "Specific Member", icon: <UserCheck className="h-3 w-3" /> },
};

export default function StateTransitionManager({
  leadId,
  currentStage,
  currentStageColor,
  assignedToUserId,
  currentUserId,
  isUserInStageTeam = false,
  onTransitionComplete,
}: StateTransitionManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingTransitions, setFetchingTransitions] = useState(false);
  const [transitions, setTransitions] = useState<AvailableTransition[]>([]);
  const [selectedTransition, setSelectedTransition] = useState<AvailableTransition | null>(null);
  const [reason, setReason] = useState("");
  const [fineractDate, setFineractDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentTypes, setPaymentTypes] = useState<{ id: number; name: string; isCashPayment?: boolean }[]>([]);
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [routingCode, setRoutingCode] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [bankNumber, setBankNumber] = useState("");

  // Payout-specific state
  const [tellers, setTellers] = useState<{ id: string; fineractTellerId: number; name: string; officeName: string }[]>([]);
  const [cashiers, setCashiers] = useState<{ id: string | number; dbId?: string; staffId: number; staffName: string; sessionStatus?: string }[]>([]);
  const [selectedTeller, setSelectedTeller] = useState("");
  const [selectedCashier, setSelectedCashier] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | "">("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [loadingTellers, setLoadingTellers] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [failedValidations, setFailedValidations] = useState<{ tab: string; checks: { id: string; label: string; message: string; severity?: string }[] }[]>([]);
  const hasBlockingValidations = failedValidations.some((tv) => tv.checks.some((c) => c.severity === "error"));
  const [overrideValidations, setOverrideValidations] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // Multi-approval state
  const [approvalStatus, setApprovalStatus] = useState<{
    requiredApprovals: number;
    approvals: { id: string; userId: string; userName: string; note?: string; approvedAt: string }[];
    isFullyApproved: boolean;
    userCanApprove: boolean;
    userHasApproved: boolean;
    userApprovalLimit: number | null;
    amountExceedsLimit: boolean;
    requestedAmount: number | null;
  } | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");

  const { toast } = useToast();
  const router = useRouter();

  // Derived: when a stage will be skipped, the effective Fineract action is from the destination stage
  const effectiveAction = useMemo(() => {
    if (selectedTransition?.willSkip && selectedTransition.skipToFineractAction) {
      return selectedTransition.skipToFineractAction;
    }
    return selectedTransition?.fineractAction || null;
  }, [selectedTransition]);

  const fetchApprovalStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/approve`);
      if (res.ok) {
        const data = await res.json();
        setApprovalStatus(data);
      }
    } catch {
      setApprovalStatus(null);
    }
  }, [leadId]);

  const handleApprove = async () => {
    setSubmittingApproval(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: approvalNote || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Approval Recorded",
          description: `${data.currentCount} of ${data.requiredCount} approvals collected.`,
        });
        setApprovalNote("");
        fetchApprovalStatus();
      } else {
        toast({
          title: "Approval Failed",
          description: data.error || "Could not record approval",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to submit approval",
        variant: "destructive",
      });
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleWithdrawApproval = async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/approve`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Approval Withdrawn" });
        fetchApprovalStatus();
      }
    } catch {
      toast({ title: "Error", description: "Failed to withdraw approval", variant: "destructive" });
    }
  };

  const fetchAvailableTransitions = useCallback(async () => {
    setFetchingTransitions(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/transition`);
      if (response.ok) {
        const data = await response.json();
        setTransitions(data.transitions || []);
      }
    } catch (error) {
      console.error("Error fetching available transitions:", error);
    } finally {
      setFetchingTransitions(false);
    }
  }, [leadId]);

  const checkValidations = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/tab-validations`, { cache: "no-store" });
      if (!res.ok) { setFailedValidations([]); return; }
      const data = await res.json();
      const failed: typeof failedValidations = [];
      for (const tv of data.tabs || []) {
        if (tv.tab === "validations") continue;
        const failedChecks = (tv.checks || []).filter((c: any) => !c.passed);
        if (failedChecks.length > 0) {
          failed.push({
            tab: tv.tab,
            checks: failedChecks.map((c: any) => ({
              id: c.id,
              label: c.label,
              message: c.message,
              severity: c.severity,
            })),
          });
        }
      }
      setFailedValidations(failed);
    } catch {
      setFailedValidations([]);
    }
  }, [leadId]);

  useEffect(() => {
    fetchApprovalStatus();
  }, [fetchApprovalStatus]);

  useEffect(() => {
    if (open) {
      fetchAvailableTransitions();
      checkValidations();
      fetchApprovalStatus();
      setSelectedTransition(null);
      setReason("");
      setFineractDate(new Date().toISOString().split("T")[0]);
      setPaymentTypeId("");
      setShowPaymentDetails(false);
      setAccountNumber("");
      setCheckNumber("");
      setRoutingCode("");
      setReceiptNumber("");
      setBankNumber("");
      setSelectedTeller("");
      setSelectedCashier("");
      setPayoutMethod("");
      setPayoutNotes("");
      setTellers([]);
      setCashiers([]);
      setOverrideValidations(false);
      setOverrideReason("");
    }
  }, [open, fetchAvailableTransitions, checkValidations]);

  useEffect(() => {
    if (effectiveAction === "disburse" && paymentTypes.length === 0) {
      fetch("/api/fineract/paymenttypes")
        .then((res) => res.ok ? res.json() : [])
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.pageItems ?? [];
          setPaymentTypes(list);
          const firstCash = list.find((p: any) => p.isCashPayment);
          if (firstCash) setPaymentTypeId(String(firstCash.id));
          else if (list.length > 0) setPaymentTypeId(String(list[0].id));
        })
        .catch(() => {});
    }
  }, [effectiveAction, paymentTypes.length]);

  // Fetch tellers when payout transition is selected
  useEffect(() => {
    if (effectiveAction === "payout" && tellers.length === 0) {
      setLoadingTellers(true);
      fetch("/api/tellers")
        .then((res) => res.ok ? res.json() : [])
        .then((data) => setTellers(data || []))
        .catch(() => {})
        .finally(() => setLoadingTellers(false));
    }
  }, [effectiveAction, tellers.length]);

  // Fetch cashiers when teller changes (payout flow)
  useEffect(() => {
    if (selectedTeller && effectiveAction === "payout") {
      setLoadingCashiers(true);
      setSelectedCashier("");
      fetch(`/api/tellers/${selectedTeller}/cashiers`)
        .then((res) => res.ok ? res.json() : [])
        .then((data) => {
          const active = (Array.isArray(data) ? data : []).filter(
            (c: any) => c.sessionStatus === "ACTIVE"
          );
          setCashiers(active);
        })
        .catch(() => {})
        .finally(() => setLoadingCashiers(false));
    } else {
      setCashiers([]);
      setSelectedCashier("");
    }
  }, [selectedTeller, selectedTransition]);

  const isAssigned =
    currentUserId != null &&
    assignedToUserId != null &&
    String(assignedToUserId) === currentUserId;

  const canSeeButton = isAssigned;

  const handleTransition = async () => {
    if (!selectedTransition) return;

    setLoading(true);
    try {
      let fineractOverrides: Record<string, any> | undefined;
      if (effectiveAction === "approve") {
        fineractOverrides = {
          approvalDate: fineractDate,
          note: reason || undefined,
        };
      } else if (effectiveAction === "disburse") {
        fineractOverrides = {
          disbursementDate: fineractDate,
          note: reason || undefined,
          paymentTypeId: paymentTypeId ? Number(paymentTypeId) : undefined,
          accountNumber: accountNumber || undefined,
          checkNumber: checkNumber || undefined,
          routingCode: routingCode || undefined,
          receiptNumber: receiptNumber || undefined,
          bankNumber: bankNumber || undefined,
        };
      } else if (effectiveAction === "reject") {
        fineractOverrides = {
          rejectionDate: fineractDate,
          note: reason || undefined,
        };
      } else if (effectiveAction === "payout") {
        fineractOverrides = {
          payoutMethod: payoutMethod || undefined,
          tellerId: selectedTeller || undefined,
          cashierId: selectedCashier || undefined,
          note: payoutNotes || reason || undefined,
        };
      }

      const response = await fetch(`/api/leads/${leadId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStageId: selectedTransition.stageId,
          reason: reason || undefined,
          fineractOverrides,
          overrideValidations: overrideValidations && hasBlockingValidations ? true : undefined,
          overrideReason: overrideValidations && hasBlockingValidations ? overrideReason : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Stage Updated",
          description: result.message,
        });
        setOpen(false);
        router.refresh();
        window.dispatchEvent(
          new CustomEvent("stage-transition-complete", {
            detail: { leadId, targetStageId: selectedTransition.stageId },
          })
        );
        onTransitionComplete?.();
      } else {
        toast({
          title: "Transition Failed",
          description: result.message || "Failed to move lead",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error transitioning lead:", error);
      toast({
        title: "Error",
        description: "Failed to move lead to next stage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canSeeButton) {
    return null;
  }

  const needsMultiApproval =
    approvalStatus && approvalStatus.requiredApprovals > 1;
  const approvalBlocked =
    needsMultiApproval && !approvalStatus.isFullyApproved;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft className="h-4 w-4 mr-2" />
          Move Stage
          {approvalBlocked && (
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {approvalStatus.approvals.length}/{approvalStatus.requiredApprovals}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Move Lead to Next Stage</DialogTitle>
          <DialogDescription>
            Select a stage to move this lead to. The lead will be automatically assigned to the receiving team.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">

        {/* Multi-approval panel — inside dialog */}
        {needsMultiApproval && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Stage Approvals
                </span>
              </div>
              <Badge
                variant="outline"
                className={
                  approvalStatus.isFullyApproved
                    ? "border-green-300 text-green-700 bg-green-50"
                    : "border-blue-300 text-blue-700 bg-blue-50"
                }
              >
                {approvalStatus.approvals.length} / {approvalStatus.requiredApprovals}
              </Badge>
            </div>

            <div className="w-full bg-blue-100 dark:bg-blue-900/40 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  approvalStatus.isFullyApproved ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (approvalStatus.approvals.length / approvalStatus.requiredApprovals) * 100
                  )}%`,
                }}
              />
            </div>

            {approvalStatus.approvals.length > 0 && (
              <div className="space-y-1.5">
                {approvalStatus.approvals.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-xs bg-white dark:bg-background/50 rounded p-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      <span className="font-medium">{a.userName}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(a.approvedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {approvalStatus.userCanApprove && !approvalStatus.userHasApproved && (
              <div className="space-y-2 border-t border-blue-200 dark:border-blue-800 pt-3">
                <Input
                  placeholder="Approval note (optional)"
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  className="text-sm"
                />
                <Button
                  onClick={handleApprove}
                  disabled={submittingApproval || approvalStatus.amountExceedsLimit}
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submittingApproval ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : approvalStatus.amountExceedsLimit ? (
                    `Amount exceeds your limit (K${approvalStatus.userApprovalLimit?.toLocaleString()})`
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
              </div>
            )}

            {approvalStatus.userHasApproved && !approvalStatus.isFullyApproved && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleWithdrawApproval}
                className="text-xs text-muted-foreground"
              >
                Withdraw my approval
              </Button>
            )}

            {approvalStatus.isFullyApproved && (
              <p className="text-xs text-green-700 dark:text-green-400 font-medium flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                All approvals collected — ready to move
              </p>
            )}
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Current Stage */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground shrink-0">From:</Label>
            <Badge
              variant="outline"
              className="font-medium"
              style={currentStageColor ? { borderColor: currentStageColor, color: currentStageColor } : undefined}
            >
              {currentStage}
            </Badge>
          </div>

          {/* Available Transitions */}
          {fetchingTransitions ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transitions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No transitions available from the current stage.
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm">Move to:</Label>
              <div className="grid gap-2">
                {transitions.map((t) => {
                  const isSelected = selectedTransition?.stageId === t.stageId;
                  const strategyInfo = t.receivingTeam
                    ? strategyLabels[t.receivingTeam.assignmentStrategy] || strategyLabels.round_robin
                    : null;

                  return (
                    <button
                      key={t.stageId}
                      type="button"
                      onClick={() => setSelectedTransition(t)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: t.stageColor }}
                            />
                            <span className="font-medium text-sm">{t.stageName}</span>
                            {t.isFinalState && (
                              <Badge variant="secondary" className="text-xs">
                                Final
                              </Badge>
                            )}
                            {t.fineractAction === "approve" && (
                              <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Approve
                              </Badge>
                            )}
                            {t.fineractAction === "disburse" && (
                              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                                <Banknote className="h-3 w-3 mr-1" />
                                Disburse
                              </Badge>
                            )}
                            {t.fineractAction === "payout" && (
                              <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                                <Banknote className="h-3 w-3 mr-1" />
                                Payout
                              </Badge>
                            )}
                            {t.fineractAction === "reject" && (
                              <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Badge>
                            )}
                            {t.isBackward && (
                              <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                <ArrowLeft className="h-3 w-3 mr-1" />
                                Back
                              </Badge>
                            )}
                            {t.undoAction && (
                              <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
                                <Undo2 className="h-3 w-3 mr-1" />
                                Undo {t.undoAction === "approve" ? "Approval" : t.undoAction === "disburse" ? "Disbursement" : t.undoAction === "payout" ? "Payout" : t.undoAction}
                              </Badge>
                            )}
                            {t.willSkip && (
                              <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50">
                                <ArrowRight className="h-3 w-3 mr-1" />
                                Auto-skip
                              </Badge>
                            )}
                          </div>
                          {t.stageDescription && !t.willSkip && (
                            <p className="text-xs text-muted-foreground mt-1 ml-5">
                              {t.stageDescription}
                            </p>
                          )}
                          {t.willSkip && t.skipToStageName && (
                            <div className="mt-1 ml-5 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground line-through">{t.stageName}</span>
                                <ArrowRight className="h-3 w-3 text-purple-500" />
                                <div className="flex items-center gap-1">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: t.skipToStageColor || undefined }}
                                  />
                                  <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
                                    {t.skipToStageName}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">(amount below threshold)</span>
                              </div>
                              {t.skippedActions && t.skippedActions.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs text-amber-600 dark:text-amber-400">Auto-actions:</span>
                                  {t.skippedActions.map((sa, i) => (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="text-xs border-amber-300 text-amber-700 bg-amber-50"
                                    >
                                      {sa.action === "approve" && <ShieldCheck className="h-3 w-3 mr-1" />}
                                      {sa.action === "disburse" && <Banknote className="h-3 w-3 mr-1" />}
                                      {sa.action}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {t.receivingTeam && (
                          <div className="shrink-0 text-right">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              <span>{t.receivingTeam.name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 justify-end">
                              {strategyInfo?.icon}
                              <span>{strategyInfo?.label}</span>
                              <span className="text-muted-foreground/60">
                                ({t.receivingTeam.memberCount})
                              </span>
                            </div>
                          </div>
                        )}

                        {!t.receivingTeam && (
                          <span className="text-xs text-muted-foreground/60 italic shrink-0">
                            No team assigned
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transition Preview */}
          {selectedTransition && (
            <div className="flex items-center gap-2 justify-center py-2 bg-muted/30 rounded-lg flex-wrap">
              <Badge variant="outline">{currentStage}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              {selectedTransition.willSkip && selectedTransition.skipToStageName ? (
                <>
                  <Badge
                    variant="outline"
                    className="line-through opacity-50"
                    style={{
                      borderColor: selectedTransition.stageColor,
                      color: selectedTransition.stageColor,
                    }}
                  >
                    {selectedTransition.stageName}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-purple-500" />
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: selectedTransition.skipToStageColor || undefined,
                      color: selectedTransition.skipToStageColor || undefined,
                    }}
                  >
                    {selectedTransition.skipToStageName}
                  </Badge>
                </>
              ) : (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: selectedTransition.stageColor,
                    color: selectedTransition.stageColor,
                  }}
                >
                  {selectedTransition.stageName}
                </Badge>
              )}
              {selectedTransition.receivingTeam && (
                <>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserCircle className="h-3 w-3" />
                    {selectedTransition.receivingTeam.name}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Undo Action Warning */}
          {selectedTransition?.undoAction && (
            <div className="rounded-lg border border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/30 p-4">
              <div className="flex items-start gap-2">
                <Undo2 className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                    This will undo the {selectedTransition.undoAction === "approve" ? "loan approval" : selectedTransition.undoAction === "disburse" ? "loan disbursement" : selectedTransition.undoAction === "payout" ? "loan payout" : selectedTransition.undoAction} in Fineract
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    {selectedTransition.undoAction === "approve"
                      ? "The loan will return to \"Submitted and pending approval\" status."
                      : selectedTransition.undoAction === "disburse"
                      ? "The loan will return to \"Approved\" status and the disbursement will be reversed."
                      : selectedTransition.undoAction === "payout"
                      ? "The payout record will be reversed and cashier transactions will be undone."
                      : "The previous action will be reversed."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fineract Action Fields — approve / disburse / reject */}
          {effectiveAction && effectiveAction !== "payout" && !selectedTransition?.isBackward && (
            <div className={`rounded-lg border p-4 space-y-3 ${
              effectiveAction === "reject"
                ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30"
                : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30"
            }`}>
              <div className="flex items-center gap-2">
                {effectiveAction === "approve" ? (
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                ) : effectiveAction === "reject" ? (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                ) : (
                  <Banknote className="h-4 w-4 text-amber-600" />
                )}
                <span className={`text-sm font-medium ${
                  effectiveAction === "reject"
                    ? "text-red-800 dark:text-red-300"
                    : "text-amber-800 dark:text-amber-300"
                }`}>
                  {effectiveAction === "approve"
                    ? selectedTransition?.willSkip
                      ? "This will auto-approve the loan in Fineract (stage skipped)"
                      : "This stage will approve the loan in Fineract"
                    : effectiveAction === "reject"
                    ? "This will reject the loan in Fineract"
                    : selectedTransition?.willSkip
                    ? "This will auto-disburse the loan in Fineract (stage skipped)"
                    : "This stage will disburse the loan in Fineract"}
                </span>
              </div>

              {effectiveAction !== "reject" && (
              <div className="space-y-2">
                <Label htmlFor="fineract-date" className="text-sm">
                  {effectiveAction === "approve"
                    ? "Approval Date"
                    : "Disbursement Date"}
                </Label>
                <Input
                  id="fineract-date"
                  type="date"
                  value={fineractDate}
                  onChange={(e) => setFineractDate(e.target.value)}
                />
              </div>
              )}

              {effectiveAction === "disburse" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Payment Type</Label>
                    <Select value={paymentTypeId} onValueChange={setPaymentTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentTypes.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}{p.isCashPayment ? " (Cash)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show-payment-details"
                      checked={showPaymentDetails}
                      onCheckedChange={(checked) => setShowPaymentDetails(!!checked)}
                    />
                    <Label htmlFor="show-payment-details" className="text-sm cursor-pointer">
                      Show Payment Details
                    </Label>
                  </div>

                  {showPaymentDetails && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Account #</Label>
                        <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cheque #</Label>
                        <Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Routing Code</Label>
                        <Input value={routingCode} onChange={(e) => setRoutingCode(e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Receipt #</Label>
                        <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Bank #</Label>
                        <Input value={bankNumber} onChange={(e) => setBankNumber(e.target.value)} placeholder="Optional" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Payout Action Fields */}
          {effectiveAction === "payout" && !selectedTransition?.isBackward && (
            <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  This stage will process the loan payout
                </span>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label className="text-sm">Payment Method *</Label>
                <Select value={payoutMethod} onValueChange={(v) => setPayoutMethod(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">
                      <span className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-green-600" />
                        Cash
                      </span>
                    </SelectItem>
                    <SelectItem value="MOBILE_MONEY">
                      <span className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-blue-600" />
                        Mobile Money
                      </span>
                    </SelectItem>
                    <SelectItem value="BANK_TRANSFER">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-purple-600" />
                        Bank Transfer
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Teller & Cashier — cash only */}
              {payoutMethod === "CASH" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Teller *</Label>
                    <Select value={selectedTeller} onValueChange={setSelectedTeller}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={loadingTellers ? "Loading tellers..." : "Select a teller"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {tellers.map((t) => (
                          <SelectItem
                            key={t.id}
                            value={t.fineractTellerId?.toString() || t.id}
                          >
                            {t.name} — {t.officeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Cashier *</Label>
                    <Select
                      value={selectedCashier}
                      onValueChange={setSelectedCashier}
                      disabled={!selectedTeller || loadingCashiers}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedTeller
                              ? "Select a teller first"
                              : loadingCashiers
                              ? "Loading cashiers..."
                              : cashiers.length === 0
                              ? "No cashiers with active sessions"
                              : "Select a cashier"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {cashiers.map((c) => (
                          <SelectItem
                            key={c.dbId || c.id}
                            value={(c.dbId || c.id).toString()}
                          >
                            {c.staffName}
                            {c.sessionStatus === "ACTIVE" && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Active
                              </Badge>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTeller && cashiers.length === 0 && !loadingCashiers && (
                      <p className="text-sm text-yellow-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        No cashiers have active sessions. Start a session first.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Non-cash info */}
              {payoutMethod && payoutMethod !== "CASH" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
                  <p className="font-medium">
                    {payoutMethod === "MOBILE_MONEY" ? "Mobile Money Payout" : "Bank Transfer Payout"}
                  </p>
                  <p className="text-xs mt-1">
                    The payout will be marked as paid. No cashier balance will be affected.
                  </p>
                </div>
              )}

              {/* Payout Notes */}
              <div className="space-y-2">
                <Label className="text-sm">Payout Notes (optional)</Label>
                <Textarea
                  placeholder="Additional notes for this payout..."
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Reason — hidden for payout since it has its own notes field */}
          {effectiveAction !== "payout" && (
            <div className="space-y-2">
              <Label htmlFor="transition-reason">
                {effectiveAction === "reject"
                  ? <>Rejection Reason <span className="text-red-500">*</span></>
                  : <>Note <span className="text-muted-foreground text-xs">(optional)</span></>}
              </Label>
              <Textarea
                id="transition-reason"
                placeholder={effectiveAction === "reject"
                  ? "Provide a reason for rejecting this loan..."
                  : "Add a note about this transition..."}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={effectiveAction === "reject" ? 3 : 2}
                className={effectiveAction === "reject" ? "border-red-200 focus:ring-red-500" : undefined}
              />
            </div>
          )}

          {/* Validation Override */}
          {selectedTransition && failedValidations.length > 0 && !selectedTransition.isBackward && (
            <div className={`rounded-md border p-3 ${
              overrideValidations
                ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20"
                : hasBlockingValidations
                ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                : "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20"
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${
                  overrideValidations ? "text-orange-600" : hasBlockingValidations ? "text-red-600" : "text-yellow-600"
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${hasBlockingValidations ? "text-red-800 dark:text-red-400" : "text-yellow-800 dark:text-yellow-400"}`}>
                    {failedValidations.reduce((sum, t) => sum + t.checks.length, 0)} validation{failedValidations.reduce((sum, t) => sum + t.checks.length, 0) !== 1 ? "s" : ""} {hasBlockingValidations ? "need attention" : "(warnings)"}
                  </p>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {failedValidations.map((tv) => (
                      <div key={tv.tab}>
                        <p className="text-xs font-semibold capitalize" style={{ color: tv.checks.some(c => c.severity === "error") ? undefined : "rgb(161, 98, 7)" }}>
                          {tv.tab}
                        </p>
                        <ul className="text-xs mt-0.5 space-y-0.5 ml-3">
                          {tv.checks.map((c) => (
                            <li key={c.id} className={`flex items-start gap-1.5 ${c.severity === "error" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                              <span className="shrink-0 mt-0.5">{c.severity === "error" ? "✕" : "⚠"}</span>
                              <span>{c.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {hasBlockingValidations && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="override-validations"
                          checked={overrideValidations}
                          onCheckedChange={(checked) => {
                            setOverrideValidations(!!checked);
                            if (!checked) setOverrideReason("");
                          }}
                        />
                        <Label
                          htmlFor="override-validations"
                          className="text-xs font-medium text-red-800 dark:text-red-400 cursor-pointer"
                        >
                          Override and proceed anyway
                        </Label>
                      </div>

                      {overrideValidations && (
                        <div className="mt-2">
                          <Label className="text-xs text-orange-700 dark:text-orange-400">
                            Override Reason <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            placeholder="Explain why this override is necessary..."
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            rows={2}
                            className="mt-1 text-sm border-orange-300 focus:ring-orange-500 bg-white dark:bg-background"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTransition}
            disabled={
              loading ||
              !selectedTransition ||
              (!!approvalBlocked && !selectedTransition?.isBackward) ||
              (hasBlockingValidations && !selectedTransition?.isBackward && !overrideValidations) ||
              (hasBlockingValidations && !selectedTransition?.isBackward && overrideValidations && !overrideReason?.trim()) ||
              (!selectedTransition?.isBackward && effectiveAction === "payout" && !payoutMethod) ||
              (!selectedTransition?.isBackward && effectiveAction === "payout" && payoutMethod === "CASH" && (!selectedTeller || !selectedCashier)) ||
              (!selectedTransition?.isBackward && effectiveAction === "reject" && !reason?.trim())
            }
            className={
              selectedTransition?.isBackward
                ? "bg-orange-600 hover:bg-orange-700"
                : effectiveAction === "reject"
                ? "bg-red-600 hover:bg-red-700"
                : effectiveAction === "payout"
                ? "bg-green-600 hover:bg-green-700"
                : undefined
            }
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {selectedTransition?.isBackward
                  ? selectedTransition.undoAction
                    ? "Undoing & Moving Back..."
                    : "Moving Back..."
                  : effectiveAction === "approve"
                  ? "Approving..."
                  : effectiveAction === "disburse"
                  ? "Disbursing..."
                  : effectiveAction === "payout"
                  ? "Processing Payout..."
                  : effectiveAction === "reject"
                  ? "Rejecting..."
                  : "Moving..."}
              </>
            ) : (
              <>
                {selectedTransition?.isBackward ? (
                  <Undo2 className="mr-2 h-4 w-4" />
                ) : effectiveAction === "approve" ? (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                ) : effectiveAction === "disburse" ? (
                  <Banknote className="mr-2 h-4 w-4" />
                ) : effectiveAction === "payout" ? (
                  <Banknote className="mr-2 h-4 w-4" />
                ) : effectiveAction === "reject" ? (
                  <AlertCircle className="mr-2 h-4 w-4" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {selectedTransition?.isBackward
                  ? selectedTransition.undoAction
                    ? `Undo ${selectedTransition.undoAction === "approve" ? "Approval" : selectedTransition.undoAction === "disburse" ? "Disbursement" : selectedTransition.undoAction === "payout" ? "Payout" : selectedTransition.undoAction} & Move Back`
                    : "Move Back"
                  : effectiveAction === "approve"
                  ? "Approve & Move"
                  : effectiveAction === "disburse"
                  ? "Disburse & Move"
                  : effectiveAction === "payout"
                  ? "Process Payout & Move"
                  : effectiveAction === "reject"
                  ? "Reject Loan"
                  : "Confirm"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
