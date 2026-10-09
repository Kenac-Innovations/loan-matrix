export type ClientServicingStatusForLead = {
  status?: { code?: string; name?: string } | null;
  policies?: Record<string, boolean> | null;
};

export class ClientServicingLeadRestrictionError extends Error {
  constructor(
    public readonly clientId: number,
    public readonly servicingStatusName?: string,
  ) {
    super(
      servicingStatusName
        ? `A new loan lead cannot be created because the client's ${servicingStatusName} servicing status does not allow new loan origination.`
        : "A new loan lead cannot be created because the client's servicing status does not allow new loan origination.",
    );
    this.name = "ClientServicingLeadRestrictionError";
  }
}

/**
 * Loan Matrix blocks the earlier lead-creation step for an existing client.
 * Fineract still authoritatively enforces the same policy for every loan
 * application, approval, and disbursement path.
 */
export async function assertClientCanCreateLoanLead(
  clientId: number,
  loadStatus: (clientId: number) => Promise<ClientServicingStatusForLead>,
): Promise<void> {
  const servicingStatus = await loadStatus(clientId);

  // An unassigned status intentionally preserves current behaviour. Only an
  // explicit false policy denies new-loan origination.
  if (servicingStatus.policies?.ORIGINATE_NEW_LOAN !== false) {
    return;
  }

  throw new ClientServicingLeadRestrictionError(
    clientId,
    servicingStatus.status?.name,
  );
}
