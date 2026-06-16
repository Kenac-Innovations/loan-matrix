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
import { useReceiptValidation } from "@/hooks/use-receipt-validation";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getPreferredPaymentMethodLabel,
  inferPreferredPaymentMethodFromPaymentType,
  normalizePreferredPaymentMethod,
  resolvePaymentTypeForPreferredMethod,
} from "@/lib/payment-method-resolution";
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
  UserX,
  Banknote,
  ShieldCheck,
  Smartphone,
  Building2,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { canMoveAssignedLead } from "@/lib/lead-transition-permissions";
import {
  getLocalIsoDate,
  isGoodfellowTenantHostname,
} from "@/lib/goodfellow-tenant";

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
  preferredPaymentMethod?: string | null;
  currentUserId?: string;
  assignedToUserId?: string | number | null;
  isUserInStageTeam?: boolean;
  canManageLead?: boolean;
  onTransitionComplete?: () => void;
}

interface DisbursementPolicy {
  onlyOriginatorCanDisburse: boolean;
  canOverrideInitiatorDisbursement?: boolean;
  designatedDisburserUserId?: number | null;
  designatedDisburserUserName?: string | null;
  blockReason?: string | null;
}

interface MifosUser {
  id: number;
  displayName: string;
  officeName?: string;
}

const strategyLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  round_robin: { label: "Round Robin", icon: <RotateCcw className="h-3 w-3" /> },
  least_loaded: { label: "Least Loaded", icon: <BarChart3 className="h-3 w-3" /> },
  manual: { label: "Manual Assignment", icon: <Hand className="h-3 w-3" /> },
  specific_member: { label: "Specific Member", icon: <UserCheck className="h-3 w-3" /> },
};

interface CurrentCashierContext {
  isCashier: boolean;
  hasActiveSession: boolean;
  staffId: number | null;
  staffName: string | null;
  cashierId: string | null;
  fineractCashierId: number | null;
  tellerId: string | null;
  fineractTellerId: number | null;
  tellerName: string | null;
  tellerOfficeName: string | null;
  reason?: string;
}

export default function StateTransitionManager({
  leadId,
  currentStage,
  currentStageColor,
  preferredPaymentMethod,
  currentUserId,
  assignedToUserId,
  isUserInStageTeam,
  canManageLead = true,
  onTransitionComplete,
}: StateTransitionManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingTransitions, setFetchingTransitions] = useState(false);
  const [transitions, setTransitions] = useState<AvailableTransition[]>([]);
  const [disbursementPolicy, setDisbursementPolicy] =
    useState<DisbursementPolicy | null>(null);
  const [mifosUsers, setMifosUsers] = useState<MifosUser[]>([]);
  const [selectedDesignatedUserId, setSelectedDesignatedUserId] =
    useState("");
  const [updatingDesignatedDisburser, setUpdatingDesignatedDisburser] =
    useState(false);
  const [loadingMifosUsers, setLoadingMifosUsers] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<AvailableTransition | null>(null);
  const [reason, setReason] = useState("");
  const [fineractDate, setFineractDate] = useState(getLocalIsoDate());
  const [isGoodfellowTenant, setIsGoodfellowTenant] = useState(false);
  const [paymentTypes, setPaymentTypes] = useState<{ id: number; name: string; isCashPayment?: boolean }[]>([]);
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [routingCode, setRoutingCode] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [currentCashierContext, setCurrentCashierContext] = useState<CurrentCashierContext | null>(null);
  const [loadingCurrentCashier, setLoadingCurrentCashier] = useState(false);

  // Payout-specific state
  const [tellers, setTellers] = useState<{ id: string; fineractTellerId: number; name: string; officeName: string }[]>([]);
  const [cashiers, setCashiers] = useState<{ id: string | number; dbId?: string; staffId: number; staffName: string; sessionStatus?: string }[]>([]);
  const [selectedTeller, setSelectedTeller] = useState("");
  const [selectedCashier, setSelectedCashier] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | "">("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [loadingTellers, setLoadingTellers] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [paymentTypeResolutionError, setPaymentTypeResolutionError] = useState<string | null>(null);
  const [failedValidations, setFailedValidations] = useState<{ tab: string; checks: { id: string; label: string; message: string; severity?: string }[] }[]>([]);
  const hasBlockingValidations = failedValidations.some((tv) => tv.checks.some((c) => c.severity === "error"));
  const [overrideValidations, setOverrideValidations] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const normalizedPreferredPaymentMethod = useMemo(
    () => normalizePreferredPaymentMethod(preferredPaymentMethod),
    [preferredPaymentMethod]
  );

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
  const {
    receiptRangesEnabled,
    isValidating: isValidatingReceipt,
    validationResult: receiptValidation,
    validate: validateReceipt,
    validateDebounced: validateReceiptDebounced,
    markUsed: markReceiptUsed,
    clearValidation: clearReceiptValidation,
  } = useReceiptValidation();

  // Derived: when a stage will be skipped, the effective Fineract action is from the destination stage
  const effectiveAction = useMemo(() => {
    if (selectedTransition?.willSkip && selectedTransition.skipToFineractAction) {
      return selectedTransition.skipToFineractAction;
    }
    return selectedTransition?.fineractAction || null;
  }, [selectedTransition]);
  const selectedPaymentType = useMemo(
    () => paymentTypes.find((paymentType) => String(paymentType.id) === paymentTypeId) || null,
    [paymentTypeId, paymentTypes]
  );
  const selectedPaymentTypeIsCash = Boolean(selectedPaymentType?.isCashPayment);
  const derivedDisbursementPayoutMethod = useMemo(
    () => inferPreferredPaymentMethodFromPaymentType(selectedPaymentType) || "",
    [selectedPaymentType]
  );
  const resolvedPreferredPaymentType = useMemo(
    () =>
      resolvePaymentTypeForPreferredMethod(
        normalizedPreferredPaymentMethod,
        paymentTypes
      ),
    [normalizedPreferredPaymentMethod, paymentTypes]
  );
  const effectivePayoutMethod = useMemo(
    () => normalizedPreferredPaymentMethod || payoutMethod,
    [normalizedPreferredPaymentMethod, payoutMethod]
  );
  const usesReadOnlyCurrentDate =
    isGoodfellowTenant &&
    !selectedTransition?.isBackward &&
    (effectiveAction === "approve" ||
      effectiveAction === "disburse" ||
      effectiveAction === "payout");

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
        setDisbursementPolicy(data.disbursementPolicy || null);
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
        const failedChecks = (tv.checks || []).filter(
          (c: { passed?: boolean }) => !c.passed
        );
        if (failedChecks.length > 0) {
          failed.push({
            tab: tv.tab,
            checks: failedChecks.map((c: { id: string; label: string; message: string; severity?: string }) => ({
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
    if (typeof window !== "undefined") {
      setIsGoodfellowTenant(isGoodfellowTenantHostname(window.location.hostname));
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchAvailableTransitions();
      checkValidations();
      fetchApprovalStatus();
      setSelectedTransition(null);
      setReason("");
      setFineractDate(getLocalIsoDate());
      setPaymentTypes([]);
      setPaymentTypeId("");
      setShowPaymentDetails(false);
      setAccountNumber("");
      setCheckNumber("");
      setRoutingCode("");
      setReceiptNumber("");
      setBankNumber("");
      setCurrentCashierContext(null);
      setSelectedTeller("");
      setSelectedCashier("");
      setPayoutMethod("");
      setPayoutNotes("");
      setTellers([]);
      setCashiers([]);
      setMifosUsers([]);
      setSelectedDesignatedUserId("");
      setDisbursementPolicy(null);
      setPaymentTypeResolutionError(null);
      setOverrideValidations(false);
      setOverrideReason("");
      clearReceiptValidation();
    }
  }, [open, fetchAvailableTransitions, checkValidations, clearReceiptValidation, fetchApprovalStatus]);

  useEffect(() => {
    if (open && usesReadOnlyCurrentDate) {
      setFineractDate(getLocalIsoDate());
    }
  }, [open, selectedTransition?.stageId, usesReadOnlyCurrentDate]);

  useEffect(() => {
    if (effectiveAction === "disburse" && paymentTypes.length === 0) {
      fetch("/api/fineract/paymenttypes")
        .then((res) => res.ok ? res.json() : [])
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.pageItems ?? [];
          setPaymentTypes(list);
          if (normalizedPreferredPaymentMethod) {
            const resolved = resolvePaymentTypeForPreferredMethod(
              normalizedPreferredPaymentMethod,
              list
            );

            if (resolved) {
              setPaymentTypeId(resolved.paymentTypeId);
              setPaymentTypeResolutionError(null);
            } else {
              setPaymentTypeId("");
              setPaymentTypeResolutionError(
                `No allowed ${getPreferredPaymentMethodLabel(normalizedPreferredPaymentMethod)} payment type is available for your branch or user profile.`
              );
            }
          } else {
            const firstCash = list.find((p: { isCashPayment?: boolean }) => p.isCashPayment);
            const firstNonCash = list.find((p: { isCashPayment?: boolean }) => !p.isCashPayment);
            const defaultPaymentType = currentCashierContext?.isCashier
              ? (firstCash || list[0])
              : (firstNonCash || list[0]);
            if (defaultPaymentType) {
              setPaymentTypeId(String(defaultPaymentType.id));
            }
          }
        })
        .catch(() => {});
    }
  }, [currentCashierContext?.isCashier, effectiveAction, normalizedPreferredPaymentMethod, paymentTypes.length]);

  useEffect(() => {
    if (
      !open ||
      effectiveAction !== "disburse" ||
      !disbursementPolicy?.onlyOriginatorCanDisburse ||
      !disbursementPolicy?.canOverrideInitiatorDisbursement ||
      mifosUsers.length > 0
    ) {
      return;
    }

    let cancelled = false;
    setLoadingMifosUsers(true);
    fetch("/api/fineract/users")
      .then((response) => (response.ok ? response.json() : { users: [] }))
      .then((data) => {
        if (cancelled) return;
        setMifosUsers(data.users || []);
      })
      .catch(() => {
        if (!cancelled) {
          setMifosUsers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMifosUsers(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    disbursementPolicy?.canOverrideInitiatorDisbursement,
    disbursementPolicy?.onlyOriginatorCanDisburse,
    effectiveAction,
    mifosUsers.length,
    open,
  ]);

  useEffect(() => {
    if (effectiveAction !== "disburse") return;

    let cancelled = false;
    setLoadingCurrentCashier(true);
    fetch("/api/auth/current-cashier")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setCurrentCashierContext(data);
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentCashierContext(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCurrentCashier(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveAction]);

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
            (c: { sessionStatus?: string }) => c.sessionStatus === "ACTIVE"
          );
          setCashiers(active);
        })
        .catch(() => {})
        .finally(() => setLoadingCashiers(false));
    } else {
      setCashiers([]);
      setSelectedCashier("");
    }
  }, [effectiveAction, selectedTeller]);

  useEffect(() => {
    if (effectiveAction !== "disburse") return;

    if (normalizedPreferredPaymentMethod) return;

    if (!currentCashierContext?.isCashier && selectedPaymentTypeIsCash) {
      const firstNonCash = paymentTypes.find((paymentType) => !paymentType.isCashPayment);
      if (firstNonCash) {
        setPaymentTypeId(String(firstNonCash.id));
      }
    }
  }, [
    currentCashierContext?.isCashier,
    effectiveAction,
    normalizedPreferredPaymentMethod,
    paymentTypes,
    selectedPaymentTypeIsCash,
  ]);

  const canSeeButton = canMoveAssignedLead({
    currentUserId,
    assignedToUserId,
    isUserInCurrentStageTeam: Boolean(isUserInStageTeam),
    canManageLead,
  });
  const disbursementBlocked =
    effectiveAction === "disburse" &&
    Boolean(disbursementPolicy?.onlyOriginatorCanDisburse) &&
    Boolean(disbursementPolicy?.blockReason);
  const transitionBlockedByDisbursementPolicy =
    !selectedTransition?.isBackward && disbursementBlocked;

  const handleSetDesignatedDisburser = async () => {
    if (!selectedDesignatedUserId) return;

    const selectedUser = mifosUsers.find(
      (user) => String(user.id) === selectedDesignatedUserId
    );

    if (!selectedUser) {
      toast({
        title: "Selection Error",
        description: "Selected designated disburser was not found.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingDesignatedDisburser(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/designated-disburser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mifosUserId: selectedUser.id,
          mifosUserName: selectedUser.displayName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Update Failed",
          description:
            result.error || "Could not update the designated disburser.",
          variant: "destructive",
        });
        return;
      }

      setSelectedDesignatedUserId("");
      await fetchAvailableTransitions();
      toast({
        title: "Designated Disburser Updated",
        description: `${selectedUser.displayName} can now disburse this loan.`,
      });
    } catch (error) {
      console.error("Error updating designated disburser:", error);
      toast({
        title: "Error",
        description: "Failed to update the designated disburser.",
        variant: "destructive",
      });
    } finally {
      setUpdatingDesignatedDisburser(false);
    }
  };

  const handleClearDesignatedDisburser = async () => {
    setUpdatingDesignatedDisburser(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/designated-disburser`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Clear Failed",
          description:
            result.error || "Could not clear the designated disburser.",
          variant: "destructive",
        });
        return;
      }

      await fetchAvailableTransitions();
      toast({
        title: "Designated Disburser Cleared",
        description: "This loan now requires a designated disburser before it can be disbursed.",
      });
    } catch (error) {
      console.error("Error clearing designated disburser:", error);
      toast({
        title: "Error",
        description: "Failed to clear the designated disburser.",
        variant: "destructive",
      });
    } finally {
      setUpdatingDesignatedDisburser(false);
    }
  };

  const handleTransition = async () => {
    if (!selectedTransition) return;

    if (disbursementBlocked) {
      toast({
        title: "Disbursement Blocked",
        description:
          disbursementPolicy?.blockReason ||
          "This loan cannot be disbursed right now.",
        variant: "destructive",
      });
      return;
    }

    if (effectiveAction === "disburse") {
      if (normalizedPreferredPaymentMethod && !resolvedPreferredPaymentType) {
        toast({
          title: "Payment Type Unavailable",
          description:
            paymentTypeResolutionError ||
            "No allowed payment type is available for the saved lead payment method.",
          variant: "destructive",
        });
        return;
      }

      if (!paymentTypeId) {
        toast({
          title: "Validation Error",
          description: normalizedPreferredPaymentMethod
            ? "No allowed payment type is available for the saved lead payment method."
            : "Please select a disbursement payment type.",
          variant: "destructive",
        });
        return;
      }

      if (!derivedDisbursementPayoutMethod) {
        toast({
          title: "Validation Error",
          description: "Could not resolve payout method from the selected payment type.",
          variant: "destructive",
        });
        return;
      }

      if (derivedDisbursementPayoutMethod === "CASH") {
        if (!selectedPaymentTypeIsCash) {
          toast({
            title: "Validation Error",
            description: "Cash payout requires a cash disbursement payment type.",
            variant: "destructive",
          });
          return;
        }

        if (!currentCashierContext?.isCashier) {
          toast({
            title: "Cash Payout Not Allowed",
            description:
              currentCashierContext?.reason ||
              "Only a logged-in cashier can choose cash for this disbursement.",
            variant: "destructive",
          });
          return;
        }

        if (!currentCashierContext.hasActiveSession) {
          toast({
            title: "Cashier Session Required",
            description:
              currentCashierContext.reason ||
              "Start an active cashier session before using cash.",
            variant: "destructive",
          });
          return;
        }
      }

      if (receiptRangesEnabled && selectedPaymentTypeIsCash) {
        if (!receiptNumber.trim()) {
          toast({
            title: "Validation Error",
            description: "Receipt number is required for cash disbursements.",
            variant: "destructive",
          });
          return;
        }

        const validation = await validateReceipt(receiptNumber);
        if (!validation.valid) {
          toast({
            title: "Validation Error",
            description: validation.error || "Invalid receipt number.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setLoading(true);
    try {
      let fineractOverrides: Record<string, unknown> | undefined;
      const transitionDate = usesReadOnlyCurrentDate
        ? getLocalIsoDate()
        : fineractDate;
      if (effectiveAction === "approve") {
        fineractOverrides = {
          approvalDate: transitionDate,
          note: reason || undefined,
        };
      } else if (effectiveAction === "disburse") {
        fineractOverrides = {
          disbursementDate: transitionDate,
          note: reason || undefined,
          paymentTypeId: paymentTypeId ? Number(paymentTypeId) : undefined,
          accountNumber: accountNumber || undefined,
          checkNumber: checkNumber || undefined,
          routingCode: routingCode || undefined,
          receiptNumber: receiptNumber || undefined,
          bankNumber: bankNumber || undefined,
          payoutMethod: derivedDisbursementPayoutMethod || undefined,
          payoutDate: usesReadOnlyCurrentDate ? transitionDate : undefined,
          payoutNote: payoutNotes || undefined,
        };
      } else if (effectiveAction === "reject") {
        fineractOverrides = {
          rejectionDate: fineractDate,
          note: reason || undefined,
        };
      } else if (effectiveAction === "payout") {
        fineractOverrides = {
          payoutMethod: effectivePayoutMethod || undefined,
          payoutDate: usesReadOnlyCurrentDate ? transitionDate : undefined,
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
        if (effectiveAction === "disburse" && receiptRangesEnabled && selectedPaymentTypeIsCash && receiptNumber.trim()) {
          await markReceiptUsed({
            receiptNumber: receiptNumber.trim(),
            transactionType: "DISBURSEMENT",
          });
        }

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
            Select a stage to move this lead forward or back. Team permissions and tenant rules are applied when the transition runs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">

        {disbursementBlocked && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Disbursement is blocked</p>
                <p>
                  {disbursementPolicy?.blockReason}
                </p>
              </div>
            </div>
          </div>
        )}

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
                  disabled={usesReadOnlyCurrentDate}
                  onChange={(e) => setFineractDate(e.target.value)}
                  className={
                    usesReadOnlyCurrentDate
                      ? "cursor-not-allowed disabled:opacity-100"
                      : undefined
                  }
                />
                {usesReadOnlyCurrentDate && (
                  <p className="text-xs text-muted-foreground">
                    Goodfellow uses the current date automatically for this action.
                  </p>
                )}
              </div>
              )}

              {effectiveAction === "disburse" && (
                <>
                  {disbursementPolicy?.onlyOriginatorCanDisburse &&
                    disbursementPolicy?.blockReason && (
                    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                          <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            Designated Disburser
                          </p>
                          <p className="font-medium">
                            {disbursementPolicy.designatedDisburserUserName || "Not set"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Only the designated disburser can complete disbursement for this lead.
                          </p>
                          {disbursementPolicy.blockReason && (
                            <p className="text-sm text-amber-800 dark:text-amber-300">
                              {disbursementPolicy.blockReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {disbursementPolicy.canOverrideInitiatorDisbursement && (
                        <div className="space-y-3 border-t border-amber-200 pt-3 dark:border-amber-900">
                          <div className="flex gap-2">
                            <Select
                              value={selectedDesignatedUserId}
                              onValueChange={setSelectedDesignatedUserId}
                              disabled={loadingMifosUsers || updatingDesignatedDisburser}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue
                                  placeholder={
                                    loadingMifosUsers
                                      ? "Loading users..."
                                      : "Select designated disburser..."
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {mifosUsers.map((user) => (
                                  <SelectItem key={user.id} value={String(user.id)}>
                                    <div className="flex items-center gap-2">
                                      <span>{user.displayName}</span>
                                      {user.officeName && (
                                        <span className="text-xs text-muted-foreground">
                                          ({user.officeName})
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleSetDesignatedDisburser}
                              disabled={
                                !selectedDesignatedUserId ||
                                loadingMifosUsers ||
                                updatingDesignatedDisburser
                              }
                            >
                              {updatingDesignatedDisburser ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ShieldCheck className="h-4 w-4" />
                              )}
                            </Button>
                            {disbursementPolicy.designatedDisburserUserId != null && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleClearDesignatedDisburser}
                                disabled={updatingDesignatedDisburser}
                                title="Clear designated disburser"
                              >
                                <UserX className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm">Payment Type</Label>
                    {normalizedPreferredPaymentMethod ? (
                      <>
                        <Input
                          value={
                            resolvedPreferredPaymentType?.displayLabel ||
                            getPreferredPaymentMethodLabel(normalizedPreferredPaymentMethod)
                          }
                          disabled
                        />
                        <p className="text-xs text-muted-foreground">
                          Payment type is locked from lead generation and cannot be changed here.
                        </p>
                        {paymentTypeResolutionError && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {paymentTypeResolutionError}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <Select value={paymentTypeId} onValueChange={setPaymentTypeId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentTypes.map((p) => (
                              <SelectItem
                                key={p.id}
                                value={String(p.id)}
                                disabled={Boolean(p.isCashPayment && currentCashierContext && !currentCashierContext.isCashier)}
                              >
                                {p.name}{p.isCashPayment ? " (Cash)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {currentCashierContext && !currentCashierContext.isCashier && (
                          <p className="text-xs text-muted-foreground">
                            Cash payment types are disabled because the logged in user is not an assigned cashier.
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {loadingCurrentCashier && selectedPaymentTypeIsCash && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking cashier access...
                    </p>
                  )}
                  {currentCashierContext && !currentCashierContext.isCashier && selectedPaymentTypeIsCash && (
                    <p className="text-xs text-muted-foreground">
                      {currentCashierContext.reason || "Only cashiers can process cash payout."}
                    </p>
                  )}

                  {selectedPaymentTypeIsCash && (
                    <div className="rounded-lg border border-green-200 bg-green-50/60 dark:border-green-800 dark:bg-green-950/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">
                          Cash payout will use the logged in cashier
                        </span>
                      </div>
                      {currentCashierContext?.isCashier ? (
                        <>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">Cashier</span>
                            <span className="font-medium">{currentCashierContext.staffName || "Unknown cashier"}</span>
                          </div>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">Teller</span>
                            <span className="font-medium">
                              {currentCashierContext.tellerName || "Unknown teller"}
                              {currentCashierContext.tellerOfficeName ? ` - ${currentCashierContext.tellerOfficeName}` : ""}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">Session</span>
                            <span className={currentCashierContext.hasActiveSession ? "font-medium text-green-700 dark:text-green-400" : "font-medium text-red-600 dark:text-red-400"}>
                              {currentCashierContext.hasActiveSession ? "Active" : "Not Active"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {currentCashierContext?.reason || "Only a cashier with an active session can use cash payout."}
                        </p>
                      )}
                    </div>
                  )}

                  {!selectedPaymentTypeIsCash && selectedPaymentType && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
                      <p className="font-medium">
                        {derivedDisbursementPayoutMethod === "MOBILE_MONEY"
                          ? "Mobile Money Payout"
                          : `${selectedPaymentType.name || "Non-cash"} Payout`}
                      </p>
                      <p className="text-xs mt-1">
                        The payout will be completed during disbursement without affecting cashier balances.
                      </p>
                    </div>
                  )}

                  {receiptRangesEnabled && selectedPaymentTypeIsCash && (
                    <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                      <Label>
                        Receipt Number <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          value={receiptNumber}
                          onChange={(e) => {
                            setReceiptNumber(e.target.value);
                            clearReceiptValidation();
                            if (e.target.value.trim()) {
                              validateReceiptDebounced(e.target.value);
                            }
                          }}
                          placeholder="Enter receipt number"
                          className={
                            receiptValidation
                              ? receiptValidation.valid
                                ? "border-green-500 pr-8"
                                : "border-red-500 pr-8"
                              : ""
                          }
                        />
                        {isValidatingReceipt && (
                          <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!isValidatingReceipt && receiptValidation?.valid && (
                          <CheckCircle className="absolute right-2 top-2.5 h-4 w-4 text-green-500" />
                        )}
                        {!isValidatingReceipt && receiptValidation && !receiptValidation.valid && (
                          <AlertCircle className="absolute right-2 top-2.5 h-4 w-4 text-red-500" />
                        )}
                      </div>
                      {receiptValidation && !receiptValidation.valid && (
                        <p className="text-xs text-red-500">{receiptValidation.error}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm">Payout Notes (optional)</Label>
                    <Textarea
                      placeholder="Additional notes for the payout..."
                      value={payoutNotes}
                      onChange={(e) => setPayoutNotes(e.target.value)}
                      rows={2}
                    />
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
                      {!receiptRangesEnabled && (
                        <div className="space-y-1">
                          <Label className="text-xs">Receipt #</Label>
                          <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="Optional" />
                        </div>
                      )}
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

              {usesReadOnlyCurrentDate && (
                <div className="space-y-2">
                  <Label htmlFor="payout-date" className="text-sm">
                    Payout Date
                  </Label>
                  <Input
                    id="payout-date"
                    type="date"
                    value={fineractDate}
                    disabled
                    className="cursor-not-allowed disabled:opacity-100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Goodfellow uses the current date automatically for this action.
                  </p>
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-2">
                <Label className="text-sm">Payment Method *</Label>
                {normalizedPreferredPaymentMethod ? (
                  <>
                    <Input
                      value={getPreferredPaymentMethodLabel(normalizedPreferredPaymentMethod)}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Payment method is locked from lead generation and cannot be changed here.
                    </p>
                  </>
                ) : (
                  <Select
                    value={payoutMethod}
                    onValueChange={(value) =>
                      setPayoutMethod(value as "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER")
                    }
                  >
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
                )}
              </div>

              {/* Teller & Cashier — cash only */}
              {effectivePayoutMethod === "CASH" && (
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
              {effectivePayoutMethod && effectivePayoutMethod !== "CASH" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
                  <p className="font-medium">
                    {effectivePayoutMethod === "MOBILE_MONEY" ? "Mobile Money Payout" : "Bank Transfer Payout"}
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
              updatingDesignatedDisburser ||
              !selectedTransition ||
              transitionBlockedByDisbursementPolicy ||
              (!!approvalBlocked && !selectedTransition?.isBackward) ||
              (hasBlockingValidations && !selectedTransition?.isBackward && !overrideValidations) ||
              (hasBlockingValidations && !selectedTransition?.isBackward && overrideValidations && !overrideReason?.trim()) ||
              (!selectedTransition?.isBackward && effectiveAction === "disburse" && !paymentTypeId) ||
              (!selectedTransition?.isBackward && effectiveAction === "disburse" && !!normalizedPreferredPaymentMethod && !resolvedPreferredPaymentType) ||
              (!selectedTransition?.isBackward && effectiveAction === "disburse" && !derivedDisbursementPayoutMethod) ||
              (!selectedTransition?.isBackward && effectiveAction === "disburse" && selectedPaymentTypeIsCash && loadingCurrentCashier) ||
              (!selectedTransition?.isBackward && effectiveAction === "payout" && !effectivePayoutMethod) ||
              (!selectedTransition?.isBackward && effectiveAction === "payout" && effectivePayoutMethod === "CASH" && (!selectedTeller || !selectedCashier)) ||
              (!selectedTransition?.isBackward && effectiveAction === "reject" && !reason?.trim())
            }
            className={
              selectedTransition?.isBackward
                ? "bg-orange-600 hover:bg-orange-700"
                : effectiveAction === "reject"
                ? "bg-red-600 hover:bg-red-700"
                : effectiveAction === "payout" || effectiveAction === "disburse"
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
                  ? derivedDisbursementPayoutMethod
                    ? "Disbursing & Completing Payout..."
                    : "Disbursing..."
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
                  ? derivedDisbursementPayoutMethod
                    ? "Disburse, Payout & Move"
                    : "Disburse & Move"
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
