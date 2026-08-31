import {
  ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID,
  ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID,
  ARDA_STOCK_INPUT_LOAN_EXTERNAL_ID,
} from "@/lib/inventory/arda-stock-loan";

export const ARDA_PRODUCT_EXTERNAL_IDS = [
  ARDA_STOCK_INPUT_LOAN_EXTERNAL_ID,
  ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID,
  ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID,
] as const;

export type ArdaSourceRecord = {
  externalId?: string | null;
  name?: string | null;
  tags?: string[];
};

export type ArdaSourceClassification = {
  kind: "automatic" | "review" | "excluded";
  reason: string;
};

function normalize(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

export function isArdaSourceProduct(input: ArdaSourceRecord): boolean {
  return ARDA_PRODUCT_EXTERNAL_IDS.includes(
    normalize(input.externalId) as (typeof ARDA_PRODUCT_EXTERNAL_IDS)[number],
  );
}

export function classifyArdaSourceRecord(
  input: ArdaSourceRecord,
): ArdaSourceClassification {
  const externalId = normalize(input.externalId);
  const name = normalize(input.name);
  const tags = new Set((input.tags || []).map((tag) => normalize(tag)));

  if (isArdaSourceProduct(input)) {
    return { kind: "automatic", reason: "approved ARDA product external ID" };
  }

  if (externalId.startsWith("ARDA-")) {
    return { kind: "automatic", reason: "ARDA-coded external ID" };
  }

  if (tags.has("ARDA_TEST")) {
    return { kind: "review", reason: "explicit ARDA test tag" };
  }

  if (name.includes("ARDA")) {
    return { kind: "review", reason: "ARDA appears only in free text" };
  }

  return { kind: "excluded", reason: "no approved ARDA identifier" };
}
