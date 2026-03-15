export interface SLALevel {
  id: string;
  name: string;
  timeframe: number;
  timeUnit: "minutes" | "hours" | "days";
  escalation: boolean;
  notifyTeam: boolean;
  notifyManager: boolean;
  color: string;
}

export interface StageSLA {
  id: string;
  stageName: string;
  description: string;
  slaLevels: SLALevel[];
}

export const defaultStageSLAs: StageSLA[] = [
  {
    id: "1",
    stageName: "New Lead",
    description: "Initial contact with potential client",
    slaLevels: [
      {
        id: "1",
        name: "First Response",
        timeframe: 4,
        timeUnit: "hours",
        escalation: true,
        notifyTeam: true,
        notifyManager: false,
        color: "#3b82f6",
      },
      {
        id: "2",
        name: "Qualification",
        timeframe: 1,
        timeUnit: "days",
        escalation: true,
        notifyTeam: true,
        notifyManager: true,
        color: "#f59e0b",
      },
    ],
  },
  {
    id: "2",
    stageName: "Qualification",
    description: "Assessing lead requirements and fit",
    slaLevels: [
      {
        id: "3",
        name: "Requirements Gathering",
        timeframe: 2,
        timeUnit: "days",
        escalation: true,
        notifyTeam: true,
        notifyManager: false,
        color: "#3b82f6",
      },
    ],
  },
  {
    id: "3",
    stageName: "Proposal",
    description: "Preparing and sending proposal",
    slaLevels: [
      {
        id: "4",
        name: "Proposal Submission",
        timeframe: 3,
        timeUnit: "days",
        escalation: true,
        notifyTeam: true,
        notifyManager: false,
        color: "#3b82f6",
      },
    ],
  },
];

export const defaultTimeUnits = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
];

export const defaultSLAColors = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#ef4444", // Red
  "#6b7280", // Gray
  "#84cc16", // Lime
];
