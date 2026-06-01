import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  PenLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getUserAction } from "@/app/actions/user-management-actions";
import { getUserSignatureAction } from "@/app/actions/user-signature-actions";
import { UserDetailActions } from "../components/user-detail-actions";
import { UserAccessDenied } from "../components/user-access-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

type UserDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function DetailField({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="space-y-1 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}

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
            <h1 className="text-3xl font-bold">{user.displayName}</h1>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              User Information
            </CardTitle>
            <CardDescription>
              Core user details from the Mifos user profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Login Name" value={user.username} />
            <DetailField label="First Name" value={user.firstname} />
            <DetailField label="Last Name" value={user.lastname} />
            <DetailField label="Email" value={user.email || "Not set"} />
            <DetailField label="Office" value={user.officeName || "-"} />
            <DetailField
              label="Staff"
              value={user.staff?.displayName || "Unassigned"}
            />
            <DetailField
              label="Password Never Expires"
              value={user.passwordNeverExpires ? "Yes" : "No"}
            />
            <DetailField
              label="Self Service User"
              value={user.isSelfServiceUser ? "Yes" : "No"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              User Signature
            </CardTitle>
            <CardDescription>
              Saved signature used for this user&apos;s loan contract workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signatureData ? (
              <div className="rounded-xl border-2 border-dashed p-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureData}
                  alt={`${user.displayName} signature`}
                  className="mx-auto max-h-32 rounded border bg-white p-2"
                />
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed p-6 text-center">
                <PenLine className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No signature has been saved for this user.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Assigned Roles
            </CardTitle>
            <CardDescription>
              Roles currently attached to this user in Fineract.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.selectedRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No roles assigned to this user.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.selectedRoles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </div>
            )}
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
