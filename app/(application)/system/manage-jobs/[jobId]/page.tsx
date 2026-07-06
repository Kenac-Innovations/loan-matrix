import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, History } from "lucide-react";
import {
  getSchedulerJobAction,
  getSystemPermissionFlagsAction,
} from "@/app/actions/system-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SchedulerJobActions } from "../../components/scheduler-job-actions";
import { SchedulerJobEditButton } from "../../components/scheduler-job-edit-dialog";
import {
  formatFineractDate,
  formatSystemLabel,
} from "../../components/system-helpers";
import type { SchedulerJob, SystemPermissionFlags } from "@/shared/types/system";

type SchedulerJobPageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SchedulerJobPage({
  params,
  searchParams,
}: SchedulerJobPageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const parsedJobId = Number(jobId);
  if (!Number.isFinite(parsedJobId)) notFound();

  let job: SchedulerJob | null = null;
  let flags: SystemPermissionFlags | null = null;
  let loadError: string | null = null;

  try {
    [job, flags] = await Promise.all([
      getSchedulerJobAction(parsedJobId),
      getSystemPermissionFlagsAction(),
    ]);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load scheduler job";
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/system/manage-jobs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Manage Jobs
          </Link>
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!job?.jobId || !flags) notFound();

  const editParam = Array.isArray(resolvedSearchParams.edit)
    ? resolvedSearchParams.edit[0]
    : resolvedSearchParams.edit;

  const rows = [
    ["Job ID", String(job.jobId)],
    ["Display Name", job.displayName],
    ["Cron Expression", job.cronExpression || "N/A"],
    ["Next Run", formatFineractDate(job.nextRunTime)],
    ["Active", job.active ? "Yes" : "No"],
    ["Currently Running", job.currentlyRunning ? "Yes" : "No"],
    ["Last Run Status", formatSystemLabel(job.lastRunHistory?.status)],
    ["Last Run Trigger", formatSystemLabel(job.lastRunHistory?.triggerType)],
    ["Last Run Start", formatFineractDate(job.lastRunHistory?.jobRunStartTime)],
    ["Last Run End", formatFineractDate(job.lastRunHistory?.jobRunEndTime)],
  ];

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" className="w-fit">
        <Link href="/system/manage-jobs">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Manage Jobs
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {job.displayName}
            </h1>
            <Badge variant={job.active ? "default" : "secondary"}>
              {job.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            Scheduler job details and execution actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SchedulerJobEditButton
            job={job}
            canUpdateScheduler={flags.canUpdateScheduler}
            defaultOpen={editParam === "1" || editParam === "true"}
            closeHref={`/system/manage-jobs/${job.jobId}`}
          />
          <Button asChild variant="outline">
            <Link href={`/system/manage-jobs/${job.jobId}/history`}>
              <History className="mr-2 h-4 w-4" />
              History
            </Link>
          </Button>
          <SchedulerJobActions job={job} />
        </div>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-md border p-3">
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {job.lastRunHistory?.jobRunErrorMessage && (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Last Run Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-4 text-xs leading-5">
              {job.lastRunHistory.jobRunErrorLog ||
                job.lastRunHistory.jobRunErrorMessage}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
