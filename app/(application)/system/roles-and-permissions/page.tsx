import { AlertCircle } from "lucide-react";
import { listSystemRolesAction } from "@/app/actions/system-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RolesAndPermissionsClient } from "../components/roles-and-permissions-client";
import type { SystemRoleSummary } from "@/shared/types/system";

export default async function RolesAndPermissionsPage() {
  let roles: SystemRoleSummary[] = [];
  let loadError: string | null = null;

  try {
    roles = await listSystemRolesAction();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load roles";
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Roles & Permissions
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage Fineract roles and permissions.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return <RolesAndPermissionsClient initialRoles={roles} />;
}
