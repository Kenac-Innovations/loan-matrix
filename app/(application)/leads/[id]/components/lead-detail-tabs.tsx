"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  MessageSquare,
  Activity,
  Calculator,
  Database,
  StickyNote,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ComprehensiveLeadDetails } from "./comprehensive-lead-details";
import { LeadAdditionalInfo } from "./lead-additional-info";
import { LeadTimeline } from "./lead-timeline";
import { LeadDocuments } from "./lead-documents";
import { LeadCommunications } from "./lead-communications";
import { LeadCDE } from "./lead-cde";
import { LeadNotes } from "./lead-notes";
import { LeadAppraisals } from "./lead-appraisals";

interface TabCheck {
  id: string;
  label: string;
  passed: boolean;
  message: string;
}

interface TabValidation {
  tab: string;
  passed: boolean;
  checks: TabCheck[];
}

interface LeadDetailTabsProps {
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
}

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

const VALIDATED_TABS = new Set([
  "details",
  "documents",
  "communication",
  "appraisal",
]);

function ValidationBanner({ validation }: { validation?: TabValidation }) {
  if (!validation) return null;

  const failedChecks = validation.checks.filter((c) => !c.passed);
  if (failedChecks.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            {failedChecks.length} check{failedChecks.length !== 1 ? "s" : ""} need attention
          </p>
          <ul className="mt-1.5 space-y-1">
            {failedChecks.map((c) => (
              <li key={c.id} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

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
}: LeadDetailTabsProps) {
  const resolvedFineractClientId = fineractClientId ?? null;
  const resolvedFineractLoanId = fineractLoanId ?? null;
  const resolvedRequestedAmount = requestedAmount ?? null;
  const resolvedDatatableData = datatableData ?? {};

  const [tabValidations, setTabValidations] = useState<
    Record<string, TabValidation>
  >({});
  const [validationsLoading, setValidationsLoading] = useState(true);

  const fetchValidations = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/tab-validations`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, TabValidation> = {};
      for (const tv of data.tabs || []) {
        map[tv.tab] = tv;
      }
      setTabValidations(map);
    } catch {
      // Silently fail — tabs still work without indicators
    } finally {
      setValidationsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchValidations();
  }, [fetchValidations]);

  // Re-fetch validations when child components signal data changes
  useEffect(() => {
    const handler = () => fetchValidations();
    window.addEventListener("lead-data-changed", handler);
    return () => window.removeEventListener("lead-data-changed", handler);
  }, [fetchValidations]);

  function renderIndicator(tabValue: string) {
    if (!VALIDATED_TABS.has(tabValue)) return null;

    if (validationsLoading) {
      return (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1 shrink-0" />
      );
    }

    const validation = tabValidations[tabValue];
    if (!validation) return null;

    const failedChecks = validation.checks.filter((c) => !c.passed);

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-1 shrink-0 inline-flex">
              {validation.passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {validation.passed ? (
              <p className="text-xs text-green-600 font-medium">All checks passed</p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-medium text-red-600">
                  {failedChecks.length} check{failedChecks.length !== 1 ? "s" : ""} pending
                </p>
                <ul className="text-xs space-y-0.5">
                  {failedChecks.map((c) => (
                    <li key={c.id} className="flex items-start gap-1.5">
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                      <span>{c.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Tabs defaultValue="details">
      <TabsList className="w-full sm:w-auto overflow-x-auto flex-nowrap justify-start">
        {TABS.map((tab) => {
          const Icon = TAB_ICON_MAP[tab.value] || FileText;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              <Icon className="mr-1 sm:mr-1.5 h-3.5 w-3.5 hidden sm:inline-block" />
              <span className="whitespace-nowrap hidden sm:inline">
                {tab.label}
              </span>
              <span className="whitespace-nowrap sm:hidden">
                {tab.shortLabel}
              </span>
              {renderIndicator(tab.value)}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="details" className="mt-4">
        <ValidationBanner validation={tabValidations["details"]} />
        <ComprehensiveLeadDetails leadId={leadId} />
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
        <ValidationBanner validation={tabValidations["documents"]} />
        <LeadDocuments
          leadId={leadId}
          fineractClientId={resolvedFineractClientId}
          fineractLoanId={resolvedFineractLoanId}
          initialClientDocuments={clientDocuments}
          initialLoanDocuments={loanDocuments}
          readOnly={readOnly}
        />
      </TabsContent>
      <TabsContent value="communication" className="mt-4">
        <ValidationBanner validation={tabValidations["communication"]} />
        <LeadCommunications leadId={leadId} readOnly={readOnly} />
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
        <ValidationBanner validation={tabValidations["appraisal"]} />
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
