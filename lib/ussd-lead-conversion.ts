type UssdApplicationLike = {
  tenantId: string;
  loanApplicationUssdId: number;
  messageId: string;
  referenceNumber: string;
  userPhoneNumber?: string | null;
  loanMatrixClientId?: number | null;
  userFullName?: string | null;
  userNationalId?: string | null;
  principalAmount?: number | null;
  loanTermMonths?: number | null;
  payoutMethod?: string | null;
  mobileMoneyNumber?: string | null;
  mobileMoneyProvider?: string | null;
  branchName?: string | null;
  officeLocationId?: number | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
};

type FineractClientLike = {
  id?: number | null;
  accountNo?: string | null;
  externalId?: string | null;
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
  fullname?: string | null;
  mobileNo?: string | null;
  officeId?: number | null;
  officeName?: string | null;
  active?: boolean | null;
  dateOfBirth?: string | number[] | Date | null;
  submittedOnDate?: string | number[] | Date | null;
  activationDate?: string | number[] | Date | null;
  timeline?: {
    activatedOnDate?: string | number[] | Date | null;
    submittedOnDate?: string | number[] | Date | null;
  } | null;
  gender?: {
    id?: number | null;
    name?: string | null;
  } | null;
  clientType?: {
    id?: number | null;
    name?: string | null;
  } | null;
  clientClassification?: {
    id?: number | null;
    name?: string | null;
  } | null;
  legalForm?: {
    id?: number | null;
    name?: string | null;
    value?: string | null;
  } | null;
};

type FineractOptionLike = {
  id?: number | null;
};

type FineractLoanProductTemplateLike = {
  numberOfRepayments?: number | null;
  repaymentEvery?: number | null;
  repaymentFrequencyType?: FineractOptionLike | null;
  loanTermFrequencyType?: FineractOptionLike | null;
  interestRatePerPeriod?: number | null;
  interestRateFrequencyType?: FineractOptionLike | null;
  interestType?: FineractOptionLike | null;
  amortizationType?: FineractOptionLike | null;
  interestCalculationPeriodType?: FineractOptionLike | null;
  transactionProcessingStrategyCode?: string | null;
  allowPartialPeriodInterestCalculation?: boolean | null;
  isEqualAmortization?: boolean | null;
};

function toCleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function toOptionalDate(
  value: string | number[] | Date | null | undefined
): Date | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    if (
      typeof year === "number" &&
      typeof month === "number" &&
      typeof day === "number"
    ) {
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
}

function splitFullName(fullName: string | null): {
  firstname?: string;
  middlename?: string;
  lastname?: string;
} {
  if (!fullName) {
    return {};
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return {};
  }

  if (parts.length === 1) {
    return { firstname: parts[0] };
  }

  if (parts.length === 2) {
    return { firstname: parts[0], lastname: parts[1] };
  }

  return {
    firstname: parts[0],
    middlename: parts.slice(1, -1).join(" "),
    lastname: parts.at(-1),
  };
}

function pickDefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

export function getUssdLeadLookupExternalIds(
  application: UssdApplicationLike
): string[] {
  return Array.from(
    new Set(
      [
        toCleanString(application.userNationalId),
        toCleanString(application.referenceNumber),
        toCleanString(application.messageId),
      ].filter((value): value is string => Boolean(value))
    )
  );
}

export function resolveUssdLoanExternalId(input: {
  leadId?: string | null;
  applicationRecordId?: string | null;
  referenceNumber?: string | null;
  messageId?: string | null;
}): string | null {
  return (
    toCleanString(input.leadId) ??
    toCleanString(input.applicationRecordId) ??
    toCleanString(input.referenceNumber) ??
    toCleanString(input.messageId) ??
    null
  );
}

export function buildUssdLoanPayloadFromTemplate(
  application: UssdApplicationLike,
  template: FineractLoanProductTemplateLike,
  options: {
    dateStr: string;
    externalId?: string | null;
  }
) {
  const numberOfRepayments =
    toOptionalNumber(template.numberOfRepayments) ?? 1;
  const repaymentEvery = toOptionalNumber(template.repaymentEvery) ?? 1;
  const loanTermFrequency =
    numberOfRepayments > 0 ? numberOfRepayments * repaymentEvery : repaymentEvery;

  return {
    clientId: application.loanMatrixClientId,
    productId: application.loanMatrixLoanProductId,
    principal: application.principalAmount,
    loanTermFrequency,
    loanTermFrequencyType:
      toOptionalNumber(template.loanTermFrequencyType?.id) ??
      toOptionalNumber(template.repaymentFrequencyType?.id) ??
      2,
    numberOfRepayments,
    repaymentEvery,
    repaymentFrequencyType:
      toOptionalNumber(template.repaymentFrequencyType?.id) ?? 2,
    interestRatePerPeriod:
      toOptionalNumber(template.interestRatePerPeriod) ?? 0,
    interestRateFrequencyType:
      toOptionalNumber(template.interestRateFrequencyType?.id) ?? 2,
    interestType: toOptionalNumber(template.interestType?.id) ?? 0,
    amortizationType:
      toOptionalNumber(template.amortizationType?.id) ?? 1,
    interestCalculationPeriodType:
      toOptionalNumber(template.interestCalculationPeriodType?.id) ?? 1,
    transactionProcessingStrategyCode:
      toCleanString(template.transactionProcessingStrategyCode) ??
      "creocore-strategy",
    submittedOnDate: options.dateStr,
    expectedDisbursementDate: options.dateStr,
    locale: "en",
    dateFormat: "yyyy-MM-dd",
    externalId: toCleanString(options.externalId) ?? undefined,
    isEqualAmortization:
      typeof template.isEqualAmortization === "boolean"
        ? template.isEqualAmortization
        : false,
    charges: [],
    collateral: [],
    loanType: "individual",
  };
}

function buildLeadClientSnapshot(
  application: UssdApplicationLike,
  fineractClient?: FineractClientLike | null
) {
  const fallbackNames = splitFullName(toCleanString(application.userFullName));
  const fineractClientId =
    toOptionalNumber(fineractClient?.id) ??
    toOptionalNumber(application.loanMatrixClientId);
  const externalId =
    toCleanString(fineractClient?.externalId) ??
    toCleanString(application.userNationalId) ??
    toCleanString(application.referenceNumber) ??
    toCleanString(application.messageId) ??
    undefined;

  return pickDefined({
    externalId,
    firstname:
      toCleanString(fineractClient?.firstname) ?? fallbackNames.firstname,
    middlename:
      toCleanString(fineractClient?.middlename) ?? fallbackNames.middlename,
    lastname: toCleanString(fineractClient?.lastname) ?? fallbackNames.lastname,
    fullname:
      toCleanString(fineractClient?.fullname) ??
      toCleanString(application.userFullName) ??
      undefined,
    mobileNo:
      toCleanString(fineractClient?.mobileNo) ??
      toCleanString(application.userPhoneNumber) ??
      undefined,
    dateOfBirth:
      toOptionalDate(fineractClient?.dateOfBirth) ?? undefined,
    gender: toCleanString(fineractClient?.gender?.name) ?? undefined,
    genderId: toOptionalNumber(fineractClient?.gender?.id),
    officeId:
      toOptionalNumber(fineractClient?.officeId) ??
      toOptionalNumber(application.officeLocationId),
    officeName:
      toCleanString(fineractClient?.officeName) ??
      toCleanString(application.branchName) ??
      undefined,
    clientTypeId: toOptionalNumber(fineractClient?.clientType?.id),
    clientTypeName: toCleanString(fineractClient?.clientType?.name) ?? undefined,
    clientClassificationId: toOptionalNumber(
      fineractClient?.clientClassification?.id
    ),
    clientClassificationName:
      toCleanString(fineractClient?.clientClassification?.name) ?? undefined,
    legalFormId: toOptionalNumber(fineractClient?.legalForm?.id),
    legalFormName:
      toCleanString(fineractClient?.legalForm?.value) ??
      toCleanString(fineractClient?.legalForm?.name) ??
      undefined,
    active:
      typeof fineractClient?.active === "boolean"
        ? fineractClient.active
        : undefined,
    fineractAccountNo: toCleanString(fineractClient?.accountNo) ?? undefined,
    fineractClientId,
    clientCreatedInFineract: Boolean(fineractClientId),
    clientCreationDate: fineractClientId
      ? toOptionalDate(
          fineractClient?.timeline?.activatedOnDate ??
            fineractClient?.activationDate ??
            fineractClient?.timeline?.submittedOnDate ??
            fineractClient?.submittedOnDate
        ) ?? new Date()
      : undefined,
    stateMetadata: {
      source: "USSD",
      applicationId: application.loanApplicationUssdId,
      messageId: application.messageId,
      referenceNumber: application.referenceNumber,
      payoutMethod: application.payoutMethod ?? null,
      loanMatrixClientId: application.loanMatrixClientId ?? null,
      userNationalId: application.userNationalId ?? null,
    },
  });
}

export function buildLeadDataFromUssdApplication(
  application: UssdApplicationLike,
  currentUserId: string,
  fineractClient?: FineractClientLike | null
) {
  return {
    tenantId: application.tenantId,
    userId: currentUserId,
    status: "DRAFT",
    requestedAmount: application.principalAmount ?? undefined,
    loanTerm: application.loanTermMonths ?? undefined,
    bankName: toCleanString(application.bankName) ?? undefined,
    accountNumber:
      toCleanString(application.bankAccountNumber) ?? undefined,
    preferredPaymentMethod:
      toCleanString(application.payoutMethod) ?? undefined,
    ...buildLeadClientSnapshot(application, fineractClient),
  };
}

export function buildLeadClientBackfillData(
  application: UssdApplicationLike,
  fineractClient?: FineractClientLike | null
) {
  return buildLeadClientSnapshot(application, fineractClient);
}

export type { FineractClientLike, UssdApplicationLike };
