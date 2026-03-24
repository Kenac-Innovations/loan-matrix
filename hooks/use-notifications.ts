"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FineractNotification,
  NotificationState,
} from "@/shared/types/notification";

interface UseNotificationsOptions {
  enabled?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true } = options;

  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    isLoading: true,
    error: null,
  });

  const [hasViewed, setHasViewed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Mark notifications as read via API
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

  // Reset viewed state when dropdown closes
  const onCloseNotifications = useCallback(() => {
    setHasViewed(false);
  }, []);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    try {
      const eventSource = new EventSource("/api/fineract/notifications/stream");
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("connected", (event) => {
        if (!isMountedRef.current) return;
        console.log("SSE connected:", JSON.parse(event.data));
        setIsConnected(true);
        setState((prev) => ({ ...prev, isLoading: false, error: null }));
      });

      eventSource.addEventListener("notifications", (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setState((prev) => ({
            ...prev,
            notifications: data.notifications || [],
            unreadCount: data.unreadCount || 0,
            isLoading: false,
            error: null,
          }));
        } catch (error) {
          console.error("Error parsing notifications:", error);
        }
      });

      eventSource.addEventListener("error", (event: Event) => {
        if (!isMountedRef.current) return;
        
        // Check if this is an SSE error event with data
        if (event instanceof MessageEvent) {
          try {
            const data = JSON.parse(event.data);
            console.error("SSE error event:", data);
            setState((prev) => ({
              ...prev,
              error: data.message || "Connection error",
              isLoading: false,
            }));
          } catch {
            // Not a JSON error event
          }
        }
      });

      eventSource.onerror = () => {
        if (!isMountedRef.current) return;
        
        console.warn("SSE notification stream disconnected, will reconnect...");
        setIsConnected(false);
        
        eventSource.close();
        eventSourceRef.current = null;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && enabled) {
            connectSSE();
          }
        }, 5000);
      };

    } catch (error) {
      console.error("Error creating EventSource:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to connect to notification stream",
      }));
    }
  }, [enabled]);

  // Disconnect SSE stream
  const disconnectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Manual refresh - reconnect to SSE
  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    disconnectSSE();
    // Small delay before reconnecting
    setTimeout(() => {
      if (isMountedRef.current) {
        connectSSE();
      }
    }, 100);
  }, [connectSSE, disconnectSSE]);

  // Set up SSE connection on mount
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      connectSSE();
    }

    return () => {
      isMountedRef.current = false;
      disconnectSSE();
    };
  }, [enabled, connectSSE, disconnectSSE]);

  return {
    ...state,
    isConnected,
    markAsRead,
    onViewNotifications,
    onCloseNotifications,
    refresh,
  };
}
