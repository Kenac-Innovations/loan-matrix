export const ARDA_TENANT_NAME = "ARDA";
export const ARDA_TENANT_SLUG = "arda";
export const ARDA_TENANT_DOMAIN = "ardaloanmatrix.kenac.tech";

export type ArdaPipelineStagePlan = {
  name: string;
  description: string;
  order: number;
  color: string;
  isInitialState?: boolean;
  isFinalState?: boolean;
  fineractStatus?: string;
  fineractAction?: string;
};

export type ArdaTenantBootstrapPlan = {
  tenant: {
    name: string;
    slug: string;
    domain: string;
  };
  stages: ArdaPipelineStagePlan[];
  transitions: Record<string, string[]>;
};

export function buildArdaTenantBootstrapPlan(): ArdaTenantBootstrapPlan {
  return {
    tenant: {
      name: ARDA_TENANT_NAME,
      slug: ARDA_TENANT_SLUG,
      domain: ARDA_TENANT_DOMAIN,
    },
    stages: [
      {
        name: "New Lead",
        description: "ARDA agricultural-input credit application is being prepared.",
        order: 1,
        color: "#3b82f6",
        isInitialState: true,
        fineractStatus: "submitted_pending_approval",
      },
      {
        name: "Approval",
        description: "Approve the agricultural-input credit in Fineract.",
        order: 2,
        color: "#f59e0b",
        fineractStatus: "approved",
        fineractAction: "approve",
      },
      {
        name: "Disburse",
        description: "Issue the approved agricultural inputs and disburse the loan in Fineract.",
        order: 3,
        color: "#10b981",
        isFinalState: true,
        fineractStatus: "disbursed",
        fineractAction: "disburse",
      },
      {
        name: "Rejected",
        description: "ARDA agricultural-input credit application was rejected.",
        order: 4,
        color: "#ef4444",
        isFinalState: true,
      },
    ],
    transitions: {
      "New Lead": ["Approval", "Rejected"],
      Approval: ["Disburse", "Rejected"],
      Disburse: [],
      Rejected: [],
    },
  };
}
