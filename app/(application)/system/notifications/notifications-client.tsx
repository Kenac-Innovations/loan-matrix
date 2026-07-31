"use client";

import { useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getNotificationMessagesPageAction,
  type NotificationMessagePageFilters,
} from "@/app/actions/reminder-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import type {
  NotificationChannel,
  NotificationMessagePage,
  NotificationMessageSummary,
  NotificationSource,
  NotificationStatus,
} from "@/shared/types/reminders";

const ALL = "__all";
const DEFAULT_PAGE_SIZE = 25;

type FilterForm = {
  status: NotificationStatus | typeof ALL;
  source: NotificationSource | typeof ALL;
  channel: NotificationChannel | typeof ALL;
  sourceType: string;
};

type NotificationsClientProps = {
  initialPage: NotificationMessagePage;
};

const emptyFilters: FilterForm = {
  status: ALL,
  source: ALL,
  channel: ALL,
  sourceType: "",
};

const statuses: NotificationStatus[] = [
  "QUEUED",
  "ACCEPTED",
  "SENT",
  "FAILED",
  "SUPPRESSED",
  "SKIPPED",
];

const sources: NotificationSource[] = [
  "REMINDER",
  "RECOVERY",
  "REPAYMENT_RECEIPT",
];

const channels: NotificationChannel[] = ["SMS", "EMAIL"];

function compactLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusBadgeClass(status: string) {
  if (status === "SENT") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  }
  if (status === "FAILED") {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200";
  }
  if (["ACCEPTED", "QUEUED"].includes(status)) {
    return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200";
  }
  if (["SUPPRESSED", "SKIPPED"].includes(status)) {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
  }
  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toActionFilters(
  filters: FilterForm,
  page: number,
  size: number
): NotificationMessagePageFilters {
  return {
    page,
    size,
    status: filters.status === ALL ? undefined : filters.status,
    source: filters.source === ALL ? undefined : filters.source,
    channel: filters.channel === ALL ? undefined : filters.channel,
    sourceType: filters.sourceType.trim() || undefined,
  };
}

function messageTimestamp(message: NotificationMessageSummary) {
  return (
    message.sentAt ??
    message.acceptedAt ??
    message.failedAt ??
    message.callbackReceivedAt ??
    message.createdAt
  );
}

function detailValue(value?: string | number | null) {
  if (value == null || value === "") {
    return "N/A";
  }

  return String(value);
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm">{detailValue(value)}</dd>
    </div>
  );
}

function pageRange(page: NotificationMessagePage) {
  if (page.totalElements === 0) {
    return { start: 0, end: 0 };
  }

  const start = page.page * page.size + 1;
  const end = start + page.content.length - 1;
  return { start, end };
}

export function NotificationsClient({ initialPage }: NotificationsClientProps) {
  const [filters, setFilters] = useState<FilterForm>(emptyFilters);
  const [notificationPage, setNotificationPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPage.size || DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<NotificationMessageSummary | null>(null);

  const totalPages = Math.max(1, notificationPage.totalPages);
  const currentPage = notificationPage.page + 1;
  const range = pageRange(notificationPage);

  async function loadPage(
    nextPage = notificationPage.page,
    nextSize = pageSize,
    nextFilters = filters
  ) {
    setIsLoading(true);
    try {
      const result = await getNotificationMessagesPageAction(
        toActionFilters(nextFilters, nextPage, nextSize)
      );
      setNotificationPage(result);
      setPageSize(result.size);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load notifications"
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    void loadPage(0);
  }

  function handleReset() {
    setFilters(emptyFilters);
    void loadPage(0, pageSize, emptyFilters);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant notification delivery history.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadPage(notificationPage.page)}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-5" onSubmit={handleSearch}>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(status: NotificationStatus | typeof ALL) =>
                  setFilters((current) => ({ ...current, status }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {compactLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={filters.source}
                onValueChange={(source: NotificationSource | typeof ALL) =>
                  setFilters((current) => ({ ...current, source }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sources</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {compactLabel(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={filters.channel}
                onValueChange={(channel: NotificationChannel | typeof ALL) =>
                  setFilters((current) => ({ ...current, channel }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All channels</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-type">Source Type</Label>
              <Input
                id="source-type"
                value={filters.sourceType}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sourceType: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleReset}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" />
            Delivery Ledger
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                const nextSize = Number(value);
                setPageSize(nextSize);
                void loadPage(0, nextSize);
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[92px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead>Last Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notificationPage.content.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No notifications found.
                    </TableCell>
                  </TableRow>
                ) : (
                  notificationPage.content.map((message) => (
                    <TableRow
                      key={message.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setSelectedMessage(message)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedMessage(message);
                        }
                      }}
                    >
                      <TableCell className="min-w-[360px] max-w-[460px]">
                        <div className="font-medium">
                          {message.subject || compactLabel(message.sourceType)}
                        </div>
                        <div className="mt-1 max-w-[520px] truncate text-sm text-muted-foreground">
                          {message.body}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {message.recipient}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border",
                            statusBadgeClass(message.status)
                          )}
                        >
                          {compactLabel(message.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{message.channel}</TableCell>
                      <TableCell>
                        <div>{compactLabel(message.source)}</div>
                        <div className="text-xs text-muted-foreground">
                          {compactLabel(message.sourceType)}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {message.loanAccountNo || message.loanId || "N/A"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(messageTimestamp(message))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {range.start}-{range.end} of{" "}
              {notificationPage.totalElements.toLocaleString()} notifications
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void loadPage(Math.max(0, notificationPage.page - 1))
                  }
                  disabled={!notificationPage.hasPrevious || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadPage(notificationPage.page + 1)}
                  disabled={!notificationPage.hasNext || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedMessage)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMessage(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {selectedMessage && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedMessage.subject ||
                    compactLabel(selectedMessage.sourceType)}
                </DialogTitle>
                <DialogDescription>
                  {selectedMessage.messageId}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "border",
                      statusBadgeClass(selectedMessage.status)
                    )}
                  >
                    {compactLabel(selectedMessage.status)}
                  </Badge>
                  <Badge variant="outline">{selectedMessage.channel}</Badge>
                  <Badge variant="outline">
                    {compactLabel(selectedMessage.source)}
                  </Badge>
                  <Badge variant="outline">
                    {compactLabel(selectedMessage.sourceType)}
                  </Badge>
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Message</h3>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm leading-6 whitespace-pre-wrap">
                    {selectedMessage.body || "N/A"}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Delivery</h3>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem
                      label="Recipient"
                      value={selectedMessage.recipient}
                    />
                    <DetailItem
                      label="Channel"
                      value={selectedMessage.channel}
                    />
                    <DetailItem
                      label="Status"
                      value={compactLabel(selectedMessage.status)}
                    />
                    <DetailItem
                      label="Scheduled For"
                      value={formatDateTime(selectedMessage.scheduledFor)}
                    />
                    <DetailItem
                      label="Accepted At"
                      value={formatDateTime(selectedMessage.acceptedAt)}
                    />
                    <DetailItem
                      label="Sent At"
                      value={formatDateTime(selectedMessage.sentAt)}
                    />
                  </dl>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Loan Context</h3>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem
                      label="Loan Account"
                      value={selectedMessage.loanAccountNo}
                    />
                    <DetailItem
                      label="Due Date"
                      value={selectedMessage.dueDate}
                    />
                  </dl>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Error Message</h3>
                  <div
                    className={cn(
                      "rounded-md border p-3 text-sm leading-6 whitespace-pre-wrap",
                      selectedMessage.errorMessage
                        ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
                        : "bg-muted/30 text-muted-foreground"
                    )}
                  >
                    {selectedMessage.errorMessage ||
                      "No error message recorded."}
                  </div>
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
