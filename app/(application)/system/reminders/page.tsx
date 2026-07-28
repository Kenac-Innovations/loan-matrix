import { AlertCircle } from "lucide-react";
import { getReminderDashboardAction } from "@/app/actions/reminder-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RemindersClient } from "./reminders-client";

export default async function RemindersPage() {
  let data = null;
  let loadError: string | null = null;

  try {
    data = await getReminderDashboardAction();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load reminders";
  }

  if (loadError || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Central reminder scheduling and delivery history.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return <RemindersClient initialData={data} />;
}
