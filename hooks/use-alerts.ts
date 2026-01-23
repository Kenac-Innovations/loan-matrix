"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Notification sound utility
const playNotificationSound = (type: AlertType = "INFO") => {
  try {
    // Create audio context for better browser support
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different sounds for different alert types
    switch (type) {
      case "SUCCESS":
        // Pleasant ascending tone
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        break;
      case "WARNING":
      case "ERROR":
        // Alert tone - two beeps
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.25);
        break;
      case "TASK":
      case "APPROVAL":
        // Attention tone
        oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.15); // G5
        break;
      default:
        // Default notification sound
        oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
    }

    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    // Silently fail if audio can't be played
    console.debug("Could not play notification sound:", error);
  }
};

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
  enableSound?: boolean; // Enable sound notifications for new alerts
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
    enableSound = true,
  } = options;

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track previous alert IDs to detect new alerts
  const previousAlertIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

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
      const newAlerts: Alert[] = data.alerts || [];
      
      // Check for new alerts and play sound (skip on initial load)
      if (enableSound && !isInitialLoadRef.current && newAlerts.length > 0) {
        const newAlertIds = newAlerts.map(a => a.id);
        const brandNewAlerts = newAlerts.filter(
          alert => !previousAlertIdsRef.current.has(alert.id) && !alert.isRead
        );
        
        if (brandNewAlerts.length > 0) {
          // Play sound for the most important alert type
          const priorityOrder: AlertType[] = ["ERROR", "WARNING", "TASK", "APPROVAL", "SUCCESS", "INFO", "REMINDER", "SYSTEM"];
          const highestPriorityAlert = brandNewAlerts.reduce((prev, curr) => {
            const prevPriority = priorityOrder.indexOf(prev.type);
            const currPriority = priorityOrder.indexOf(curr.type);
            return currPriority < prevPriority ? curr : prev;
          }, brandNewAlerts[0]);
          
          playNotificationSound(highestPriorityAlert.type);
          
          // Also show browser notification if permitted
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(brandNewAlerts[0].title, {
              body: brandNewAlerts[0].message,
              icon: "/favicon.ico",
              tag: brandNewAlerts[0].id,
            });
          }
        }
        
        // Update previous alert IDs
        previousAlertIdsRef.current = new Set(newAlertIds);
      } else if (isInitialLoadRef.current) {
        // On initial load, just populate the previous IDs without sound
        previousAlertIdsRef.current = new Set(newAlerts.map(a => a.id));
        isInitialLoadRef.current = false;
      }
      
      setAlerts(newAlerts);
      setUnreadCount(data.unreadCount || 0);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching alerts:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [includeRead, includeDismissed, enableSound]);

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

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

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

// Export the sound function for manual use
export { playNotificationSound };

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
