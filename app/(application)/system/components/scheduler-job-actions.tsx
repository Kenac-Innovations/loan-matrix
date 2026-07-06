"use client";

import { useState, useTransition } from "react";
import { Loader2, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { runSchedulerJobAction } from "@/app/actions/system-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { JobParameter, SchedulerJob } from "@/shared/types/system";

type SchedulerJobActionsProps = {
  job: SchedulerJob;
};

export function SchedulerJobActions({ job }: SchedulerJobActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [parameters, setParameters] = useState<JobParameter[]>([
    { parameterName: "", parameterValue: "" },
  ]);
  const canRun = !job.currentlyRunning;

  function runJob(jobParameters?: JobParameter[]) {
    if (!canRun) {
      toast.info("This job is already running.");
      return;
    }

    startTransition(async () => {
      const cleanedParameters = jobParameters?.filter(
        (parameter) =>
          parameter.parameterName.trim() || parameter.parameterValue.trim()
      );
      const result = await runSchedulerJobAction({
        jobId: job.jobId,
        ...(cleanedParameters?.length
          ? { jobParameters: cleanedParameters }
          : {}),
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to run job");
        return;
      }

      toast.success(`${job.displayName} queued`);
      setIsDialogOpen(false);
      setParameters([{ parameterName: "", parameterValue: "" }]);
    });
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runJob()} disabled={isPending || !canRun}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(true)}
            disabled={isPending || !canRun}
          >
            <Plus className="mr-2 h-4 w-4" />
            Run With Parameters
          </Button>
        </div>
        {!canRun && (
          <p className="text-sm text-muted-foreground">
            This job is already running. Run actions are available after it
            finishes.
          </p>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Job With Parameters</DialogTitle>
            <DialogDescription>
              Add optional name and value pairs before starting this job.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {parameters.map((parameter, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={parameter.parameterName}
                  placeholder="Parameter name"
                  onChange={(event) =>
                    setParameters((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, parameterName: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <Input
                  value={parameter.parameterValue}
                  placeholder="Parameter value"
                  onChange={(event) =>
                    setParameters((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, parameterValue: event.target.value }
                          : item
                      )
                    )
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setParameters((current) => [
                  ...current,
                  { parameterName: "", parameterValue: "" },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Parameter
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => runJob(parameters)}
              disabled={isPending || !canRun}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
