import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import {
  getSchedulerJobAction,
  getSchedulerJobHistoryAction,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatFineractDate,
  formatSystemLabel,
} from "../../../components/system-helpers";
import type { SchedulerJob, SchedulerRunHistory } from "@/shared/types/system";

type SchedulerJobHistoryPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function SchedulerJobHistoryPage({
  params,
}: SchedulerJobHistoryPageProps) {
  const { jobId } = await params;
  const parsedJobId = Number(jobId);
  if (!Number.isFinite(parsedJobId)) notFound();

  let job: SchedulerJob | null = null;
  let history: { pageItems: SchedulerRunHistory[] } | null = null;
  let loadError: string | null = null;

  try {
    [job, history] = await Promise.all([
      getSchedulerJobAction(parsedJobId),
      getSchedulerJobHistoryAction(parsedJobId),
    ]);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load run history";
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

  if (!job?.jobId || !history) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" className="w-fit">
        <Link href={`/system/manage-jobs/${job.jobId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Job
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {job.displayName} History
        </h1>
        <p className="mt-1 text-muted-foreground">
          Scheduler run history from Fineract.
        </p>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Run History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.pageItems.map((item, index) => (
                <TableRow key={`${item.version}-${index}`}>
                  <TableCell>{item.version}</TableCell>
                  <TableCell>{formatFineractDate(item.jobRunStartTime)}</TableCell>
                  <TableCell>{formatFineractDate(item.jobRunEndTime)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formatSystemLabel(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatSystemLabel(item.triggerType)}</TableCell>
                  <TableCell className="max-w-xl whitespace-normal">
                    {item.jobRunErrorMessage || item.jobRunErrorLog || "N/A"}
                  </TableCell>
                </TableRow>
              ))}
              {history.pageItems.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No run history found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
