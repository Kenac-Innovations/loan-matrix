import { prisma } from "@/lib/prisma";

function normalizeOfficeId(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeOfficeName(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export async function syncLinkedLeadOfficesForFineractClient(input: {
  tenantId: string;
  fineractClientId: number;
  officeId: number | string | null | undefined;
  officeName?: string | null;
}) {
  const tenantId = input.tenantId?.trim();
  const fineractClientId = Number(input.fineractClientId);
  const officeId = normalizeOfficeId(input.officeId);
  const officeName = normalizeOfficeName(input.officeName);

  if (!tenantId || !Number.isInteger(fineractClientId) || fineractClientId <= 0 || !officeId) {
    return { updatedCount: 0 };
  }

  const result = await prisma.lead.updateMany({
    where: {
      tenantId,
      fineractClientId,
    },
    data: {
      officeId,
      officeName,
    },
  });

  return { updatedCount: result.count };
}
