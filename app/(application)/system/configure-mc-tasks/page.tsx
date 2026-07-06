import { AlertCircle } from "lucide-react";
import {
  getSystemPermissionFlagsAction,
  listMakerCheckerPermissionsAction,
} from "@/app/actions/system-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MakerCheckerClient } from "../components/maker-checker-client";
import type {
  SystemPermission,
  SystemPermissionFlags,
} from "@/shared/types/system";

export default async function ConfigureMakerCheckerTasksPage() {
  let permissions: SystemPermission[] = [];
  let flags: SystemPermissionFlags = {
    canUpdatePermission: false,
    canUpdateScheduler: false,
    canExecuteInlineJob: false,
  };
  let loadError: string | null = null;

  try {
    [permissions, flags] = await Promise.all([
      listMakerCheckerPermissionsAction(),
      getSystemPermissionFlagsAction(),
    ]);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Failed to load maker checker tasks";
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Configure Maker Checker Tasks
          </h1>
          <p className="mt-1 text-muted-foreground">
            Configure maker-checker behavior for eligible Fineract tasks.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <MakerCheckerClient
      initialPermissions={permissions}
      canUpdatePermission={flags.canUpdatePermission}
    />
  );
}
