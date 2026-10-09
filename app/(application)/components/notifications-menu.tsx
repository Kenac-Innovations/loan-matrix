"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileCheck,
  Info,
  Loader2,
  RefreshCw,
  Shield,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useAlerts } from "@/hooks/use-alerts";
import {
  alertToFeedItem,
  filterFeed,
  groupFeedByDay,
  notificationToFeedItem,
  relativeTime,
  type FeedGroup,
  type FeedItem,
  type FeedTab,
} from "@/lib/notification-feed";

const MENU_ITEM_LIMIT = 8;

// Icon for an alert type or a Fineract notification category (FeedItem.kind)
const FEED_KIND_ICONS: Record<string, LucideIcon> = {
  SUCCESS: CheckCircle2,
  WARNING: AlertTriangle,
  ERROR: XCircle,
  TASK: ClipboardList,
  REMINDER: Clock,
  APPROVAL: FileCheck,
  SYSTEM: Shield,
  LOAN: CreditCard,
  CLIENT: Users,
  DISBURSEMENT: DollarSign,
  REPAYMENT: DollarSign,
  OTHER: Bell,
  INFO: Info,
};

export function renderFeedKindIcon(kind: string, className: string): ReactNode {
  const Icon = FEED_KIND_ICONS[kind] ?? Info;
  return <Icon className={className} />;
}

// Soft tint for the icon circle, by kind
export function getFeedKindTone(kind: string): string {
  switch (kind) {
    case "WARNING":
    case "APPROVAL":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "ERROR":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "SUCCESS":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// Keeps the first `limit` items across groups, dropping empty groups
function limitGroups(groups: FeedGroup[], limit: number): FeedGroup[] {
  const result: FeedGroup[] = [];
  let remaining = limit;
  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    result.push({ label: group.label, items });
  }
  return result;
}

interface FeedItemRowProps {
  item: FeedItem;
  now: Date;
  density?: "compact" | "comfortable";
  onOpen?: (item: FeedItem) => void;
  trailing?: ReactNode;
}

export function FeedItemRow({
  item,
  now,
  density = "compact",
  onOpen,
  trailing,
}: FeedItemRowProps) {
  const comfortable = density === "comfortable";
  const time = item.createdAt ? relativeTime(item.createdAt, now) : "";

  const content = (
    <>
      <span
        className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
          item.isRead ? "bg-transparent" : "bg-primary"
        }`}
      />
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${
          comfortable ? "h-8 w-8" : "h-7 w-7"
        } ${getFeedKindTone(item.kind)}`}
      >
        {renderFeedKindIcon(item.kind, "h-3.5 w-3.5")}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate ${
            comfortable ? "text-sm" : "text-[13px] leading-snug"
          } ${item.isRead ? "font-normal" : "font-medium"}`}
        >
          {item.title}
        </span>
        {item.body && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {item.body}
          </span>
        )}
        {item.href && item.actionLabel && (
          <span className="mt-1 inline-block text-xs text-primary">
            {item.actionLabel}
          </span>
        )}
        {time && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {time}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      className={`flex items-start gap-3 px-4 hover:bg-muted/50 ${
        comfortable ? "py-3" : "py-2.5"
      }`}
    >
      {item.href ? (
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
      )}
      {trailing}
    </div>
  );
}

interface FeedTabsProps {
  value: FeedTab;
  onChange: (tab: FeedTab) => void;
  unreadCount: number;
  size?: "sm" | "lg";
  className?: string;
}

export function FeedTabs({
  value,
  onChange,
  unreadCount,
  size = "sm",
  className = "",
}: FeedTabsProps) {
  const tabs: { value: FeedTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: `Unread ${unreadCount}` },
    { value: "alerts", label: "Alerts" },
  ];

  return (
    <div
      role="tablist"
      className={`flex items-center gap-4 border-b border-border ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`-mb-px border-b-2 transition-colors ${
              size === "lg" ? "pb-3 text-base" : "pb-2.5 text-sm"
            } ${
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

interface NotificationsMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NotificationsMenu({ open, onOpenChange }: NotificationsMenuProps = {}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [tab, setTab] = useState<FeedTab>("all");

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  // Fineract notifications (SSE)
  const {
    notifications,
    unreadCount: fineractUnreadCount,
    isLoading: fineractLoading,
    error: fineractError,
    isConnected,
    onViewNotifications,
    onCloseNotifications,
    markAsRead: markNotificationsAsRead,
    refresh: refreshFineract,
  } = useNotifications();

  // System alerts (polling)
  const {
    alerts,
    unreadCount: alertsUnreadCount,
    isLoading: alertsLoading,
    error: alertsError,
    markAsRead: markAlertAsRead,
    markAllAsRead: markAllAlertsAsRead,
    refresh: refreshAlerts,
  } = useAlerts();

  const totalUnreadCount = fineractUnreadCount + alertsUnreadCount;
  const isLoading = fineractLoading || alertsLoading;
  const error = fineractError || alertsError;

  // Keep the latest hook callbacks in a ref so the open/close effect only depends on isOpen
  const notificationCallbacksRef = useRef({ onViewNotifications, onCloseNotifications });
  useEffect(() => {
    notificationCallbacksRef.current = { onViewNotifications, onCloseNotifications };
  });

  // Opening marks Fineract notifications as viewed, closing resets the viewed state.
  // Runs for both user toggles and external closes (e.g. the profile menu opening).
  useEffect(() => {
    if (isOpen) {
      notificationCallbacksRef.current.onViewNotifications();
    } else {
      notificationCallbacksRef.current.onCloseNotifications();
    }
  }, [isOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setOpen]);

  const { groups, now } = useMemo(() => {
    const current = new Date();
    const items = [
      ...alerts.map(alertToFeedItem),
      ...notifications.map(notificationToFeedItem),
    ];
    return {
      now: current,
      groups: limitGroups(
        groupFeedByDay(filterFeed(items, tab), current),
        MENU_ITEM_LIMIT
      ),
    };
  }, [alerts, notifications, tab]);

  const hasItems = alerts.length > 0 || notifications.length > 0;

  const refresh = () => {
    refreshFineract();
    refreshAlerts();
  };

  const handleMarkAllRead = () => {
    if (alertsUnreadCount > 0) {
      markAllAlertsAsRead().catch(console.error);
    }
    if (fineractUnreadCount > 0) {
      markNotificationsAsRead().catch(console.error);
    }
  };

  const handleOpenItem = (item: FeedItem) => {
    if (!item.href) return;
    setOpen(false);
    if (item.source === "alert" && !item.isRead) {
      markAlertAsRead(String(item.id)).catch(console.error);
    }
    router.push(item.href);
  };

  const handleViewAll = () => {
    setOpen(false);
    router.push("/notifications");
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {totalUnreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
            {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-background shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Notifications</h3>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isConnected ? "bg-green-500" : "animate-pulse bg-amber-500"
                }`}
                title={isConnected ? "Live" : "Connecting…"}
              />
            </div>
            <div className="flex items-center gap-1">
              {totalUnreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={refresh}
                disabled={isLoading}
                title="Refresh"
                aria-label="Refresh notifications"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <FeedTabs
            value={tab}
            onChange={setTab}
            unreadCount={totalUnreadCount}
            className="px-4"
          />

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading && !hasItems ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
                  Retry
                </Button>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <BellOff className="mb-3 h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New notifications will show up here.
                </p>
              </div>
            ) : (
              <div className="pb-1">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="px-4 pb-1 pt-3 text-[11px] text-muted-foreground">
                      {group.label}
                    </p>
                    {group.items.map((item) => (
                      <FeedItemRow
                        key={item.key}
                        item={item}
                        now={now}
                        onOpen={handleOpenItem}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="w-full justify-center gap-2 text-sm"
              onClick={handleViewAll}
            >
              View all notifications
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
