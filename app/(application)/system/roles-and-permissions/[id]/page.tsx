import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getSystemRoleAction } from "@/app/actions/system-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RoleDetailClient } from "../../components/role-detail-client";
import type { SystemRoleDetail } from "@/shared/types/system";

type RoleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const { id } = await params;
  let role: SystemRoleDetail | null = null;
  let loadError: string | null = null;

  try {
    role = await getSystemRoleAction(id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load role";
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role</h1>
          <p className="mt-1 text-muted-foreground">
            Review and maintain role permissions.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!role?.id) notFound();

  return <RoleDetailClient initialRole={role} />;
}
