"use server";

import { getTenantBySlug } from "@/lib/tenant-service";

// Types for USSD Loan Applications
export interface UssdLoanApplication {
  loanApplicationUssdId: number;
  messageId: string;
  referenceNumber: string;
  userPhoneNumber: string;
  loanMatrixClientId?: number;
  userFullName: string;
  userNationalId: string;
  
  // Loan Product Information
  loanMatrixLoanProductId: number;
  loanProductName: string;
  loanProductDisplayName: string;
  
  // Loan Details
  principalAmount: number;
  loanTermMonths: number;
  
  // Payout Information
  payoutMethod: string;
  mobileMoneyNumber?: string;
  mobileMoneyProvider?: string;
  branchName?: string;
  officeLocationId?: number;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  
  // Status Information
  status: "CREATED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DISBURSED" | "CANCELLED" | "EXPIRED";
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Queue specific fields
  source: string;
  channel: string;
  queuedAt: Date;
}

export interface UssdLeadsMetrics {
  totalApplications: number;
  pendingAction: number;
  approved: number;
  rejected: number;
  disbursed: number;
  underReview: number;
  cancelled: number;
  expired: number;
  monthlyTarget: number;
  approvalRate: number;
  averageProcessingTime: number; // in hours
}

export interface UssdLeadsData {
  applications: UssdLoanApplication[];
  metrics: UssdLeadsMetrics;
  totalCount: number;
}

// Dummy data for USSD applications
const generateDummyUssdApplications = (): UssdLoanApplication[] => {
  const statuses: UssdLoanApplication["status"][] = [
    "CREATED", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "DISBURSED", "CANCELLED", "EXPIRED"
  ];
  
  const payoutMethods = ["1", "2", "3"]; // 1: Mobile Money, 2: Cash Pickup, 3: Bank Transfer
  const mobileProviders = ["EcoCash", "OneMoney", "Telecash"];
  const loanProducts = [
    { id: 1, name: "Personal Loan", displayName: "Personal Loan - Up to $500" },
    { id: 2, name: "Business Loan", displayName: "Business Loan - Up to $2000" },
    { id: 3, name: "Emergency Loan", displayName: "Emergency Loan - Up to $200" },
  ];
  
  const names = [
    "John Moyo", "Sarah Chikwanda", "Peter Sibanda", "Grace Mwale", "David Phiri",
    "Mary Banda", "James Mwamba", "Ruth Mwila", "Michael Chanda", "Patience Ngoma",
    "Blessing Mwale", "Faith Chisenga", "Hope Mwansa", "Joy Mwila", "Peace Chanda"
  ];
  
  const applications: UssdLoanApplication[] = [];
  
  for (let i = 1; i <= 50; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const payoutMethod = payoutMethods[Math.floor(Math.random() * payoutMethods.length)];
    const product = loanProducts[Math.floor(Math.random() * loanProducts.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30));
    
    applications.push({
      loanApplicationUssdId: i,
      messageId: `MSG${String(i).padStart(6, '0')}`,
      referenceNumber: `REF${String(i).padStart(8, '0')}`,
      userPhoneNumber: `+263${Math.floor(Math.random() * 900000000) + 100000000}`,
      loanMatrixClientId: Math.random() > 0.3 ? Math.floor(Math.random() * 1000) + 1 : undefined,
      userFullName: name,
      userNationalId: `${Math.floor(Math.random() * 900000000) + 100000000}`,
      loanMatrixLoanProductId: product.id,
      loanProductName: product.name,
      loanProductDisplayName: product.displayName,
      principalAmount: Math.floor(Math.random() * 2000) + 100,
      loanTermMonths: [3, 6, 12, 24][Math.floor(Math.random() * 4)],
      payoutMethod,
      mobileMoneyNumber: payoutMethod === "1" ? `+263${Math.floor(Math.random() * 900000000) + 100000000}` : undefined,
      mobileMoneyProvider: payoutMethod === "1" ? mobileProviders[Math.floor(Math.random() * mobileProviders.length)] : undefined,
      branchName: payoutMethod === "2" ? ["Harare CBD", "Bulawayo CBD", "Mutare CBD"][Math.floor(Math.random() * 3)] : undefined,
      officeLocationId: payoutMethod === "2" ? Math.floor(Math.random() * 10) + 1 : undefined,
      bankAccountNumber: payoutMethod === "3" ? `${Math.floor(Math.random() * 9000000000) + 1000000000}` : undefined,
      bankName: payoutMethod === "3" ? ["CBZ", "Stanbic", "FBC", "NMB"][Math.floor(Math.random() * 4)] : undefined,
      bankBranch: payoutMethod === "3" ? ["Main Branch", "CBD Branch", "Industrial Branch"][Math.floor(Math.random() * 3)] : undefined,
      status,
      createdAt,
      updatedAt: new Date(createdAt.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000)),
      source: "USSD",
      channel: "USSD_LOAN_APPLICATION",
      queuedAt: createdAt,
    });
  }
  
  return applications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export async function getUssdLeadsData(
  tenantSlug: string,
  options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<UssdLeadsData> {
  try {
    const { status, limit = 50, offset = 0 } = options;

    // Get tenant
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Generate dummy data
    let applications = generateDummyUssdApplications();

    // Filter by status if provided
    if (status) {
      applications = applications.filter(app => app.status === status);
    }

    // Apply pagination
    const paginatedApplications = applications.slice(offset, offset + limit);

    // Calculate metrics
    const totalApplications = applications.length;
    const pendingAction = applications.filter(app => 
      ["CREATED", "SUBMITTED"].includes(app.status)
    ).length;
    const approved = applications.filter(app => app.status === "APPROVED").length;
    const rejected = applications.filter(app => app.status === "REJECTED").length;
    const disbursed = applications.filter(app => app.status === "DISBURSED").length;
    const underReview = applications.filter(app => app.status === "UNDER_REVIEW").length;
    const cancelled = applications.filter(app => app.status === "CANCELLED").length;
    const expired = applications.filter(app => app.status === "EXPIRED").length;
    
    const monthlyTarget = 100;
    const approvalRate = totalApplications > 0 ? Math.round((approved / totalApplications) * 100) : 0;
    const averageProcessingTime = 24; // hours

    const metrics: UssdLeadsMetrics = {
      totalApplications,
      pendingAction,
      approved,
      rejected,
      disbursed,
      underReview,
      cancelled,
      expired,
      monthlyTarget,
      approvalRate,
      averageProcessingTime,
    };

    return {
      applications: paginatedApplications,
      metrics,
      totalCount: totalApplications,
    };
  } catch (error) {
    console.error("Error fetching USSD leads:", error);
    throw new Error("Failed to fetch USSD leads data");
  }
}

export async function updateUssdApplicationStatus(
  applicationId: number,
  status: UssdLoanApplication["status"],
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // In a real implementation, this would update the database
    // For now, we'll simulate the update
    console.log(`Updating application ${applicationId} to status: ${status}`, notes ? `Notes: ${notes}` : '');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      message: `Application ${status.toLowerCase()} successfully`
    };
  } catch (error) {
    console.error("Error updating USSD application status:", error);
    return {
      success: false,
      message: "Failed to update application status"
    };
  }
}

export async function getUssdApplicationById(
  applicationId: number
): Promise<UssdLoanApplication | null> {
  try {
    // In a real implementation, this would fetch from the database
    const applications = generateDummyUssdApplications();
    return applications.find(app => app.loanApplicationUssdId === applicationId) || null;
  } catch (error) {
    console.error("Error fetching USSD application:", error);
    return null;
  }
}
