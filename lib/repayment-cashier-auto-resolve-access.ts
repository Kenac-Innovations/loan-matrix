import { prisma } from "@/lib/prisma";

export async function isUserExemptFromAutoCashierResolution(
  tenantId: string,
  fineractUserId: string | number | null | undefined
): Promise<boolean> {
  const numericUserId = Number(fineractUserId);
  if (!fineractUserId || Number.isNaN(numericUserId)) {
    return false;
  }

  const userLogin = await prisma.userLogin.findUnique({
    where: {
      tenantId_fineractUserId: {
        tenantId,
        fineractUserId: numericUserId,
      },
    },
    select: {
      exemptFromAutoCashierResolution: true,
    },
  });

  return Boolean(userLogin?.exemptFromAutoCashierResolution);
}
