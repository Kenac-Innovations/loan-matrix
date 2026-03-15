export interface ValidationCondition {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "is_empty"
    | "is_not_empty"
    | "matches_regex";
  value?: string;
}

export interface ValidationAction {
  type: "block_progression" | "notify" | "auto_assign" | "set_field_value";
  message?: string;
  assignTo?: string;
  field?: string;
  value?: string;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  appliesTo: string[]; // Stage IDs
  conditions: ValidationCondition[];
  actions: ValidationAction[];
  severity: "info" | "warning" | "error";
}

export interface PipelineStage {
  id: string;
  name: string;
}

export interface Field {
  id: string;
  name: string;
}

export const defaultValidationRules: ValidationRule[] = [
  {
    id: "1",
    name: "Required Company Information",
    description: "Ensures company information is complete before moving to Qualification",
    enabled: true,
    appliesTo: ["1"], // New Lead stage
    conditions: [
      { field: "company_name", operator: "is_empty" },
      { field: "industry", operator: "is_empty" },
    ],
    actions: [
      {
        type: "block_progression",
        message: "Company name and industry must be provided before moving to Qualification",
      },
    ],
    severity: "error",
  },
  {
    id: "2",
    name: "Budget Validation",
    description: "Checks if budget information is available before proposal",
    enabled: true,
    appliesTo: ["2"], // Qualification stage
    conditions: [{ field: "annual_revenue", operator: "is_empty" }],
    actions: [
      {
        type: "notify",
        message: "Budget information is missing. Consider collecting this before proceeding.",
      },
    ],
    severity: "warning",
  },
  {
    id: "3",
    name: "Auto-assign to Finance Team",
    description: "Automatically assigns leads with high revenue to Finance Team",
    enabled: true,
    appliesTo: ["2", "3"], // Qualification and Proposal stages
    conditions: [
      { field: "annual_revenue", operator: "greater_than", value: "1000000" },
    ],
    actions: [
      {
        type: "auto_assign",
        assignTo: "Finance Team",
      },
    ],
    severity: "info",
  },
];

export const defaultPipelineStages: PipelineStage[] = [
  { id: "1", name: "New Lead" },
  { id: "2", name: "Qualification" },
  { id: "3", name: "Proposal" },
  { id: "4", name: "Negotiation" },
  { id: "5", name: "Closed Won" },
  { id: "6", name: "Closed Lost" },
];

export const defaultFields: Field[] = [
  { id: "company_name", name: "Company Name" },
  { id: "industry", name: "Industry" },
  { id: "annual_revenue", name: "Annual Revenue" },
  { id: "notes", name: "Additional Notes" },
  { id: "contact_name", name: "Contact Name" },
  { id: "contact_email", name: "Contact Email" },
  { id: "contact_phone", name: "Contact Phone" },
];

export const defaultOperators = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
  { value: "matches_regex", label: "Matches regex" },
];

export const defaultActionTypes = [
  { value: "block_progression", label: "Block progression to next stage" },
  { value: "notify", label: "Show notification" },
  { value: "auto_assign", label: "Auto-assign to team" },
  { value: "set_field_value", label: "Set field value" },
];

export const defaultTeams = ["Sales Team", "Finance Team", "Customer Success"];

export const defaultSeverityOptions = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error (Blocking)" },
];
