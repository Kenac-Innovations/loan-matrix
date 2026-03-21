export interface Stage {
  id: string;
  name: string;
  description: string;
  color: string;
  isInitialState?: boolean;
  isFinalState?: boolean;
  allowedTransitions?: string[];
  fineractStatus?: string | null;
  fineractAction?: string | null;
}

export const defaultStages: Stage[] = [
  {
    id: "1",
    name: "New Lead",
    description: "Initial contact with potential client",
    color: "#3b82f6",
  },
  {
    id: "2",
    name: "Qualification",
    description: "Assessing lead requirements and fit",
    color: "#8b5cf6",
  },
  {
    id: "3",
    name: "Proposal",
    description: "Preparing and sending proposal",
    color: "#ec4899",
  },
  {
    id: "4",
    name: "Negotiation",
    description: "Discussing terms and conditions",
    color: "#f59e0b",
  },
  {
    id: "5",
    name: "Closed Won",
    description: "Successfully converted lead to customer",
    color: "#10b981",
  },
  {
    id: "6",
    name: "Closed Lost",
    description: "Lead did not convert to customer",
    color: "#ef4444",
  },
];

export const defaultStageColors = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#ef4444", // Red
  "#6b7280", // Gray
  "#84cc16", // Lime
  "#f97316", // Orange
  "#06b6d4", // Cyan
  "#8b5a2b", // Brown
  "#be123c", // Rose
];
