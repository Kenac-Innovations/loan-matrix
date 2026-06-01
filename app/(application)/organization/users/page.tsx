import { AlertCircle } from "lucide-react";
import { listUsersAction } from "@/app/actions/user-management-actions";
import { UserAccessDenied } from "./components/user-access-denied";
import { UsersPageClient } from "./components/users-page-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { hasPermissionServer } from "@/lib/authorization";
import { SpecificPermission } from "@/shared/types/auth";

export default async function UsersPage() {
  const [canRead, canCreate] = await Promise.all([
    hasPermissionServer(SpecificPermission.READ_USER),
    hasPermissionServer(SpecificPermission.CREATE_USER),
  ]);

  if (!canRead) {
    return <UserAccessDenied />;
  }

  try {
    const users = await listUsersAction();
    return <UsersPageClient users={users} canCreate={canCreate} />;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load users";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="mt-1 text-muted-foreground">
            Manage Mifos user accounts, roles, and branch assignment.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    );
  }
}
