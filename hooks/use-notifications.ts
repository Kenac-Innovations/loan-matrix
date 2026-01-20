"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FineractNotification,
  NotificationsResponse,
  NotificationState,
} from "@/shared/types/notification";

const POLLING_INTERVAL = 30000; // 30 seconds

interface UseNotificationsOptions {
  enabled?: boolean;
  pollingInterval?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, pollingInterval = POLLING_INTERVAL } = options;

  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    isLoading: true,
    error: null,
  });

  const [hasViewed, setHasViewed] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fetch notifications from the API
  const fetchNotifications = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      const response = await fetch("/api/fineract/notifications");

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      // Handle different response structures
      let notifications: FineractNotification[] = [];

      if (Array.isArray(data)) {
        notifications = data;
      } else if (data?.pageItems && Array.isArray(data.pageItems)) {
        notifications = data.pageItems;
      } else if (data?.notifications && Array.isArray(data.notifications)) {
        notifications = data.notifications;
      }

      const unreadCount = notifications.filter((n) => !n.isRead).length;

      setState({
        notifications,
        unreadCount,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (!isMountedRef.current) return;

      console.error("Error fetching notifications:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to fetch notifications",
      }));
    }
  }, []);

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds?: number[]) => {
    try {
      const body = notificationIds ? { notificationIds } : {};

      const response = await fetch("/api/fineract/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark notifications as read: ${response.statusText}`);
      }

      // Update local state optimistically
      setState((prev) => {
        const updatedNotifications = prev.notifications.map((n) => {
          if (!notificationIds || notificationIds.includes(n.id)) {
            return { ...n, isRead: true };
          }
          return n;
        });

        return {
          ...prev,
          notifications: updatedNotifications,
          unreadCount: updatedNotifications.filter((n) => !n.isRead).length,
        };
      });

      return true;
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      return false;
    }
  }, []);

  // Mark all as read when dropdown is opened
  const onViewNotifications = useCallback(async () => {
    if (!hasViewed && state.unreadCount > 0) {
      setHasViewed(true);
      await markAsRead();
    }
  }, [hasViewed, state.unreadCount, markAsRead]);

  // Reset viewed state when dropdown closes and notifications are fetched again
  const onCloseNotifications = useCallback(() => {
    setHasViewed(false);
  }, []);

  // Refresh notifications manually
  const refresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Set up polling
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      // Initial fetch
      fetchNotifications();

      // Set up polling interval
      pollingRef.current = setInterval(fetchNotifications, pollingInterval);
    }

    return () => {
      isMountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [enabled, pollingInterval, fetchNotifications]);

  return {
    ...state,
    markAsRead,
    onViewNotifications,
    onCloseNotifications,
    refresh,
  };
}
