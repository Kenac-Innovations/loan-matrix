export interface ValidationConditionRule {
  field: string;
  operator: string;
  value?: any;
}

export interface ValidationConditions {
  type: "AND" | "OR";
  rules: ValidationConditionRule[];
}

export interface ValidationActions {
  onPass: { message: string };
  onFail: {
    message: string;
    suggestedAction?: string;
    actionUrl?: string;
  };
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  conditions: ValidationConditions;
  actions: ValidationActions;
  severity: "info" | "warning" | "error";
  enabled: boolean;
  order: number;
  pipelineStageId?: string | null;
  tab?: string | null;
}

export interface ValidationResult {
  id: string;
  name: string;
  description: string;
  status: "passed" | "failed" | "warning";
  message?: string;
  suggestedAction?: string;
  actionUrl?: string;
  severity: "info" | "warning" | "error";
}

export enum ValidationSeverity {
  ERROR = "ERROR",
  WARNING = "WARNING",
  INFO = "INFO",
}

export enum ValidationStatus {
  PASSED = "PASSED",
  FAILED = "FAILED",
  WARNING = "WARNING",
}
