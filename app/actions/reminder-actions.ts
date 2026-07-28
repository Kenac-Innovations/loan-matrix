"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getTenantAndFineractInfo } from "@/lib/fineract-tenant-service";
import type {
  NotificationChannel,
  NotificationMessagePage,
  NotificationMessageSummary,
  NotificationSource,
  NotificationStatus,
  ReminderActionResult,
  ReminderDashboardData,
  ReminderRule,
  ReminderRunItem,
  ReminderRunItemStatus,
  ReminderRunStatus,
  ReminderRunSummary,
  ReminderTemplate,
  ReminderTenantConfig,
  ReminderType,
} from "@/shared/types/reminders";

const REMINDERS_PATH = "/system/reminders";
const TENANT_HEADER_NAME = "X-Tenant-Id";

type ReminderContext = {
  tenantId: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  fineractTenantId: string;
};

export type SaveReminderTenantConfigInput = {
  enabled: boolean;
  timezone: string;
  defaultCountryCode?: string | null;
};

export type SaveReminderTemplateInput = {
  id?: string;
  code: string;
  name: string;
  channel: "SMS" | "EMAIL";
  subject?: string | null;
  body: string;
  active: boolean;
};

export type SaveReminderRuleInput = {
  id?: string;
  code: string;
  name: string;
  type: ReminderType;
  enabled: boolean;
  channels: string;
  templateId?: string | null;
  reportName?: string | null;
  sendTime: string;
  timezone?: string | null;
  daysOffset: number;
  lookBackDays: number;
  lookAheadDays: number;
  minDaysPastDue?: number | null;
  maxDaysPastDue?: number | null;
  cooldownMinutes: number;
  pageLimit: number;
};

export type ReminderRunFilters = {
  status?: ReminderRunStatus;
  limit?: number;
};

export type NotificationMessageFilters = {
  status?: NotificationStatus;
  sourceType?: string;
  reminderRunId?: string;
  reminderRuleId?: string;
  limit?: number;
};

export type NotificationMessagePageFilters = {
  page?: number;
  size?: number;
  status?: NotificationStatus;
  source?: NotificationSource;
  sourceType?: string;
  channel?: NotificationChannel;
  reminderRunId?: string;
  reminderRuleId?: string;
};

function backendBaseUrl() {
  const value = process.env.LOAN_MATRIX_BACKEND_URL?.trim();
  if (!value) {
    throw new Error("LOAN_MATRIX_BACKEND_URL is not configured");
  }
  return value.replace(/\/+$/, "");
}

async function requireReminderContext(): Promise<ReminderContext> {
  const [session, tenantInfo] = await Promise.all([
    getSession(),
    getTenantAndFineractInfo(),
  ]);

  if (!session?.user) {
    throw new Error("You must be signed in to manage reminders");
  }

  const tenant = tenantInfo.tenant;
  const tenantId = tenantInfo.fineractTenantId;
  if (!tenantId) {
    throw new Error("Could not resolve tenant for reminders");
  }

  return {
    tenantId,
    tenantName: tenant?.name ?? null,
    tenantSlug: tenant?.slug ?? null,
    fineractTenantId: tenantId,
  };
}

async function readError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.details === "string") return data.details;
  }

  const text = await response.text().catch(() => "");
  return text || `${response.status} ${response.statusText}`;
}

async function backendFetch<T>(
  context: ReminderContext,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      [TENANT_HEADER_NAME]: context.fineractTenantId,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function queryString(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

function success<T>(data: T): ReminderActionResult<T> {
  return { success: true, data };
}

function failure<T = unknown>(error: unknown): ReminderActionResult<T> {
  return {
    success: false,
    error: error instanceof Error ? error.message : "Reminder action failed",
  };
}

export async function getReminderDashboardAction(): Promise<ReminderDashboardData> {
  const context = await requireReminderContext();

  const [config, templates, rules, runs, messages] = await Promise.all([
    backendFetch<ReminderTenantConfig>(
      context,
      "/api/v1/reminders/tenant-config"
    ),
    backendFetch<ReminderTemplate[]>(
      context,
      "/api/v1/reminders/templates"
    ),
    backendFetch<ReminderRule[]>(
      context,
      "/api/v1/reminders/rules"
    ),
    backendFetch<ReminderRunSummary[]>(
      context,
      `/api/v1/reminders/runs${queryString({ limit: 50 })}`
    ),
    backendFetch<NotificationMessageSummary[]>(
      context,
      `/api/v1/notifications/messages${queryString({ limit: 50 })}`
    ),
  ]);

  return {
    tenant: context,
    config,
    templates,
    rules,
    runs,
    messages,
  };
}

export async function getReminderRunsAction(
  filters: ReminderRunFilters = {}
): Promise<ReminderRunSummary[]> {
  const context = await requireReminderContext();
  return backendFetch<ReminderRunSummary[]>(
    context,
    `/api/v1/reminders/runs${queryString({
      status: filters.status,
      limit: filters.limit ?? 50,
    })}`
  );
}

export async function getReminderRunItemsAction(
  runId: string,
  status?: ReminderRunItemStatus
): Promise<ReminderRunItem[]> {
  const context = await requireReminderContext();
  return backendFetch<ReminderRunItem[]>(
    context,
    `/api/v1/reminders/runs/${encodeURIComponent(runId)}/items${queryString({
      status,
    })}`
  );
}

export async function getNotificationMessagesAction(
  filters: NotificationMessageFilters = {}
): Promise<NotificationMessageSummary[]> {
  const context = await requireReminderContext();
  return backendFetch<NotificationMessageSummary[]>(
    context,
    `/api/v1/notifications/messages${queryString({
      status: filters.status,
      sourceType: filters.sourceType,
      reminderRunId: filters.reminderRunId,
      reminderRuleId: filters.reminderRuleId,
      limit: filters.limit ?? 50,
    })}`
  );
}

export async function getNotificationMessagesPageAction(
  filters: NotificationMessagePageFilters = {}
): Promise<NotificationMessagePage> {
  const context = await requireReminderContext();
  return backendFetch<NotificationMessagePage>(
    context,
    `/api/v1/notifications/messages/page${queryString({
      page: filters.page ?? 0,
      size: filters.size ?? 25,
      status: filters.status,
      source: filters.source,
      sourceType: filters.sourceType,
      channel: filters.channel,
      reminderRunId: filters.reminderRunId,
      reminderRuleId: filters.reminderRuleId,
    })}`
  );
}

export async function saveReminderTenantConfigAction(
  input: SaveReminderTenantConfigInput
): Promise<ReminderActionResult<ReminderTenantConfig>> {
  try {
    const context = await requireReminderContext();
    const data = await backendFetch<ReminderTenantConfig>(
      context,
      "/api/v1/reminders/tenant-config",
      {
        method: "PUT",
        body: JSON.stringify({
          enabled: input.enabled,
          timezone: input.timezone,
          defaultCountryCode: input.defaultCountryCode,
        }),
      }
    );
    revalidatePath(REMINDERS_PATH);
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function saveReminderTemplateAction(
  input: SaveReminderTemplateInput
): Promise<ReminderActionResult<ReminderTemplate>> {
  try {
    const context = await requireReminderContext();
    const payload = {
      code: input.code.trim(),
      name: input.name.trim(),
      channel: input.channel,
      subject: input.subject?.trim() || null,
      body: input.body.trim(),
      active: input.active,
    };

    const data = await backendFetch<ReminderTemplate>(
      context,
      input.id
        ? `/api/v1/reminders/templates/${encodeURIComponent(input.id)}`
        : "/api/v1/reminders/templates",
      {
        method: input.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      }
    );
    revalidatePath(REMINDERS_PATH);
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function saveReminderRuleAction(
  input: SaveReminderRuleInput
): Promise<ReminderActionResult<ReminderRule>> {
  try {
    const context = await requireReminderContext();
    const payload = {
      code: input.code.trim(),
      name: input.name.trim(),
      type: input.type,
      enabled: input.enabled,
      channels: input.channels || "SMS",
      templateId: input.templateId || null,
      reportName: input.reportName?.trim() || null,
      sendTime: input.sendTime,
      timezone: input.timezone?.trim() || null,
      daysOffset: input.daysOffset,
      lookBackDays: input.lookBackDays,
      lookAheadDays: input.lookAheadDays,
      minDaysPastDue: input.minDaysPastDue ?? null,
      maxDaysPastDue: input.maxDaysPastDue ?? null,
      cooldownMinutes: input.cooldownMinutes,
      pageLimit: input.pageLimit,
    };

    const data = await backendFetch<ReminderRule>(
      context,
      input.id
        ? `/api/v1/reminders/rules/${encodeURIComponent(input.id)}`
        : "/api/v1/reminders/rules",
      {
        method: input.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      }
    );
    revalidatePath(REMINDERS_PATH);
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function ensureDefaultReminderSetupAction(): Promise<
  ReminderActionResult<ReminderDashboardData>
> {
  try {
    const dashboard = await getReminderDashboardAction();
    const templatesByCode = new Map(
      dashboard.templates.map((template) => [template.code, template])
    );
    const rulesByCode = new Map(dashboard.rules.map((rule) => [rule.code, rule]));

    let repaymentTemplate = templatesByCode.get("repayment_due_sms");
    if (!repaymentTemplate) {
      const result = await saveReminderTemplateAction({
        code: "repayment_due_sms",
        name: "Repayment Due SMS",
        channel: "SMS",
        subject: null,
        body:
          "Dear {{clientName}}, your loan {{loanAccountNo}} repayment of {{amountDue}} is due on {{dueDate}}. Please pay on time.",
        active: true,
      });
      if (!result.success || !result.data) throw new Error(result.error);
      repaymentTemplate = result.data;
    }

    let recoveryTemplate = templatesByCode.get("recovery_arrears_sms");
    if (!recoveryTemplate) {
      const result = await saveReminderTemplateAction({
        code: "recovery_arrears_sms",
        name: "Recovery Arrears SMS",
        channel: "SMS",
        subject: null,
        body:
          "Dear {{clientName}}, your loan {{loanAccountNo}} is {{daysPastDue}} days overdue. Amount due: {{amountDue}}. Please contact us to regularise your account.",
        active: true,
      });
      if (!result.success || !result.data) throw new Error(result.error);
      recoveryTemplate = result.data;
    }

    const defaultRules: SaveReminderRuleInput[] = [
      {
        code: "repayment_due_today",
        name: "Repayment Due Today",
        type: "LOAN_REPAYMENT_DUE",
        enabled: true,
        channels: "SMS",
        templateId: repaymentTemplate.id,
        reportName: "LM Reminder Repayment Candidates",
        sendTime: "09:00",
        timezone: dashboard.config.timezone || "Africa/Harare",
        daysOffset: 0,
        lookBackDays: 0,
        lookAheadDays: 0,
        cooldownMinutes: 1440,
        pageLimit: 100,
      },
      {
        code: "recovery_30_days",
        name: "Recovery 30-59 Days",
        type: "RECOVERY_ARREARS",
        enabled: true,
        channels: "SMS",
        templateId: recoveryTemplate.id,
        reportName: "LM Reminder Recovery Candidates",
        sendTime: "10:00",
        timezone: dashboard.config.timezone || "Africa/Harare",
        daysOffset: 0,
        lookBackDays: 0,
        lookAheadDays: 0,
        minDaysPastDue: 30,
        maxDaysPastDue: 59,
        cooldownMinutes: 1440,
        pageLimit: 100,
      },
      {
        code: "recovery_60_days",
        name: "Recovery 60-89 Days",
        type: "RECOVERY_ARREARS",
        enabled: true,
        channels: "SMS",
        templateId: recoveryTemplate.id,
        reportName: "LM Reminder Recovery Candidates",
        sendTime: "10:30",
        timezone: dashboard.config.timezone || "Africa/Harare",
        daysOffset: 0,
        lookBackDays: 0,
        lookAheadDays: 0,
        minDaysPastDue: 60,
        maxDaysPastDue: 89,
        cooldownMinutes: 1440,
        pageLimit: 100,
      },
      {
        code: "recovery_90_plus",
        name: "Recovery 90+ Days",
        type: "RECOVERY_ARREARS",
        enabled: true,
        channels: "SMS",
        templateId: recoveryTemplate.id,
        reportName: "LM Reminder Recovery Candidates",
        sendTime: "11:00",
        timezone: dashboard.config.timezone || "Africa/Harare",
        daysOffset: 0,
        lookBackDays: 0,
        lookAheadDays: 0,
        minDaysPastDue: 90,
        maxDaysPastDue: null,
        cooldownMinutes: 1440,
        pageLimit: 100,
      },
    ];

    for (const rule of defaultRules) {
      if (!rulesByCode.has(rule.code)) {
        const result = await saveReminderRuleAction(rule);
        if (!result.success) throw new Error(result.error);
      }
    }

    revalidatePath(REMINDERS_PATH);
    return success(await getReminderDashboardAction());
  } catch (error) {
    return failure(error);
  }
}
