export type SystemActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** True when a maker-checker-enabled task queued the request instead of applying it. */
  pending?: boolean;
};

export type SystemPermission = {
  code: string;
  grouping: string;
  selected: boolean;
};

export type SystemRoleSummary = {
  id: number;
  name: string;
  description: string;
  disabled: boolean;
};

export type SystemRoleDetail = SystemRoleSummary & {
  permissionUsageData: SystemPermission[];
};

export type SystemPermissionFlags = {
  canUpdatePermission: boolean;
  canUpdateScheduler: boolean;
  canExecuteInlineJob: boolean;
};

export type AuditTrailUserOption = {
  id: number;
  username: string;
};

export type AuditTrailProcessingResult = {
  id: string | number;
  processingResult: string;
};

export type AuditTrailSearchTemplate = {
  appUsers: AuditTrailUserOption[];
  actionNames: string[];
  entityNames: string[];
  processingResults: AuditTrailProcessingResult[];
};

export type AuditTrailFilters = {
  actionName?: string;
  entityName?: string;
  resourceId?: string;
  makerId?: string;
  makerDateTimeFrom?: string;
  makerDateTimeTo?: string;
  checkerDateTimeFrom?: string;
  checkerDateTimeTo?: string;
  checkerId?: string;
  processingResult?: string;
  dateFormat?: string;
  locale?: string;
};

export type AuditTrailSearchInput = {
  filters?: AuditTrailFilters;
  orderBy?: string;
  sortOrder?: "asc" | "desc" | "";
  offset?: number;
  limit?: number;
};

export type AuditTrail = {
  id: number;
  resourceId?: number | string;
  processingResult?: string;
  maker?: string;
  actionName?: string;
  entityName?: string;
  officeName?: string;
  madeOnDate?: string | number | number[] | null;
  checker?: string;
  checkedOnDate?: string | number | number[] | null;
  clientName?: string;
  commandAsJson?: string;
  savingsAccountNo?: string;
  groupLevelName?: string;
};

export type AuditTrailPage = {
  totalFilteredRecords: number;
  pageItems: AuditTrail[];
};

export type SchedulerRunHistory = {
  version: number;
  jobRunStartTime?: string;
  jobRunEndTime?: string;
  status?: string;
  triggerType?: string;
  jobRunErrorMessage?: string;
  jobRunErrorLog?: string;
};

export type SchedulerJob = {
  jobId: number;
  displayName: string;
  nextRunTime?: string;
  cronExpression?: string;
  active: boolean;
  currentlyRunning: boolean;
  lastRunHistory?: SchedulerRunHistory | null;
};

export type SchedulerStatus = {
  active: boolean;
};

export type JobParameter = {
  parameterName: string;
  parameterValue: string;
};

export type WorkflowJobStep = {
  id?: number;
  stepName: string;
  stepDescription?: string;
  order: number;
};

export type WorkflowJobNames = {
  businessJobs: string[];
};

export type WorkflowJobSteps = {
  businessSteps: WorkflowJobStep[];
};

export type AvailableWorkflowJobSteps = {
  availableBusinessSteps: WorkflowJobStep[];
};

export type CobCatchUpStatus = {
  isCatchUpRunning: boolean;
};

export type LockedLoan = {
  loanId: number;
  lockPlacedOn?: string;
  lockOwner?: string;
  error?: string;
  stacktrace?: string;
};

export type LockedLoansPage = {
  content: LockedLoan[];
};

export type LoadFailure = {
  status?: number;
  message: string;
};

export type MakerCheckerSearchInput = {
  actionName?: string;
  entityName?: string;
  resourceId?: string;
  makerDateTimeFrom?: string;
  makerDateTimeTo?: string;
};

export type RescheduleLoanRequest = {
  id: number;
  loanId?: number;
  clientId?: number;
  clientName?: string;
  loanAccountNumber?: string;
  rescheduleReasonComment?: string;
  rescheduleReasonName?: string;
  submittedOnDate?: string | number | number[] | null;
  submittedByUsername?: string;
};
