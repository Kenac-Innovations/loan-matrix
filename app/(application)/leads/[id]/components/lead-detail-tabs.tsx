"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  MessageSquare,
  Activity,
  Calculator,
  Database,
  StickyNote,
  ClipboardCheck,
} from "lucide-react";
import { ComprehensiveLeadDetails } from "./comprehensive-lead-details";
import { LeadAdditionalInfo } from "./lead-additional-info";
import { LeadTimeline } from "./lead-timeline";
import { LeadDocuments } from "./lead-documents";
import { LeadCommunications } from "./lead-communications";
import { LeadCDE } from "./lead-cde";
import { LeadNotes } from "./lead-notes";
import { LeadAppraisals } from "./lead-appraisals";

type LeadDetailTabsProps = {
  leadId: string;
  fineractClientId?: number | null;
  fineractLoanId?: number | null;
  requestedAmount?: number | null;
  currentStage?: string | null;
  clientTypeName?: string;
  clientDatatables?: any[];
  datatableData?: Record<string, any> | null;
  clientDocuments?: any[];
  loanDocuments?: any[];
  readOnly?: boolean;
  canEditPendingLoanApplication?: boolean;
  showOmamaLeadTabs?: boolean;
};

const TAB_ICON_MAP: Record<string, typeof FileText> = {
  details: FileText,
  "additional-info": Database,
  timeline: Activity,
  documents: FileText,
  communication: MessageSquare,
  affordability: Calculator,
  notes: StickyNote,
  appraisal: ClipboardCheck,
};

const TABS = [
  { value: "details", label: "Details", shortLabel: "Details" },
  { value: "additional-info", label: "Additional Info", shortLabel: "Info" },
  { value: "timeline", label: "Timeline", shortLabel: "Timeline" },
  { value: "documents", label: "Documents", shortLabel: "Docs" },
  { value: "communication", label: "Communication", shortLabel: "Comms" },
  { value: "affordability", label: "CDE", shortLabel: "CDE" },
  { value: "notes", label: "Notes", shortLabel: "Notes" },
  { value: "appraisal", label: "Appraisal", shortLabel: "Appraisal" },
];

export function LeadDetailTabs({
  leadId,
  fineractClientId,
  fineractLoanId,
  requestedAmount,
  currentStage,
  clientTypeName,
  clientDatatables = [],
  datatableData = {},
  clientDocuments = [],
  loanDocuments = [],
  readOnly = false,
  canEditPendingLoanApplication = false,
  showOmamaLeadTabs = false,
}: LeadDetailTabsProps) {
  const resolvedFineractClientId = fineractClientId ?? null;
  const resolvedFineractLoanId = fineractLoanId ?? null;
  const resolvedRequestedAmount = requestedAmount ?? null;
  const resolvedDatatableData = datatableData ?? {};

  if (!showOmamaLeadTabs) {
    return (
      <ComprehensiveLeadDetails
        leadId={leadId}
        canEditPendingLoanApplication={canEditPendingLoanApplication}
      />
    );
  }

  return (
    <Tabs defaultValue="details">
      <TabsList className="w-full flex-nowrap justify-start overflow-x-auto sm:w-auto">
        {TABS.map((tab) => {
          const Icon = TAB_ICON_MAP[tab.value] || FileText;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-2 text-xs sm:px-3 sm:text-sm"
            >
              <Icon className="mr-1 hidden h-3.5 w-3.5 sm:mr-1.5 sm:inline-block" />
              <span className="hidden whitespace-nowrap sm:inline">
                {tab.label}
              </span>
              <span className="whitespace-nowrap sm:hidden">
                {tab.shortLabel}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="details" className="mt-4">
        <ComprehensiveLeadDetails
          leadId={leadId}
          canEditPendingLoanApplication={canEditPendingLoanApplication}
        />
      </TabsContent>
      <TabsContent value="additional-info" className="mt-4">
        <LeadAdditionalInfo
          leadId={leadId}
          clientId={resolvedFineractClientId}
          datatables={clientDatatables}
          datatableData={resolvedDatatableData}
          clientType={clientTypeName}
        />
      </TabsContent>
      <TabsContent value="timeline" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Lead Timeline</CardTitle>
            <CardDescription>
              Track the progress of this lead through the pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadTimeline leadId={leadId} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="documents" className="mt-4">
        <LeadDocuments
          leadId={leadId}
          fineractClientId={resolvedFineractClientId}
          fineractLoanId={resolvedFineractLoanId}
          initialClientDocuments={clientDocuments}
          initialLoanDocuments={loanDocuments}
        />
      </TabsContent>
      <TabsContent value="communication" className="mt-4">
        <LeadCommunications leadId={leadId} />
      </TabsContent>
      <TabsContent value="affordability" className="mt-4">
        <LeadCDE leadId={leadId} />
      </TabsContent>
      <TabsContent value="notes" className="mt-4">
        <LeadNotes
          leadId={leadId}
          fineractLoanId={resolvedFineractLoanId}
          readOnly={readOnly}
        />
      </TabsContent>
      <TabsContent value="appraisal" className="mt-4">
        <LeadAppraisals
          leadId={leadId}
          fineractClientId={resolvedFineractClientId}
          requestedAmount={resolvedRequestedAmount}
          readOnly={readOnly}
        />
      </TabsContent>
    </Tabs>
  );
}
