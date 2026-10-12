"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BellOff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAlerts } from "@/hooks/use-alerts";
import { useNotifications } from "@/hooks/use-notifications";
import {
  FeedItemRow,
  FeedTabs,
} from "../components/notifications-menu";
import {
  alertToFeedItem,
  filterFeed,
  groupFeedByDay,
  notificationToFeedItem,
  type FeedItem,
  type FeedTab,
} from "@/lib/notification-feed";

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<FeedTab>("all");

  // Fineract notifications (SSE). Opening the bell menu marks these as viewed; this page does not.
  const {
    notifications,
    unreadCount: fineractUnreadCount,
    isLoading: fineractLoading,
    error: fineractError,
    markAsRead: markNotificationsAsRead,
    refresh: refreshFineract,
  } = useNotifications();

  // Alerts including read ones. Sound is disabled here because the header bell menu already plays it.
  const {
    alerts,
    unreadCount: alertsUnreadCount,
    isLoading: alertsLoading,
    error: alertsError,
    markAsRead: markAlertAsRead,
    markAllAsRead: markAllAlertsAsRead,
    dismissAlert,
    refresh: refreshAlerts,
  } = useAlerts({ includeRead: true, pollingInterval: 30000, enableSound: false });

  const totalUnreadCount = fineractUnreadCount + alertsUnreadCount;
  const isLoading = fineractLoading || alertsLoading;
  const error = fineractError || alertsError;
  const hasItems = alerts.length > 0 || notifications.length > 0;

  const { groups, now } = useMemo(() => {
    const current = new Date();
    const items = [
      ...alerts.map(alertToFeedItem),
      ...notifications.map(notificationToFeedItem),
    ];
    return {
      now: current,
      groups: groupFeedByDay(filterFeed(items, tab), current),
    };
  }, [alerts, notifications, tab]);

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
    if (item.source === "alert" && !item.isRead) {
      markAlertAsRead(String(item.id)).catch(console.error);
    }
    router.push(item.href);
  };

  const handleDismiss = (item: FeedItem) => {
    dismissAlert(String(item.id)).catch(console.error);
  };

  let body: ReactNode;
  if (isLoading && !hasItems) {
    body = (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (error) {
    body = (
      <div className="py-16 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  } else if (groups.length === 0) {
    body = (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BellOff className="mb-3 h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm">You&apos;re all caught up</p>
        <p className="mt-1 text-xs text-muted-foreground">
          New notifications will show up here.
        </p>
      </div>
    );
  } else {
    body = (
      <div className="overflow-hidden rounded-xl border">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
              {group.label}
            </div>
            <div className="divide-y">
              {group.items.map((item) => (
                <FeedItemRow
                  key={item.key}
                  item={item}
                  now={now}
                  density="comfortable"
                  onOpen={handleOpenItem}
                  trailing={
                    item.source === "alert" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground"
                        onClick={() => handleDismiss(item)}
                        title="Dismiss"
                        aria-label="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alerts and activity from Loan Matrix and Mifos.
          </p>
        </div>
        {totalUnreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      <FeedTabs
        value={tab}
        onChange={setTab}
        unreadCount={totalUnreadCount}
        size="lg"
      />

      {body}

      {groups.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing your most recent notifications.
        </p>
      )}
    </div>
  );
}
