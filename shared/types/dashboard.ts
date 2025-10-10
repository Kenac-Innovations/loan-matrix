export interface DashboardData {
  summary: {
    totalLoans: {
      count: number;
      amount: number;
      currency?: {
        code: string;
        name: string;
        decimalPlaces: number;
        displaySymbol: string;
        displayLabel: string;
      };
    };
    activeClients: number;
    pendingApprovals: number;
    overdueLoans: number;
  };
  portfolioDistribution: Array<{
    name: string;
    count: number;
    amount: number;
  }>;
  riskAssessment: {
    low: number;
    medium: number;
    high: number;
    total: number;
  };
  recentApplications: Array<{
    id: string | number;
    clientName: string;
    amount: number;
    productName: string;
    status: string;
    submittedDate: string;
    type: ApplicationType;
    currency?: {
      code: string;
      displaySymbol: string;
    };
  }>;
  loanProducts: Array<any>;
}

export enum ApplicationType {
  LEAD = "lead",
  LOAN = "loan",
}

export interface Stat {
  title: string;
  value: string | number;
  delta?: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  description?: string;
  trend?: Trend;
}

export enum Trend {
  UP = "up",
  DOWN = "down",
  NEUTRAL = "neutral",
}
