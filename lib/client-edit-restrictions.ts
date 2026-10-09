import { getTenantFeatures } from "@/lib/tenant-features";

export const RESTRICTED_CLIENT_EDIT_FIELDS = [
  "isStaff",
  "staffId",
  "mobileNo",
  "submittedOnDate",
  "activationDate",
] as const;

export function isSensitiveClientEditRestrictionEnabled(
  settings: unknown
): boolean {
  return (
    getTenantFeatures(settings).restrictSensitiveClientEditFieldsToSuperAdmin ===
    true
  );
}

export function stripRestrictedClientEditFields(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const sanitizedPayload = { ...(payload as Record<string, unknown>) };

  for (const field of RESTRICTED_CLIENT_EDIT_FIELDS) {
    delete sanitizedPayload[field];
  }

  return sanitizedPayload;
}
