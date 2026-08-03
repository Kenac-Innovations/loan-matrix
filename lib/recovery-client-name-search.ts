export type RecoveryClientNameRow = {
  clientName?: string | null;
};

export function normalizeRecoveryClientNameSearch(value?: string | null): string {
  return value?.trim().toLocaleLowerCase() || "";
}

export function filterRecoveryRowsByClientName<T extends RecoveryClientNameRow>(
  rows: T[],
  clientNameSearch?: string | null
): T[] {
  const query = normalizeRecoveryClientNameSearch(clientNameSearch);

  if (!query) {
    return rows;
  }

  return rows.filter((row) =>
    normalizeRecoveryClientNameSearch(row.clientName).includes(query)
  );
}
