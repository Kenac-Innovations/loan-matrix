"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  History,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAvailableWorkflowJobStepsAction,
  getCobCatchUpStatusAction,
  getLoanClientNavigationAction,
  getLockedLoansAction,
  getSchedulerStatusAction,
  getWorkflowJobStepsAction,
  listSchedulerJobsAction,
  runCobCatchUpAction,
  runInlineCobAction,
  runSchedulerCommandAction,
  runSchedulerJobAction,
  updateWorkflowJobStepsAction,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CobCatchUpStatus,
  JobParameter,
  LockedLoan,
  LockedLoansPage,
  SchedulerJob,
  SchedulerStatus,
  SystemPermissionFlags,
  WorkflowJobNames,
  WorkflowJobStep,
} from "@/shared/types/system";
import { cn } from "@/lib/utils";
import { SchedulerJobEditDialog } from "./scheduler-job-edit-dialog";
import { formatFineractDate, formatSystemLabel } from "./system-helpers";

type ManageJobsClientProps = {
  initialJobs: SchedulerJob[];
  initialScheduler: SchedulerStatus;
  permissionFlags: SystemPermissionFlags;
  workflowNames: WorkflowJobNames;
  cobStatus: CobCatchUpStatus;
  lockedLoans: LockedLoansPage;
  initialErrors?: string[];
};

const noSelection = "__none";

function jobCategory(jobName: string) {
  return jobName.split("_")[0] || jobName;
}

function sortSteps(steps: WorkflowJobStep[]) {
  return [...steps].sort((first, second) => first.order - second.order);
}

function normalizeStepOrder(steps: WorkflowJobStep[]) {
  return steps.map((step, index) => ({ ...step, order: index + 1 }));
}

function workflowStepsSignature(steps: WorkflowJobStep[]) {
  return steps.map((step) => step.stepName).join("\u001f");
}

function activeBadgeClass(active: boolean) {
  return active
    ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
    : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
}

function runningBadgeClass(currentlyRunning: boolean) {
  return currentlyRunning
    ? "border-emerald-300 bg-emerald-600 text-white dark:border-emerald-700 dark:bg-emerald-500 dark:text-emerald-950"
    : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
}

function statusBadgeClass(status?: string) {
  const normalizedStatus = status?.toLowerCase() ?? "";

  if (
    normalizedStatus.includes("success") ||
    normalizedStatus.includes("complete")
  ) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  }

  if (
    normalizedStatus.includes("fail") ||
    normalizedStatus.includes("error") ||
    normalizedStatus.includes("abandon")
  ) {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200";
  }

  if (
    normalizedStatus.includes("running") ||
    normalizedStatus.includes("progress") ||
    normalizedStatus.includes("started")
  ) {
    return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200";
  }

  if (
    normalizedStatus.includes("warn") ||
    normalizedStatus.includes("pending") ||
    normalizedStatus.includes("unknown")
  ) {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
  }

  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
}

type WorkflowStepRowProps = {
  step: WorkflowJobStep;
  index: number;
  isDirty: boolean;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
};

function WorkflowStepRow({
  step,
  index,
  isDirty,
  isFirst,
  isLast,
  disabled,
  onMove,
  onRemove,
}: WorkflowStepRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: step.stepName,
    disabled,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        isDirty &&
          "bg-amber-50/80 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
        isDragging &&
          "relative z-10 bg-background opacity-95 shadow-lg dark:bg-background"
      )}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Reorder ${step.stepName}`}
            disabled={disabled}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground",
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-grab active:cursor-grabbing"
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-medium",
              isDirty
                ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {index + 1}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-medium">{step.stepName}</TableCell>
      <TableCell className="max-w-lg whitespace-normal text-muted-foreground">
        {step.stepDescription || "N/A"}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(index, -1)}
            disabled={disabled || isFirst}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(index, 1)}
            disabled={disabled || isLast}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ManageJobsClient({
  initialJobs,
  initialScheduler,
  permissionFlags,
  workflowNames,
  cobStatus,
  lockedLoans,
  initialErrors = [],
}: ManageJobsClientProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [scheduler, setScheduler] = useState(initialScheduler);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());
  const [jobQuery, setJobQuery] = useState("");
  const [editingJob, setEditingJob] = useState<SchedulerJob | null>(null);
  const [parameterDialogJob, setParameterDialogJob] =
    useState<SchedulerJob | null>(null);
  const [jobParameters, setJobParameters] = useState<JobParameter[]>([
    { parameterName: "", parameterValue: "" },
  ]);
  const [workflowJob, setWorkflowJob] = useState(
    workflowNames.businessJobs[0] ?? noSelection
  );
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowJobStep[]>([]);
  const [workflowBaselineSteps, setWorkflowBaselineSteps] = useState<
    WorkflowJobStep[]
  >([]);
  const [availableSteps, setAvailableSteps] = useState<WorkflowJobStep[]>([]);
  const [selectedAvailableStep, setSelectedAvailableStep] = useState(noSelection);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [currentCobStatus, setCurrentCobStatus] = useState(cobStatus);
  const [currentLockedLoans, setCurrentLockedLoans] = useState(lockedLoans);
  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<number>>(new Set());
  const [errorLoan, setErrorLoan] = useState<LockedLoan | null>(null);
  const [isPending, startTransition] = useTransition();
  const workflowDragSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredJobs = useMemo(() => {
    const query = jobQuery.trim().toLowerCase();
    if (!query) return jobs;

    return jobs.filter((job) => {
      const searchableText = [
        job.jobId,
        job.displayName,
        job.cronExpression,
        job.active ? "active" : "inactive",
        job.currentlyRunning ? "running" : "idle",
        job.lastRunHistory?.status,
        job.lastRunHistory?.triggerType,
        formatFineractDate(job.nextRunTime),
      ]
        .filter((value) => value !== undefined && value !== null)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [jobs, jobQuery]);

  const runnableJobs = useMemo(
    () => filteredJobs.filter((job) => !job.currentlyRunning),
    [filteredJobs]
  );
  const selectedJobs = useMemo(
    () => runnableJobs.filter((job) => selectedJobIds.has(job.jobId)),
    [runnableJobs, selectedJobIds]
  );
  const allJobsSelected =
    runnableJobs.length > 0 &&
    runnableJobs.every((job) => selectedJobIds.has(job.jobId));
  const workflowBaselineSignature = useMemo(
    () => workflowStepsSignature(workflowBaselineSteps),
    [workflowBaselineSteps]
  );
  const workflowCurrentSignature = useMemo(
    () => workflowStepsSignature(workflowSteps),
    [workflowSteps]
  );
  const workflowDirty =
    workflowJob !== noSelection &&
    workflowCurrentSignature !== workflowBaselineSignature;
  const workflowBaselineIndexByStepName = useMemo(() => {
    return new Map(
      workflowBaselineSteps.map((step, index) => [step.stepName, index])
    );
  }, [workflowBaselineSteps]);
  const selectableAvailableSteps = useMemo(() => {
    const currentStepNames = new Set(
      workflowSteps.map((step) => step.stepName)
    );
    return availableSteps.filter((step) => !currentStepNames.has(step.stepName));
  }, [availableSteps, workflowSteps]);
  const canAddWorkflowStep =
    selectedAvailableStep !== noSelection &&
    selectableAvailableSteps.some(
      (step) => step.stepName === selectedAvailableStep
    );
  const allLockedLoansSelected =
    currentLockedLoans.content.length > 0 &&
    selectedLoanIds.size === currentLockedLoans.content.length;

  useEffect(() => {
    if (workflowJob === noSelection) return;
    void loadWorkflowSteps(workflowJob);
  }, [workflowJob]);

  useEffect(() => {
    if (!currentCobStatus.isCatchUpRunning) return;

    const interval = window.setInterval(() => {
      void refreshCobStatus();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [currentCobStatus.isCatchUpRunning]);

  async function refreshScheduler() {
    startTransition(async () => {
      try {
        const [nextJobs, nextScheduler] = await Promise.all([
          listSchedulerJobsAction(),
          getSchedulerStatusAction(),
        ]);
        setJobs(nextJobs);
        setScheduler(nextScheduler);
        setSelectedJobIds(new Set());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to refresh jobs"
        );
      }
    });
  }

  function toggleAllJobs(checked: boolean) {
    setSelectedJobIds(
      checked ? new Set(runnableJobs.map((job) => job.jobId)) : new Set()
    );
  }

  function toggleJob(jobId: number, checked: boolean) {
    const job = jobs.find((item) => item.jobId === jobId);
    if (job?.currentlyRunning) return;

    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (checked) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }

  function runSchedulerCommand(command: "start" | "stop") {
    startTransition(async () => {
      const result = await runSchedulerCommandAction(command);
      if (!result.success) {
        toast.error(result.error ?? `Failed to ${command} scheduler`);
        return;
      }

      toast.success(`Scheduler ${command === "start" ? "started" : "stopped"}`);
      if (result.data) setScheduler(result.data);
      await refreshScheduler();
    });
  }

  function runJob(job: SchedulerJob, parameters?: JobParameter[]) {
    if (job.currentlyRunning) {
      toast.info("This job is already running.");
      return;
    }

    startTransition(async () => {
      const cleanedParameters = parameters?.filter(
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
      setParameterDialogJob(null);
      setJobParameters([{ parameterName: "", parameterValue: "" }]);
      await refreshScheduler();
    });
  }

  function runSelectedJobs() {
    startTransition(async () => {
      for (const job of selectedJobs) {
        const result = await runSchedulerJobAction({ jobId: job.jobId });
        if (!result.success) {
          toast.error(result.error ?? `Failed to run ${job.displayName}`);
          return;
        }
      }

      toast.success(`${selectedJobs.length} job(s) queued`);
      await refreshScheduler();
    });
  }

  async function loadWorkflowSteps(jobName: string) {
    setWorkflowLoading(true);
    try {
      const [steps, available] = await Promise.all([
        getWorkflowJobStepsAction(jobName),
        getAvailableWorkflowJobStepsAction(jobCategory(jobName)),
      ]);
      const nextSteps = normalizeStepOrder(sortSteps(steps.businessSteps));
      setWorkflowSteps(nextSteps);
      setWorkflowBaselineSteps(nextSteps.map((step) => ({ ...step })));
      setAvailableSteps(sortSteps(available.availableBusinessSteps));
      setSelectedAvailableStep(noSelection);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load workflow job steps"
      );
    } finally {
      setWorkflowLoading(false);
    }
  }

  function moveStep(index: number, direction: -1 | 1) {
    setWorkflowSteps((current) => {
      const next = [...current];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return current;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return normalizeStepOrder(next);
    });
  }

  function handleWorkflowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setWorkflowSteps((current) => {
      const oldIndex = current.findIndex(
        (step) => step.stepName === String(active.id)
      );
      const newIndex = current.findIndex(
        (step) => step.stepName === String(over.id)
      );
      if (oldIndex < 0 || newIndex < 0) return current;

      return normalizeStepOrder(arrayMove(current, oldIndex, newIndex));
    });
  }

  function removeStep(index: number) {
    setWorkflowSteps((current) =>
      normalizeStepOrder(current.filter((_, stepIndex) => stepIndex !== index))
    );
  }

  function addAvailableStep() {
    if (selectedAvailableStep === noSelection) return;

    const step = availableSteps.find(
      (item) => item.stepName === selectedAvailableStep
    );
    if (!step) return;

    if (workflowSteps.some((item) => item.stepName === step.stepName)) {
      toast.info("That step is already in the workflow");
      return;
    }

    setWorkflowSteps((current) =>
      normalizeStepOrder([...current, { ...step, order: current.length + 1 }])
    );
    setSelectedAvailableStep(noSelection);
  }

  function resetWorkflowSteps() {
    setWorkflowSteps(workflowBaselineSteps.map((step) => ({ ...step })));
    setSelectedAvailableStep(noSelection);
  }

  function saveWorkflowSteps() {
    if (workflowJob === noSelection || !workflowDirty) return;

    startTransition(async () => {
      const result = await updateWorkflowJobStepsAction({
        jobName: workflowJob,
        businessSteps: normalizeStepOrder(workflowSteps),
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to save workflow steps");
        return;
      }

      toast.success("Workflow steps updated");
      await loadWorkflowSteps(workflowJob);
    });
  }

  async function refreshCobStatus() {
    try {
      const status = await getCobCatchUpStatusAction();
      setCurrentCobStatus(status);
      return status;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh COB status"
      );
      return null;
    }
  }

  async function refreshLockedLoans() {
    try {
      const loans = await getLockedLoansAction();
      setCurrentLockedLoans(loans);
      setSelectedLoanIds(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh locked loans"
      );
    }
  }

  function runCatchUp() {
    startTransition(async () => {
      const result = await runCobCatchUpAction();
      if (!result.success) {
        toast.error(result.error ?? "Failed to run catch-up");
        return;
      }

      toast.success("COB catch-up started");
      if (result.data) setCurrentCobStatus(result.data);
    });
  }

  function toggleAllLoans(checked: boolean) {
    setSelectedLoanIds(
      checked
        ? new Set(currentLockedLoans.content.map((loan) => loan.loanId))
        : new Set()
    );
  }

  function toggleLoan(loanId: number, checked: boolean) {
    setSelectedLoanIds((current) => {
      const next = new Set(current);
      if (checked) next.add(loanId);
      else next.delete(loanId);
      return next;
    });
  }

  function runInlineCob() {
    startTransition(async () => {
      const result = await runInlineCobAction({
        loanIds: Array.from(selectedLoanIds),
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to run inline COB");
        return;
      }

      toast.success("Inline COB started");
      await refreshLockedLoans();
    });
  }

  function openLoan(loanId: number) {
    startTransition(async () => {
      const result = await getLoanClientNavigationAction(loanId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to open loan");
        return;
      }

      if (result.data?.clientId) {
        router.push(`/clients/${result.data.clientId}/loans/${loanId}`);
        return;
      }

      router.push(`/loans?query=${encodeURIComponent(String(loanId))}`);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Jobs</h1>
        <p className="mt-1 text-muted-foreground">
          Manage scheduler jobs, workflow job steps, and COB processing.
        </p>
      </div>

      {initialErrors.map((message) => (
        <Alert key={message} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ))}

      <Tabs defaultValue="scheduler" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scheduler">Scheduler Jobs</TabsTrigger>
          <TabsTrigger value="workflow">Workflow Jobs</TabsTrigger>
          <TabsTrigger value="cob">COB</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduler" className="space-y-4">
          <Card className="rounded-lg">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Scheduler</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Status:{" "}
                  <Badge variant={scheduler.active ? "default" : "secondary"}>
                    {scheduler.active ? "Active" : "Stopped"}
                  </Badge>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={refreshScheduler}
                  disabled={isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    runSchedulerCommand(scheduler.active ? "stop" : "start")
                  }
                  disabled={isPending}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {scheduler.active ? "Stop Scheduler" : "Start Scheduler"}
                </Button>
                <Button
                  onClick={runSelectedJobs}
                  disabled={selectedJobs.length === 0 || isPending}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Run Selected
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={jobQuery}
                    onChange={(event) => setJobQuery(event.target.value)}
                    placeholder="Search scheduler jobs"
                    className="pl-9"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Showing {filteredJobs.length} of {jobs.length} jobs
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allJobsSelected}
                        disabled={runnableJobs.length === 0}
                        onCheckedChange={(checked) =>
                          toggleAllJobs(checked === true)
                        }
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Running</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Last Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow
                      key={job.jobId}
                      className={
                        job.currentlyRunning
                          ? "bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                          : undefined
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={
                            !job.currentlyRunning &&
                            selectedJobIds.has(job.jobId)
                          }
                          disabled={job.currentlyRunning}
                          onCheckedChange={(checked) =>
                            toggleJob(job.jobId, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {job.displayName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={activeBadgeClass(job.active)}
                        >
                          {job.active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={runningBadgeClass(job.currentlyRunning)}
                        >
                          {job.currentlyRunning ? "Running" : "Idle"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatFineractDate(job.nextRunTime)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(job.lastRunHistory?.status)}
                        >
                          {formatSystemLabel(job.lastRunHistory?.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Action...
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              disabled={job.currentlyRunning}
                              onSelect={() => runJob(job)}
                            >
                              <Play className="h-4 w-4" />
                              Run now
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={job.currentlyRunning}
                              onSelect={() => setParameterDialogJob(job)}
                            >
                              <Plus className="h-4 w-4" />
                              Run with parameters
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/system/manage-jobs/${job.jobId}`}>
                                <Eye className="h-4 w-4" />
                                View details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEditingJob(job)}>
                              <Pencil className="h-4 w-4" />
                              Edit schedule
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/system/manage-jobs/${job.jobId}/history`}
                              >
                                <History className="h-4 w-4" />
                                Run history
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredJobs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {jobQuery.trim()
                          ? "No scheduler jobs match your search."
                          : "No scheduler jobs found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow" className="space-y-4">
          <Card className="rounded-lg">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Workflow Jobs</CardTitle>
                  {workflowDirty && (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                    >
                      Unsaved changes
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reorder, add, and remove business steps for workflow jobs.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {workflowDirty && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetWorkflowSteps}
                    disabled={workflowLoading || isPending}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Discard
                  </Button>
                )}
                <Button
                  onClick={saveWorkflowSteps}
                  disabled={
                    workflowJob === noSelection ||
                    workflowLoading ||
                    isPending ||
                    !workflowDirty
                  }
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Steps
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:max-w-md">
                <Label>Workflow job</Label>
                <Select value={workflowJob} onValueChange={setWorkflowJob}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noSelection}>Select a job</SelectItem>
                    {workflowNames.businessJobs.map((jobName) => (
                      <SelectItem key={jobName} value={jobName}>
                        {jobName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="grid flex-1 gap-2">
                  <Label>Available step</Label>
                  <Select
                    value={selectedAvailableStep}
                    onValueChange={setSelectedAvailableStep}
                    disabled={workflowJob === noSelection || workflowLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={noSelection}>Select a step</SelectItem>
                      {selectableAvailableSteps.map((step) => (
                        <SelectItem key={step.stepName} value={step.stepName}>
                          {step.stepName}
                        </SelectItem>
                      ))}
                      {selectableAvailableSteps.length === 0 && (
                        <SelectItem value="__empty" disabled>
                          No available steps
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAvailableStep}
                  disabled={!canAddWorkflowStep || workflowLoading || isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Step
                </Button>
              </div>

              {workflowLoading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading workflow steps
                </div>
              ) : (
                <DndContext
                  sensors={workflowDragSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleWorkflowDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Order</TableHead>
                        <TableHead>Step</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-40 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <SortableContext
                      items={workflowSteps.map((step) => step.stepName)}
                      strategy={verticalListSortingStrategy}
                    >
                      <TableBody>
                        {workflowSteps.map((step, index) => {
                          const originalIndex =
                            workflowBaselineIndexByStepName.get(step.stepName);
                          const isStepDirty =
                            workflowDirty &&
                            (originalIndex === undefined ||
                              originalIndex !== index);

                          return (
                            <WorkflowStepRow
                              key={step.stepName}
                              step={step}
                              index={index}
                              isDirty={isStepDirty}
                              isFirst={index === 0}
                              isLast={index === workflowSteps.length - 1}
                              disabled={workflowLoading || isPending}
                              onMove={moveStep}
                              onRemove={removeStep}
                            />
                          );
                        })}
                        {workflowSteps.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="h-24 text-center text-muted-foreground"
                            >
                              No workflow steps loaded.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </SortableContext>
                  </Table>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cob" className="space-y-4">
          <Card className="rounded-lg">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>COB Catch-Up</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Status:{" "}
                  <Badge
                    variant={
                      currentCobStatus.isCatchUpRunning ? "default" : "secondary"
                    }
                  >
                    {currentCobStatus.isCatchUpRunning ? "Running" : "Idle"}
                  </Badge>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void refreshCobStatus()}
                  disabled={isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Status
                </Button>
                <Button
                  onClick={runCatchUp}
                  disabled={currentCobStatus.isCatchUpRunning || isPending}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Catch-Up
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card className="rounded-lg">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Locked Loans</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentLockedLoans.content.length} loan(s) currently locked.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void refreshLockedLoans()}
                  disabled={isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Loans
                </Button>
                {permissionFlags.canExecuteInlineJob && (
                  <Button
                    onClick={runInlineCob}
                    disabled={selectedLoanIds.size === 0 || isPending}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Run Inline COB
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!permissionFlags.canExecuteInlineJob && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your current Fineract permissions do not allow inline COB
                    execution.
                  </AlertDescription>
                </Alert>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allLockedLoansSelected}
                        onCheckedChange={(checked) =>
                          toggleAllLoans(checked === true)
                        }
                      />
                    </TableHead>
                    <TableHead>Loan ID</TableHead>
                    <TableHead>Lock Owner</TableHead>
                    <TableHead>Placed On</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentLockedLoans.content.map((loan) => (
                    <TableRow key={loan.loanId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLoanIds.has(loan.loanId)}
                          onCheckedChange={(checked) =>
                            toggleLoan(loan.loanId, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {loan.loanId}
                      </TableCell>
                      <TableCell>{loan.lockOwner || "N/A"}</TableCell>
                      <TableCell>{formatFineractDate(loan.lockPlacedOn)}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {loan.error || "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Action...
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {loan.error && (
                              <DropdownMenuItem
                                onSelect={() => setErrorLoan(loan)}
                              >
                                <AlertCircle className="h-4 w-4" />
                                View Error
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onSelect={() => openLoan(loan.loanId)}
                            >
                              <Eye className="h-4 w-4" />
                              View Loan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {currentLockedLoans.content.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No locked loans found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SchedulerJobEditDialog
        job={editingJob}
        open={editingJob !== null}
        onOpenChange={(open) => {
          if (!open) setEditingJob(null);
        }}
        canUpdateScheduler={permissionFlags.canUpdateScheduler}
        onSaved={refreshScheduler}
      />

      <Dialog
        open={parameterDialogJob !== null}
        onOpenChange={(open) => !open && setParameterDialogJob(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Job With Parameters</DialogTitle>
            <DialogDescription>
              Add optional name and value pairs before starting this job.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {jobParameters.map((parameter, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={parameter.parameterName}
                  placeholder="Parameter name"
                  onChange={(event) =>
                    setJobParameters((current) =>
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
                    setJobParameters((current) =>
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
                setJobParameters((current) => [
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
              onClick={() => setParameterDialogJob(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                parameterDialogJob && runJob(parameterDialogJob, jobParameters)
              }
              disabled={
                isPending ||
                parameterDialogJob === null ||
                parameterDialogJob.currentlyRunning
              }
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorLoan !== null} onOpenChange={() => setErrorLoan(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Locked Loan Error</DialogTitle>
            <DialogDescription>
              Loan {errorLoan?.loanId} COB lock details.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-4 text-xs leading-5">
            {errorLoan?.stacktrace || errorLoan?.error || "No details available"}
          </pre>
          <DialogFooter>
            <Button onClick={() => setErrorLoan(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
