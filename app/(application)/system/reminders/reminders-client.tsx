"use client";

import { useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  Clock3,
  Database,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Save,
  Send,
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
  type SaveReminderRuleInput,
  type SaveReminderTemplateInput,
} from "@/app/actions/reminder-actions";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
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
  NotificationChannel,
  NotificationStatus,
  ReminderDashboardData,
  ReminderRule,
  ReminderRunItem,
  ReminderRunSummary,
  ReminderTemplate,
  ReminderType,
} from "@/shared/types/reminders";

type RemindersClientProps = {
  initialData: ReminderDashboardData;
};

type RuleFormState = SaveReminderRuleInput;
type TemplateFormState = SaveReminderTemplateInput;

const RULE_CHANNEL_OPTIONS: Array<{ value: NotificationChannel; label: string }> = [
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
];

const TEMPLATE_VARIABLES = [
  {
    token: "{{clientName}}",
    label: "Client Name",
    hint: "Client display name from the candidate report.",
  },
  {
    token: "{{loanAccountNo}}",
    label: "Loan Account",
    hint: "Fineract loan account number.",
  },
  {
    token: "{{amountDue}}",
    label: "Amount Due",
    hint: "Amount due formatted by the backend.",
  },
  {
    token: "{{dueDate}}",
    label: "Due Date",
    hint: "Repayment due date from the candidate report.",
  },
  {
    token: "{{daysPastDue}}",
    label: "Days Past Due",
    hint: "Overdue age for recovery reminders.",
  },
  {
    token: "{{recipientPhone}}",
    label: "Phone",
    hint: "Recipient phone number from the candidate report.",
  },
  {
    token: "{{recipientEmail}}",
    label: "Email",
    hint: "Recipient email address from the candidate report.",
  },
];

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

function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function emptyTemplateForm(): TemplateFormState {
  return {
    name: "",
    body: "",
    active: true,
  };
}

function templateToForm(template: ReminderTemplate): TemplateFormState {
  return {
    id: template.id,
    name: template.name,
    body: template.body,
    active: template.active,
  };
}

function parseRuleChannels(channels?: string | null): NotificationChannel[] {
  const values = (channels || "SMS")
    .split(",")
    .map((channel) => channel.trim().toUpperCase())
    .filter((channel): channel is NotificationChannel =>
      RULE_CHANNEL_OPTIONS.some((option) => option.value === channel)
    );

  const uniqueValues = Array.from(new Set(values));
  return uniqueValues.length > 0 ? uniqueValues : ["SMS"];
}

function formatRuleChannels(channels?: string | null) {
  const selectedChannels = parseRuleChannels(channels);
  return selectedChannels
    .map((channel) => RULE_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? channel)
    .join(", ");
}

function emptyRuleForm(templateId?: string | null): RuleFormState {
  return {
    name: "",
    type: "LOAN_REPAYMENT_DUE",
    enabled: true,
    channels: "SMS",
    templateId: templateId ?? null,
    sendTime: "09:00",
    startRemindingToday: true,
    daysBeforeDue: 0,
    daysPastDue: 30,
  };
}

function ruleToForm(rule: ReminderRule): RuleFormState {
  const legacyRule = rule as ReminderRule & {
    daysOffset?: number;
    minDaysPastDue?: number | null;
  };
  const daysBeforeDue = rule.daysBeforeDue ?? Math.max(0, legacyRule.daysOffset ?? 0);
  const startRemindingToday = rule.startRemindingToday ?? (daysBeforeDue === 0);

  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    type: rule.type,
    enabled: rule.enabled,
    channels: parseRuleChannels(rule.channels).join(","),
    templateId: rule.templateId ?? null,
    sendTime: rule.sendTime?.slice(0, 5) || "09:00",
    startRemindingToday,
    daysBeforeDue,
    daysPastDue: rule.daysPastDue ?? legacyRule.minDaysPastDue ?? 30,
  };
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
  if (!templateId) return "Missing template";
  return templates.find((template) => template.id === templateId)?.name ?? "Unknown";
}

function ruleTimingSummary(rule: ReminderRule) {
  const legacyRule = rule as ReminderRule & {
    daysOffset?: number;
    minDaysPastDue?: number | null;
  };

  if (rule.type === "RECOVERY_ARREARS") {
    return `${rule.daysPastDue ?? legacyRule.minDaysPastDue ?? 30} days past due`;
  }

  const daysBeforeDue = rule.daysBeforeDue ?? Math.max(0, legacyRule.daysOffset ?? 0);
  const startsToday = rule.startRemindingToday ?? (daysBeforeDue === 0);
  return startsToday ? "Due today" : `${daysBeforeDue} days before due`;
}

function defaultRuleTemplateId(templates: ReminderTemplate[]) {
  const template = templates.find((item) => item.active) ?? templates[0];
  return template?.id ?? null;
}

export function RemindersClient({ initialData }: RemindersClientProps) {
  const [data, setData] = useState(initialData);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(
    emptyTemplateForm()
  );
  const [ruleForm, setRuleForm] = useState<RuleFormState>(
    emptyRuleForm(defaultRuleTemplateId(initialData.templates))
  );
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [messageStatusFilter, setMessageStatusFilter] = useState<NotificationStatus | "ALL">("ALL");
  const [selectedRun, setSelectedRun] = useState<ReminderRunSummary | null>(null);
  const [runItems, setRunItems] = useState<ReminderRunItem[]>([]);
  const [runItemsLoading, setRunItemsLoading] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const templateBodyRef = useRef<HTMLTextAreaElement | null>(null);

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
        toast.success("Reminders refreshed");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to refresh reminders");
      } finally {
        setPendingLabel(null);
      }
    });
  };

  const insertTemplateVariable = (token: string) => {
    const textarea = templateBodyRef.current;
    setTemplateForm((current) => {
      const body = current.body ?? "";
      const selectionStart = textarea?.selectionStart ?? body.length;
      const selectionEnd = textarea?.selectionEnd ?? body.length;
      const before = body.slice(0, selectionStart);
      const after = body.slice(selectionEnd);
      const spaceBefore = before && !/\s$/.test(before) ? " " : "";
      const spaceAfter = after && !/^\s/.test(after) ? " " : "";
      const nextBody = `${before}${spaceBefore}${token}${spaceAfter}${after}`;
      const cursorPosition = before.length + spaceBefore.length + token.length + spaceAfter.length;

      requestAnimationFrame(() => {
        templateBodyRef.current?.focus();
        templateBodyRef.current?.setSelectionRange(cursorPosition, cursorPosition);
      });

      return {
        ...current,
        body: nextBody,
      };
    });
  };

  const handleRuleChannelToggle = (channel: NotificationChannel, checked: boolean) => {
    setRuleForm((current) => {
      const selectedChannels = parseRuleChannels(current.channels);
      const nextChannels = checked
        ? Array.from(new Set([...selectedChannels, channel]))
        : selectedChannels.filter((selectedChannel) => selectedChannel !== channel);

      return {
        ...current,
        channels: (nextChannels.length > 0 ? nextChannels : selectedChannels).join(","),
      };
    });
  };

  const handleSaveTemplate = (event: FormEvent) => {
    event.preventDefault();
    if (!templateForm.name.trim() || !templateForm.body.trim()) {
      toast.error("Template name and message are required");
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
      setTemplateDialogOpen(false);
      toast.success("Reminder template saved");
      setPendingLabel(null);
    });
  };

  const handleSaveRule = (event: FormEvent) => {
    event.preventDefault();
    const selectedChannels = parseRuleChannels(ruleForm.channels);
    if (!ruleForm.name.trim() || !ruleForm.sendTime || !ruleForm.templateId || selectedChannels.length === 0) {
      toast.error("Rule name, channel, send time, and template are required");
      return;
    }
    if (ruleForm.type === "LOAN_REPAYMENT_DUE" && !ruleForm.startRemindingToday && ruleForm.daysBeforeDue < 1) {
      toast.error("Days before due date must be at least 1");
      return;
    }
    if (ruleForm.type === "RECOVERY_ARREARS" && ruleForm.daysPastDue < 1) {
      toast.error("Days past due must be at least 1");
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
      setRuleForm(emptyRuleForm(defaultRuleTemplateId(data.templates)));
      setRuleDialogOpen(false);
      toast.success("Reminder rule saved");
      setPendingLabel(null);
    });
  };

  const openNewRuleDialog = () => {
    setRuleForm(emptyRuleForm(defaultRuleTemplateId(data.templates)));
    setRuleDialogOpen(true);
  };

  const openEditRuleDialog = (rule: ReminderRule) => {
    setRuleForm(ruleToForm(rule));
    setRuleDialogOpen(true);
  };

  const openNewTemplateDialog = () => {
    setTemplateForm(emptyTemplateForm());
    setTemplateDialogOpen(true);
  };

  const openEditTemplateDialog = (template: ReminderTemplate) => {
    setTemplateForm(templateToForm(template));
    setTemplateDialogOpen(true);
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
    setRunDialogOpen(true);
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
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Rules</CardTitle>
                <Button type="button" onClick={openNewRuleDialog}>
                  New Rule
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Timing</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                            No reminder rules configured.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.rules.map((rule) => (
                          <TableRow key={rule.id ?? rule.code}>
                            <TableCell>
                              <div className="font-medium">{rule.name}</div>
                            </TableCell>
                            <TableCell>{formatReminderType(rule.type)}</TableCell>
                            <TableCell>{formatRuleChannels(rule.channels)}</TableCell>
                            <TableCell className="tabular-nums">
                              {rule.sendTime?.slice(0, 5)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {ruleTimingSummary(rule)}
                            </TableCell>
                            <TableCell>{templateName(data.templates, rule.templateId)}</TableCell>
                            <TableCell>
                              <Badge className={cn("border", statusBadgeClass(rule.enabled ? "SENT" : "SKIPPED"))}>
                                {rule.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="outline" size="sm">
                                    ...Action
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => openEditRuleDialog(rule)}>
                                    <SquarePen className="h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    {ruleForm.id ? "Edit Rule" : "New Rule"}
                  </DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleSaveRule}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rule-name">Name</Label>
                      <Input
                        id="rule-name"
                        value={ruleForm.name}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, name: event.target.value }))
                        }
                      />
                      <FieldHint>
                        Readable label shown in rule lists, runs, and notification history.
                      </FieldHint>
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
                      <FieldHint>
                        Local time of day used when creating scheduled runs for this rule.
                      </FieldHint>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={ruleForm.type}
                        onValueChange={(type: ReminderType) =>
                          setRuleForm((current) => ({
                            ...current,
                            type,
                            startRemindingToday: type === "LOAN_REPAYMENT_DUE" ? current.startRemindingToday : true,
                            daysBeforeDue: type === "LOAN_REPAYMENT_DUE" ? current.daysBeforeDue : 0,
                            daysPastDue: type === "RECOVERY_ARREARS"
                              ? (current.daysPastDue > 0 ? current.daysPastDue : 30)
                              : 0,
                          }))
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
                      <FieldHint>
                        Selects whether the rule targets upcoming repayments or overdue recovery loans.
                      </FieldHint>
                    </div>
                    <div className="space-y-2">
                      <Label>Channels</Label>
                      <div className="space-y-2 rounded-md border p-2">
                        {RULE_CHANNEL_OPTIONS.map((channel) => {
                          const selectedChannels = parseRuleChannels(ruleForm.channels);
                          const checked = selectedChannels.includes(channel.value);
                          return (
                            <Label
                              key={channel.value}
                              htmlFor={`rule-channel-${channel.value.toLowerCase()}`}
                              className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 leading-normal hover:bg-muted/50"
                            >
                              <Checkbox
                                id={`rule-channel-${channel.value.toLowerCase()}`}
                                checked={checked}
                                onCheckedChange={(value) =>
                                  handleRuleChannelToggle(channel.value, value === true)
                                }
                              />
                              <span className="text-sm font-medium">
                                {channel.label}
                              </span>
                            </Label>
                          );
                        })}
                      </div>
                      <FieldHint>
                        Select one or more delivery channels for this rule.
                      </FieldHint>
                    </div>
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Select
                        value={ruleForm.templateId ?? ""}
                        onValueChange={(templateId) =>
                          setRuleForm((current) => ({
                            ...current,
                            templateId,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {data.templates.filter((template) => template.id).map((template) => (
                              <SelectItem key={template.id} value={template.id!}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldHint>
                        Required message template used for notifications produced by this rule.
                      </FieldHint>
                    </div>
                  </div>

                  {ruleForm.type === "LOAN_REPAYMENT_DUE" ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <Label
                        htmlFor="start-reminding-today"
                        className="flex w-full cursor-pointer items-center justify-between gap-4 leading-normal"
                      >
                        <div className="space-y-1">
                          <span className="text-sm font-medium">Start Reminding Today</span>
                          <FieldHint>
                            When on, this rule sends once for repayments due today.
                          </FieldHint>
                        </div>
                        <Switch
                          id="start-reminding-today"
                          checked={ruleForm.startRemindingToday}
                          onCheckedChange={(startRemindingToday) =>
                            setRuleForm((current) => ({
                              ...current,
                              startRemindingToday,
                              daysBeforeDue: startRemindingToday
                                ? 0
                                : Math.max(1, current.daysBeforeDue || 3),
                            }))
                          }
                        />
                      </Label>
                      {!ruleForm.startRemindingToday ? (
                        <div className="max-w-xs space-y-2">
                          <Label htmlFor="days-before-due">Days Before Due Date</Label>
                          <Input
                            id="days-before-due"
                            type="number"
                            min={1}
                            value={ruleForm.daysBeforeDue}
                            onChange={(event) =>
                              setRuleForm((current) => ({
                                ...current,
                                daysBeforeDue: Number(event.target.value) || 0,
                              }))
                            }
                          />
                          <FieldHint>
                            Sends once when the repayment due date is this many days away.
                          </FieldHint>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="max-w-xs space-y-2">
                      <Label htmlFor="days-past-due">Days Past Due</Label>
                      <Input
                        id="days-past-due"
                        type="number"
                        min={1}
                        value={ruleForm.daysPastDue}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            daysPastDue: Number(event.target.value) || 0,
                          }))
                        }
                      />
                      <FieldHint>
                        Sends once when the loan reaches this exact overdue age.
                      </FieldHint>
                    </div>
                  )}

                  <Label
                    htmlFor="rule-enabled"
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3 leading-normal"
                  >
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Enabled</span>
                      <FieldHint>
                        When off, the rule is saved but new runs are not created for it.
                      </FieldHint>
                    </div>
                    <Switch
                      id="rule-enabled"
                      checked={ruleForm.enabled}
                      onCheckedChange={(enabled) =>
                        setRuleForm((current) => ({ ...current, enabled }))
                      }
                    />
                  </Label>

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
                      onClick={openNewRuleDialog}
                    >
                      New Rule
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Templates</CardTitle>
                <Button type="button" onClick={openNewTemplateDialog}>
                  New Template
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.templates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                            No reminder templates configured.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.templates.map((template) => (
                          <TableRow key={template.id ?? template.name}>
                            <TableCell>
                              <div className="font-medium">{template.name}</div>
                            </TableCell>
                            <TableCell className="max-w-xl truncate">{template.body}</TableCell>
                            <TableCell>
                              <Badge className={cn("border", statusBadgeClass(template.active ? "SENT" : "SKIPPED"))}>
                                {template.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="outline" size="sm">
                                    ...Action
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => openEditTemplateDialog(template)}>
                                    <SquarePen className="h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {templateForm.id ? "Edit Template" : "New Template"}
                  </DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleSaveTemplate}>
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Name</Label>
                    <Input
                      id="template-name"
                      value={templateForm.name}
                      onChange={(event) =>
                        setTemplateForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                    <FieldHint>
                      Readable label used when selecting this template for reminder rules.
                    </FieldHint>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="template-body">Message</Label>
                      <FieldHint>
                        Pick variables below to insert safe tokens into the message body.
                      </FieldHint>
                    </div>
                    <div className="flex flex-wrap gap-2 rounded-md border bg-muted/20 p-2">
                      {TEMPLATE_VARIABLES.map((variable) => (
                        <Button
                          key={variable.token}
                          type="button"
                          variant="outline"
                          size="sm"
                          title={variable.hint}
                          onClick={() => insertTemplateVariable(variable.token)}
                        >
                          {variable.label}
                        </Button>
                      ))}
                    </div>
                    <Textarea
                      id="template-body"
                      ref={templateBodyRef}
                      value={templateForm.body}
                      rows={7}
                      onChange={(event) =>
                        setTemplateForm((current) => ({ ...current, body: event.target.value }))
                      }
                    />
                    <FieldHint>
                      The backend replaces these tokens with values from each reminder candidate.
                    </FieldHint>
                  </div>

                  <Label
                    htmlFor="template-active"
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3 leading-normal"
                  >
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Active</span>
                      <FieldHint>
                        When off, rules can reference this template but no messages are sent with it.
                      </FieldHint>
                    </div>
                    <Switch
                      id="template-active"
                      checked={templateForm.active}
                      onCheckedChange={(active) =>
                        setTemplateForm((current) => ({ ...current, active }))
                      }
                    />
                  </Label>

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
                      onClick={openNewTemplateDialog}
                    >
                      New Template
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <div className="space-y-4">
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

            <Dialog
              open={runDialogOpen}
              onOpenChange={(open) => {
                setRunDialogOpen(open);
                if (!open) {
                  setSelectedRun(null);
                  setRunItems([]);
                }
              }}
            >
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedRun ? "Run Items" : "Select a Run"}
                  </DialogTitle>
                </DialogHeader>
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
                            <TableHead>Channel</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
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
                                <TableCell>{item.channel ?? "SMS"}</TableCell>
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
              </DialogContent>
            </Dialog>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          ...Action
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onSelectRun(run)}>
                          <Database className="h-4 w-4" />
                          Inspect
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
