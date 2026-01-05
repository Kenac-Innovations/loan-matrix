import { format } from "date-fns";

interface KeyFactsData {
  // Borrower info
  clientName: string;
  clientId?: string;
  nrc?: string;
  
  // Loan identifiers
  applicationNo?: string;
  loanId?: string;
  
  // Loan amounts
  loanAmount: number;
  disbursedAmount: number;
  interest: number;
  fees: number;
  totalCostOfCredit: number;
  totalRepayment: number;
  paymentPerPeriod: number;
  
  // Loan terms
  tenure: string;
  numberOfPayments: number;
  paymentFrequency: string;
  firstPaymentDate: string;
  monthlyPercentageRate: number;
  
  // Fees breakdown
  charges: Array<{
    name: string;
    amount: number;
    isRecurring?: boolean;
    frequency?: string;
  }>;
  
  // Late payment penalties
  lateFeeAmount?: number;
  lateFeeDays?: number;
  defaultInterestRate?: number;
  defaultInterestDays?: number;
  
  // Collateral
  collateral?: string;
  mandatorySavings?: number;
  variableInterestApplies?: boolean;
  
  // Repayment schedule
  repaymentSchedule: Array<{
    paymentNumber: number;
    dueDate: string;
    paymentAmount: number;
    principal: number;
    interestAndFees: number;
    remainingBalance: number;
  }>;
  
  // Currency and dates
  currency: string;
  preparedDate?: string;
  validFor?: string;
}

interface SignatureData {
  borrower?: string | null;
  guarantor?: string | null;
  creditProvider?: string | null;
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (date: Date): string => {
  return format(date, "EEEE, dd MMMM yyyy");
};

export function generateKeyFactsStatementHTML(
  data: KeyFactsData,
  signatures: SignatureData = {}
): string {
  const preparedDate = data.preparedDate || formatDate(new Date());
  const signatureTimestamp = format(new Date(), "dd/MM/yyyy HH:mm");
  
  // Generate repayment schedule rows
  const repaymentScheduleRows = data.repaymentSchedule
    .map(
      (period) =>
        `<tr>
          <td class="text-center">${period.paymentNumber}</td>
          <td class="text-center">${period.dueDate}</td>
          <td class="text-right">${formatCurrency(period.paymentAmount)}</td>
          <td class="text-right">${formatCurrency(period.principal)}</td>
          <td class="text-right">${formatCurrency(period.interestAndFees)}</td>
          <td class="text-right">${data.currency} ${formatCurrency(period.remainingBalance)}</td>
        </tr>`
    )
    .join("");
  
  // Calculate totals for repayment schedule
  const totalPayment = data.repaymentSchedule.reduce((sum, p) => sum + p.paymentAmount, 0);
  const totalPrincipal = data.repaymentSchedule.reduce((sum, p) => sum + p.principal, 0);
  const totalInterestAndFees = data.repaymentSchedule.reduce((sum, p) => sum + p.interestAndFees, 0);
  
  // Separate upfront and recurring fees
  const upfrontFees = data.charges.filter(c => !c.isRecurring);
  const recurringFees = data.charges.filter(c => c.isRecurring);
  const totalUpfrontFees = upfrontFees.reduce((sum, c) => sum + c.amount, 0);
  const totalRecurringFees = recurringFees.reduce((sum, c) => sum + c.amount, 0);

  // Generate fee rows
  const generateFeeRow = (name: string, amount: number | undefined, isNA: boolean = false) => {
    const displayAmount = isNA ? "N/A" : (amount !== undefined ? formatCurrency(amount) : "N/A");
    const valueClass = isNA || amount === undefined ? "value-na" : "";
    return `<div class="fee-item">
      <span class="fee-label">${name}</span>
      <span class="fee-value ${valueClass}">${data.currency}__${displayAmount}_</span>
    </div>`;
  };

  const borrowerSignatureImg = signatures.borrower
    ? `<img src="${signatures.borrower}" alt="Borrower Signature" class="signature-img" />`
    : '<div class="signature-placeholder">______________________________</div>';

  const guarantorSignatureImg = signatures.guarantor
    ? `<img src="${signatures.guarantor}" alt="Guarantor Signature" class="signature-img" />`
    : '<div class="signature-placeholder">______________________________</div>';

  const creditProviderSignatureImg = signatures.creditProvider
    ? `<img src="${signatures.creditProvider}" alt="Credit Provider Signature" class="signature-img" />`
    : '<div class="signature-placeholder">______________________________</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Key Facts Statement - ${data.clientName}</title>
  <style>
    @page { 
      margin: 0.5in; 
      size: A4; 
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000;
      background: #fff;
      padding: 10px;
    }
    
    .container {
      max-width: 100%;
      margin: 0 auto;
    }
    
    /* Header styles */
    .header {
      text-align: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }
    
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .header .subtitle {
      font-size: 10pt;
      font-style: italic;
    }
    
    .disclaimer {
      font-style: italic;
      font-size: 8pt;
      margin: 10px 0;
    }
    
    /* Section styles */
    .section {
      margin-bottom: 15px;
    }
    
    .section-title {
      font-size: 10pt;
      font-weight: bold;
      background: #f0f0f0;
      padding: 5px;
      margin-bottom: 10px;
      border-left: 4px solid #333;
    }
    
    /* Key Terms three-column layout */
    .key-terms-grid {
      display: table;
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    
    .key-terms-row {
      display: table-row;
    }
    
    .key-terms-col {
      display: table-cell;
      width: 33.33%;
      padding: 5px;
      vertical-align: top;
      border: 1px solid #ccc;
    }
    
    .key-terms-col h4 {
      font-size: 9pt;
      font-weight: bold;
      margin-bottom: 5px;
      color: #333;
    }
    
    .term-item {
      margin-bottom: 8px;
    }
    
    .term-label {
      font-weight: bold;
      font-size: 8pt;
    }
    
    .term-sublabel {
      font-size: 7pt;
      color: #666;
      font-style: italic;
    }
    
    .term-value {
      font-size: 10pt;
      margin-top: 2px;
    }
    
    /* Summary box */
    .summary-box {
      display: table;
      width: 100%;
      margin: 15px 0;
      border: 2px solid #333;
    }
    
    .summary-row {
      display: table-row;
    }
    
    .summary-cell {
      display: table-cell;
      padding: 10px;
      vertical-align: middle;
      text-align: center;
      border-right: 1px solid #ccc;
    }
    
    .summary-cell:last-child {
      border-right: none;
    }
    
    .summary-cell.highlight {
      background: #f5f5f5;
    }
    
    .summary-operator {
      display: table-cell;
      padding: 10px 5px;
      font-size: 16pt;
      font-weight: bold;
      vertical-align: middle;
      text-align: center;
    }
    
    .summary-label {
      font-size: 8pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .summary-sublabel {
      font-size: 7pt;
      color: #666;
    }
    
    .summary-value {
      font-size: 11pt;
      font-weight: bold;
    }
    
    /* Risks section */
    .risks-list {
      list-style: none;
      padding: 0;
    }
    
    .risks-list li {
      margin-bottom: 8px;
      padding-left: 5px;
    }
    
    .risks-list li::before {
      content: "*";
      font-weight: bold;
      margin-right: 5px;
    }
    
    /* Contact info */
    .contact-info {
      margin-bottom: 10px;
    }
    
    .contact-info p {
      margin-bottom: 5px;
    }
    
    /* Fees table */
    .fees-grid {
      display: table;
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    
    .fees-row {
      display: table-row;
    }
    
    .fees-col {
      display: table-cell;
      width: 33.33%;
      padding: 5px;
      vertical-align: top;
      border: 1px solid #ccc;
    }
    
    .fees-col h5 {
      font-size: 8pt;
      font-weight: bold;
      margin-bottom: 5px;
      text-decoration: underline;
    }
    
    .fee-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 8pt;
    }
    
    .fee-value {
      text-align: right;
    }
    
    .value-na {
      color: #666;
    }
    
    .fees-total {
      border-top: 1px solid #333;
      padding-top: 5px;
      margin-top: 10px;
      font-weight: bold;
    }
    
    /* Terms and conditions grid */
    .terms-grid {
      display: table;
      width: 100%;
      border-collapse: collapse;
    }
    
    .terms-row {
      display: table-row;
    }
    
    .terms-col {
      display: table-cell;
      width: 33.33%;
      padding: 5px;
      vertical-align: top;
      border: 1px solid #ccc;
    }
    
    .terms-col h5 {
      font-size: 8pt;
      font-weight: bold;
      margin-bottom: 5px;
      text-decoration: underline;
    }
    
    .term-row {
      margin-bottom: 5px;
      font-size: 8pt;
    }
    
    /* Repayment schedule table */
    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    
    .schedule-table th {
      background: #333;
      color: #fff;
      padding: 5px;
      text-align: left;
      font-size: 7pt;
    }
    
    .schedule-table td {
      border: 1px solid #ccc;
      padding: 4px;
    }
    
    .schedule-table .text-center {
      text-align: center;
    }
    
    .schedule-table .text-right {
      text-align: right;
    }
    
    .schedule-table .total-row {
      font-weight: bold;
      background: #f5f5f5;
    }
    
    /* Signature section */
    .signature-section {
      margin-top: 20px;
    }
    
    .signature-grid {
      display: table;
      width: 100%;
    }
    
    .signature-row {
      display: table-row;
    }
    
    .signature-col {
      display: table-cell;
      width: 50%;
      padding: 10px;
      vertical-align: top;
    }
    
    .signature-box {
      border: 1px solid #ccc;
      padding: 10px;
      min-height: 100px;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 10px;
      font-size: 8pt;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      height: 40px;
      margin-bottom: 5px;
    }
    
    .signature-placeholder {
      font-size: 8pt;
      color: #666;
    }
    
    .signature-img {
      max-width: 150px;
      max-height: 50px;
    }
    
    .signature-label {
      font-size: 7pt;
      font-style: italic;
      color: #666;
    }
    
    /* Footer info */
    .footer-info {
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      font-size: 8pt;
    }
    
    .footer-info .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    
    /* Certification text */
    .certification-text {
      font-size: 8pt;
      margin-bottom: 10px;
    }
    
    /* Print styles */
    @media print {
      body {
        padding: 0;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>KEY FACTS STATEMENT FOR CONSUMER CREDIT</h1>
      <p class="subtitle">*Review carefully before agreeing to a loan.*</p>
      <p class="subtitle">*You have the right to get a copy of the full loan agreement.*</p>
    </div>

    <!-- SECTION I: KEY TERMS -->
    <div class="section">
      <div class="section-title">SECTION I: KEY TERMS</div>
      
      <div class="key-terms-grid">
        <div class="key-terms-row">
          <!-- LOAN SUMMARY Column -->
          <div class="key-terms-col">
            <h4>LOAN SUMMARY</h4>
            
            <div class="term-item">
              <div class="term-label">1. Amount of Loan:</div>
              <div class="term-sublabel">Amount you are borrowing</div>
              <div class="term-value">${data.currency} ${formatCurrency(data.loanAmount)}</div>
            </div>
            
            <div class="term-item">
              <div class="term-label">2. Duration of Loan Agreement</div>
              <div class="term-value">${data.tenure}</div>
            </div>
            
            <div class="term-item">
              <div class="term-label">3. Amount Received:</div>
              <div class="term-sublabel">Amount you actually receive from the lender</div>
              <div class="term-value">${data.currency} ${formatCurrency(data.disbursedAmount)}</div>
            </div>
          </div>
          
          <!-- COST OF CREDIT Column -->
          <div class="key-terms-col">
            <h4>COST OF CREDIT</h4>
            
            <div class="term-item">
              <div class="term-label">4. Interest:</div>
              <div class="term-sublabel">Interest you will be charged on the loan</div>
              <div class="term-value">${data.currency} ${formatCurrency(data.interest)}</div>
            </div>
            
            <div class="term-item">
              <div class="term-label">5. Other Fees and Charges:</div>
              <div class="term-sublabel">See details in Section III</div>
              <div class="term-value">${data.currency} ${formatCurrency(data.fees)}</div>
            </div>
            
            <div class="term-item">
              <div class="term-label">6. Monthly percentage Rate:</div>
              <div class="term-sublabel">Total Cost of Credit as a comparable monthly percentage</div>
              <div class="term-value">${data.monthlyPercentageRate.toFixed(0)}%</div>
            </div>
            
            <div class="term-item">
              <div class="term-label">7. Total Cost of Credit:</div>
              <div class="term-sublabel">All costs for the loan, including interest and fees</div>
              <div class="term-value">${data.currency} ${formatCurrency(data.totalCostOfCredit)}</div>
            </div>
          </div>
          
          <!-- REPAYMENT SCHEDULE Column -->
          <div class="key-terms-col">
            <h4>REPAYMENT SCHEDULE</h4>
            
            <div class="term-item">
              <div class="term-label">7. Date First Payment Due</div>
              <div class="term-value">${data.firstPaymentDate}</div>
            </div>
            
            <div class="term-item">
              <div class="term-label">8. Number of Payments</div>
              <div class="term-value">${data.numberOfPayments}</div>
            </div>
            
            <div class="term-item">
              <div class="term-label">9. Payment Frequency</div>
              <div class="term-value">${data.paymentFrequency}</div>
            </div>
            
            <div class="term-item">
              <div class="term-label">10. Amount Per Payment:</div>
              <div class="term-sublabel">Includes capital, interest, and recurring fees</div>
              <div class="term-value">${data.currency} ${formatCurrency(data.paymentPerPeriod)}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Summary Equation Box -->
      <div class="summary-box">
        <div class="summary-row">
          <div class="summary-cell">
            <div class="summary-label">Amount of Loan</div>
            <div class="summary-sublabel">Amount you are borrowing</div>
            <div class="summary-value">${data.currency} ${formatCurrency(data.loanAmount)}</div>
          </div>
          <div class="summary-operator">+</div>
          <div class="summary-cell">
            <div class="summary-label">Total Cost of Credit:</div>
            <div class="summary-sublabel">All costs for the loan, including interest and fees:</div>
            <div class="summary-value">${data.currency} ${formatCurrency(data.totalCostOfCredit)}</div>
          </div>
          <div class="summary-operator">=</div>
          <div class="summary-cell highlight">
            <div class="summary-label">TOTAL AMOUNT YOU PAY:</div>
            <div class="summary-sublabel">Total amount you pay after making all payments</div>
            <div class="summary-value">${data.currency} ${formatCurrency(data.totalRepayment)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION II: RISKS TO YOU -->
    <div class="section">
      <div class="section-title">SECTION II: RISKS TO YOU</div>
      <ul class="risks-list">
        <li>Late or missing payments may be reported to a credit reference bureau and may severely affect your financial situation, collateral, and ability to reborrow.*</li>
        <li>Your interest rate will change based on changes in the Bank of Zambia's Policy Rate. This change will affect the duration of your loan and your repayment amount.*</li>
      </ul>
    </div>

    <!-- SECTION III: YOUR RIGHTS AND OBLIGATIONS -->
    <div class="section">
      <div class="section-title">SECTION III: YOUR RIGHTS AND OBLIGATIONS</div>
      <div class="contact-info">
        <p><strong>Any questions or complaints?</strong> Call <strong>+260 211 238719</strong>, email <strong>info@goodfellow.co.zm</strong> or write to <strong>P.O. Box 50644 Lusaka</strong> to contact us regarding your question or complaint.</p>
        <p><strong>Unsatisfied with our response to your question or complaint?</strong> Contact the Bank of Zambia for help at <strong>+260 211 399300</strong> or <strong>info@boz.zm</strong> write <strong>BOZ Square Cairo Road Lusaka</strong> or visit <strong>www.boz.zm</strong>.</p>
        <p><strong>Want to pay off your loan early?</strong> You can do so without any penalties or fees. For more information, please call +260 211 238719.</p>
        <p>You are required to make payments on your loan according to your loan agreement and to notify us of any important changes in your situation.</p>
      </div>
    </div>

    <!-- SECTION IV: UPFRONT AND RECURRING FEES -->
    <div class="section">
      <div class="section-title">SECTION IV: UPFRONT AND RECURRING FEES</div>
      <div class="fees-grid">
        <div class="fees-row">
          <div class="fees-col">
            <h5>UPFRONT FEES</h5>
            <div class="fee-item">
              <span>Arrangement fee</span>
              <span>${data.currency}__N/A_</span>
            </div>
            <div class="fee-item">
              <span>Documentation fee</span>
              <span>${data.currency}__N/A_</span>
            </div>
            <div class="fee-item">
              <span>Other (list all):</span>
              <span></span>
            </div>
            ${upfrontFees.map(fee => `
            <div class="fee-item">
              <span>${fee.name}</span>
              <span>${data.currency} ${formatCurrency(fee.amount)}</span>
            </div>
            `).join('')}
          </div>
          
          <div class="fees-col">
            <h5>UPFRONT FEES (cont.)</h5>
            <div class="fee-item">
              <span>Collateral appraisal</span>
              <span>${data.currency}__N/A_</span>
            </div>
            <div class="fee-item">
              <span>Drawdown fee</span>
              <span>${data.currency}__N/A_</span>
            </div>
          </div>
          
          <div class="fees-col">
            <h5>RECURRING FEES</h5>
            <div class="fee-item">
              <span>Credit life insurance</span>
              <span>${data.currency}__N/A__ per _______N/A</span>
            </div>
            <div class="fee-item">
              <span>Management fee</span>
              <span>${data.currency}_N/A per ________</span>
            </div>
            ${recurringFees.map(fee => `
            <div class="fee-item">
              <span>${fee.name}</span>
              <span>${data.currency} ${formatCurrency(fee.amount)} per ${fee.frequency || 'month'}</span>
            </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      <div class="fees-total">
        <div style="display: flex; justify-content: space-between;">
          <span>TOTAL UPFRONT AND RECURRING FEES AND CHARGES (EXCLUDING INTEREST)</span>
          <span>${data.currency}____${data.fees > 0 ? formatCurrency(data.fees) : 'N/A'}__</span>
        </div>
      </div>
    </div>

    <!-- SECTION V: IMPORTANT TERMS AND CONDITIONS TO CONSIDER -->
    <div class="section">
      <div class="section-title">SECTION V: IMPORTANT TERMS AND CONDITIONS TO CONSIDER</div>
      <div class="terms-grid">
        <div class="terms-row">
          <div class="terms-col">
            <h5>LATE PAYMENT PENALTIES</h5>
            <div class="term-row">
              Late fees if payment is more than [${data.lateFeeDays || '__'}] days late:
              <strong>${data.currency}_${data.lateFeeAmount ? formatCurrency(data.lateFeeAmount) : 'N/A'}_</strong>
            </div>
            <div class="term-row">
              Default interest if payment is more than <strong>${data.defaultInterestDays || '10'}</strong> days late
              <strong>${data.defaultInterestRate || '25'}%</strong> per Month
            </div>
          </div>
          
          <div class="terms-col">
            <h5>TERMS AND CONDITIONS</h5>
            <div class="term-row">
              Cash deposit/ mandatory savings: <strong>${data.currency}_${data.mandatorySavings ? formatCurrency(data.mandatorySavings) : 'N/A'}_</strong>
            </div>
            <div class="term-row">
              Variable interest rate applies: <strong>_${data.variableInterestApplies ? 'Yes' : 'N/A'}_</strong>
            </div>
          </div>
          
          <div class="terms-col">
            <h5>TERMS AND CONDITIONS</h5>
            <div class="term-row">
              <strong>COLLATERAL:</strong> You are committing the following as collateral:
            </div>
            <div class="term-row">
              __${data.collateral || 'N/A'}__
            </div>
            <div class="term-row">
              Other:___________________________________
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION VI: REPAYMENT SCHEDULE -->
    <div class="section">
      <div class="section-title">SECTION VI: REPAYMENT SCHEDULE</div>
      <table class="schedule-table">
        <thead>
          <tr>
            <th>Payment Number</th>
            <th>Payment Due Date</th>
            <th>Payment Amount</th>
            <th>Principal</th>
            <th>Interest and Other Fees and Charges</th>
            <th>Remaining Balance</th>
          </tr>
        </thead>
        <tbody>
          ${repaymentScheduleRows}
          <tr class="total-row">
            <td colspan="2" class="text-center"><strong>TOTAL</strong></td>
            <td class="text-right">${formatCurrency(totalPayment)}</td>
            <td class="text-right">${formatCurrency(totalPrincipal)}</td>
            <td class="text-right">${formatCurrency(totalInterestAndFees)}</td>
            <td class="text-right"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Disclaimer and validity -->
    <div class="disclaimer" style="text-align: center; margin: 15px 0;">
      <p>* This information is not final until signed by all parties and does not replace the loan agreement. *</p>
      <p>* This information is valid for ${data.validFor || '………………………'}*</p>
    </div>

    <!-- Certification and Signatures -->
    <div class="signature-section">
      <div class="signature-grid">
        <div class="signature-row">
          <!-- Credit Provider Signature -->
          <div class="signature-col">
            <div class="certification-text">
              <strong>CERTIFIED CORRECT:</strong>
            </div>
            <div class="signature-line">${creditProviderSignatureImg}</div>
            <div class="signature-label">Credit provider representative</div>
          </div>
          
          <!-- Empty space for layout -->
          <div class="signature-col"></div>
        </div>
        
        <div class="signature-row">
          <!-- Borrower Acknowledgment -->
          <div class="signature-col">
            <div class="certification-text">
              <strong>I ACKNOWLEDGE THE RECEIPT OF THIS STATEMENT PRIOR TO SIGNING THE LOAN AGREEMENT:</strong>
            </div>
            <div class="signature-line">${borrowerSignatureImg}</div>
            <div class="signature-label">Borrower</div>
          </div>
          
          <!-- Guarantor Acknowledgment -->
          <div class="signature-col">
            <div class="certification-text">
              <strong>I ACKNOWLEDGE RECEIPT OF THIS STATEMENT PRIOR TO SIGNING THE GUARANTEE:</strong>
            </div>
            <div class="signature-line">${guarantorSignatureImg}</div>
            <div class="signature-label">Guarantor (if applicable)</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Info -->
    <div class="footer-info">
      <div class="row">
        <span><strong>Name of Borrower:</strong> ${data.clientName} ${data.clientId ? `(${data.clientId})` : ''}</span>
        <span><strong>Application No:</strong> ${data.applicationNo || data.loanId || 'N/A'}</span>
        <span><strong>Date prepared:</strong> ${preparedDate}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export type { KeyFactsData, SignatureData };

