export interface FieldOption {
  id: string;
  label: string;
  value: string;
}

export interface CustomField {
  id: string;
  name: string;
  label: string;
  type:
    | "text"
    | "number"
    | "email"
    | "phone"
    | "date"
    | "select"
    | "multiselect"
    | "checkbox"
    | "textarea";
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
  options?: FieldOption[];
  description?: string;
  visibleTo: string[];
}

export const defaultCustomFields: CustomField[] = [
  {
    id: "1",
    name: "company_name",
    label: "Company Name",
    type: "text",
    placeholder: "Enter company name",
    required: true,
    description: "Legal name of the company",
    visibleTo: ["Sales Team", "Finance Team", "Customer Success"],
  },
  {
    id: "2",
    name: "industry",
    label: "Industry",
    type: "select",
    required: true,
    options: [
      { id: "1", label: "Technology", value: "technology" },
      { id: "2", label: "Healthcare", value: "healthcare" },
      { id: "3", label: "Finance", value: "finance" },
      { id: "4", label: "Education", value: "education" },
      { id: "5", label: "Other", value: "other" },
    ],
    visibleTo: ["Sales Team"],
  },
  {
    id: "3",
    name: "annual_revenue",
    label: "Annual Revenue",
    type: "number",
    placeholder: "Enter annual revenue",
    required: false,
    visibleTo: ["Finance Team"],
  },
  {
    id: "4",
    name: "notes",
    label: "Additional Notes",
    type: "textarea",
    placeholder: "Enter any additional information",
    required: false,
    visibleTo: ["Sales Team", "Customer Success"],
  },
];

export const defaultFieldTypes = [
  { value: "text", label: "Text Input" },
  { value: "number", label: "Number Input" },
  { value: "email", label: "Email Input" },
  { value: "phone", label: "Phone Input" },
  { value: "date", label: "Date Picker" },
  { value: "select", label: "Dropdown Select" },
  { value: "multiselect", label: "Multi-Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "textarea", label: "Text Area" },
];

export const defaultFieldTeams = [
  "Sales Team",
  "Finance Team",
  "Customer Success",
  "Underwriting Team",
  "Legal Team",
];
