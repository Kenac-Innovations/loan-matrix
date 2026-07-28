import { AlertCircle } from "lucide-react";
import { getNotificationMessagesPageAction } from "@/app/actions/reminder-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NotificationsClient } from "./notifications-client";
import type { NotificationMessagePage } from "@/shared/types/reminders";

export default async function NotificationsPage() {
  let initialPage: NotificationMessagePage | null = null;
  let loadError: string | null = null;

  try {
    initialPage = await getNotificationMessagesPageAction({
      page: 0,
      size: 25,
    });
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load notifications";
  }

  if (loadError || !initialPage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant notification delivery history.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {loadError ?? "Failed to load notifications"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <NotificationsClient initialPage={initialPage} />;
}
