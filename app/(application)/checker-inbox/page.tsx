import { getFineractErrorStatus } from "@/lib/api";
import {
  getMakerCheckerSearchTemplateAction,
  listMakerCheckerEntriesAction,
  listPendingRescheduleLoansAction,
} from "@/app/actions/system-actions";
import { CheckerInboxTasksClient } from "./components/checker-inbox-tasks-client";
import type {
  AuditTrail,
  AuditTrailSearchTemplate,
  LoadFailure,
  RescheduleLoanRequest,
} from "@/shared/types/system";

function toLoadFailure(error: unknown, fallback: string): LoadFailure {
  return {
    status: getFineractErrorStatus(error),
    message: error instanceof Error ? error.message : fallback,
  };
}

export default async function CheckerInboxPage() {
  let template: AuditTrailSearchTemplate = {
    appUsers: [],
    actionNames: [],
    entityNames: [],
    processingResults: [],
  };
  let entries: AuditTrail[] = [];
  let checkerInboxError: LoadFailure | null = null;

  try {
    [template, entries] = await Promise.all([
      getMakerCheckerSearchTemplateAction(),
      listMakerCheckerEntriesAction(),
    ]);
  } catch (error) {
    checkerInboxError = toLoadFailure(error, "Failed to load checker inbox");
  }

  let rescheduleRequests: RescheduleLoanRequest[] = [];
  let rescheduleError: LoadFailure | null = null;

  try {
    rescheduleRequests = await listPendingRescheduleLoansAction();
  } catch (error) {
    rescheduleError = toLoadFailure(
      error,
      "Failed to load loan reschedule requests"
    );
  }

  return (
    <CheckerInboxTasksClient
      template={template}
      initialEntries={entries}
      checkerInboxError={checkerInboxError}
      initialRescheduleRequests={rescheduleRequests}
      rescheduleError={rescheduleError}
    />
  );
}
