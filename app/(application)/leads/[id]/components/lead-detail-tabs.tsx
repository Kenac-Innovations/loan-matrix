"use client";

import { ComprehensiveLeadDetails } from "./comprehensive-lead-details";

type LeadDetailTabsProps = {
  leadId: string;
  fineractClientId?: number | null;
  fineractLoanId?: number | null;
  requestedAmount?: number | null;
  currentStage?: string | null;
  clientTypeName?: string;
  clientDatatables?: unknown[];
  datatableData?: Record<string, unknown> | null;
  clientDocuments?: unknown[];
  loanDocuments?: unknown[];
  readOnly?: boolean;
};

export function LeadDetailTabs({ leadId }: LeadDetailTabsProps) {
  return <ComprehensiveLeadDetails leadId={leadId} />;
}
