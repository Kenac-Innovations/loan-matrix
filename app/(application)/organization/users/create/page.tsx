import Link from "next/link";
import { AlertCircle, ArrowLeft, UserPlus } from "lucide-react";
import { getUsersTemplateAction } from "@/app/actions/user-management-actions";
import { UserAccessDenied } from "../components/user-access-denied";
import { UserForm } from "../components/user-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasPermissionServer } from "@/lib/authorization";
import { SpecificPermission } from "@/shared/types/auth";

export default async function CreateUserPage() {
  const canCreate = await hasPermissionServer(SpecificPermission.CREATE_USER);

  if (!canCreate) {
    return (
      <UserAccessDenied description="You do not have permission to create users." />
    );
  }

  try {
    const template = await getUsersTemplateAction();

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Create User</h1>
            <p className="mt-1 text-muted-foreground">
              Add a new Mifos user and assign roles and branch access.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/organization/users">
              <ArrowLeft className="h-4 w-4" />
              Back to Users
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              User Details
            </CardTitle>
            <CardDescription>
              Complete the required information to create the user.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserForm
              mode="create"
              template={template}
              cancelHref="/organization/users"
            />
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user template";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create User</h1>
          <p className="mt-1 text-muted-foreground">
            Add a new Mifos user and assign roles and branch access.
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
