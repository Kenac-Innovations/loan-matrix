"use client";

import { useState, useEffect, useCallback } from "react";

export type AlertType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "TASK"
  | "REMINDER"
  | "APPROVAL"
  | "SYSTEM";

export interface Alert {
  id: string;
  tenantId: string;
  mifosUserId: number;
  type: AlertType;
  title: string;
  message: string;
  actionUrl: string | null;
  actionLabel: string | null;
  metadata: any;
  isRead: boolean;
  isDismissed: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UseAlertsOptions {
  pollingInterval?: number; // milliseconds, default 30000 (30 seconds)
  includeRead?: boolean;
  includeDismissed?: boolean;
}

interface UseAlertsReturn {
  alerts: Alert[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (alertId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAlerts(options: UseAlertsOptions = {}): UseAlertsReturn {
  const {
    pollingInterval = 30000,
    includeRead = false,
    includeDismissed = false,
  } = options;

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (includeRead) params.set("includeRead", "true");
      if (includeDismissed) params.set("includeDismissed", "true");

      const response = await fetch(`/api/alerts?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, don't show error
          setAlerts([]);
          setUnreadCount(0);
          return;
        }
        throw new Error("Failed to fetch alerts");
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
      setUnreadCount(data.unreadCount || 0);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching alerts:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [includeRead, includeDismissed]);

  // Mark a single alert as read
  const markAsRead = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark alert as read");
      }

      // Update local state
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, isRead: true } : alert
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error("Error marking alert as read:", err);
      throw err;
    }
  }, []);

  // Mark all alerts as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "readAll" }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark all alerts as read");
      }

      // Update local state
      setAlerts((prev) => prev.map((alert) => ({ ...alert, isRead: true })));
      setUnreadCount(0);
    } catch (err: any) {
      console.error("Error marking all alerts as read:", err);
      throw err;
    }
  }, []);

  // Dismiss an alert
  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to dismiss alert");
      }

      // Remove from local state
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
      // Decrease unread count if the alert was unread
      setAlerts((prev) => {
        const alert = prev.find((a) => a.id === alertId);
        if (alert && !alert.isRead) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((a) => a.id !== alertId);
      });
    } catch (err: any) {
      console.error("Error dismissing alert:", err);
      throw err;
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchAlerts();
  }, [fetchAlerts]);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Polling
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const interval = setInterval(fetchAlerts, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchAlerts, pollingInterval]);

  return {
    alerts,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    dismissAlert,
    refresh,
  };
}

// Helper function to get alert icon color
export function getAlertTypeColor(type: AlertType): string {
  switch (type) {
    case "SUCCESS":
      return "text-green-500";
    case "WARNING":
      return "text-amber-500";
    case "ERROR":
      return "text-red-500";
    case "TASK":
      return "text-blue-500";
    case "REMINDER":
      return "text-purple-500";
    case "APPROVAL":
      return "text-orange-500";
    case "SYSTEM":
      return "text-gray-500";
    case "INFO":
    default:
      return "text-blue-500";
  }
}

// Helper function to get alert background color
export function getAlertTypeBgColor(type: AlertType): string {
  switch (type) {
    case "SUCCESS":
      return "bg-green-500/10";
    case "WARNING":
      return "bg-amber-500/10";
    case "ERROR":
      return "bg-red-500/10";
    case "TASK":
      return "bg-blue-500/10";
    case "REMINDER":
      return "bg-purple-500/10";
    case "APPROVAL":
      return "bg-orange-500/10";
    case "SYSTEM":
      return "bg-gray-500/10";
    case "INFO":
    default:
      return "bg-blue-500/10";
  }
}
