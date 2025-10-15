interface ValidationRule {
  id: string;
  name: string;
  description: string;
  field: string;
  operator: string;
  value: any;
  errorMessage: string;
  isActive: boolean;
  severity: ValidationSeverity;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  pipelineStageId: string | null;
}

export enum ValidationSeverity {
  ERROR = "ERROR",
  WARNING = "WARNING",
  INFO = "INFO",
}

interface ValidationResult {
  ruleId: string;
  ruleName: string;
  status: ValidationStatus;
  message: string;
  field?: string;
  value?: any;
}

export enum ValidationStatus {
  PASSED = "PASSED",
  FAILED = "FAILED",
  WARNING = "WARNING",
}
