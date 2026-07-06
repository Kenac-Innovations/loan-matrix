import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { getAuditTrailAction } from "@/app/actions/system-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatFineractDate,
  formatSystemLabel,
} from "../../components/system-helpers";
import type { AuditTrail } from "@/shared/types/system";

type AuditTrailDetailPageProps = {
  params: Promise<{ id: string }>;
};

function prettyJson(value?: string) {
  if (!value) return "N/A";

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default async function AuditTrailDetailPage({
  params,
}: AuditTrailDetailPageProps) {
  const { id } = await params;
  const auditId = Number(id);
  if (!Number.isFinite(auditId)) notFound();

  let audit: AuditTrail | null = null;
  let loadError: string | null = null;

  try {
    audit = await getAuditTrailAction(auditId);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load audit trail";
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/system/audit-trails">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Audit Trails
          </Link>
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!audit?.id) notFound();

  const detailRows = [
    ["Action", formatSystemLabel(audit.actionName)],
    ["Entity", formatSystemLabel(audit.entityName)],
    ["Resource ID", String(audit.resourceId ?? "N/A")],
    ["Processing Result", formatSystemLabel(audit.processingResult)],
    ["Maker", audit.maker || "N/A"],
    ["Made On", formatFineractDate(audit.madeOnDate)],
    ["Checker", audit.checker || "N/A"],
    ["Checked On", formatFineractDate(audit.checkedOnDate)],
    ["Office", audit.officeName || "N/A"],
    ["Client", audit.clientName || "N/A"],
    ["Savings Account", audit.savingsAccountNo || "N/A"],
    ["Group Level", audit.groupLevelName || "N/A"],
  ];

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" className="w-fit">
        <Link href="/system/audit-trails">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Audit Trails
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Audit Trail #{audit.id}
        </h1>
        <Badge variant="outline">
          {formatSystemLabel(audit.processingResult)}
        </Badge>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {detailRows.map(([label, value]) => (
              <div key={label} className="rounded-md border p-3">
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Command JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[520px] overflow-auto rounded-md bg-muted p-4 text-xs leading-5">
            {prettyJson(audit.commandAsJson)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
