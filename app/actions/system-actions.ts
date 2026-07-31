"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fetchFineractAPIAsCurrentUser,
  isFineractCommandPendingApproval,
} from "@/lib/api";
import { hasFineractPermissionServer } from "@/lib/authorization";
import type {
  AuditTrail,
  AuditTrailPage,
  AuditTrailSearchInput,
  AuditTrailSearchTemplate,
  AvailableWorkflowJobSteps,
  CobCatchUpStatus,
  LockedLoansPage,
  MakerCheckerSearchInput,
  RescheduleLoanRequest,
  SchedulerJob,
  SchedulerRunHistory,
  SchedulerStatus,
  SystemActionResult,
  SystemPermission,
  SystemPermissionFlags,
  SystemRoleDetail,
  SystemRoleSummary,
  WorkflowJobNames,
  WorkflowJobStep,
  WorkflowJobSteps,
} from "@/shared/types/system";
import { format } from "date-fns";

type LooseObject = Record<string, unknown>;

/**
 * Loan Matrix wraps a handful of Fineract tasks with its own bookkeeping (auto-
 * disbursement trail, teller/cashier cash movements, LoanPayout records, lead/client
 * linkage) that assumes the Fineract command executed immediately. Enabling maker-
 * checker on these would silently desync that bookkeeping, since Fineract would queue
 * the command instead of running it. These are hidden from the Configure Maker
 * Checker Tasks page and stripped server-side even if a client tries to enable them
 * directly.
 *
 * Loan approval and disbursement (app/api/fineract/loans/[id]/approve,
 * .../disburse, .../undodisbursal, .../undoapproval) are the only loan-lifecycle
 * actions with bespoke wrappers today - everything else under the loan/
 * transaction_loan grouping (repayment, reject, withdraw, writeoff, waive, close,
 * reschedule, ...) is a thin passthrough and safe to leave toggleable.
 *
 * Extend this list if a new bespoke workflow is added around a Fineract task.
 */
const BLOCKED_MAKER_CHECKER_CODES = new Set([
  "CREATE_CLIENT",
  "UPDATE_CLIENT",
  "REJECT_CLIENT",
  // Approval (incl. undo-approval and the "in past" variant)
  "APPROVE_LOAN",
  "APPROVE_LOAN_CHECKER",
  "APPROVEINPAST_LOAN",
  "APPROVEINPAST_LOAN_CHECKER",
  "APPROVALUNDO_LOAN",
  "APPROVALUNDO_LOAN_CHECKER",
  // Disbursement (incl. undo-disbursal and the "in past" variant)
  "DISBURSE_LOAN",
  "DISBURSE_LOAN_CHECKER",
  "DISBURSEINPAST_LOAN",
  "DISBURSEINPAST_LOAN_CHECKER",
  "DISBURSALUNDO_LOAN",
  "DISBURSALUNDO_LOAN_CHECKER",
]);

function isBlockedMakerCheckerTask(permission: SystemPermission): boolean {
  return BLOCKED_MAKER_CHECKER_CODES.has(permission.code);
}

const makerCheckerIdSchema = z.object({
  id: z.coerce.number().int().positive("Entry id is required"),
});

const rescheduleLoanIdSchema = z.object({
  id: z.coerce.number().int().positive("Reschedule request id is required"),
});

const roleCreateSchema = z.object({
  name: z.string().trim().min(1, "Role name is required"),
  description: z.string().trim().min(1, "Role description is required"),
});

const roleUpdateSchema = z.object({
  id: z.coerce.number().int().positive("Role id is required"),
  description: z.string().trim().min(1, "Role description is required"),
});

const roleIdSchema = z.object({
  id: z.coerce.number().int().positive("Role id is required"),
});

const permissionMapSchema = z.object({
  permissions: z.record(z.boolean()),
});

const updateRolePermissionsSchema = permissionMapSchema.extend({
  roleId: z.coerce.number().int().positive("Role id is required"),
});

const schedulerJobUpdateSchema = z.object({
  jobId: z.coerce.number().int().positive("Job id is required"),
  displayName: z.string().trim().min(1, "Job name is required"),
  cronExpression: z.string().trim().min(1, "Cron expression is required"),
  active: z.boolean(),
});

const jobIdSchema = z.object({
  jobId: z.coerce.number().int().positive("Job id is required"),
});

const runJobSchema = z.object({
  jobId: z.coerce.number().int().positive("Job id is required"),
  jobParameters: z
    .array(
      z.object({
        parameterName: z.string(),
        parameterValue: z.string(),
      })
    )
    .optional(),
});

const workflowJobNameSchema = z.object({
  jobName: z.string().trim().min(1, "Job name is required"),
});

const availableStepsSchema = z.object({
  category: z.string().trim().min(1, "Job category is required"),
});

const updateWorkflowStepsSchema = workflowJobNameSchema.extend({
  businessSteps: z.array(
    z.object({
      id: z.coerce.number().optional(),
      stepName: z.string().trim().min(1),
      stepDescription: z.string().optional(),
      order: z.coerce.number().int().positive(),
    })
  ),
});

const inlineCobSchema = z.object({
  loanIds: z.array(z.coerce.number().int().positive()).min(1),
});

function asObject(value: unknown): LooseObject {
  return typeof value === "object" && value !== null
    ? (value as LooseObject)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getErrorMessage(error: unknown, fallback: string) {
  const candidate = asObject(error);
  const errorData = asObject(candidate.errorData);

  if (
    typeof errorData.defaultUserMessage === "string" &&
    errorData.defaultUserMessage
  ) {
    return errorData.defaultUserMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function toFieldErrorResult<T = undefined>(
  error: z.ZodError,
  message = "Please correct the highlighted fields and try again"
): SystemActionResult<T> {
  return {
    success: false,
    error: message,
    fieldErrors: error.flatten().fieldErrors,
  };
}

function ok<T>(data?: T): SystemActionResult<T> {
  return { success: true, data };
}

function pendingApproval<T>(): SystemActionResult<T> {
  return { success: true, pending: true };
}

function fail<T = undefined>(
  error: unknown,
  fallback: string
): SystemActionResult<T> {
  return { success: false, error: getErrorMessage(error, fallback) };
}

function mapRoleSummary(role: unknown): SystemRoleSummary {
  const record = asObject(role);
  const id = asNumber(record.id) ?? 0;

  return {
    id,
    name: asString(record.name) || `Role ${id}`,
    description: asString(record.description),
    disabled: asBoolean(record.disabled),
  };
}

function mapPermission(permission: unknown): SystemPermission {
  const record = asObject(permission);

  return {
    code: asString(record.code),
    grouping: asString(record.grouping, "other"),
    selected: asBoolean(record.selected),
  };
}

function mapRoleDetail(role: unknown): SystemRoleDetail {
  const record = asObject(role);
  const summary = mapRoleSummary(record);

  return {
    ...summary,
    permissionUsageData: asArray(record.permissionUsageData).map(mapPermission),
  };
}

function mapAuditTemplate(value: unknown): AuditTrailSearchTemplate {
  const record = asObject(value);

  return {
    appUsers: asArray(record.appUsers).map((user) => {
      const userRecord = asObject(user);
      const id = asNumber(userRecord.id) ?? 0;
      return {
        id,
        username:
          asString(userRecord.username) ||
          asString(userRecord.name) ||
          `User ${id}`,
      };
    }),
    actionNames: asArray(record.actionNames)
      .map((item) => asString(item))
      .filter(Boolean),
    entityNames: asArray(record.entityNames)
      .map((item) => asString(item))
      .filter(Boolean),
    processingResults: asArray(record.processingResults).map((item) => {
      const itemRecord = asObject(item);
      return {
        id: asNumber(itemRecord.id) ?? asString(itemRecord.id),
        processingResult:
          asString(itemRecord.processingResult) ||
          asString(itemRecord.value) ||
          asString(itemRecord.code),
      };
    }),
  };
}

function mapAuditTrail(value: unknown): AuditTrail {
  const record = asObject(value);
  const numericResourceId = asNumber(record.resourceId);
  const textResourceId = asString(record.resourceId);

  return {
    id: asNumber(record.id) ?? 0,
    resourceId: numericResourceId ?? (textResourceId || undefined),
    processingResult: asString(record.processingResult),
    maker: asString(record.maker),
    actionName: asString(record.actionName),
    entityName: asString(record.entityName),
    officeName: asString(record.officeName),
    madeOnDate: (record.madeOnDate as AuditTrail["madeOnDate"]) ?? null,
    checker: asString(record.checker),
    checkedOnDate: (record.checkedOnDate as AuditTrail["checkedOnDate"]) ?? null,
    clientName: asString(record.clientName),
    commandAsJson: asString(record.commandAsJson),
    savingsAccountNo: asString(record.savingsAccountNo),
    groupLevelName: asString(record.groupLevelName),
  };
}

function mapAuditPage(value: unknown): AuditTrailPage {
  const record = asObject(value);

  return {
    totalFilteredRecords: asNumber(record.totalFilteredRecords) ?? 0,
    pageItems: asArray(record.pageItems).map(mapAuditTrail),
  };
}

function mapRescheduleLoanRequest(value: unknown): RescheduleLoanRequest {
  const record = asObject(value);
  const reasonCodeValue = asObject(record.rescheduleReasonCodeValue);
  const timeline = asObject(record.timeline);

  return {
    id: asNumber(record.id) ?? 0,
    loanId: asNumber(record.loanId),
    clientId: asNumber(record.clientId),
    clientName: asString(record.clientName),
    loanAccountNumber: asString(record.loanAccountNumber),
    rescheduleReasonComment: asString(record.rescheduleReasonComment),
    rescheduleReasonName: asString(reasonCodeValue.name),
    submittedOnDate:
      (timeline.submittedOnDate as RescheduleLoanRequest["submittedOnDate"]) ??
      null,
    submittedByUsername: asString(timeline.submittedByUsername),
  };
}

function mapRunHistory(value: unknown): SchedulerRunHistory {
  const record = asObject(value);

  return {
    version: asNumber(record.version) ?? 0,
    jobRunStartTime: asString(record.jobRunStartTime),
    jobRunEndTime: asString(record.jobRunEndTime),
    status: asString(record.status),
    triggerType: asString(record.triggerType),
    jobRunErrorMessage: asString(record.jobRunErrorMessage),
    jobRunErrorLog: asString(record.jobRunErrorLog),
  };
}

function mapSchedulerJob(value: unknown): SchedulerJob {
  const record = asObject(value);
  const jobId = asNumber(record.jobId) ?? 0;
  const lastRunHistory = record.lastRunHistory
    ? mapRunHistory(record.lastRunHistory)
    : null;

  return {
    jobId,
    displayName: asString(record.displayName) || `Job ${jobId}`,
    nextRunTime: asString(record.nextRunTime),
    cronExpression: asString(record.cronExpression),
    active: asBoolean(record.active),
    currentlyRunning: asBoolean(record.currentlyRunning),
    lastRunHistory,
  };
}

function mapWorkflowStep(value: unknown): WorkflowJobStep {
  const record = asObject(value);

  return {
    id: asNumber(record.id),
    stepName: asString(record.stepName),
    stepDescription: asString(record.stepDescription),
    order: asNumber(record.order) ?? 0,
  };
}

function appendAuditFilters(
  params: URLSearchParams,
  input: AuditTrailSearchInput
) {
  const filters = input.filters ?? {};
  const normalizedFilters: Record<string, string | undefined> = {
    actionName: filters.actionName,
    entityName: filters.entityName,
    resourceId: filters.resourceId,
    makerId: filters.makerId,
    makerDateTimeFrom: filters.makerDateTimeFrom,
    makerDateTimeTo: filters.makerDateTimeTo,
    checkerDateTimeFrom: filters.checkerDateTimeFrom,
    checkerDateTimeTo: filters.checkerDateTimeTo,
    checkerId: filters.checkerId,
    processingResult: filters.processingResult,
    dateFormat: filters.dateFormat,
    locale: filters.locale,
  };

  Object.entries(normalizedFilters).forEach(([key, value]) => {
    if (value && value.trim() !== "") {
      params.set(key, value);
    }
  });
}

function revalidateSystemPaths() {
  revalidatePath("/system");
  revalidatePath("/system/roles-and-permissions");
  revalidatePath("/system/configure-mc-tasks");
  revalidatePath("/system/manage-jobs");
  revalidatePath("/system/audit-trails");
  revalidatePath("/checker-inbox");
}

export async function getSystemPermissionFlagsAction(): Promise<SystemPermissionFlags> {
  const [canUpdatePermission, canUpdateScheduler, canExecuteInlineJob] =
    await Promise.all([
      hasFineractPermissionServer("UPDATE_PERMISSION"),
      hasFineractPermissionServer("UPDATE_SCHEDULER"),
      hasFineractPermissionServer("EXECUTE_INLINE_JOB"),
    ]);

  return {
    canUpdatePermission,
    canUpdateScheduler,
    canExecuteInlineJob,
  };
}

export async function listSystemRolesAction(): Promise<SystemRoleSummary[]> {
  const roles = await fetchFineractAPIAsCurrentUser("/roles", {
    cache: "no-store",
  });
  return asArray(roles).map(mapRoleSummary);
}

export async function getSystemRoleAction(
  id: number | string
): Promise<SystemRoleDetail> {
  const parsed = roleIdSchema.parse({ id });
  const role = await fetchFineractAPIAsCurrentUser(
    `/roles/${parsed.id}/permissions`,
    { cache: "no-store" }
  );
  return mapRoleDetail(role);
}

export async function createSystemRoleAction(
  input: z.infer<typeof roleCreateSchema>
): Promise<SystemActionResult<SystemRoleSummary>> {
  const parsed = roleCreateSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    const response = await fetchFineractAPIAsCurrentUser("/roles", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    revalidateSystemPaths();

    if (isFineractCommandPendingApproval(response)) {
      return pendingApproval();
    }

    return ok(mapRoleSummary({ ...parsed.data, id: asNumber(asObject(response).resourceId) }));
  } catch (error) {
    return fail(error, "Failed to create role");
  }
}

export async function updateSystemRoleAction(
  input: z.infer<typeof roleUpdateSchema>
): Promise<SystemActionResult> {
  const parsed = roleUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    const response = await fetchFineractAPIAsCurrentUser(`/roles/${parsed.data.id}`, {
      method: "PUT",
      body: JSON.stringify({ description: parsed.data.description }),
    });
    revalidateSystemPaths();

    if (isFineractCommandPendingApproval(response)) {
      return pendingApproval();
    }

    return ok();
  } catch (error) {
    return fail(error, "Failed to update role");
  }
}

export async function updateSystemRolePermissionsAction(
  input: z.infer<typeof updateRolePermissionsSchema>
): Promise<SystemActionResult> {
  const parsed = updateRolePermissionsSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    const response = await fetchFineractAPIAsCurrentUser(
      `/roles/${parsed.data.roleId}/permissions`,
      {
        method: "PUT",
        body: JSON.stringify({ permissions: parsed.data.permissions }),
      }
    );
    revalidateSystemPaths();

    if (isFineractCommandPendingApproval(response)) {
      return pendingApproval();
    }

    return ok();
  } catch (error) {
    return fail(error, "Failed to update role permissions");
  }
}

export async function deleteSystemRoleAction(
  id: number | string
): Promise<SystemActionResult> {
  const parsed = roleIdSchema.safeParse({ id });
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    const response = await fetchFineractAPIAsCurrentUser(`/roles/${parsed.data.id}`, {
      method: "DELETE",
    });
    revalidateSystemPaths();

    if (isFineractCommandPendingApproval(response)) {
      return pendingApproval();
    }

    return ok();
  } catch (error) {
    return fail(error, "Failed to delete role");
  }
}

export async function setSystemRoleEnabledAction(
  id: number | string,
  enabled: boolean
): Promise<SystemActionResult> {
  const parsed = roleIdSchema.safeParse({ id });
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    const response = await fetchFineractAPIAsCurrentUser(
      `/roles/${parsed.data.id}?command=${enabled ? "enable" : "disable"}`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    revalidateSystemPaths();

    if (isFineractCommandPendingApproval(response)) {
      return pendingApproval();
    }

    return ok();
  } catch (error) {
    return fail(error, `Failed to ${enabled ? "enable" : "disable"} role`);
  }
}

export async function listMakerCheckerPermissionsAction(): Promise<SystemPermission[]> {
  const permissions = await fetchFineractAPIAsCurrentUser(
    "/permissions?makerCheckerable=true",
    { cache: "no-store" }
  );
  return asArray(permissions)
    .map(mapPermission)
    .filter((permission) => !isBlockedMakerCheckerTask(permission));
}

export async function updateMakerCheckerPermissionsAction(
  input: z.infer<typeof permissionMapSchema>
): Promise<SystemActionResult> {
  const parsed = permissionMapSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    // Defense in depth: strip any blocked code from the payload server-side too, in
    // case a stale client or a direct call tries to enable one.
    const allPermissions = asArray(
      await fetchFineractAPIAsCurrentUser("/permissions?makerCheckerable=true", {
        cache: "no-store",
      })
    ).map(mapPermission);
    const blockedCodes = new Set(
      allPermissions
        .filter(isBlockedMakerCheckerTask)
        .map((permission) => permission.code)
    );
    const sanitizedPermissions = Object.fromEntries(
      Object.entries(parsed.data.permissions).filter(
        ([code]) => !blockedCodes.has(code)
      )
    );

    await fetchFineractAPIAsCurrentUser("/permissions?makerCheckerable=true", {
      method: "PUT",
      body: JSON.stringify({ permissions: sanitizedPermissions }),
    });
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to update maker checker tasks");
  }
}

export async function getMakerCheckerSearchTemplateAction(): Promise<AuditTrailSearchTemplate> {
  const template = await fetchFineractAPIAsCurrentUser(
    "/makercheckers/searchtemplate",
    { cache: "no-store" }
  );
  return mapAuditTemplate(template);
}

export async function listMakerCheckerEntriesAction(
  input: MakerCheckerSearchInput = {}
): Promise<AuditTrail[]> {
  const params = new URLSearchParams();
  if (input.actionName) params.set("actionName", input.actionName);
  if (input.entityName) params.set("entityName", input.entityName);
  if (input.resourceId) params.set("resourceId", input.resourceId);
  if (input.makerDateTimeFrom) {
    params.set("makerDateTimeFrom", input.makerDateTimeFrom);
    params.set("dateFormat", "dd MMMM yyyy");
    params.set("locale", "en");
  }
  if (input.makerDateTimeTo) {
    params.set("makerDateTimeTo", input.makerDateTimeTo);
    params.set("dateFormat", "dd MMMM yyyy");
    params.set("locale", "en");
  }

  const query = params.toString();
  const entries = await fetchFineractAPIAsCurrentUser(
    `/makercheckers${query ? `?${query}` : ""}`,
    { cache: "no-store" }
  );
  return asArray(entries).map(mapAuditTrail);
}

export async function approveMakerCheckerEntryAction(
  id: number | string
): Promise<SystemActionResult> {
  const parsed = makerCheckerIdSchema.safeParse({ id });
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser(
      `/makercheckers/${parsed.data.id}?command=approve`,
      { method: "POST", body: JSON.stringify({}) }
    );
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to approve entry");
  }
}

export async function rejectMakerCheckerEntryAction(
  id: number | string
): Promise<SystemActionResult> {
  const parsed = makerCheckerIdSchema.safeParse({ id });
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser(
      `/makercheckers/${parsed.data.id}?command=reject`,
      { method: "POST", body: JSON.stringify({}) }
    );
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to reject entry");
  }
}

export async function deleteMakerCheckerEntryAction(
  id: number | string
): Promise<SystemActionResult> {
  const parsed = makerCheckerIdSchema.safeParse({ id });
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser(`/makercheckers/${parsed.data.id}`, {
      method: "DELETE",
    });
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to delete entry");
  }
}

export async function getAuditTrailSearchTemplateAction(): Promise<AuditTrailSearchTemplate> {
  const template = await fetchFineractAPIAsCurrentUser(
    "/audits/searchtemplate",
    { cache: "no-store" }
  );
  return mapAuditTemplate(template);
}

export async function searchAuditTrailsAction(
  input: AuditTrailSearchInput = {}
): Promise<AuditTrailPage> {
  const params = new URLSearchParams({
    offset: String(input.offset ?? 0),
    limit: String(input.limit ?? 10),
    sortOrder: input.sortOrder ?? "",
    orderBy: input.orderBy ?? "",
    paged: "true",
  });
  appendAuditFilters(params, input);

  const audits = await fetchFineractAPIAsCurrentUser(
    `/audits?${params.toString()}`,
    { cache: "no-store" }
  );
  return mapAuditPage(audits);
}

export async function getAuditTrailAction(
  id: number | string
): Promise<AuditTrail> {
  const auditId = z.coerce.number().int().positive().parse(id);
  const audit = await fetchFineractAPIAsCurrentUser(`/audits/${auditId}`, {
    cache: "no-store",
  });
  return mapAuditTrail(audit);
}

export async function getManageJobsDataAction(): Promise<{
  jobs: SchedulerJob[];
  scheduler: SchedulerStatus;
}> {
  const [jobs, scheduler] = await Promise.all([
    fetchFineractAPIAsCurrentUser("/jobs", { cache: "no-store" }),
    fetchFineractAPIAsCurrentUser("/scheduler", { cache: "no-store" }),
  ]);

  return {
    jobs: asArray(jobs).map(mapSchedulerJob),
    scheduler: { active: asBoolean(asObject(scheduler).active) },
  };
}

export async function listSchedulerJobsAction(): Promise<SchedulerJob[]> {
  const jobs = await fetchFineractAPIAsCurrentUser("/jobs", {
    cache: "no-store",
  });
  return asArray(jobs).map(mapSchedulerJob);
}

export async function getSchedulerStatusAction(): Promise<SchedulerStatus> {
  const scheduler = await fetchFineractAPIAsCurrentUser("/scheduler", {
    cache: "no-store",
  });
  return { active: asBoolean(asObject(scheduler).active) };
}

export async function runSchedulerCommandAction(
  command: "start" | "stop"
): Promise<SystemActionResult<SchedulerStatus>> {
  try {
    await fetchFineractAPIAsCurrentUser(`/scheduler?command=${command}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const scheduler = await getSchedulerStatusAction();
    revalidateSystemPaths();
    return ok(scheduler);
  } catch (error) {
    return fail(error, `Failed to ${command} scheduler`);
  }
}

export async function getSchedulerJobAction(
  jobId: number | string
): Promise<SchedulerJob> {
  const parsed = jobIdSchema.parse({ jobId });
  const job = await fetchFineractAPIAsCurrentUser(`/jobs/${parsed.jobId}`, {
    cache: "no-store",
  });
  return mapSchedulerJob(job);
}

export async function updateSchedulerJobAction(
  input: z.infer<typeof schedulerJobUpdateSchema>
): Promise<SystemActionResult> {
  const parsed = schedulerJobUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser(`/jobs/${parsed.data.jobId}`, {
      method: "PUT",
      body: JSON.stringify({
        displayName: parsed.data.displayName,
        cronExpression: parsed.data.cronExpression,
        active: parsed.data.active,
      }),
    });
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to update scheduler job");
  }
}

export async function runSchedulerJobAction(
  input: z.infer<typeof runJobSchema>
): Promise<SystemActionResult> {
  const parsed = runJobSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  const body =
    parsed.data.jobParameters !== undefined
      ? { jobParameters: parsed.data.jobParameters }
      : {};

  try {
    await fetchFineractAPIAsCurrentUser(
      `/jobs/${parsed.data.jobId}?command=executeJob`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to run scheduler job");
  }
}

export async function getSchedulerJobHistoryAction(
  jobId: number | string
): Promise<{ pageItems: SchedulerRunHistory[] }> {
  const parsed = jobIdSchema.parse({ jobId });
  const history = await fetchFineractAPIAsCurrentUser(
    `/jobs/${parsed.jobId}/runhistory`,
    { cache: "no-store" }
  );
  return {
    pageItems: asArray(asObject(history).pageItems).map(mapRunHistory),
  };
}

export async function getWorkflowJobNamesAction(): Promise<WorkflowJobNames> {
  const names = await fetchFineractAPIAsCurrentUser("/jobs/names", {
    cache: "no-store",
  });
  return {
    businessJobs: asArray(asObject(names).businessJobs)
      .map((item) => asString(item))
      .filter(Boolean),
  };
}

export async function getWorkflowJobStepsAction(
  jobName: string
): Promise<WorkflowJobSteps> {
  const parsed = workflowJobNameSchema.parse({ jobName });
  const steps = await fetchFineractAPIAsCurrentUser(
    `/jobs/${encodeURIComponent(parsed.jobName)}/steps`,
    { cache: "no-store" }
  );
  return {
    businessSteps: asArray(asObject(steps).businessSteps).map(mapWorkflowStep),
  };
}

export async function getAvailableWorkflowJobStepsAction(
  category: string
): Promise<AvailableWorkflowJobSteps> {
  const parsed = availableStepsSchema.parse({ category });
  const steps = await fetchFineractAPIAsCurrentUser(
    `/jobs/${encodeURIComponent(parsed.category)}/available-steps`,
    { cache: "no-store" }
  );
  return {
    availableBusinessSteps: asArray(
      asObject(steps).availableBusinessSteps
    ).map(mapWorkflowStep),
  };
}

export async function updateWorkflowJobStepsAction(
  input: z.infer<typeof updateWorkflowStepsSchema>
): Promise<SystemActionResult> {
  const parsed = updateWorkflowStepsSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser(
      `/jobs/${encodeURIComponent(parsed.data.jobName)}/steps`,
      {
        method: "PUT",
        body: JSON.stringify({ businessSteps: parsed.data.businessSteps }),
      }
    );
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to update workflow job steps");
  }
}

export async function getCobCatchUpStatusAction(): Promise<CobCatchUpStatus> {
  const status = await fetchFineractAPIAsCurrentUser(
    "/loans/is-catch-up-running",
    { cache: "no-store" }
  );
  return {
    isCatchUpRunning: asBoolean(asObject(status).isCatchUpRunning),
  };
}

export async function runCobCatchUpAction(): Promise<SystemActionResult<CobCatchUpStatus>> {
  try {
    await fetchFineractAPIAsCurrentUser("/loans/catch-up", {
      method: "POST",
      body: JSON.stringify({}),
    });
    revalidateSystemPaths();
    return ok({ isCatchUpRunning: true });
  } catch (error) {
    return fail(error, "Failed to run COB catch-up");
  }
}

export async function getLockedLoansAction(
  page = 0,
  limit = 5000
): Promise<LockedLoansPage> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const loans = await fetchFineractAPIAsCurrentUser(
    `/loans/locked?${params.toString()}`,
    { cache: "no-store" }
  );
  return {
    content: asArray(asObject(loans).content).map((item) => {
      const record = asObject(item);
      return {
        loanId: asNumber(record.loanId) ?? 0,
        lockPlacedOn: asString(record.lockPlacedOn),
        lockOwner: asString(record.lockOwner),
        error: asString(record.error),
        stacktrace: asString(record.stacktrace),
      };
    }),
  };
}

export async function runInlineCobAction(
  input: z.infer<typeof inlineCobSchema>
): Promise<SystemActionResult> {
  const parsed = inlineCobSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser("/jobs/LOAN_COB/inline", {
      method: "POST",
      body: JSON.stringify({ loanIds: parsed.data.loanIds }),
    });
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to run inline COB");
  }
}

export async function getLoanClientNavigationAction(
  loanId: number | string
): Promise<SystemActionResult<{ loanId: number; clientId?: number }>> {
  const parsed = z.coerce.number().int().positive().safeParse(loanId);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    const loan = asObject(
      await fetchFineractAPIAsCurrentUser(`/loans/${parsed.data}`, {
        cache: "no-store",
      })
    );

    const clientId =
      asNumber(loan.clientId) ??
      asNumber(asObject(loan.clientData).id) ??
      asNumber(asObject(loan.client).id);

    return ok({ loanId: parsed.data, clientId });
  } catch (error) {
    return fail(error, "Failed to resolve loan client");
  }
}

export async function listPendingRescheduleLoansAction(): Promise<
  RescheduleLoanRequest[]
> {
  const requests = await fetchFineractAPIAsCurrentUser(
    "/rescheduleloans?command=pending",
    { cache: "no-store" }
  );
  return asArray(requests).map(mapRescheduleLoanRequest);
}

function todayForFineract() {
  return format(new Date(), "dd MMMM yyyy");
}

export async function approveRescheduleLoanAction(
  id: number | string
): Promise<SystemActionResult> {
  const parsed = rescheduleLoanIdSchema.safeParse({ id });
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser(
      `/rescheduleloans/${parsed.data.id}?command=approve`,
      {
        method: "POST",
        body: JSON.stringify({
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          approvedOnDate: todayForFineract(),
        }),
      }
    );
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to approve reschedule request");
  }
}

export async function rejectRescheduleLoanAction(
  id: number | string
): Promise<SystemActionResult> {
  const parsed = rescheduleLoanIdSchema.safeParse({ id });
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser(
      `/rescheduleloans/${parsed.data.id}?command=reject`,
      {
        method: "POST",
        body: JSON.stringify({
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          rejectedOnDate: todayForFineract(),
        }),
      }
    );
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to reject reschedule request");
  }
}
