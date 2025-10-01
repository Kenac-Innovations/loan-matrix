"use server";

import { getTenantBySlug } from "@/lib/tenant-service";
import prisma from "@/lib/prisma";

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
  paymentStatus?: string | null;
  
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

    // Build where clause
    const where: any = {
      tenantId: tenant.id,
    };

    if (status) {
      where.status = status;
    }

    // Get applications with pagination
    console.log('=== DEBUG: Table Query ===');
    console.log('Tenant ID:', tenant.id);
    console.log('Where clause:', JSON.stringify(where, null, 2));
    console.log('Limit:', limit, 'Offset:', offset);
    
    const applications = await prisma.ussdLoanApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    
    console.log('Raw applications count:', applications.length);
    console.log('First application (if any):', applications[0] ? JSON.stringify(applications[0], null, 2) : 'None');
    console.log('=== END DEBUG ===');

    // Get total count for pagination
    const totalCount = await prisma.ussdLoanApplication.count({ where });

    // Get all applications for metrics calculation (without pagination)
    console.log('=== DEBUG: Stats Query ===');
    console.log('Stats query tenant ID:', tenant.id);
    
    const allApplications = await prisma.ussdLoanApplication.findMany({
      where: { tenantId: tenant.id },
      select: { status: true, createdAt: true, processedAt: true }
    });
    
    console.log('Stats applications count:', allApplications.length);
    console.log('=== END DEBUG ===');

    // Calculate metrics
    const totalApplications = allApplications.length;
    const pendingAction = allApplications.filter(app => 
      ["CREATED", "SUBMITTED"].includes(app.status)
    ).length;
    const approved = allApplications.filter(app => app.status === "APPROVED").length;
    const rejected = allApplications.filter(app => app.status === "REJECTED").length;
    const disbursed = allApplications.filter(app => app.status === "DISBURSED").length;
    const underReview = allApplications.filter(app => app.status === "UNDER_REVIEW").length;
    const cancelled = allApplications.filter(app => app.status === "CANCELLED").length;
    const expired = allApplications.filter(app => app.status === "EXPIRED").length;
    
    // Calculate average processing time
    const processedApps = allApplications.filter(app => 
      app.processedAt && ["APPROVED", "REJECTED", "DISBURSED"].includes(app.status)
    );
    
    let averageProcessingTime = 0;
    if (processedApps.length > 0) {
      const totalProcessingTime = processedApps.reduce((sum, app) => {
        if (app.processedAt) {
          const processingTime = app.processedAt.getTime() - app.createdAt.getTime();
          return sum + processingTime;
        }
        return sum;
      }, 0);
      averageProcessingTime = Math.round(totalProcessingTime / processedApps.length / (1000 * 60 * 60)); // Convert to hours
    }
    
    const monthlyTarget = 100;
    const approvalRate = totalApplications > 0 ? Math.round((approved / totalApplications) * 100) : 0;

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

    // Convert database records to the expected interface format
    const formattedApplications: UssdLoanApplication[] = applications.map(app => ({
      loanApplicationUssdId: app.loanApplicationUssdId,
      messageId: app.messageId,
      referenceNumber: app.referenceNumber,
      userPhoneNumber: app.userPhoneNumber,
      loanMatrixClientId: app.loanMatrixClientId,
      userFullName: app.userFullName,
      userNationalId: app.userNationalId,
      loanMatrixLoanProductId: app.loanMatrixLoanProductId,
      loanProductName: app.loanProductName,
      loanProductDisplayName: app.loanProductDisplayName,
      principalAmount: app.principalAmount,
      loanTermMonths: app.loanTermMonths,
      payoutMethod: app.payoutMethod,
      mobileMoneyNumber: app.mobileMoneyNumber,
      mobileMoneyProvider: app.mobileMoneyProvider,
      branchName: app.branchName,
      officeLocationId: app.officeLocationId,
      bankAccountNumber: app.bankAccountNumber,
      bankName: app.bankName,
      bankBranch: app.bankBranch,
      status: app.status as UssdLoanApplication["status"],
      paymentStatus: app.paymentStatus,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      source: app.source,
      channel: app.channel,
      queuedAt: app.queuedAt,
    }));

    return {
      applications: formattedApplications,
      metrics,
      totalCount,
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
    // Find the application by loanApplicationUssdId
    const application = await prisma.ussdLoanApplication.findFirst({
      where: { loanApplicationUssdId: applicationId }
    });

    if (!application) {
      return {
        success: false,
        message: "Application not found"
      };
    }

    // Update the application status
    await prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: {
        status,
        processingNotes: notes,
        processedAt: new Date(),
        updatedAt: new Date(),
      }
    });

    console.log(`Updated application ${applicationId} to status: ${status}`, notes ? `Notes: ${notes}` : '');
    
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
    const application = await prisma.ussdLoanApplication.findFirst({
      where: { loanApplicationUssdId: applicationId }
    });

    if (!application) {
      return null;
    }

    // Convert database record to the expected interface format
    return {
      loanApplicationUssdId: application.loanApplicationUssdId,
      messageId: application.messageId,
      referenceNumber: application.referenceNumber,
      userPhoneNumber: application.userPhoneNumber,
      loanMatrixClientId: application.loanMatrixClientId,
      userFullName: application.userFullName,
      userNationalId: application.userNationalId,
      loanMatrixLoanProductId: application.loanMatrixLoanProductId,
      loanProductName: application.loanProductName,
      loanProductDisplayName: application.loanProductDisplayName,
      principalAmount: application.principalAmount,
      loanTermMonths: application.loanTermMonths,
      payoutMethod: application.payoutMethod,
      mobileMoneyNumber: application.mobileMoneyNumber,
      mobileMoneyProvider: application.mobileMoneyProvider,
      branchName: application.branchName,
      officeLocationId: application.officeLocationId,
      bankAccountNumber: application.bankAccountNumber,
      bankName: application.bankName,
      bankBranch: application.bankBranch,
      status: application.status as UssdLoanApplication["status"],
      paymentStatus: application.paymentStatus,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      source: application.source,
      channel: application.channel,
      queuedAt: application.queuedAt,
    };
  } catch (error) {
    console.error("Error fetching USSD application:", error);
    return null;
  }
}
