export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  approvalLimit?: number | null;
}

export type AssignmentStrategy = "round_robin" | "least_loaded" | "manual" | "specific_member";

export interface AssignmentConfig {
  specificMemberId?: string;
  lastAssignedIndex?: number;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
  pipelineStages: string[];
  assignmentStrategy?: AssignmentStrategy;
  assignmentConfig?: AssignmentConfig;
}

export const defaultTeams: Team[] = [
  {
    id: "1",
    name: "Sales Team",
    description: "Responsible for initial lead qualification and sales process",
    members: [
      {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        role: "Sales Manager",
        avatar: "/robert-johnson-avatar.png",
      },
      {
        id: "2",
        name: "Jane Smith",
        email: "jane@example.com",
        role: "Sales Representative",
      },
    ],
    pipelineStages: ["New Lead", "Qualification", "Proposal"],
  },
  {
    id: "2",
    name: "Finance Team",
    description: "Handles financial verification and approval",
    members: [
      {
        id: "3",
        name: "Robert Johnson",
        email: "robert@example.com",
        role: "Finance Manager",
      },
      {
        id: "4",
        name: "Sarah Williams",
        email: "sarah@example.com",
        role: "Financial Analyst",
      },
    ],
    pipelineStages: ["Negotiation"],
  },
  {
    id: "3",
    name: "Customer Success",
    description: "Manages onboarding and customer relationship",
    members: [
      {
        id: "5",
        name: "Michael Brown",
        email: "michael@example.com",
        role: "Customer Success Manager",
      },
    ],
    pipelineStages: ["Closed Won"],
  },
];

export const defaultPipelineStages = [
  "New Lead",
  "Qualification",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

export const defaultRoles = [
  "Sales Manager",
  "Sales Representative",
  "Finance Manager",
  "Financial Analyst",
  "Customer Success Manager",
  "Team Lead",
  "Team Member",
];
