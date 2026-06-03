import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { getUserAction } from "@/app/actions/user-management-actions";
import { getUserSignatureAction } from "@/app/actions/user-signature-actions";
import { UserDetailActions } from "../components/user-detail-actions";
import { UserDetailTabs } from "../components/user-detail-tabs";
import { UserAccessDenied } from "../components/user-access-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasPermissionServer } from "@/lib/authorization";
import { SpecificPermission } from "@/shared/types/auth";

type UserDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserDetailPage({
  params,
}: Readonly<UserDetailPageProps>) {
  const { id } = await params;
  const userId = Number(id);

  if (!Number.isFinite(userId)) {
    notFound();
  }

  const [canRead, canUpdate] = await Promise.all([
    hasPermissionServer(SpecificPermission.READ_USER),
    hasPermissionServer(SpecificPermission.UPDATE_USER),
  ]);

  if (!canRead) {
    return <UserAccessDenied />;
  }

  try {
    const [user, { signatureData }] = await Promise.all([
      getUserAction(userId),
      getUserSignatureAction(userId),
    ]);

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{user.displayName}</h1>
              <Badge variant={user.isBlocked ? "destructive" : "secondary"}>
                {user.isBlocked ? "Blocked" : "Active"}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              View user profile, assigned roles, and administration actions.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/organization/users">
              <ArrowLeft className="h-4 w-4" />
              Back to Users
            </Link>
          </Button>
        </div>

        <UserDetailActions
          user={user}
          canUpdate={canUpdate}
        />

        <UserDetailTabs user={user} signatureData={signatureData} />
      </div>
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">User Details</h1>
          <p className="mt-1 text-muted-foreground">
            View user profile, assigned roles, and administration actions.
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
