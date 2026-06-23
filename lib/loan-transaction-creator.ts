type LoanTransactionReferenceCandidate = {
  id?: number | null;
  transactionId?: string | null;
  externalId?: string | null;
};

type JournalEntryCandidate = {
  createdByUserName?: string | null;
};

type JournalEntriesPayload = {
  pageItems?: JournalEntryCandidate[] | null;
};

type ReportRow = Record<string, unknown>;

type ReportPayload =
  | ReportRow[]
  | {
      columnHeaders?: Array<{ columnName?: string; name?: string } | string>;
      data?: Array<{ row?: unknown[] } | unknown[]>;
      pageItems?: ReportRow[] | null;
    }
  | null
  | undefined;

export function getLoanTransactionJournalReference(
  transaction: LoanTransactionReferenceCandidate | null | undefined
): string | null {
  if (!transaction) return null;

  if (
    typeof transaction.transactionId === "string" &&
    /^L\d+$/.test(transaction.transactionId)
  ) {
    return transaction.transactionId;
  }

  if (
    typeof transaction.externalId === "string" &&
    /^L\d+$/.test(transaction.externalId)
  ) {
    return transaction.externalId;
  }

  if (typeof transaction.id === "number" && Number.isFinite(transaction.id)) {
    return `L${transaction.id}`;
  }

  return null;
}

export function getJournalEntriesCreatorName(
  payload: JournalEntriesPayload | null | undefined
): string | null {
  if (!payload?.pageItems?.length) return null;

  for (const entry of payload.pageItems) {
    const candidate = entry?.createdByUserName?.trim();
    if (candidate) return candidate;
  }

  return null;
}

function parseReportRows(payload: ReportPayload): ReportRow[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  if (Array.isArray(payload.pageItems)) {
    return payload.pageItems;
  }

  if (!Array.isArray(payload.columnHeaders) || !Array.isArray(payload.data)) {
    return [];
  }

  const columns = payload.columnHeaders.map((column) => {
    const name =
      typeof column === "string" ? column : column.columnName || column.name || "";

    return String(name)
      .trim()
      .toLowerCase()
      .replaceAll(" ", "_");
  });

  return payload.data.map((item) => {
    const values = Array.isArray(item) ? item : item.row || [];
    const row: ReportRow = {};

    columns.forEach((column, index) => {
      row[column] = values[index];
    });

    return row;
  });
}

function getRowString(
  row: ReportRow,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function getLoanTransactionReportCreatorName(
  payload: ReportPayload
): string | null {
  const rows = parseReportRows(payload);

  for (const row of rows) {
    const candidate = getRowString(row, [
      "created_by_user_name",
      "createdbyusername",
      "created_by_username",
      "loan_txn_user",
      "username",
    ]);

    if (candidate) return candidate;
  }

  return null;
}

export function resolveLoanTransactionCreatorName(options: {
  journalEntriesPayload?: JournalEntriesPayload | null;
  reportPayload?: ReportPayload;
}): string | null {
  return (
    getLoanTransactionReportCreatorName(options.reportPayload) ||
    getJournalEntriesCreatorName(options.journalEntriesPayload) ||
    null
  );
}
