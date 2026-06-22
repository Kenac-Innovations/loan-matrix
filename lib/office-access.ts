import { getLeadViewerAccessContext } from "@/lib/lead-policy";

interface ResolveVisibleOfficeIdsInput {
  tenantId: string;
  fineractUserId?: number | null;
  sessionOfficeId?: number | null;
  sessionOfficeName?: string | null;
}

export async function resolveVisibleOfficeIdsForUser(
  input: ResolveVisibleOfficeIdsInput
) {
  const leadAccess = await getLeadViewerAccessContext(
    input.tenantId,
    input.fineractUserId
  );

  if (Array.isArray(leadAccess.visibleOfficeIds)) {
    return [...new Set(leadAccess.visibleOfficeIds)];
  }

  return null;
}

export function canAccessOfficeId(
  officeId: number | null | undefined,
  visibleOfficeIds: number[] | null
) {
  if (visibleOfficeIds === null) {
    return true;
  }

  if (officeId == null) {
    return false;
  }

  return visibleOfficeIds.includes(officeId);
}
