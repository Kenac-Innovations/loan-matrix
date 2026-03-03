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
  /** Payment details when transaction has a payment type (e.g. disbursement, repayment) */
  paymentDetailData?: {
    id?: number;
    paymentType?: { id: number; name: string };
  };
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

    console.log("FineractAPIService initialized with tenant:", config.tenantId);

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

  async createClient(clientData: any): Promise<FineractClient> {
    try {
      console.log(
        "==========> Sending client data to Fineract:",
        JSON.stringify(clientData, null, 2)
      );

      const response: AxiosResponse<FineractClient> = await this.client.post(
        `/clients`,
        clientData
      );

      console.log(
        "==========> Fineract createClient SUCCESS response ::",
        response.data
      );
      return response.data;
    } catch (error: any) {
      console.error("==========> Fineract createClient ERROR ::", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
        },
      });
      throw error;
    }
  }

  async deleteClient(clientId: number): Promise<void> {
    try {
      console.log(`==========> Deleting Fineract client ${clientId}`);

      const response = await this.client.delete(`/clients/${clientId}`);

      console.log(
        `==========> Fineract deleteClient SUCCESS for client ${clientId}`
      );
    } catch (error: any) {
      console.error(
        `==========> Fineract deleteClient ERROR for client ${clientId} ::`,
        {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
          },
        }
      );
      throw error;
    }
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

    const response: AxiosResponse<any> = await this.client.get(
      `/loans?offset=${offset}&limit=${limit}&orderBy=id&sortOrder=desc`
    );

    console.log("Fineract getLoans response:", {
      status: response.status,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      length: Array.isArray(response.data) ? response.data.length : "N/A",
      hasPageItems: !!response.data?.pageItems,
      hasContent: !!response.data?.content,
      fullResponse: response.data,
    });

    // Handle different response structures
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (
      response.data?.pageItems &&
      Array.isArray(response.data.pageItems)
    ) {
      return response.data.pageItems;
    } else if (response.data?.content && Array.isArray(response.data.content)) {
      return response.data.content;
    } else if (response.data?.loans && Array.isArray(response.data.loans)) {
      return response.data.loans;
    } else {
      console.warn(
        "Unexpected response structure from Fineract loans API:",
        response.data
      );
      return [];
    }
  }

  async getLoan(loanId: number): Promise<FineractLoan> {
    const response: AxiosResponse<FineractLoan> = await this.client.get(
      `/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`
    );
    return response.data;
  }

  async searchLoansByExternalId(externalId: string): Promise<FineractLoan[]> {
    const response: AxiosResponse<any> = await this.client.get(
      `/loans?externalId=${encodeURIComponent(externalId)}`
    );

    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data?.pageItems)) {
      return data.pageItems;
    }
    if (Array.isArray(data?.content)) {
      return data.content;
    }
    return [];
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
    // First try: get loan with transactions association (most reliable)
    try {
      const response = await this.client.get(`/loans/${loanId}?associations=transactions`);
      const data = response.data;
      if (data?.transactions && Array.isArray(data.transactions)) {
        return data.transactions;
      }
    } catch {
      // Fall through to alternative endpoint
    }

    // Second try: direct transactions endpoint
    const response = await this.client.get(`/loans/${loanId}/transactions`);
    const data = response.data;

    // Handle different Fineract response formats
    if (Array.isArray(data)) {
      return data;
    }
    if (data?.transactions && Array.isArray(data.transactions)) {
      return data.transactions;
    }
    if (data?.pageItems && Array.isArray(data.pageItems)) {
      return data.pageItems;
    }

    return [];
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

  // Teller operations
  async getTellers(officeId?: number): Promise<any[]> {
    try {
      let url = "/tellers";
      if (officeId) {
        url += `?officeId=${officeId}`;
      }
      console.log("Fetching tellers from Fineract:", url);
      const response: AxiosResponse<any> = await this.client.get(url);

      console.log("Fineract getTellers response:", {
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        length: Array.isArray(response.data) ? response.data.length : "N/A",
        data: JSON.stringify(response.data).substring(0, 500),
      });

      // Handle different response structures
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (
        response.data?.pageItems &&
        Array.isArray(response.data.pageItems)
      ) {
        return response.data.pageItems;
      } else if (
        response.data?.content &&
        Array.isArray(response.data.content)
      ) {
        return response.data.content;
      }
      return [];
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async getTeller(tellerId: number): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.get(
        `/tellers/${tellerId}`
      );
      return response.data;
    } catch (error: any) {
      console.error("Fineract API Error getting teller:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async createTeller(tellerData: any): Promise<any> {
    try {
      console.log(
        "Creating teller with data:",
        JSON.stringify(tellerData, null, 2)
      );
      const response: AxiosResponse<any> = await this.client.post(
        "/tellers",
        tellerData
      );
      return response.data;
    } catch (error: any) {
      console.error("Fineract API Error creating teller:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async updateTeller(tellerId: number, tellerData: any): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.put(
        `/tellers/${tellerId}`,
        tellerData
      );
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async deleteTeller(tellerId: number): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.delete(
        `/tellers/${tellerId}`
      );
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  // Cashier operations
  async getCashiers(tellerId: number): Promise<any[]> {
    try {
      // First try without date parameters to get all cashiers
      const response: AxiosResponse<any> = await this.client.get(
        `/tellers/${tellerId}/cashiers`
      );

      console.log(
        "Fineract getCashiers response:",
        JSON.stringify(response.data, null, 2)
      );

      // Handle different response structures
      // Fineract returns: { tellerId, tellerName, officeId, officeName, cashiers: [...] }
      if (response.data?.cashiers && Array.isArray(response.data.cashiers)) {
        return response.data.cashiers;
      } else if (Array.isArray(response.data)) {
        return response.data;
      } else if (
        response.data?.pageItems &&
        Array.isArray(response.data.pageItems)
      ) {
        return response.data.pageItems;
      } else if (
        response.data?.content &&
        Array.isArray(response.data.content)
      ) {
        return response.data.content;
      }
      return [];
    } catch (error: any) {
      console.error("Fineract API Error getting cashiers:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async getCashier(tellerId: number, cashierId: number): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.get(
        `/tellers/${tellerId}/cashiers/${cashierId}`
      );
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async createCashier(
    tellerId: number,
    cashierData: {
      staffId: number;
      description?: string;
      startDate: string;
      endDate?: string;
      isFullDay: boolean;
      dateFormat?: string;
      locale?: string;
    }
  ): Promise<any> {
    try {
      const payload = {
        staffId: cashierData.staffId,
        description: cashierData.description || "",
        startDate: cashierData.startDate,
        endDate: cashierData.endDate || "",
        isFullDay: cashierData.isFullDay,
        dateFormat: cashierData.dateFormat || "dd MMMM yyyy",
        locale: cashierData.locale || "en",
      };
      console.log(
        "Creating cashier with data:",
        JSON.stringify(payload, null, 2)
      );
      const response: AxiosResponse<any> = await this.client.post(
        `/tellers/${tellerId}/cashiers`,
        payload
      );
      return response.data;
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        errors: error.response?.data?.errors,
      };
      console.error(
        "Fineract API Error creating cashier:",
        JSON.stringify(errorDetails, null, 2)
      );
      throw error;
    }
  }

  async allocateCashToTeller(
    tellerId: number,
    allocationData: {
      amount: number;
      currency?: string;
      date?: string;
      notes?: string;
    }
  ): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.post(
        `/tellers/${tellerId}/cashiers/allocate`,
        allocationData
      );
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async allocateCashToCashier(
    tellerId: number,
    cashierId: number,
    allocationData: {
      txnDate: string;
      currencyCode: string;
      txnAmount: string;
      txnNote?: string;
      dateFormat?: string;
      locale?: string;
    }
  ): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.post(
        `/tellers/${tellerId}/cashiers/${cashierId}/allocate`,
        {
          ...allocationData,
          dateFormat: allocationData.dateFormat || "dd MMMM yyyy",
          locale: allocationData.locale || "en",
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("Fineract API Error allocating cash to cashier:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async settleCashForCashier(
    tellerId: number,
    cashierId: number,
    settlementData: {
      txnDate: string;
      currencyCode: string;
      txnAmount: string;
      txnNote?: string;
      dateFormat?: string;
      locale?: string;
    }
  ): Promise<any> {
    try {
      // Use the settle command for cash out transactions
      const response: AxiosResponse<any> = await this.client.post(
        `/tellers/${tellerId}/cashiers/${cashierId}/settle`,
        {
          ...settlementData,
          dateFormat: settlementData.dateFormat || "dd MMMM yyyy",
          locale: settlementData.locale || "en",
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("Fineract API Error settling cash for cashier:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async getCashierSummaryAndTransactions(
    tellerId: number,
    cashierId: number,
    currencyCode: string,
    options?: { offset?: number; limit?: number }
  ): Promise<any> {
    try {
      const params = new URLSearchParams({ currencyCode });
      if (options?.offset != null) params.set("offset", String(options.offset));
      if (options?.limit != null) params.set("limit", String(options.limit));
      const url = `/tellers/${tellerId}/cashiers/${cashierId}/summaryandtransactions?${params}`;
      console.log("Fetching cashier summary and transactions:", url);
      const response: AxiosResponse<any> = await this.client.get(url);
      console.log(
        "Cashier summary response:",
        JSON.stringify(response.data, null, 2).substring(0, 500)
      );
      return response.data;
    } catch (error: any) {
      console.error("Fineract API Error getting cashier summary:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async getCashierTransactions(
    tellerId: number,
    cashierId: number,
    currencyCode: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any[]> {
    try {
      // Use summaryandtransactions endpoint which includes transactions
      const url = `/tellers/${tellerId}/cashiers/${cashierId}/summaryandtransactions?currencyCode=${currencyCode}`;
      const response: AxiosResponse<any> = await this.client.get(url);

      // Extract transactions from the response
      if (
        response.data?.cashierTransactions &&
        Array.isArray(response.data.cashierTransactions)
      ) {
        return response.data.cashierTransactions;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async getTellerSummary(tellerId: number): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.get(
        `/tellers/${tellerId}/summary`
      );
      return response.data;
    } catch (error) {
      console.error("Fineract API Error:", error);
      throw error;
    }
  }

  async getCurrencies(): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.get("/currencies");
      return response.data;
    } catch (error) {
      console.error("Fineract API Error getting currencies:", error);
      throw error;
    }
  }

  // Session management
  async startCashierSession(
    tellerId: number,
    cashierId: number,
    sessionData?: {
      dateFormat?: string;
      locale?: string;
    }
  ): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.post(
        `/tellers/${tellerId}/cashiers/${cashierId}?command=activate`,
        {
          dateFormat: sessionData?.dateFormat || "dd MMMM yyyy",
          locale: sessionData?.locale || "en",
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("Fineract API Error starting session:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async closeCashierSession(
    tellerId: number,
    cashierId: number,
    closeData: {
      txnDate: string;
      txnAmount: string;
      txnNote?: string;
      dateFormat?: string;
      locale?: string;
    }
  ): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.post(
        `/tellers/${tellerId}/cashiers/${cashierId}?command=settle`,
        {
          ...closeData,
          dateFormat: closeData.dateFormat || "dd MMMM yyyy",
          locale: closeData.locale || "en",
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("Fineract API Error closing session:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async getCashierSession(tellerId: number, cashierId: number): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.get(
        `/tellers/${tellerId}/cashiers/${cashierId}`
      );
      return response.data;
    } catch (error: any) {
      console.error("Fineract API Error getting session:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  // User operations
  async getUsers(): Promise<any[]> {
    try {
      const response: AxiosResponse<any[]> = await this.client.get("/users");
      return response.data || [];
    } catch (error: any) {
      console.error("Error fetching Fineract users:", error.message);
      throw error;
    }
  }

  // Loan Officer Assignment
  async assignLoanOfficer(
    loanId: number,
    loanOfficerId: number,
    assignmentDate?: string
  ): Promise<any> {
    try {
      const today = new Date();
      const formattedDate = assignmentDate || 
        `${today.getDate()} ${today.toLocaleString('en', { month: 'long' })} ${today.getFullYear()}`;
      
      const response: AxiosResponse<any> = await this.client.post(
        `/loans/${loanId}?command=assignLoanOfficer`,
        {
          toLoanOfficerId: loanOfficerId,
          assignmentDate: formattedDate,
          dateFormat: "dd MMMM yyyy",
          locale: "en",
        }
      );
      console.log(`Loan officer ${loanOfficerId} assigned to loan ${loanId}`);
      return response.data;
    } catch (error: any) {
      console.error("Error assigning loan officer:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  // Get staff member by user ID
  async getStaffByUserId(userId: number): Promise<any | null> {
    try {
      // Fineract staff are linked to users, try to find staff with matching user ID
      const allStaff = await this.getStaff();
      // Staff might have userId property or we need to match by some other means
      const staff = allStaff.find((s: any) => s.id === userId || s.userId === userId);
      return staff || null;
    } catch (error: any) {
      console.error("Error finding staff by user ID:", error.message);
      return null;
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
      baseUrl: process.env.FINERACT_BASE_URL || "http://mifos-be.kenac.co.zw",
      username: "", // Not needed when using token
      password: "", // Not needed when using token
      tenantId: tenantId || process.env.FINERACT_TENANT_ID || "goodfellow",
    };
    return new FineractAPIService(config, authToken);
  }

  // Fallback to singleton with env credentials
  if (!fineractService) {
    const config: FineractConfig = {
      baseUrl: process.env.FINERACT_BASE_URL || "http://mifos-be.kenac.co.zw",
      username: process.env.FINERACT_USERNAME || "mifos",
      password: process.env.FINERACT_PASSWORD || "password",
      tenantId: tenantId || process.env.FINERACT_TENANT_ID || "goodfellow",
    };
    fineractService = new FineractAPIService(config);
  }
  return fineractService;
}

// Hardcoded service token for all API calls
// TODO: Move to environment variable
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

export async function getFineractServiceWithSession(): Promise<FineractAPIService> {
  try {
    const { getFineractTenantId } = await import("./fineract-tenant-service");
    const fineractTenantId = await getFineractTenantId();

    // Use hardcoded service token for all API calls
    return getFineractService(SERVICE_TOKEN, fineractTenantId);
  } catch (error) {
    console.error("Error in getFineractServiceWithSession:", error);
    throw new Error(
      `Failed to initialize Fineract service: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
