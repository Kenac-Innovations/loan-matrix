import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const POLLING_INTERVAL = 30000; // 30 seconds

// GET /api/fineract/notifications/stream - SSE endpoint for real-time notifications
export async function GET(request: NextRequest) {
  // Get authentication details
  const session = await getSession();
  const fineractTenantId = await getFineractTenantId();

  if (!session?.base64EncodedAuthenticationKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  const authToken = session.base64EncodedAuthenticationKey;
  const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isControllerClosed = false;

      // Function to send SSE data
      const sendEvent = (event: string, data: any) => {
        if (isControllerClosed) return;
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error("Error sending SSE event:", error);
        }
      };

      // Function to fetch notifications from Fineract
      const fetchNotifications = async () => {
        try {
          const url = `${baseUrl}/fineract-provider/api/v1/notifications`;

          const response = await fetch(url, {
            headers: {
              Authorization: `Basic ${authToken}`,
              "Fineract-Platform-TenantId": fineractTenantId,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          // Handle different response structures
          let notifications = [];
          if (Array.isArray(data)) {
            notifications = data;
          } else if (data?.pageItems && Array.isArray(data.pageItems)) {
            notifications = data.pageItems;
          } else if (data?.notifications && Array.isArray(data.notifications)) {
            notifications = data.notifications;
          }

          const unreadCount = notifications.filter((n: any) => !n.isRead).length;

          sendEvent("notifications", {
            notifications,
            unreadCount,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error fetching notifications:", error);
          sendEvent("error", {
            message: error instanceof Error ? error.message : "Failed to fetch notifications",
            timestamp: new Date().toISOString(),
          });
        }
      };

      // Send initial connection event
      sendEvent("connected", {
        message: "SSE connection established",
        pollingInterval: POLLING_INTERVAL,
        timestamp: new Date().toISOString(),
      });

      // Fetch immediately on connection
      await fetchNotifications();

      // Set up polling interval
      const intervalId = setInterval(fetchNotifications, POLLING_INTERVAL);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        isControllerClosed = true;
        clearInterval(intervalId);
        try {
          controller.close();
        } catch (e) {
          // Controller might already be closed
        }
      });
    },
  });

  // Return SSE response with proper headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
