import axios, { AxiosInstance, AxiosResponse } from "axios";
import { error } from "console";

export interface FineractConfig {
  baseUrl: string;
  username: string;
  password: string;
  tenantId: string;
}

export interface FineractClient {
  id: number;
  accountNo: string;
  externalId?: string;
  status: {
    id: number;
    code: string;
    value: string;
  };
  active: boolean;
  activationDate?: string | number[];
  firstname: string;
  middlename?: string;
  lastname: string;
  displayName: string;
  mobileNo?: string;
  emailAddress?: string;
  dateOfBirth?: string | number[];
  gender?: {
    id: number;
    name: string;
  };
  clientType?: {
    id: number;
    name: string;
  };
  clientClassification?: {
    id: number;
    name: string;
  };
  officeId: number;
  officeName: string;
  staffId?: number;
  staffName?: string;
  timeline: {
    submittedOnDate: string | number[];
    submittedByUsername: string;
    activatedOnDate?: string | number[];
    activatedByUsername?: string;
    activatedByFirstname?: string;
    activatedByLastname?: string;
  };
  savingsAccountId?: number;
  clientNonPersonDetails?: any;
  clientCollateralManagements?: any[];
  groups?: any[];
  legalForm?: {
    id: number;
    code: string;
    value: string;
  };
}

export interface FineractLoan {
  id: number;
  accountNo: string;
  externalId?: string;
  clientId: number;
  clientName: string;
  clientOfficeId: number;
  loanProductId: number;
  loanProductName: string;
  loanProductDescription?: string;
  fundId?: number;
  fundName?: string;
  loanOfficerId?: number;
  loanOfficerName?: string;
  loanType: {
    id: number;
    code: string;
    value: string;
  };
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    inMultiplesOf: number;
    displaySymbol: string;
    nameCode: string;
    displayLabel: string;
  };
  principal: number;
  approvedPrincipal: number;
  proposedPrincipal: number;
  termFrequency: number;
  termPeriodFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  interestRatePerPeriod: number;
  interestRateFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  annualInterestRate: number;
  amortizationType: {
    id: number;
    code: string;
    value: string;
  };
  interestType: {
    id: number;
    code: string;
    value: string;
  };
  interestCalculationPeriodType: {
    id: number;
    code: string;
    value: string;
  };
  allowPartialPeriodInterestCalcualtion: boolean;
  transactionProcessingStrategyId: number;
  transactionProcessingStrategyName: string;
  graceOnPrincipalPayment?: number;
  recurringMoratoriumOnPrincipalPeriods?: number;
  graceOnInterestPayment?: number;
  graceOnInterestCharged?: number;
  interestChargedFromDate?: string;
  timeline: {
    submittedOnDate: string;
    submittedByUsername: string;
    submittedByFirstname: string;
    submittedByLastname: string;
    approvedOnDate?: string;
    approvedByUsername?: string;
    approvedByFirstname?: string;
    approvedByLastname?: string;
    expectedDisbursementDate?: string;
    actualDisbursementDate?: string;
    disbursedByUsername?: string;
    disbursedByFirstname?: string;
    disbursedByLastname?: string;
    closedOnDate?: string;
    closedByUsername?: string;
    closedByFirstname?: string;
    closedByLastname?: string;
    expectedMaturityDate?: string;
  };
  summary: {
    currency: any;
    principalDisbursed: number;
    principalPaid: number;
    principalWrittenOff: number;
    principalOutstanding: number;
    principalOverdue: number;
    interestCharged: number;
    interestPaid: number;
    interestWaived: number;
    interestWrittenOff: number;
    interestOutstanding: number;
    interestOverdue: number;
    feeChargesCharged: number;
    feeChargesDueAtDisbursementCharged: number;
    feeChargesPaid: number;
    feeChargesWaived: number;
    feeChargesWrittenOff: number;
    feeChargesOutstanding: number;
    feeChargesOverdue: number;
    penaltyChargesCharged: number;
    penaltyChargesPaid: number;
    penaltyChargesWaived: number;
    penaltyChargesWrittenOff: number;
    penaltyChargesOutstanding: number;
    penaltyChargesOverdue: number;
    totalExpectedRepayment: number;
    totalRepayment: number;
    totalExpectedCostOfLoan: number;
    totalCostOfLoan: number;
    totalWaived: number;
    totalWrittenOff: number;
    totalOutstanding: number;
    totalOverdue: number;
    overdueSinceDate?: string;
  };
  status: {
    id: number;
    code: string;
    value: string;
    pendingApproval: boolean;
    waitingForDisbursal: boolean;
    active: boolean;
    closedObligationsMet: boolean;
    closedWrittenOff: boolean;
    closedRescheduled: boolean;
    closed: boolean;
    overpaid: boolean;
  };
}

export interface FineractLoanProduct {
  id: number;
  name: string;
  shortName: string;
  description?: string;
  fundId?: number;
  fundName?: string;
  includeInBorrowerCycle: boolean;
  useBorrowerCycle: boolean;
  startDate?: string;
  endDate?: string;
  status: string;
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    inMultiplesOf: number;
    displaySymbol: string;
    nameCode: string;
    displayLabel: string;
  };
  principal: {
    min: number;
    max: number;
    default: number;
  };
  numberOfRepayments: {
    min: number;
    max: number;
    default: number;
  };
  repaymentEvery: number;
  repaymentFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  interestRatePerPeriod: {
    min: number;
    max: number;
    default: number;
  };
  interestRateFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  annualInterestRate: {
    min: number;
    max: number;
    default: number;
  };
  amortizationType: {
    id: number;
    code: string;
    value: string;
  };
  interestType: {
    id: number;
    code: string;
    value: string;
  };
  interestCalculationPeriodType: {
    id: number;
    code: string;
    value: string;
  };
  transactionProcessingStrategyId: number;
  transactionProcessingStrategyName: string;
  charges: any[];
  accountingRule: {
    id: number;
    code: string;
    value: string;
  };
  accountingMappings?: any;
  paymentChannelToFundSourceMappings?: any[];
  feeToIncomeAccountMappings?: any[];
  penaltyToIncomeAccountMappings?: any[];
  chargeToIncomeAccountMappings?: any[];
  allowAttributeOverrides: {
    amortizationType: boolean;
    interestType: boolean;
    transactionProcessingStrategyId: boolean;
    interestCalculationPeriodType: boolean;
    inArrearsTolerance: boolean;
    repaymentEvery: boolean;
    graceOnPrincipalAndInterestPayment: boolean;
    graceOnArrearsAgeing: boolean;
  };
}

export interface FineractTransaction {
  id: number;
  officeId: number;
  officeName: string;
  type: {
    id: number;
    code: string;
    value: string;
    disbursement: boolean;
    repaymentAtDisbursement: boolean;
    repayment: boolean;
    contra: boolean;
    waiveInterest: boolean;
    waiveCharges: boolean;
    accrual: boolean;
    writeOff: boolean;
    recoveryRepayment: boolean;
    initiateTransfer: boolean;
    approveTransfer: boolean;
    withdrawTransfer: boolean;
    rejectTransfer: boolean;
    chargePayment: boolean;
    refund: boolean;
    chargeback: boolean;
  };
  date: string;
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    inMultiplesOf: number;
    displaySymbol: string;
    nameCode: string;
    displayLabel: string;
  };
  amount: number;
  principalPortion?: number;
  interestPortion?: number;
  feeChargesPortion?: number;
  penaltyChargesPortion?: number;
  overpaymentPortion?: number;
  unrecognizedIncomePortion?: number;
  outstandingLoanBalance?: number;
  submittedOnDate: string;
  manuallyReversed: boolean;
  loanChargePaidByList?: any[];
}

export interface AccountingRuleAccount {
  id: number;
  name: string;
  glCode: string;
}

export interface AccountingRuleTag {
  id: number;
  name: string;
  position: number;
  description: string;
  active: boolean;
  mandatory: boolean;
}

export interface AccountingRuleCreditTag {
  id: number;
  tag: {
    id: number;
    name: string;
    active: boolean;
    mandatory: boolean;
  };
  transactionType: {
    id: number;
    code: string;
    value: string;
  };
}

export interface FineractAccountingRule {
  id: number;
  officeId: number;
  officeName: string;
  name: string;
  description: string;
  systemDefined: boolean;
  allowMultipleDebitEntries: boolean;
  allowMultipleCreditEntries: boolean;
  allowedOffices: any[];
  allowedAccounts: any[];
  creditAccounts?: AccountingRuleAccount[];
  debitAccounts?: AccountingRuleAccount[];
  creditTags?: AccountingRuleCreditTag[];
  debitTags?: AccountingRuleCreditTag[];
}

export interface AccountingRuleTemplate {
  systemDefined: boolean;
  allowMultipleDebitEntries: boolean;
  allowMultipleCreditEntries: boolean;
  allowedOffices: any[];
  allowedAccounts: any[];
  allowedCreditTagOptions: AccountingRuleTag[];
  allowedDebitTagOptions: AccountingRuleTag[];
}

export class FineractAPIService {
  private client: AxiosInstance;
  private clientV2: AxiosInstance;
  private config: FineractConfig;

  constructor(config: FineractConfig, authToken?: string) {
    this.config = config;

    const headers: any = {
      "Fineract-Platform-TenantId": config.tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Use session token if provided, otherwise fall back to username/password
    if (authToken) {
      headers.Authorization = `Basic ${authToken}`;
    }

    this.client = axios.create({
      baseURL: `${config.baseUrl}/fineract-provider/api/v1`,
      ...(!authToken && {
        auth: {
          username: config.username,
          password: config.password,
        },
      }),
      headers,
      timeout: 30000,
    });

    // Create a separate client for v2 endpoints
    this.clientV2 = axios.create({
      baseURL: `${config.baseUrl}/fineract-provider/api/v2`,
      ...(!authToken && {
        auth: {
          username: config.username,
          password: config.password,
        },
      }),
      headers,
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(
          "Fineract API Error:",
          error.response?.data || error.message
        );
        throw error;
      }
    );
  }

  // Client operations
  async getClients(offset = 0, limit = 100): Promise<FineractClient[]> {
    const response: AxiosResponse<FineractClient[]> = await this.client.get(
      `/clients?offset=${offset}&limit=${limit}&orderBy=id&sortOrder=desc`
    );
    return response.data;
  }

  async getClient(clientId: number): Promise<FineractClient> {
    const response: AxiosResponse<FineractClient> = await this.client.get(
      `/clients/${clientId}`
    );
    console.log(
      "==========> log on server side getClient response ::",
      response.data
    );
    return response.data;
  }

  async updateClient(
    clientId: number,
    clientData: Partial<FineractClient>
  ): Promise<FineractClient> {
    const response: AxiosResponse<FineractClient> = await this.client.put(
      `/clients/${clientId}`,
      clientData
    );
    return response.data;
  }

  async searchClients(query: string): Promise<FineractClient[]> {
    const response: AxiosResponse<FineractClient[]> = await this.client.get(
      `/search?query=${encodeURIComponent(query)}&resource=clients`
    );
    return response.data;
  }

  async searchClientsV2(
    query?: string,
    offset = 0,
    limit = 100
  ): Promise<FineractClient[]> {
    let url = `/clients/search?offset=${offset}&limit=${limit}`;
    if (query) {
      url += `&query=${encodeURIComponent(query)}`;
    }
    const response: AxiosResponse<FineractClient[]> = await this.clientV2.get(
      url
    );
    return response.data;
  }

  // Loan operations
  async getLoans(offset = 0, limit = 100): Promise<FineractLoan[]> {
    console.log("Fineract getLoans called with:", { offset, limit });
    
    const response: AxiosResponse<FineractLoan[]> = await this.client.get(
      `/loans?offset=${offset}&limit=${limit}&orderBy=id&sortOrder=desc`
    );
    
    console.log("Fineract getLoans response:", {
      status: response.status,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      length: Array.isArray(response.data) ? response.data.length : 'N/A',
      hasPageItems: !!response.data?.pageItems,
      hasContent: !!response.data?.content,
      fullResponse: response.data
    });
    
    return response.data;
  }

  async getLoan(loanId: number): Promise<FineractLoan> {
    const response: AxiosResponse<FineractLoan> = await this.client.get(
      `/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`
    );
    return response.data;
  }

  async getClientLoans(clientId: number): Promise<FineractLoan[]> {
    const response: AxiosResponse<FineractLoan[]> = await this.client.get(
      `/clients/${clientId}/accounts`
    );
    console.log(
      "==========> log on server side getClientLoans response ::",
      response.data
    );
    return response.data;
  }

  async getOverdueLoans(): Promise<FineractLoan[]> {
    const response: AxiosResponse<FineractLoan[]> = await this.client.get(
      `/loans?sqlSearch=l.loan_status_id = 300 AND l.total_outstanding_derived > 0 AND DATEDIFF(CURDATE(), l.expected_maturedon_date) > 0`
    );
    return response.data;
  }

  // Loan product operations
  async getLoanProducts(): Promise<FineractLoanProduct[]> {
    const response: AxiosResponse<FineractLoanProduct[]> =
      await this.client.get("/loanproducts");
    return response.data;
  }

  async getLoanProduct(productId: number): Promise<FineractLoanProduct> {
    const response: AxiosResponse<FineractLoanProduct> = await this.client.get(
      `/loanproducts/${productId}`
    );
    return response.data;
  }

  // Transaction operations
  async getLoanTransactions(loanId: number): Promise<FineractTransaction[]> {
    const response: AxiosResponse<{ transactions: FineractTransaction[] }> =
      await this.client.get(`/loans/${loanId}/transactions`);
    return response.data.transactions || [];
  }

  async getClientTransactions(
    clientId: number
  ): Promise<FineractTransaction[]> {
    const loans = await this.getClientLoans(clientId);
    const allTransactions: FineractTransaction[] = [];

    for (const loan of loans) {
      const transactions = await this.getLoanTransactions(loan.id);
      allTransactions.push(...transactions);
    }

    return allTransactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  // Reports and analytics
  async getPortfolioSummary(): Promise<any> {
    const response = await this.client.get("/runreports/PortfolioAtRisk");
    return response.data;
  }

  // Run Fineract reports
  async runReport(
    reportName: string,
    parameters: Record<string, any> = {}
  ): Promise<any> {
    const encodedReportName = encodeURIComponent(reportName);
    const params = new URLSearchParams();

    // Add parameters with R_ prefix as required by Fineract
    Object.entries(parameters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        const paramKey = key.startsWith("R_") ? key : `R_${key}`;
        params.append(paramKey, value.toString());
      }
    });

    const queryString = params.toString();
    const url = `/runreports/${encodedReportName}${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await this.client.get(url);
    return response.data;
  }

  // Get available reports
  async getReports(): Promise<any[]> {
    const response = await this.client.get("/reports");
    return response.data;
  }

  // Get report parameters using FullParameterList
  async getReportParameters(reportName: string): Promise<any> {
    const encodedReportName = encodeURIComponent(`'${reportName}'`);
    const response = await this.client.get(
      `/runreports/FullParameterList?R_reportListing=${encodedReportName}&parameterType=true`
    );
    return response.data;
  }

  // Get parameter options (for select dropdowns)
  async getParameterOptions(parameterName: string): Promise<any> {
    const response = await this.client.get(
      `/runreports/${parameterName}?parameterType=true`
    );
    return response.data;
  }

  async getCollectionSheet(
    officeId?: number,
    staffId?: number,
    meetingDate?: string
  ): Promise<any> {
    let url = "/collectionsheet";
    const params = new URLSearchParams();

    if (officeId) params.append("officeId", officeId.toString());
    if (staffId) params.append("staffId", staffId.toString());
    if (meetingDate) params.append("meetingDate", meetingDate);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await this.client.get(url);
    return response.data;
  }

  // Office operations
  async getOffices(): Promise<any[]> {
    const response = await this.client.get("/offices");
    return response.data;
  }

  // Staff operations
  async getStaff(officeId?: number): Promise<any[]> {
    let url = "/staff";
    if (officeId) {
      url += `?officeId=${officeId}`;
    }
    const response = await this.client.get(url);
    return response.data;
  }

  // Generic search
  async search(query: string, resource?: string): Promise<any[]> {
    let url = `/search?query=${encodeURIComponent(query)}`;
    if (resource) {
      url += `&resource=${resource}`;
    }
    const response = await this.client.get(url);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get("/offices");
      return true;
    } catch (error) {
      return false;
    }
  }

  // Accounting Rules operations
  async getAccountingRules(
    url = "/accountingrules"
  ): Promise<FineractAccountingRule[]> {
    try {
      const response: AxiosResponse<FineractAccountingRule[]> =
        await this.client.get(url);
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async getAccountingRule(id: string): Promise<FineractAccountingRule> {
    try {
      const response: AxiosResponse<FineractAccountingRule> =
        await this.client.get(`/accountingrules/${id}`);
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async getAccountingRulesTemplate(): Promise<AccountingRuleTemplate> {
    try {
      const response: AxiosResponse<AccountingRuleTemplate> =
        await this.client.get("/accountingrules/template");
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async createAccountingRule(data: any): Promise<FineractAccountingRule> {
    try {
      const response: AxiosResponse<FineractAccountingRule> =
        await this.client.post("/accountingrules", data);
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async updateAccountingRule(
    id: string,
    data: any
  ): Promise<FineractAccountingRule> {
    try {
      const response: AxiosResponse<FineractAccountingRule> =
        await this.client.put(`/accountingrules/${id}`, data);
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async deleteAccountingRule(id: string): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.delete(
        `/accountingrules/${id}`
      );
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }
}

// Singleton instance for fallback
let fineractService: FineractAPIService | null = null;

export function getFineractService(
  authToken: string,
  tenantId?: string
): FineractAPIService {
  // If we have an auth token, create a new instance with it
  if (authToken) {
    const config: FineractConfig = {
      baseUrl: process.env.FINERACT_BASE_URL || "https://demo.fineract.dev",
      username: "", // Not needed when using token
      password: "", // Not needed when using token
      tenantId: tenantId || process.env.FINERACT_TENANT_ID || "default",
    };
    return new FineractAPIService(config, authToken);
  }

  // Fallback to singleton with env credentials
  if (!fineractService) {
    const config: FineractConfig = {
      baseUrl: process.env.FINERACT_BASE_URL || "https://demo.fineract.dev",
      username: process.env.FINERACT_USERNAME || "mifos",
      password: process.env.FINERACT_PASSWORD || "password",
      tenantId: tenantId || process.env.FINERACT_TENANT_ID || "default",
    };
    fineractService = new FineractAPIService(config);
  }
  return fineractService;
}

export async function getFineractServiceWithSession(): Promise<FineractAPIService> {
  try {
    const { getSession } = await import("./auth");
    const { getFineractTenantId } = await import("./fineract-tenant-service");

    const session = await getSession();
    const fineractTenantId = await getFineractTenantId();

    console.log("Fineract Service Debug:", {
      hasSession: !!session,
      hasAuthKey: !!session?.base64EncodedAuthenticationKey,
      fineractTenantId,
      sessionKeys: session ? Object.keys(session) : null,
    });

    if (session?.base64EncodedAuthenticationKey) {
      return getFineractService(
        session.base64EncodedAuthenticationKey,
        fineractTenantId
      );
    }

    // Fallback: try to create service with environment credentials
    console.warn(
      "No session auth key found, falling back to environment credentials"
    );
    const config: FineractConfig = {
      baseUrl: process.env.FINERACT_BASE_URL || "https://demo.fineract.dev",
      username: process.env.FINERACT_USERNAME || "mifos",
      password: process.env.FINERACT_PASSWORD || "password",
      tenantId: fineractTenantId || process.env.FINERACT_TENANT_ID || "default",
    };

    return new FineractAPIService(config);
  } catch (error) {
    console.error("Error in getFineractServiceWithSession:", error);
    throw new Error(
      `Failed to initialize Fineract service: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
