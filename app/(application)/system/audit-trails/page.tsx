import { AlertCircle } from "lucide-react";
import {
  getAuditTrailSearchTemplateAction,
  searchAuditTrailsAction,
} from "@/app/actions/system-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuditTrailsClient } from "../components/audit-trails-client";
import type {
  AuditTrailPage,
  AuditTrailSearchTemplate,
} from "@/shared/types/system";

export default async function AuditTrailsPage() {
  let template: AuditTrailSearchTemplate | null = null;
  let initialPage: AuditTrailPage | null = null;
  let loadError: string | null = null;

  try {
    [template, initialPage] = await Promise.all([
      getAuditTrailSearchTemplateAction(),
      searchAuditTrailsAction({ offset: 0, limit: 10 }),
    ]);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load audit trails";
  }

  if (loadError || !template || !initialPage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Trails</h1>
          <p className="mt-1 text-muted-foreground">
            Search and inspect Fineract audit activity.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {loadError ?? "Failed to load audit trails"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <AuditTrailsClient template={template} initialPage={initialPage} />;
}
