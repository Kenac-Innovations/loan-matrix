export function getUserSignatureUniqueWhere(
  tenantId: string,
  fineractUserId: number
) {
  return {
    tenantId_fineractUserId: {
      tenantId,
      fineractUserId,
    },
  };
}

export function getUserSignatureDeleteWhere(
  tenantId: string,
  fineractUserId: number
) {
  return {
    tenantId,
    fineractUserId,
  };
}

export function getUserSignatureCreateData(
  tenantId: string,
  fineractUserId: number,
  signatureData: string
) {
  return {
    tenantId,
    fineractUserId,
    signatureData,
  };
}
