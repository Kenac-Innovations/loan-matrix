const DEFAULT_FINERACT_BASE_URL = "https://fineract.kenac.tech";

export function getFineractBaseUrl(): string {
  const configuredBaseUrl = process.env.FINERACT_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return DEFAULT_FINERACT_BASE_URL;
  }

  return configuredBaseUrl.replace(/\/$/, "");
}

