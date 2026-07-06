"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchFineractAPIAsCurrentUser } from "@/lib/api";
import { hasFineractPermissionServer } from "@/lib/authorization";
import type {
  AuditTrail,
  AuditTrailPage,
  AuditTrailSearchInput,
  AuditTrailSearchTemplate,
  AvailableWorkflowJobSteps,
  CobCatchUpStatus,
  LockedLoansPage,
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

type LooseObject = Record<string, unknown>;

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
    await fetchFineractAPIAsCurrentUser(`/roles/${parsed.data.id}`, {
      method: "PUT",
      body: JSON.stringify({ description: parsed.data.description }),
    });
    revalidateSystemPaths();
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
    await fetchFineractAPIAsCurrentUser(
      `/roles/${parsed.data.roleId}/permissions`,
      {
        method: "PUT",
        body: JSON.stringify({ permissions: parsed.data.permissions }),
      }
    );
    revalidateSystemPaths();
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
    await fetchFineractAPIAsCurrentUser(`/roles/${parsed.data.id}`, {
      method: "DELETE",
    });
    revalidateSystemPaths();
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
    await fetchFineractAPIAsCurrentUser(
      `/roles/${parsed.data.id}?command=${enabled ? "enable" : "disable"}`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    revalidateSystemPaths();
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
  return asArray(permissions).map(mapPermission);
}

export async function updateMakerCheckerPermissionsAction(
  input: z.infer<typeof permissionMapSchema>
): Promise<SystemActionResult> {
  const parsed = permissionMapSchema.safeParse(input);
  if (!parsed.success) {
    return toFieldErrorResult(parsed.error);
  }

  try {
    await fetchFineractAPIAsCurrentUser("/permissions?makerCheckerable=true", {
      method: "PUT",
      body: JSON.stringify(parsed.data),
    });
    revalidateSystemPaths();
    return ok();
  } catch (error) {
    return fail(error, "Failed to update maker checker tasks");
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
