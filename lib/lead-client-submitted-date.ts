const CLIENT_SUBMITTED_ON_DATE_KEY = "clientSubmittedOnDate";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

function asJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const items = value.map(asJsonValue);
    return items.every((item) => item !== undefined)
      ? (items as JsonValue[])
      : undefined;
  }

  if (value && typeof value === "object") {
    return asMetadataRecord(value);
  }

  return undefined;
}

function asMetadataRecord(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value).reduce<JsonObject>((metadata, [key, entry]) => {
    const jsonValue = asJsonValue(entry);
    if (jsonValue !== undefined) metadata[key] = jsonValue;
    return metadata;
  }, {});
}

/**
 * Reads the client registration date kept alongside a lead. The lead's own
 * submittedOnDate belongs to the loan application and must not be reused for
 * this purpose.
 */
export function getClientSubmittedOnDate(
  stateMetadata: unknown,
): Date | undefined {
  const value = asMetadataRecord(stateMetadata)[CLIENT_SUBMITTED_ON_DATE_KEY];

  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Preserves arbitrary lead metadata while storing the client registration
 * date independently from the loan application's submitted-on date.
 */
export function withClientSubmittedOnDate(
  stateMetadata: unknown,
  submittedOnDate: Date,
): JsonObject {
  if (Number.isNaN(submittedOnDate.getTime())) {
    return asMetadataRecord(stateMetadata);
  }

  return {
    ...asMetadataRecord(stateMetadata),
    [CLIENT_SUBMITTED_ON_DATE_KEY]: submittedOnDate.toISOString(),
  };
}
