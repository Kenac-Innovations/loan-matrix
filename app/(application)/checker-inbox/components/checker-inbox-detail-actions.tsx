"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveMakerCheckerEntryAction,
  rejectMakerCheckerEntryAction,
} from "@/app/actions/system-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CheckerInboxDetailActionsProps = {
  auditId: number;
};

type ConfirmAction = "approve" | "reject" | null;

export function CheckerInboxDetailActions({
  auditId,
}: CheckerInboxDetailActionsProps) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    const action = confirmAction;
    if (!action) return;
    setConfirmAction(null);

    const actionFn =
      action === "approve"
        ? approveMakerCheckerEntryAction
        : rejectMakerCheckerEntryAction;

    startTransition(async () => {
      const result = await actionFn(auditId);
      if (!result.success) {
        toast.error(result.error ?? `Failed to ${action} entry`);
        return;
      }

      toast.success(action === "approve" ? "Entry approved" : "Entry rejected");
      router.push("/checker-inbox");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setConfirmAction("approve")} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Approve
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmAction("reject")}
          disabled={isPending}
        >
          <X className="mr-2 h-4 w-4" />
          Reject
        </Button>
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "approve" ? "Approve this entry?" : "Reject this entry?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "approve"
                ? "This will approve and execute the pending request. This cannot be undone."
                : "This will reject the pending request. It will not be applied."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={run}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
