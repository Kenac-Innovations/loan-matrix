import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, PencilLine } from "lucide-react";
import {
  getStaffOptionsAction,
  getUserAction,
  getUsersTemplateAction,
} from "@/app/actions/user-management-actions";
import { UserAccessDenied } from "../../components/user-access-denied";
import { UserForm } from "../../components/user-form";
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

type EditUserPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditUserPage({
  params,
}: Readonly<EditUserPageProps>) {
  const { id } = await params;
  const userId = Number(id);

  if (!Number.isFinite(userId)) {
    notFound();
  }

  const canUpdate = await hasPermissionServer(SpecificPermission.UPDATE_USER);

  if (!canUpdate) {
    return (
      <UserAccessDenied description="You do not have permission to edit users." />
    );
  }

  try {
    const [user, template] = await Promise.all([
      getUserAction(userId),
      getUsersTemplateAction(),
    ]);

    const staffResult = user.officeId
      ? await getStaffOptionsAction(user.officeId)
      : { success: true, data: { staff: [] } };

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Edit User</h1>
            <p className="mt-1 text-muted-foreground">
              Update user details, office assignment, and role access.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href={`/organization/users/${user.id}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to User
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PencilLine className="h-5 w-5" />
              Edit {user.displayName}
            </CardTitle>
            <CardDescription>
              Save changes to this Mifos user profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserForm
              mode="edit"
              template={template}
              initialUser={user}
              initialStaffOptions={staffResult.data?.staff ?? []}
              cancelHref={`/organization/users/${user.id}`}
            />
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit User</h1>
          <p className="mt-1 text-muted-foreground">
            Update user details, office assignment, and role access.
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
