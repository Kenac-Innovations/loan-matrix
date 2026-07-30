"use client";

import { AlertCircle } from "lucide-react";
import { AccessRestricted } from "@/components/access-restricted";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AuditTrail,
  AuditTrailSearchTemplate,
  LoadFailure,
  RescheduleLoanRequest,
} from "@/shared/types/system";
import { CheckerInboxClient } from "./checker-inbox-client";
import { RescheduleLoanTab } from "./reschedule-loan-tab";

type CheckerInboxTasksClientProps = {
  template: AuditTrailSearchTemplate;
  initialEntries: AuditTrail[];
  checkerInboxError: LoadFailure | null;
  initialRescheduleRequests: RescheduleLoanRequest[];
  rescheduleError: LoadFailure | null;
};

function ErrorState({ error }: { error: LoadFailure }) {
  if (error.status === 403) {
    return (
      <AccessRestricted description="Your account doesn't have permission to view this. Ask an administrator to grant the relevant permission if you need access." />
    );
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export function CheckerInboxTasksClient({
  template,
  initialEntries,
  checkerInboxError,
  initialRescheduleRequests,
  rescheduleError,
}: CheckerInboxTasksClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Checker Inbox &amp; Tasks
        </h1>
        <p className="mt-1 text-muted-foreground">
          Review and act on maker-checker entries and other pending back-office
          tasks awaiting your approval.
        </p>
      </div>

      <Tabs defaultValue="checker-inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="checker-inbox">Checker Inbox</TabsTrigger>
          <TabsTrigger value="reschedule-loan">Reschedule Loan</TabsTrigger>
        </TabsList>

        <TabsContent value="checker-inbox" className="space-y-4">
          {checkerInboxError ? (
            <ErrorState error={checkerInboxError} />
          ) : (
            <CheckerInboxClient
              template={template}
              initialEntries={initialEntries}
            />
          )}
        </TabsContent>

        <TabsContent value="reschedule-loan" className="space-y-4">
          {rescheduleError ? (
            <ErrorState error={rescheduleError} />
          ) : (
            <RescheduleLoanTab initialRequests={initialRescheduleRequests} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
