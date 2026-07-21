type ClientLoanDate = string | number[] | null | undefined;

export interface ClientLoanTableItem {
  id: number;
  accountNo?: string | number | null;
  loanProductName?: string | null;
  timeline?: {
    submittedOnDate?: ClientLoanDate;
    approvedOnDate?: ClientLoanDate;
    actualDisbursementDate?: ClientLoanDate;
    expectedDisbursementDate?: ClientLoanDate;
  };
}

export const CLIENT_LOANS_PAGE_SIZE = 10;

const UNKNOWN_LOAN_DATE = Number.MAX_SAFE_INTEGER;

const parseLoanDateTime = (value: ClientLoanDate): number | null => {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 3) {
    const parsed = new Date(value[0], value[1] - 1, value[2]).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

export const getClientLoanSequenceSortTime = (
  loan: ClientLoanTableItem
): number => {
  const candidateDates = [
    loan.timeline?.submittedOnDate,
    loan.timeline?.approvedOnDate,
    loan.timeline?.actualDisbursementDate,
    loan.timeline?.expectedDisbursementDate,
  ];

  for (const value of candidateDates) {
    const parsed = parseLoanDateTime(value);
    if (parsed !== null) {
      return parsed;
    }
  }

  return UNKNOWN_LOAN_DATE;
};

export function orderClientLoansChronologically<T extends ClientLoanTableItem>(
  loans: T[]
): T[] {
  return [...loans].sort((left, right) => {
    const timeDiff =
      getClientLoanSequenceSortTime(left) -
      getClientLoanSequenceSortTime(right);

    if (timeDiff !== 0) {
      return timeDiff;
    }

    return left.id - right.id;
  });
}

export function orderClientLoansLatestFirst<T extends ClientLoanTableItem>(
  loans: T[]
): T[] {
  return [...loans].sort((left, right) => {
    const leftTime = getClientLoanSequenceSortTime(left);
    const rightTime = getClientLoanSequenceSortTime(right);
    const leftHasDate = leftTime !== UNKNOWN_LOAN_DATE;
    const rightHasDate = rightTime !== UNKNOWN_LOAN_DATE;

    if (leftHasDate !== rightHasDate) {
      return leftHasDate ? -1 : 1;
    }

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.id - left.id;
  });
}

export function buildClientLoanSequenceNumbers<T extends ClientLoanTableItem>(
  loans: T[]
): Map<number, number> {
  return new Map(
    orderClientLoansChronologically(loans).map((loan, index) => [
      loan.id,
      index + 1,
    ])
  );
}

export function filterClientLoans<T extends ClientLoanTableItem>(
  loans: T[],
  searchQuery: string
): T[] {
  const query = searchQuery.trim().toLowerCase();

  if (!query) {
    return loans;
  }

  return loans.filter((loan) => {
    const accountNo = String(loan.accountNo ?? "").toLowerCase();
    const productName = String(loan.loanProductName ?? "").toLowerCase();

    return accountNo.includes(query) || productName.includes(query);
  });
}

export function paginateClientLoans<T>(
  loans: T[],
  requestedPage: number,
  requestedPageSize = CLIENT_LOANS_PAGE_SIZE
) {
  const pageSize =
    Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? Math.floor(requestedPageSize)
      : CLIENT_LOANS_PAGE_SIZE;
  const totalItems = loans.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requested =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;
  const page = Math.min(requested, totalPages);
  const startIndex = (page - 1) * pageSize;
  const pageItems = loans.slice(startIndex, startIndex + pageSize);
  const startItem = totalItems === 0 ? 0 : startIndex + 1;
  const endItem = startIndex + pageItems.length;

  return {
    pageItems,
    page,
    pageSize,
    totalItems,
    totalPages,
    startItem,
    endItem,
    canPreviousPage: page > 1,
    canNextPage: page < totalPages,
  };
}
