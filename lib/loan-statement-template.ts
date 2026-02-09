import { format } from "date-fns";

export interface LoanStatementData {
  // Company info
  companyName: string;
  logoUrl?: string;

  // Account info
  accountType: string;
  accountName: string;
  accountNumber: string;
  printDate: string;
  periodFrom: string;
  periodTo: string;

  // Currency
  currency: string;
  currencySymbol: string;

  // Accrued Interest
  accruedInterest: number;

  // Transactions
  transactions: LoanTransaction[];

  // Summary
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface LoanTransaction {
  id: number;
  date: string;
  type: string;
  trxnId: string;
  debit: number;
  credit: number;
  cumulativeBalance: number;
  isHighlighted?: boolean; // For disbursements and certain transactions
}

const formatCurrency = (amount: number, symbol: string = ""): string => {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
};


export function generateLoanStatementHTML(data: LoanStatementData): string {
  // Generate transaction rows
  const transactionRows = data.transactions
    .map(
      (tx) => `
      <tr class="${tx.isHighlighted ? "highlighted-row" : ""}">
        <td class="date-cell">${tx.date}</td>
        <td class="type-cell">${tx.type}</td>
        <td class="trxn-id-cell">${tx.trxnId}</td>
        <td class="amount-cell">${formatCurrency(tx.debit, "")}</td>
        <td class="amount-cell">${formatCurrency(tx.credit, "")}</td>
        <td class="amount-cell balance-cell">${formatCurrency(tx.cumulativeBalance, "")}</td>
      </tr>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Account Statement - ${data.accountNumber}</title>
  <style>
    @page {
      margin: 0.4in;
      size: A4;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      background: #fff;
      padding: 20px;
    }
    
    .container {
      max-width: 100%;
      margin: 0 auto;
    }
    
    /* Header Section */
    .header {
      display: table;
      width: 100%;
      border: 1px solid #000;
      margin-bottom: 0;
    }
    
    .header-left {
      display: table-cell;
      width: 50%;
      vertical-align: middle;
      text-align: center;
      padding: 15px;
      border-right: 1px solid #000;
    }
    
    .header-right {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding: 0;
    }
    
    .logo {
      max-width: 80px;
      max-height: 80px;
      margin-bottom: 10px;
    }
    
    .company-name {
      font-size: 14px;
      font-weight: bold;
      color: #1a5276;
      margin-top: 10px;
    }
    
    /* Account Info Table */
    .account-info-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .account-info-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #000;
    }
    
    .account-info-table tr:last-child td {
      border-bottom: none;
    }
    
    .account-title {
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      color: #1a5276;
    }
    
    .account-info-label {
      text-align: right;
      font-weight: bold;
    }
    
    /* Accrued Interest Section */
    .accrued-section {
      display: table;
      width: 100%;
      border: 1px solid #000;
      border-top: none;
    }
    
    .accrued-left {
      display: table-cell;
      width: 50%;
      padding: 15px;
      border-right: 1px solid #000;
    }
    
    .accrued-right {
      display: table-cell;
      width: 50%;
      padding: 8px 10px;
      text-align: right;
      font-weight: bold;
    }
    
    /* Transactions Table */
    .transactions-section {
      margin-top: 20px;
      margin-bottom: 20px;
    }
    
    .transactions-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .transactions-table th {
      background: #f5f5f5;
      padding: 10px 8px;
      text-align: left;
      font-weight: bold;
      border-bottom: 2px solid #000;
      font-size: 11px;
    }
    
    .transactions-table th.amount-header {
      text-align: right;
    }
    
    .transactions-table td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
      font-size: 11px;
    }
    
    .transactions-table .date-cell {
      width: 120px;
    }
    
    .transactions-table .type-cell {
      width: auto;
    }
    
    .transactions-table .trxn-id-cell {
      width: 80px;
      text-align: center;
    }
    
    .transactions-table .amount-cell {
      width: 100px;
      text-align: right;
      font-family: 'Courier New', monospace;
    }
    
    .transactions-table .balance-cell {
      font-weight: bold;
    }
    
    .transactions-table .highlighted-row td {
      color: #0e6655;
    }
    
    /* Footer Section */
    .footer {
      display: table;
      width: 100%;
      border: 1px solid #000;
      margin-top: 30px;
    }
    
    .footer-left {
      display: table-cell;
      width: 55%;
      vertical-align: top;
      padding: 15px;
      border-right: 1px solid #000;
    }
    
    .footer-right {
      display: table-cell;
      width: 45%;
      vertical-align: top;
      padding: 0;
    }
    
    .signature-line {
      margin-bottom: 15px;
      font-weight: bold;
    }
    
    .signature-dots {
      display: inline-block;
      width: 80%;
      border-bottom: 1px dotted #000;
      margin-left: 5px;
    }
    
    /* Account Summary Table */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .summary-table th {
      background: #f5f5f5;
      padding: 8px 10px;
      text-align: center;
      font-weight: bold;
      font-size: 12px;
      border-bottom: 1px solid #000;
    }
    
    .summary-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #ddd;
    }
    
    .summary-table td:last-child {
      text-align: right;
      font-weight: bold;
      font-family: 'Courier New', monospace;
    }
    
    .summary-table tr:last-child td {
      border-bottom: none;
      background: #f9f9f9;
    }
    
    .summary-table .closing-row td {
      font-weight: bold;
      background: #f0f0f0;
    }
    
    /* Print styles */
    @media print {
      body {
        padding: 0;
      }
      
      .header,
      .accrued-section,
      .footer {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Section -->
    <div class="header">
      <div class="header-left">
        ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" class="logo" onerror="this.style.display='none'" />` : ""}
        <div class="company-name">${data.companyName}</div>
      </div>
      <div class="header-right">
        <table class="account-info-table">
          <tr>
            <td class="account-title">Account Statement</td>
          </tr>
          <tr>
            <td class="account-info-label">Account Type: ${data.accountType}</td>
          </tr>
          <tr>
            <td class="account-info-label">Account Name: ${data.accountName}</td>
          </tr>
          <tr>
            <td class="account-info-label">Account Number: ${data.accountNumber}</td>
          </tr>
          <tr>
            <td class="account-info-label">Print Date: ${data.printDate}</td>
          </tr>
          <tr>
            <td class="account-info-label">From ${data.periodFrom} To ${data.periodTo}</td>
          </tr>
        </table>
      </div>
    </div>
    
    <!-- Accrued Interest Section -->
    <div class="accrued-section">
      <div class="accrued-left"></div>
      <div class="accrued-right">
        Accrued Interest: ${formatCurrency(data.accruedInterest, "")}
      </div>
    </div>
    
    <!-- Transactions Table -->
    <div class="transactions-section">
      <table class="transactions-table">
        <thead>
          <tr>
            <th>Transaction Date</th>
            <th>Trxn Type</th>
            <th class="amount-header">Trxn ID</th>
            <th class="amount-header">Debit</th>
            <th class="amount-header">Credit</th>
            <th class="amount-header">Cumulative Balance</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRows || '<tr><td colspan="6" style="text-align: center; padding: 20px;">No transactions found</td></tr>'}
        </tbody>
      </table>
    </div>
    
    <!-- Footer Section -->
    <div class="footer">
      <div class="footer-left">
        <div class="signature-line">
          Prepared By : <span class="signature-dots"></span>
        </div>
        <div class="signature-line">
          Sign / Stamp : <span class="signature-dots"></span>
        </div>
        <div class="signature-line">
          Date : <span class="signature-dots"></span>
        </div>
      </div>
      <div class="footer-right">
        <table class="summary-table">
          <thead>
            <tr>
              <th colspan="2">Account Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Opening Balance</td>
              <td>${data.currencySymbol}${formatCurrency(data.openingBalance, "")}</td>
            </tr>
            <tr>
              <td>Total Debits</td>
              <td>${data.currencySymbol}${formatCurrency(data.totalDebits, "")}</td>
            </tr>
            <tr>
              <td>Total Credits</td>
              <td>${data.currencySymbol}${formatCurrency(data.totalCredits, "")}</td>
            </tr>
            <tr class="closing-row">
              <td>Closing Balance</td>
              <td>${data.currencySymbol}${formatCurrency(data.closingBalance, "")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Helper function to parse Fineract date arrays to formatted string
 */
export function parseFineractDate(dateValue: string | number[] | undefined): string {
  if (!dateValue) return "N/A";

  try {
    if (Array.isArray(dateValue)) {
      const [year, month, day] = dateValue;
      return format(new Date(year, month - 1, day), "dd MMMM yyyy");
    }
    return format(new Date(dateValue), "dd MMMM yyyy");
  } catch {
    return String(dateValue);
  }
}

/**
 * Map Fineract transaction type to readable description
 */
export function mapTransactionType(
  type: { code?: string; value?: string } | string,
  accountNo?: string,
  paymentDetail?: string
): string {
  const typeCode = typeof type === "string" ? type : type?.code || "";
  const typeValue = typeof type === "string" ? type : type?.value || "";

  // Map common transaction types
  if (typeCode.includes("disbursement") || typeValue.toLowerCase().includes("disbursement")) {
    return `Disbursement ${accountNo || ""}`.trim();
  }
  if (typeCode.includes("repayment") || typeValue.toLowerCase().includes("repayment")) {
    const desc = paymentDetail || "Capital Repayment";
    return `${desc} ${accountNo || ""}`.trim();
  }
  if (typeCode.includes("accrual") || typeValue.toLowerCase().includes("accrual")) {
    return `Interest to Maturity ${accountNo || ""}`.trim();
  }
  if (typeCode.includes("waiveInterest")) {
    return "Interest Waiver";
  }
  if (typeCode.includes("waiveCharges")) {
    return "Charges Waiver";
  }
  if (typeCode.includes("writeOff")) {
    return "Write-Off";
  }
  if (typeCode.includes("chargePayment")) {
    return "Fee Payment";
  }

  return typeValue || typeCode || "Unknown";
}

/**
 * Transform Fineract loan data to statement data
 */
export function transformFineractLoanToStatement(
  loan: any,
  client: any,
  companyInfo: {
    name: string;
    logoUrl?: string;
  },
  periodFrom?: string,
  periodTo?: string
): LoanStatementData {
  const currency = loan.currency || {};
  const summary = loan.summary || {};
  const transactions = loan.transactions || [];
  const accountNo = loan.accountNo || "";

  // Calculate totals
  let openingBalance = 0;
  let totalDebits = 0;
  let totalCredits = 0;
  let runningBalance = 0;

  // Process transactions
  const processedTransactions: LoanTransaction[] = [];

  // Add opening balance row
  processedTransactions.push({
    id: 0,
    date: periodFrom || parseFineractDate(transactions[0]?.date),
    type: "Balance B/Fwd",
    trxnId: "",
    debit: 0,
    credit: 0,
    cumulativeBalance: 0,
    isHighlighted: false,
  });

  // Sort transactions by date
  const sortedTransactions = [...transactions].sort((a: any, b: any) => {
    const dateA = Array.isArray(a.date)
      ? new Date(a.date[0], a.date[1] - 1, a.date[2]).getTime()
      : new Date(a.date).getTime();
    const dateB = Array.isArray(b.date)
      ? new Date(b.date[0], b.date[1] - 1, b.date[2]).getTime()
      : new Date(b.date).getTime();
    return dateA - dateB;
  });

  sortedTransactions.forEach((tx: any) => {
    const isDisbursement =
      tx.type?.code?.includes("disbursement") ||
      tx.type?.value?.toLowerCase().includes("disbursement");
    const isRepayment =
      tx.type?.code?.includes("repayment") ||
      tx.type?.value?.toLowerCase().includes("repayment");
    const isAccrual =
      tx.type?.code?.includes("accrual") ||
      tx.type?.value?.toLowerCase().includes("accrual");

    let debit = 0;
    let credit = 0;
    let isHighlighted = false;

    if (isDisbursement) {
      debit = tx.amount || 0;
      totalDebits += debit;
      runningBalance += debit;
      isHighlighted = true;
    } else if (isAccrual) {
      // Interest accrual adds to debit (what's owed)
      debit = tx.amount || 0;
      totalDebits += debit;
      runningBalance += debit;
      // isHighlighted stays false for accruals
    } else if (isRepayment || tx.type?.code?.includes("chargePayment")) {
      credit = tx.amount || 0;
      totalCredits += credit;
      runningBalance -= credit;
      isHighlighted = true;
    }

    // Get payment detail for description
    const paymentDetail = tx.paymentDetailData?.paymentType?.name || tx.note || "";

    processedTransactions.push({
      id: tx.id,
      date: parseFineractDate(tx.date),
      type: mapTransactionType(tx.type, accountNo, paymentDetail),
      trxnId: tx.id?.toString() || "",
      debit,
      credit,
      cumulativeBalance: Math.max(0, runningBalance),
      isHighlighted,
    });
  });

  // Calculate accrued interest (interest outstanding)
  const accruedInterest = summary.interestOutstanding || 0;

  // Determine period dates
  const now = new Date();
  const timeline = loan.timeline || {};
  const actualPeriodFrom =
    periodFrom ||
    parseFineractDate(timeline.actualDisbursementDate || timeline.submittedOnDate);
  const actualPeriodTo = periodTo || format(now, "dd MMMM yyyy");
  const printDate = format(now, "M/d/yyyy h:mm:ss a");

  // Create account name from client info
  const clientName = client?.displayName || loan.clientName || "N/A";
  const accountName = `${clientName} | ${accountNo}`;

  return {
    companyName: companyInfo.name,
    logoUrl: companyInfo.logoUrl,

    accountType: "Loans and Advances",
    accountName,
    accountNumber: accountNo,
    printDate,
    periodFrom: actualPeriodFrom,
    periodTo: actualPeriodTo,

    currency: currency.code || "ZMW",
    currencySymbol: currency.displaySymbol || "ZMW",

    accruedInterest,

    transactions: processedTransactions,

    openingBalance,
    totalDebits,
    totalCredits,
    closingBalance: Math.max(0, runningBalance),
  };
}
