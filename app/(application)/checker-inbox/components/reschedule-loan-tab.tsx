"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveRescheduleLoanAction,
  listPendingRescheduleLoansAction,
  rejectRescheduleLoanAction,
} from "@/app/actions/system-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RescheduleLoanRequest } from "@/shared/types/system";
import { formatFineractDate } from "../../system/components/system-helpers";

type RescheduleLoanTabProps = {
  initialRequests: RescheduleLoanRequest[];
};

type BulkAction = "approve" | "reject" | null;

export function RescheduleLoanTab({
  initialRequests,
}: RescheduleLoanTabProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<BulkAction>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = requests.length > 0 && selected.size === requests.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(requests.map((r) => r.id)));
  }

  function toggleOne(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function refresh() {
    startTransition(async () => {
      try {
        const next = await listPendingRescheduleLoansAction();
        setRequests(next);
        setSelected(new Set());
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to refresh reschedule requests"
        );
      }
    });
  }

  function runBulkAction() {
    const action = confirmAction;
    if (!action) return;
    setConfirmAction(null);

    const ids = Array.from(selected);
    const actionFn =
      action === "approve" ? approveRescheduleLoanAction : rejectRescheduleLoanAction;

    startTransition(async () => {
      const results = await Promise.all(ids.map((id) => actionFn(id)));
      const failures = results.filter((result) => !result.success);

      if (failures.length > 0) {
        toast.error(
          `${failures.length} of ${ids.length} requests failed: ${
            failures[0].error ?? "Unknown error"
          }`
        );
      } else {
        toast.success(
          `${ids.length} reschedule ${ids.length === 1 ? "request" : "requests"} ${
            action === "approve" ? "approved" : "rejected"
          }`
        );
      }

      refresh();
    });
  }

  const confirmCopy: Record<
    NonNullable<BulkAction>,
    { title: string; description: string }
  > = {
    approve: {
      title: "Approve selected reschedule requests?",
      description:
        "This will approve and apply every selected loan reschedule request. This cannot be undone.",
    },
    reject: {
      title: "Reject selected reschedule requests?",
      description:
        "This will reject every selected loan reschedule request. The original schedule stays unchanged.",
    },
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Pending Reschedule Requests</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{requests.length} pending</Badge>
            <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                size="sm"
                onClick={() => setConfirmAction("approve")}
                disabled={isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction("reject")}
                disabled={isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected || (someSelected ? "indeterminate" : false)}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Loan Account No.</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Submitted On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(request.id)}
                      onCheckedChange={() => toggleOne(request.id)}
                      aria-label={`Select reschedule request ${request.id}`}
                    />
                  </TableCell>
                  <TableCell>{request.clientName || "N/A"}</TableCell>
                  <TableCell>{request.loanAccountNumber || "N/A"}</TableCell>
                  <TableCell>
                    {request.rescheduleReasonName ||
                      request.rescheduleReasonComment ||
                      "N/A"}
                  </TableCell>
                  <TableCell>{request.submittedByUsername || "N/A"}</TableCell>
                  <TableCell>
                    {formatFineractDate(request.submittedOnDate)}
                  </TableCell>
                </TableRow>
              ))}

              {requests.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No loan reschedule requests are pending right now.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? confirmCopy[confirmAction].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? confirmCopy[confirmAction].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkAction}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
