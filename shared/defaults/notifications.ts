export interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  triggers: string[];
  recipients: string[];
  isActive: boolean;
}

export const defaultPipelineStages: PipelineStage[] = [
  { id: "qualification", name: "Lead Qualification", color: "#3b82f6" },
  { id: "documents", name: "Document Collection", color: "#8b5cf6" },
  { id: "assessment", name: "Credit Assessment", color: "#eab308" },
  { id: "approval", name: "Approval", color: "#22c55e" },
  { id: "disbursement", name: "Disbursement", color: "#14b8a6" },
];

export const defaultNotificationTemplates: NotificationTemplate[] = [
  {
    id: "stage-change",
    name: "Stage Change Notification",
    type: "email",
    subject: "Lead Status Update: [Lead ID] moved to [Stage Name]",
    body: "Dear [Recipient Name],\n\nThe lead [Lead ID] for [Client Name] has been moved to the [Stage Name] stage.\n\nCurrent Status: [Stage Name]\nAssigned To: [Assignee Name]\n\nPlease review and take appropriate action if needed.\n\nRegards,\nKENAC Loan Matrix",
    triggers: ["stage-change"],
    recipients: ["team-lead", "team-members"],
    isActive: true,
  },
  {
    id: "sla-warning",
    name: "SLA Warning Notification",
    type: "email",
    subject: "SLA Warning: [Lead ID] approaching deadline",
    body: "Dear [Recipient Name],\n\nThe lead [Lead ID] for [Client Name] is approaching its SLA deadline in the [Stage Name] stage.\n\nCurrent Status: [Stage Name]\nTime in Stage: [Time in Stage]\nSLA Deadline: [SLA Deadline]\nAssigned To: [Assignee Name]\n\nPlease take immediate action to ensure timely processing.\n\nRegards,\nKENAC Loan Matrix",
    triggers: ["sla-warning"],
    recipients: ["team-lead", "team-members"],
    isActive: true,
  },
  {
    id: "sla-breach",
    name: "SLA Breach Notification",
    type: "email",
    subject: "URGENT: SLA Breach for [Lead ID]",
    body: "Dear [Recipient Name],\n\nThe lead [Lead ID] for [Client Name] has exceeded its SLA deadline in the [Stage Name] stage.\n\nCurrent Status: [Stage Name]\nTime in Stage: [Time in Stage]\nSLA Deadline: [SLA Deadline]\nAssigned To: [Assignee Name]\n\nPlease take immediate action to resolve this issue.\n\nRegards,\nKENAC Loan Matrix",
    triggers: ["sla-breach"],
    recipients: ["team-lead", "team-members", "manager"],
    isActive: true,
  },
  {
    id: "assignment",
    name: "Lead Assignment Notification",
    type: "email",
    subject: "New Lead Assignment: [Lead ID]",
    body: "Dear [Recipient Name],\n\nYou have been assigned to lead [Lead ID] for [Client Name] in the [Stage Name] stage.\n\nLead Details:\nClient: [Client Name]\nLoan Amount: [Loan Amount]\nLoan Type: [Loan Type]\nStage: [Stage Name]\n\nPlease review and take appropriate action.\n\nRegards,\nKENAC Loan Matrix",
    triggers: ["assignment"],
    recipients: ["assignee"],
    isActive: true,
  },
  {
    id: "client-update",
    name: "Client Update Notification",
    type: "sms",
    subject: "",
    body: "KENAC Loan Matrix: Your loan application [Lead ID] has been updated to status: [Stage Name]. Log in to your portal for details or contact your loan officer.",
    triggers: ["stage-change"],
    recipients: ["client"],
    isActive: true,
  },
];

export const defaultNotificationTriggers = [
  "stage-change",
  "sla-warning",
  "sla-breach",
  "assignment",
  "document-upload",
  "approval",
  "rejection",
  "disbursement",
];

export const defaultNotificationRecipients = [
  "assignee",
  "team-lead",
  "team-members",
  "manager",
  "client",
  "stakeholder",
];

export const defaultNotificationTypes = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push Notification" },
];
