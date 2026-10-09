import {
  getNotificationCategory,
  type FineractNotification,
} from "../shared/types/notification";

// Unified feed model shared by the notifications bell menu and the /notifications page.
// Keep this file pure (no React / hooks imports) so it can be unit tested under node.

export type FeedSource = "alert" | "notification";

export interface FeedItem {
  key: string;
  source: FeedSource;
  id: string | number;
  title: string;
  body: string;
  createdAt: Date | null;
  isRead: boolean;
  href: string | null;
  actionLabel: string | null;
  kind: string;
}

// Structural input for system alerts (matches the Alert shape from hooks/use-alerts)
export interface FeedAlertInput {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  actionLabel: string | null;
  isRead: boolean;
  createdAt: string;
}

export type FeedTab = "all" | "unread" | "alerts";

export type FeedGroupLabel = "Today" | "Yesterday" | "Earlier";

export interface FeedGroup {
  label: FeedGroupLabel;
  items: FeedItem[];
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

// Fineract sends dates as ISO strings or as [year, month, day, hour?, minute?, second?] arrays
export function parseFeedDate(
  value: string | number[] | null | undefined
): Date | null {
  if (value == null) return null;

  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value;
    if (
      [year, month, day, hour, minute, second].some(
        (part) => typeof part !== "number" || !Number.isFinite(part)
      )
    ) {
      return null;
    }
    const date = new Date(year, month - 1, day, hour, minute, second);
    // Reject overflowing components (e.g. month 13 or 31 February) instead of rolling over
    if (
      Number.isNaN(date.getTime()) ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function humaniseAction(action: string | null | undefined): string {
  const text = (action ?? "").replace(/[_-]+/g, " ").trim().toLowerCase();
  if (!text) return "Notification";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Only in-app paths are navigable; absolute or protocol-relative URLs are dropped. */
export function toInternalHref(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) {
    return null;
  }
  return url;
}

export function alertToFeedItem(alert: FeedAlertInput): FeedItem {
  return {
    key: `alert:${alert.id}`,
    source: "alert",
    id: alert.id,
    title: alert.title,
    body: alert.message,
    createdAt: parseFeedDate(alert.createdAt),
    isRead: alert.isRead,
    href: toInternalHref(alert.actionUrl),
    actionLabel: alert.actionLabel,
    kind: alert.type,
  };
}

export function notificationToFeedItem(
  notification: FineractNotification
): FeedItem {
  return {
    key: `notification:${notification.id}`,
    source: "notification",
    id: notification.id,
    title: humaniseAction(notification.action),
    body: notification.content ?? "",
    createdAt: parseFeedDate(notification.createdAt),
    isRead: notification.isRead,
    href: null,
    actionLabel: null,
    kind: getNotificationCategory(notification),
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

// Groups feed items into Today / Yesterday / Earlier, newest first.
// Items without a date are treated as the oldest and land in Earlier.
export function groupFeedByDay(
  items: FeedItem[],
  now: Date = new Date()
): FeedGroup[] {
  const todayStart = startOfDay(now).getTime();
  const yesterdayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  ).getTime();

  const sorted = [...items].sort((a, b) => {
    const aTime = a.createdAt ? a.createdAt.getTime() : Number.NEGATIVE_INFINITY;
    const bTime = b.createdAt ? b.createdAt.getTime() : Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });

  const groups: Record<FeedGroupLabel, FeedItem[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  for (const item of sorted) {
    const time = item.createdAt ? item.createdAt.getTime() : null;
    if (time !== null && time >= todayStart) {
      groups.Today.push(item);
    } else if (time !== null && time >= yesterdayStart) {
      groups.Yesterday.push(item);
    } else {
      groups.Earlier.push(item);
    }
  }

  const labels: FeedGroupLabel[] = ["Today", "Yesterday", "Earlier"];
  return labels
    .filter((label) => groups[label].length > 0)
    .map((label) => ({ label, items: groups[label] }));
}

export function filterFeed(items: FeedItem[], tab: FeedTab): FeedItem[] {
  switch (tab) {
    case "unread":
      return items.filter((item) => !item.isRead);
    case "alerts":
      return items.filter((item) => item.source === "alert");
    case "all":
    default:
      return [...items];
  }
}

// Short relative label: "Just now", "5 min ago", "3 h ago", "Yesterday", or "12 Mar"
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < MINUTE_MS) return "Just now";

  if (diffMs < HOUR_MS) {
    return `${Math.floor(diffMs / MINUTE_MS)} min ago`;
  }

  if (isSameDay(date, now)) {
    return `${Math.floor(diffMs / HOUR_MS)} h ago`;
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month}`;
  }
  return `${day} ${month} ${date.getFullYear()}`;
}
