import {
  getCobCatchUpStatusAction,
  getLockedLoansAction,
  getManageJobsDataAction,
  getSystemPermissionFlagsAction,
  getWorkflowJobNamesAction,
} from "@/app/actions/system-actions";
import { ManageJobsClient } from "../components/manage-jobs-client";
import type {
  CobCatchUpStatus,
  LockedLoansPage,
  SchedulerJob,
  SchedulerStatus,
  SystemPermissionFlags,
  WorkflowJobNames,
} from "@/shared/types/system";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default async function ManageJobsPage() {
  const [jobsResult, flagsResult, workflowResult, cobResult, lockedResult] =
    await Promise.allSettled([
      getManageJobsDataAction(),
      getSystemPermissionFlagsAction(),
      getWorkflowJobNamesAction(),
      getCobCatchUpStatusAction(),
      getLockedLoansAction(),
    ]);

  const initialErrors: string[] = [];
  let initialJobs: SchedulerJob[] = [];
  let initialScheduler: SchedulerStatus = { active: false };
  let permissionFlags: SystemPermissionFlags = {
    canUpdatePermission: false,
    canUpdateScheduler: false,
    canExecuteInlineJob: false,
  };
  let workflowNames: WorkflowJobNames = { businessJobs: [] };
  let cobStatus: CobCatchUpStatus = { isCatchUpRunning: false };
  let lockedLoans: LockedLoansPage = { content: [] };

  if (jobsResult.status === "fulfilled") {
    initialJobs = jobsResult.value.jobs;
    initialScheduler = jobsResult.value.scheduler;
  } else {
    initialErrors.push(
      errorMessage(jobsResult.reason, "Failed to load scheduler jobs")
    );
  }

  if (flagsResult.status === "fulfilled") {
    permissionFlags = flagsResult.value;
  }

  if (workflowResult.status === "fulfilled") {
    workflowNames = workflowResult.value;
  } else {
    initialErrors.push(
      errorMessage(workflowResult.reason, "Failed to load workflow job names")
    );
  }

  if (cobResult.status === "fulfilled") {
    cobStatus = cobResult.value;
  } else {
    initialErrors.push(
      errorMessage(cobResult.reason, "Failed to load COB status")
    );
  }

  if (lockedResult.status === "fulfilled") {
    lockedLoans = lockedResult.value;
  } else {
    initialErrors.push(
      errorMessage(lockedResult.reason, "Failed to load locked loans")
    );
  }

  return (
    <ManageJobsClient
      initialJobs={initialJobs}
      initialScheduler={initialScheduler}
      permissionFlags={permissionFlags}
      workflowNames={workflowNames}
      cobStatus={cobStatus}
      lockedLoans={lockedLoans}
      initialErrors={initialErrors}
    />
  );
}
