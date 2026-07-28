"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  Clock3,
  Database,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  SquarePen,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  ensureDefaultReminderSetupAction,
  getNotificationMessagesAction,
  getReminderDashboardAction,
  getReminderRunItemsAction,
  saveReminderRuleAction,
  saveReminderTemplateAction,
  saveReminderTenantConfigAction,
  type SaveReminderRuleInput,
  type SaveReminderTemplateInput,
  type SaveReminderTenantConfigInput,
} from "@/app/actions/reminder-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  NotificationMessageSummary,
  NotificationStatus,
  ReminderDashboardData,
  ReminderRule,
  ReminderRunItem,
  ReminderRunSummary,
  ReminderTemplate,
  ReminderType,
} from "@/shared/types/reminders";

const NONE = "__none";

type RemindersClientProps = {
  initialData: ReminderDashboardData;
};

type RuleFormState = SaveReminderRuleInput;
type TemplateFormState = SaveReminderTemplateInput;

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    dateStyle: "medium",
  });
}

function formatReminderType(type: ReminderType) {
  return type === "LOAN_REPAYMENT_DUE" ? "Repayment Due" : "Recovery Arrears";
}

function compactStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusBadgeClass(status: string) {
  if (["SENT", "COMPLETED"].includes(status)) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  }
  if (["FAILED"].includes(status)) {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200";
  }
  if (["ACCEPTED", "QUEUED", "PROCESSING_REMINDERS", "SCANNING_CANDIDATES", "CANDIDATES_LOADED"].includes(status)) {
    return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200";
  }
  if (["SUPPRESSED", "SKIPPED"].includes(status)) {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
  }
  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
}

function StatCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function emptyTemplateForm(): TemplateFormState {
  return {
    code: "",
    name: "",
    channel: "SMS",
    subject: "",
    body: "",
    active: true,
  };
}

function templateToForm(template: ReminderTemplate): TemplateFormState {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    channel: template.channel,
    subject: template.subject ?? "",
    body: template.body,
    active: template.active,
  };
}

function emptyRuleForm(
  timezone: string,
  templateId?: string | null
): RuleFormState {
  return {
    code: "",
    name: "",
    type: "LOAN_REPAYMENT_DUE",
    enabled: true,
    channels: "SMS",
    templateId: templateId ?? null,
    reportName: "",
    sendTime: "09:00",
    timezone,
    daysOffset: 0,
    lookBackDays: 0,
    lookAheadDays: 0,
    minDaysPastDue: null,
    maxDaysPastDue: null,
    cooldownMinutes: 1440,
    pageLimit: 100,
  };
}

function ruleToForm(rule: ReminderRule): RuleFormState {
  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    type: rule.type,
    enabled: rule.enabled,
    channels: rule.channels || "SMS",
    templateId: rule.templateId ?? null,
    reportName: rule.reportName ?? "",
    sendTime: rule.sendTime?.slice(0, 5) || "09:00",
    timezone: rule.timezone ?? "",
    daysOffset: rule.daysOffset,
    lookBackDays: rule.lookBackDays,
    lookAheadDays: rule.lookAheadDays,
    minDaysPastDue: rule.minDaysPastDue ?? null,
    maxDaysPastDue: rule.maxDaysPastDue ?? null,
    cooldownMinutes: rule.cooldownMinutes,
    pageLimit: rule.pageLimit,
  };
}

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function runProgress(run: ReminderRunSummary) {
  const loadedBase = run.totalCandidateCount || run.loadedCandidateCount || 0;
  if (run.status === "SCANNING_CANDIDATES" && loadedBase > 0) {
    return Math.min(100, Math.round((run.loadedCandidateCount / loadedBase) * 100));
  }

  const processedBase = run.loadedCandidateCount || run.totalCandidateCount || 0;
  if (processedBase > 0) {
    return Math.min(100, Math.round((run.processedCount / processedBase) * 100));
  }

  return run.status === "COMPLETED" ? 100 : 0;
}

function ruleName(rules: ReminderRule[], ruleId?: string | null) {
  if (!ruleId) return "N/A";
  return rules.find((rule) => rule.id === ruleId)?.name ?? ruleId.slice(0, 8);
}

function templateName(templates: ReminderTemplate[], templateId?: string | null) {
  if (!templateId) return "None";
  return templates.find((template) => template.id === templateId)?.name ?? "Unknown";
}

export function RemindersClient({ initialData }: RemindersClientProps) {
  const [data, setData] = useState(initialData);
  const [configForm, setConfigForm] = useState<SaveReminderTenantConfigInput>({
    enabled: initialData.config.enabled,
    timezone: initialData.config.timezone || "Africa/Harare",
    defaultCountryCode: initialData.config.defaultCountryCode || "+263",
  });
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(
    emptyTemplateForm()
  );
  const [ruleForm, setRuleForm] = useState<RuleFormState>(
    emptyRuleForm(initialData.config.timezone || "Africa/Harare")
  );
  const [messageStatusFilter, setMessageStatusFilter] = useState<NotificationStatus | "ALL">("ALL");
  const [selectedRun, setSelectedRun] = useState<ReminderRunSummary | null>(null);
  const [runItems, setRunItems] = useState<ReminderRunItem[]>([]);
  const [runItemsLoading, setRunItemsLoading] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRules = useMemo(
    () => data.rules.filter((rule) => rule.enabled).length,
    [data.rules]
  );
  const runningRuns = useMemo(
    () =>
      data.runs.filter((run) =>
        ["CREATED", "SCANNING_CANDIDATES", "CANDIDATES_LOADED", "PROCESSING_REMINDERS"].includes(run.status)
      ).length,
    [data.runs]
  );
  const deliveredCount = useMemo(
    () => data.messages.filter((message) => message.status === "SENT").length,
    [data.messages]
  );
  const failedCount = useMemo(
    () => data.messages.filter((message) => message.status === "FAILED").length,
    [data.messages]
  );

  const refreshDashboard = () => {
    setPendingLabel("refresh");
    startTransition(async () => {
      try {
        const next = await getReminderDashboardAction();
        setData(next);
        setConfigForm({
          enabled: next.config.enabled,
          timezone: next.config.timezone || "Africa/Harare",
          defaultCountryCode: next.config.defaultCountryCode || "+263",
        });
        toast.success("Reminders refreshed");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to refresh reminders");
      } finally {
        setPendingLabel(null);
      }
    });
  };

  const handleSaveConfig = (event: FormEvent) => {
    event.preventDefault();
    setPendingLabel("config");
    startTransition(async () => {
      const result = await saveReminderTenantConfigAction(configForm);
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to save reminder settings");
        setPendingLabel(null);
        return;
      }
      setData((current) => ({ ...current, config: result.data! }));
      toast.success("Reminder settings saved");
      setPendingLabel(null);
    });
  };

  const handleSaveTemplate = (event: FormEvent) => {
    event.preventDefault();
    if (!templateForm.code.trim() || !templateForm.name.trim() || !templateForm.body.trim()) {
      toast.error("Template code, name, and message are required");
      return;
    }

    setPendingLabel("template");
    startTransition(async () => {
      const result = await saveReminderTemplateAction(templateForm);
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to save template");
        setPendingLabel(null);
        return;
      }

      setData((current) => ({
        ...current,
        templates: [
          result.data!,
          ...current.templates.filter((template) => template.id !== result.data!.id),
        ].sort((first, second) => first.name.localeCompare(second.name)),
      }));
      setTemplateForm(emptyTemplateForm());
      toast.success("Reminder template saved");
      setPendingLabel(null);
    });
  };

  const handleSaveRule = (event: FormEvent) => {
    event.preventDefault();
    if (!ruleForm.code.trim() || !ruleForm.name.trim() || !ruleForm.sendTime) {
      toast.error("Rule code, name, and send time are required");
      return;
    }

    setPendingLabel("rule");
    startTransition(async () => {
      const result = await saveReminderRuleAction(ruleForm);
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to save rule");
        setPendingLabel(null);
        return;
      }

      setData((current) => ({
        ...current,
        rules: [
          result.data!,
          ...current.rules.filter((rule) => rule.id !== result.data!.id),
        ].sort((first, second) => first.name.localeCompare(second.name)),
      }));
      setRuleForm(emptyRuleForm(data.config.timezone || "Africa/Harare"));
      toast.success("Reminder rule saved");
      setPendingLabel(null);
    });
  };

  const handleDefaults = () => {
    setPendingLabel("defaults");
    startTransition(async () => {
      const result = await ensureDefaultReminderSetupAction();
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to create default reminders");
        setPendingLabel(null);
        return;
      }
      setData(result.data);
      toast.success("Default reminder setup is ready");
      setPendingLabel(null);
    });
  };

  const handleMessageFilter = (status: NotificationStatus | "ALL") => {
    setMessageStatusFilter(status);
    setPendingLabel("messages");
    startTransition(async () => {
      try {
        const messages = await getNotificationMessagesAction({
          status: status === "ALL" ? undefined : status,
          limit: 50,
        });
        setData((current) => ({ ...current, messages }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load messages");
      } finally {
        setPendingLabel(null);
      }
    });
  };

  const handleSelectRun = async (run: ReminderRunSummary) => {
    setSelectedRun(run);
    setRunItems([]);
    setRunItemsLoading(true);
    try {
      const items = await getReminderRunItemsAction(run.id);
      setRunItems(items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load run items");
    } finally {
      setRunItemsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Central scheduling, templates, run progress, and delivery history.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{data.tenant.fineractTenantId}</Badge>
            {data.tenant.tenantName && (
              <Badge variant="outline">{data.tenant.tenantName}</Badge>
            )}
            <Badge className={cn("border", statusBadgeClass(data.config.enabled ? "SENT" : "SKIPPED"))}>
              {data.config.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={refreshDashboard}
            disabled={isPending}
          >
            {pendingLabel === "refresh" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button onClick={handleDefaults} disabled={isPending}>
            {pendingLabel === "defaults" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Use Defaults
          </Button>
        </div>
      </div>

      {!data.config.enabled && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Reminder runs will not be created for this tenant until reminders are enabled.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Rules"
          value={activeRules}
          detail={`${data.rules.length} configured rules`}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          title="Running Jobs"
          value={runningRuns}
          detail={`${data.runs.length} recent runs loaded`}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <StatCard
          title="Messages Sent"
          value={deliveredCount}
          detail="From the central notification ledger"
          icon={<Send className="h-4 w-4" />}
        />
        <StatCard
          title="Failures"
          value={failedCount}
          detail="Callback or dispatch failures"
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="h-4 w-4" />
                  Tenant Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSaveConfig}>
                  <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <div>
                      <Label className="text-sm font-medium">Reminders</Label>
                      <p className="text-xs text-muted-foreground">
                        Tenant-level scheduler switch.
                      </p>
                    </div>
                    <Switch
                      checked={configForm.enabled}
                      onCheckedChange={(enabled) =>
                        setConfigForm((current) => ({ ...current, enabled }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={configForm.timezone}
                      onChange={(event) =>
                        setConfigForm((current) => ({
                          ...current,
                          timezone: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-country-code">Default Country Code</Label>
                    <Input
                      id="default-country-code"
                      value={configForm.defaultCountryCode ?? ""}
                      onChange={(event) =>
                        setConfigForm((current) => ({
                          ...current,
                          defaultCountryCode: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <Button type="submit" disabled={isPending} className="w-full">
                    {pendingLabel === "config" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Settings
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BellRing className="h-4 w-4" />
                  Recent Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RunsTable
                  runs={data.runs.slice(0, 5)}
                  rules={data.rules}
                  compact
                  onSelectRun={handleSelectRun}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Window</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                            No reminder rules configured.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.rules.map((rule) => (
                          <TableRow key={rule.id ?? rule.code}>
                            <TableCell>
                              <div className="font-medium">{rule.name}</div>
                              <div className="text-xs text-muted-foreground">{rule.code}</div>
                            </TableCell>
                            <TableCell>{formatReminderType(rule.type)}</TableCell>
                            <TableCell className="tabular-nums">
                              {rule.sendTime?.slice(0, 5)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {rule.type === "RECOVERY_ARREARS"
                                ? `${rule.minDaysPastDue ?? 0}+ days${rule.maxDaysPastDue ? ` to ${rule.maxDaysPastDue}` : ""}`
                                : `${rule.lookBackDays} back / ${rule.lookAheadDays} ahead`}
                            </TableCell>
                            <TableCell>{templateName(data.templates, rule.templateId)}</TableCell>
                            <TableCell>
                              <Badge className={cn("border", statusBadgeClass(rule.enabled ? "SENT" : "SKIPPED"))}>
                                {rule.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRuleForm(ruleToForm(rule))}
                              >
                                <SquarePen className="h-4 w-4" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {ruleForm.id ? "Edit Rule" : "New Rule"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSaveRule}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rule-code">Code</Label>
                      <Input
                        id="rule-code"
                        value={ruleForm.code}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, code: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rule-time">Send Time</Label>
                      <Input
                        id="rule-time"
                        type="time"
                        value={ruleForm.sendTime}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, sendTime: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rule-name">Name</Label>
                    <Input
                      id="rule-name"
                      value={ruleForm.name}
                      onChange={(event) =>
                        setRuleForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={ruleForm.type}
                        onValueChange={(type: ReminderType) =>
                          setRuleForm((current) => ({ ...current, type }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOAN_REPAYMENT_DUE">Repayment Due</SelectItem>
                          <SelectItem value="RECOVERY_ARREARS">Recovery Arrears</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Select
                        value={ruleForm.templateId || NONE}
                        onValueChange={(templateId) =>
                          setRuleForm((current) => ({
                            ...current,
                            templateId: templateId === NONE ? null : templateId,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {data.templates.map((template) => (
                            <SelectItem key={template.id ?? template.code} value={template.id ?? template.code}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rule-timezone">Timezone</Label>
                      <Input
                        id="rule-timezone"
                        value={ruleForm.timezone ?? ""}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, timezone: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rule-cooldown">Cooldown Minutes</Label>
                      <Input
                        id="rule-cooldown"
                        type="number"
                        min={0}
                        value={ruleForm.cooldownMinutes}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            cooldownMinutes: Number(event.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="days-offset">Days Offset</Label>
                      <Input
                        id="days-offset"
                        type="number"
                        value={ruleForm.daysOffset}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            daysOffset: Number(event.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="look-back">Look Back</Label>
                      <Input
                        id="look-back"
                        type="number"
                        min={0}
                        value={ruleForm.lookBackDays}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            lookBackDays: Number(event.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="look-ahead">Look Ahead</Label>
                      <Input
                        id="look-ahead"
                        type="number"
                        min={0}
                        value={ruleForm.lookAheadDays}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            lookAheadDays: Number(event.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="min-days-past-due">Min Past Due</Label>
                      <Input
                        id="min-days-past-due"
                        type="number"
                        min={0}
                        value={ruleForm.minDaysPastDue ?? ""}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            minDaysPastDue: numberOrNull(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-days-past-due">Max Past Due</Label>
                      <Input
                        id="max-days-past-due"
                        type="number"
                        min={0}
                        value={ruleForm.maxDaysPastDue ?? ""}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            maxDaysPastDue: numberOrNull(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="page-limit">Page Limit</Label>
                      <Input
                        id="page-limit"
                        type="number"
                        min={1}
                        max={500}
                        value={ruleForm.pageLimit}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            pageLimit: Number(event.target.value) || 1,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="report-name">Stretchy Report</Label>
                    <Input
                      id="report-name"
                      value={ruleForm.reportName ?? ""}
                      onChange={(event) =>
                        setRuleForm((current) => ({ ...current, reportName: event.target.value }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <Label className="text-sm font-medium">Enabled</Label>
                    <Switch
                      checked={ruleForm.enabled}
                      onCheckedChange={(enabled) =>
                        setRuleForm((current) => ({ ...current, enabled }))
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={isPending}>
                      {pendingLabel === "rule" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Rule
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setRuleForm(emptyRuleForm(data.config.timezone || "Africa/Harare"))
                      }
                    >
                      New Rule
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.templates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                            No reminder templates configured.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.templates.map((template) => (
                          <TableRow key={template.id ?? template.code}>
                            <TableCell>
                              <div className="font-medium">{template.name}</div>
                              <div className="text-xs text-muted-foreground">{template.code}</div>
                            </TableCell>
                            <TableCell>{template.channel}</TableCell>
                            <TableCell className="max-w-xl truncate">{template.body}</TableCell>
                            <TableCell>
                              <Badge className={cn("border", statusBadgeClass(template.active ? "SENT" : "SKIPPED"))}>
                                {template.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setTemplateForm(templateToForm(template))}
                              >
                                <SquarePen className="h-4 w-4" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {templateForm.id ? "Edit Template" : "New Template"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSaveTemplate}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="template-code">Code</Label>
                      <Input
                        id="template-code"
                        value={templateForm.code}
                        onChange={(event) =>
                          setTemplateForm((current) => ({ ...current, code: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Channel</Label>
                      <Select
                        value={templateForm.channel}
                        onValueChange={(channel: "SMS" | "EMAIL") =>
                          setTemplateForm((current) => ({ ...current, channel }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SMS">SMS</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-name">Name</Label>
                    <Input
                      id="template-name"
                      value={templateForm.name}
                      onChange={(event) =>
                        setTemplateForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-subject">Subject</Label>
                    <Input
                      id="template-subject"
                      value={templateForm.subject ?? ""}
                      onChange={(event) =>
                        setTemplateForm((current) => ({ ...current, subject: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-body">Message</Label>
                    <Textarea
                      id="template-body"
                      value={templateForm.body}
                      rows={7}
                      onChange={(event) =>
                        setTemplateForm((current) => ({ ...current, body: event.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables: {"{{clientName}}"}, {"{{loanAccountNo}}"}, {"{{amountDue}}"}, {"{{dueDate}}"}, {"{{daysPastDue}}"}.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <Label className="text-sm font-medium">Active</Label>
                    <Switch
                      checked={templateForm.active}
                      onCheckedChange={(active) =>
                        setTemplateForm((current) => ({ ...current, active }))
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={isPending}>
                      {pendingLabel === "template" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Template
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTemplateForm(emptyTemplateForm())}
                    >
                      New Template
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4" />
                  Job Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RunsTable
                  runs={data.runs}
                  rules={data.rules}
                  onSelectRun={handleSelectRun}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedRun ? "Run Items" : "Select a Run"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedRun ? (
                  <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    Pick a run to inspect candidates.
                  </div>
                ) : runItemsLoading ? (
                  <div className="flex min-h-40 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{ruleName(data.rules, selectedRun.ruleId)}</Badge>
                      <Badge className={cn("border", statusBadgeClass(selectedRun.status))}>
                        {compactStatus(selectedRun.status)}
                      </Badge>
                    </div>
                    <div className="max-h-[520px] overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground">
                                No candidates loaded.
                              </TableCell>
                            </TableRow>
                          ) : (
                            runItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <div className="font-medium">{item.clientName || "N/A"}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.loanAccountNo || item.loanId || "No loan reference"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>{formatDate(item.dueDate)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.daysPastDue ?? 0} days past due
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className={cn("border", statusBadgeClass(item.status))}>
                                    {compactStatus(item.status)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4" />
                Notification Ledger
              </CardTitle>
              <div className="w-full lg:w-56">
                <Select value={messageStatusFilter} onValueChange={(value) => handleMessageFilter(value as NotificationStatus | "ALL")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="QUEUED">Queued</SelectItem>
                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="SUPPRESSED">Suppressed</SelectItem>
                    <SelectItem value="SKIPPED">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {pendingLabel === "messages" ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <MessagesTable messages={data.messages} rules={data.rules} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RunsTable({
  runs,
  rules,
  compact = false,
  onSelectRun,
}: {
  runs: ReminderRunSummary[];
  rules: ReminderRule[];
  compact?: boolean;
  onSelectRun: (run: ReminderRunSummary) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule</TableHead>
            {!compact && <TableHead>Slot</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            {!compact && <TableHead>Counts</TableHead>}
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={compact ? 4 : 6} className="h-24 text-center text-sm text-muted-foreground">
                No reminder runs yet.
              </TableCell>
            </TableRow>
          ) : (
            runs.map((run) => {
              const progress = runProgress(run);
              return (
                <TableRow key={run.id}>
                  <TableCell>
                    <div className="font-medium">{ruleName(rules, run.ruleId)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatReminderType(run.type)}
                    </div>
                  </TableCell>
                  {!compact && (
                    <TableCell>
                      <div>{formatDateTime(run.slotStartAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        As of {formatDate(run.asOfDate)}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge className={cn("border", statusBadgeClass(run.status))}>
                      {compactStatus(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-36">
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2" />
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {progress}%
                      </span>
                    </div>
                  </TableCell>
                  {!compact && (
                    <TableCell className="text-sm tabular-nums">
                      {run.processedCount}/{run.loadedCandidateCount || run.totalCandidateCount || 0}
                      <div className="text-xs text-muted-foreground">
                        {run.queuedCount} queued, {run.failedCount} failed
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectRun(run)}
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MessagesTable({
  messages,
  rules,
}: {
  messages: NotificationMessageSummary[];
  rules: ReminderRule[];
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipient</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Loan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                No notification messages found.
              </TableCell>
            </TableRow>
          ) : (
            messages.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  <div className="font-medium">{message.recipient}</div>
                  <div className="text-xs text-muted-foreground">{message.channel}</div>
                </TableCell>
                <TableCell>{ruleName(rules, message.reminderRuleId)}</TableCell>
                <TableCell className="max-w-xl">
                  <div className="line-clamp-2 text-sm">{message.body}</div>
                  {message.errorMessage && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {message.errorMessage}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={cn("border", statusBadgeClass(message.status))}>
                    {compactStatus(message.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatDateTime(
                    message.sentAt ||
                      message.acceptedAt ||
                      message.callbackReceivedAt ||
                      message.createdAt
                  )}
                </TableCell>
                <TableCell>
                  {message.loanId && message.clientId ? (
                    <Link
                      href={`/clients/${message.clientId}/loans/${message.loanId}`}
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {message.loanAccountNo || message.loanId}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">N/A</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
