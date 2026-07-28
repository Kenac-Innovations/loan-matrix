export type NotificationChannel = "SMS" | "EMAIL";
export type NotificationSource = "REMINDER" | "RECOVERY" | "REPAYMENT_RECEIPT";
export type NotificationStatus =
  | "QUEUED"
  | "ACCEPTED"
  | "SENT"
  | "FAILED"
  | "SUPPRESSED"
  | "SKIPPED";

export type ReminderType = "LOAN_REPAYMENT_DUE" | "RECOVERY_ARREARS";
export type ReminderRunStatus =
  | "CREATED"
  | "SCANNING_CANDIDATES"
  | "CANDIDATES_LOADED"
  | "PROCESSING_REMINDERS"
  | "COMPLETED"
  | "FAILED";

export type ReminderRunItemStatus =
  | "PICKED"
  | "PROCESSING"
  | "QUEUED"
  | "SUPPRESSED"
  | "FAILED";

export interface ReminderTenantConfig {
  id?: string;
  tenantId: string;
  enabled: boolean;
  timezone: string;
  defaultCountryCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReminderTemplate {
  id?: string;
  tenantId: string;
  code: string;
  name: string;
  channel: NotificationChannel;
  subject?: string | null;
  body: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReminderRule {
  id?: string;
  tenantId: string;
  code: string;
  name: string;
  type: ReminderType;
  enabled: boolean;
  channels: string;
  templateId?: string | null;
  reportName?: string | null;
  sendTime: string;
  timezone?: string | null;
  daysOffset: number;
  lookBackDays: number;
  lookAheadDays: number;
  minDaysPastDue?: number | null;
  maxDaysPastDue?: number | null;
  cooldownMinutes: number;
  pageLimit: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReminderRunSummary {
  id: string;
  tenantId: string;
  ruleId: string;
  idempotencyKey: string;
  type: ReminderType;
  status: ReminderRunStatus;
  slotStartAt: string;
  asOfDate: string;
  pageLimit: number;
  pageOffset: number;
  hasMore: boolean;
  totalCandidateCount: number;
  loadedCandidateCount: number;
  pickedCount: number;
  processedCount: number;
  queuedCount: number;
  skippedCount: number;
  failedCount: number;
  startedAt?: string | null;
  scanStartedAt?: string | null;
  scanCompletedAt?: string | null;
  processingStartedAt?: string | null;
  finishedAt?: string | null;
  lockedBy?: string | null;
  lockedUntil?: string | null;
  lastError?: string | null;
}

export interface ReminderRunItem {
  id: string;
  runId: string;
  tenantId: string;
  ruleId: string;
  candidateKey: string;
  globalDedupeKey: string;
  loanId?: number | null;
  clientId?: number | null;
  loanAccountNo?: string | null;
  clientName?: string | null;
  recipientPhone?: string | null;
  dueDate?: string | null;
  amountDue?: number | string | null;
  daysPastDue?: number | null;
  status: ReminderRunItemStatus;
  skipReason?: string | null;
  errorMessage?: string | null;
  notificationMessageId?: string | null;
  rawCandidatePayload?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationMessageSummary {
  id: string;
  tenantId: string;
  messageId: string;
  source: NotificationSource;
  sourceType: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string | null;
  body: string;
  status: NotificationStatus;
  templateId?: string | null;
  reminderRuleId?: string | null;
  reminderRunId?: string | null;
  reminderRunItemId?: string | null;
  loanId?: number | null;
  clientId?: number | null;
  loanAccountNo?: string | null;
  dueDate?: string | null;
  scheduledFor?: string | null;
  acceptedAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  callbackReceivedAt?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationMessagePage {
  content: NotificationMessageSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ReminderTenantContext {
  tenantId: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  fineractTenantId: string;
}

export interface ReminderDashboardData {
  tenant: ReminderTenantContext;
  config: ReminderTenantConfig;
  rules: ReminderRule[];
  templates: ReminderTemplate[];
  runs: ReminderRunSummary[];
  messages: NotificationMessageSummary[];
}

export interface ReminderActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
