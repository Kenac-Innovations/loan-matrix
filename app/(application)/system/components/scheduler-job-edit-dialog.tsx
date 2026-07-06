"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { updateSchedulerJobAction } from "@/app/actions/system-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SchedulerJob } from "@/shared/types/system";

type SchedulerJobEditDialogProps = {
  job: SchedulerJob | null;
  canUpdateScheduler: boolean;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  closeHref?: string;
  onSaved?: () => void | Promise<void>;
};

type SchedulerJobEditButtonProps = {
  job: SchedulerJob;
  canUpdateScheduler: boolean;
  defaultOpen?: boolean;
  closeHref?: string;
};

type SchedulerJobEditDialogContentProps = {
  job: SchedulerJob;
  canUpdateScheduler: boolean;
  setDialogOpen: (open: boolean) => void;
  onSaved?: () => void | Promise<void>;
};

export function SchedulerJobEditDialog({
  job,
  canUpdateScheduler,
  trigger,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  closeHref,
  onSaved,
}: SchedulerJobEditDialogProps) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : internalOpen;

  function setDialogOpen(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);

    if (!nextOpen && closeHref) {
      router.replace(closeHref, { scroll: false });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {job && (
        <SchedulerJobEditDialogContent
          key={job.jobId}
          job={job}
          canUpdateScheduler={canUpdateScheduler}
          setDialogOpen={setDialogOpen}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function SchedulerJobEditDialogContent({
  job,
  canUpdateScheduler,
  setDialogOpen,
  onSaved,
}: SchedulerJobEditDialogContentProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(job.displayName);
  const [cronExpression, setCronExpression] = useState(job.cronExpression ?? "");
  const [active, setActive] = useState(job.active);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await updateSchedulerJobAction({
        jobId: job.jobId,
        displayName,
        cronExpression,
        active,
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to update scheduler job");
        return;
      }

      toast.success("Scheduler job updated");
      await onSaved?.();
      setDialogOpen(false);
      router.refresh();
    });
  }

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Edit Scheduler Job</DialogTitle>
        <DialogDescription>
          Update the schedule, name, and active state for this job.
        </DialogDescription>
      </DialogHeader>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {!canUpdateScheduler && (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your current permissions allow viewing this job, but not editing
            scheduler configuration.
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor={`display-name-${job.jobId}`}>Display name</Label>
          <Input
            id={`display-name-${job.jobId}`}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={!canUpdateScheduler || isPending}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`cron-expression-${job.jobId}`}>
            Cron expression
          </Label>
          <Input
            id={`cron-expression-${job.jobId}`}
            value={cronExpression}
            onChange={(event) => setCronExpression(event.target.value)}
            disabled={!canUpdateScheduler || isPending}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <Label htmlFor={`job-active-${job.jobId}`}>Active</Label>
            <p className="text-sm text-muted-foreground">
              Enable this job for scheduler execution.
            </p>
          </div>
          <Switch
            id={`job-active-${job.jobId}`}
            checked={active}
            onCheckedChange={setActive}
            disabled={!canUpdateScheduler || isPending}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!canUpdateScheduler || isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Submit
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function SchedulerJobEditButton({
  job,
  canUpdateScheduler,
  defaultOpen,
  closeHref,
}: SchedulerJobEditButtonProps) {
  return (
    <SchedulerJobEditDialog
      job={job}
      canUpdateScheduler={canUpdateScheduler}
      defaultOpen={defaultOpen}
      closeHref={closeHref}
      trigger={
        <Button variant="outline">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      }
    />
  );
}
