import type {
  InterestRateDisplayMode,
  TenantSettings,
} from "@/shared/types/tenant";

type InterestRateLoanLike = {
  annualInterestRate?: number | null;
  interestRatePerPeriod?: number | null;
  interestRateFrequencyType?: {
    value?: string | null;
  } | null;
} | null | undefined;

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function includesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function normalizeInterestFrequency(
  loan: InterestRateLoanLike
): string | null {
  const rawValue = loan?.interestRateFrequencyType?.value;
  if (typeof rawValue !== "string") return null;

  const normalized = rawValue.trim().toLowerCase();
  return normalized || null;
}

export function formatInterestRatePercentage(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const roundedValue = Number(safeValue.toFixed(2));

  if (Number.isInteger(roundedValue)) {
    return `${roundedValue}%`;
  }

  return `${roundedValue.toFixed(2)}%`;
}

export function resolveInterestRateDisplayMode(
  tenantSlug?: string | null,
  tenantSettings?: Pick<TenantSettings, "loanTermsInterestRateDisplay"> | null
): InterestRateDisplayMode {
  const configuredMode = tenantSettings?.loanTermsInterestRateDisplay;
  if (configuredMode === "annual" || configuredMode === "monthly") {
    return configuredMode;
  }

  return tenantSlug?.trim().toLowerCase() === "omama" ? "monthly" : "annual";
}

export function getLoanInterestRateDisplay(
  loan: InterestRateLoanLike,
  mode: InterestRateDisplayMode
) {
  const annualRateFromLoan = asFiniteNumber(loan?.annualInterestRate);
  const periodicRate = asFiniteNumber(loan?.interestRatePerPeriod);
  const interestFrequency = normalizeInterestFrequency(loan);

  const derivedAnnualRate =
    annualRateFromLoan ??
    (periodicRate == null
      ? 0
      : includesAny(interestFrequency || "", ["year", "annual"])
        ? periodicRate
        : periodicRate * 12);

  const monthlyRate =
    includesAny(interestFrequency || "", ["month"]) && periodicRate != null
      ? periodicRate
      : derivedAnnualRate / 12;

  const displayRate = mode === "monthly" ? monthlyRate : derivedAnnualRate;
  const label =
    mode === "monthly" ? "Monthly Interest Rate" : "Annual Interest Rate";
  const cadence = mode === "monthly" ? "per month" : "per annum";

  return {
    annualRate: derivedAnnualRate,
    monthlyRate,
    displayRate,
    label,
    cadence,
    formattedRate: formatInterestRatePercentage(displayRate),
    statementValue: `${formatInterestRatePercentage(displayRate)} ${cadence}`,
  };
}
