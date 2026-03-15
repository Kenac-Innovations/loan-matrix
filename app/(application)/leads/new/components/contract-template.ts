import { format } from "date-fns";

interface ContractData {
  clientName: string;
  nrc: string;
  dateOfBirth: string;
  gender: string;
  employeeNo?: string;
  employer?: string;
  gflNo?: string;
  loanId?: string;
  loanAmount: number;
  disbursedAmount: number;
  tenure: string;
  numberOfPayments: number;
  paymentFrequency: string;
  firstPaymentDate: string;
  interest: number;
  fees: number;
  totalCostOfCredit: number;
  totalRepayment: number;
  paymentPerPeriod: number;
  monthlyPercentageRate: number;
  repaymentSchedule: Array<{
    paymentNumber: number;
    dueDate: string;
    paymentAmount: number;
    principal: number;
    interestAndFees: number;
    remainingBalance: number;
  }>;
  charges: Array<{
    name: string;
    amount: number;
  }>;
  currency: string;
  branch: string;
  loanOfficer?: string;
  loanPurpose?: string;
}

interface SignatureData {
  borrower?: string | null;
  guarantor?: string | null;
  loanOfficer?: string | null;
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function generateContractHTML(
  data: ContractData,
  signatures: SignatureData = {}
): string {
  const signatureTimestamp = format(new Date(), "dd/MM/yyyy HH:mm");
  const preparedDate = format(new Date(), "EEEE, dd MMMM yyyy");
  const preparedYear = format(new Date(), "yyyy");

  const borrowerSignatureImg = signatures.borrower
    ? `<img src="${signatures.borrower}" alt="Borrower Signature" style="max-width:200px;max-height:60px;border-bottom:1px solid #000" />`
    : '<div style="border-bottom:1px dotted #000;width:200px;height:40px;display:inline-block"></div>';

  const loanOfficerSignatureImg = signatures.loanOfficer
    ? `<img src="${signatures.loanOfficer}" alt="Loan Officer Signature" style="max-width:200px;max-height:60px;border-bottom:1px solid #000" />`
    : '<div style="border-bottom:1px dotted #000;width:200px;height:40px;display:inline-block"></div>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Salary Advance Contract - ${data.clientName}</title>
  <style>
    @page { margin: 0.5in; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.4;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 20px;
      font-size: 11px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #000;
    }
    .header h1 {
      font-size: 18px;
      font-weight: bold;
      margin: 0 0 15px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 10px auto;
      display: block;
    }
    
    /* Info rows */
    .info-row {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 8px;
      font-size: 11px;
    }
    .info-item {
      margin-right: 30px;
      margin-bottom: 5px;
    }
    .info-item strong {
      font-weight: bold;
    }
    .info-item span {
      margin-left: 5px;
    }
    
    /* Sections */
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    
    /* Parties */
    .party {
      margin-bottom: 10px;
    }
    .party-title {
      font-weight: bold;
    }
    .party-details {
      margin-left: 0;
    }
    
    /* Lists */
    .obligations-list, .permissions-list {
      margin: 10px 0;
      padding-left: 25px;
    }
    .obligations-list li, .permissions-list li {
      margin-bottom: 8px;
      text-align: justify;
    }
    .sub-list {
      margin-top: 5px;
      padding-left: 20px;
      list-style-type: disc;
    }
    .sub-list li {
      margin-bottom: 3px;
    }
    
    /* Declaration */
    .declaration {
      margin-top: 20px;
      margin-bottom: 20px;
    }
    .declaration p {
      text-align: justify;
      margin-bottom: 15px;
    }
    
    /* Signatures */
    .signatures {
      margin-top: 30px;
    }
    .signature-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25px;
    }
    .signature-block {
      width: 48%;
    }
    .signature-line {
      border-bottom: 1px dotted #000;
      min-width: 200px;
      display: inline-block;
      min-height: 40px;
      vertical-align: bottom;
    }
    .signature-label {
      margin-top: 5px;
      font-size: 10px;
    }
    
    /* Dotted fill lines */
    .dotted-fill {
      border-bottom: 1px dotted #000;
      display: inline;
    }
    
    @media print {
      body { padding: 0; }
      .container { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <img src="/gfl-logo.png" alt="GFL Logo" class="logo" onerror="this.style.display='none'" />
      <h1>SALARY ADVANCE CONTRACT</h1>
      
      <!-- Top info row -->
      <div class="info-row" style="justify-content: space-between;">
        <div class="info-item">
          <strong>GFL NO.:</strong>
          <span>${data.gflNo || "N/A"}</span>
        </div>
        <div class="info-item">
          <strong>LOAN ID:</strong>
          <span>${data.loanId || "N/A"}</span>
        </div>
        <div class="info-item">
          <strong>BRANCH:</strong>
          <span>${data.branch}</span>
        </div>
      </div>
      
      <!-- NRC and Loan Purpose -->
      <div class="info-row">
        <div class="info-item">
          <strong>NRC:</strong>
          <span>${data.nrc}</span>
        </div>
        <div class="info-item" style="flex: 1;">
          <strong>LOAN PURPOSE:</strong>
          <span>${data.loanPurpose || "..................................................................."}</span>
        </div>
      </div>
      
      <!-- Financial details row -->
      <div class="info-row">
        <div class="info-item">
          <strong>LOAN AMOUNT:</strong>
          <span>${formatCurrency(data.loanAmount)}</span>
        </div>
        <div class="info-item">
          <strong>INTEREST:</strong>
          <span>${formatCurrency(data.interest)}</span>
        </div>
        <div class="info-item">
          <strong>SERVICE FEE:</strong>
          <span>${formatCurrency(data.fees)}</span>
        </div>
        <div class="info-item">
          <strong>TOTAL AMOUNT DUE:</strong>
          <span>${formatCurrency(data.totalRepayment)}</span>
        </div>
        <div class="info-item">
          <strong>TENURE:</strong>
          <span>${data.numberOfPayments}</span>
        </div>
      </div>
      
      <!-- Payment details -->
      <div class="info-row">
        <div class="info-item">
          <strong>PAYMENT DUE DATE:</strong>
          <span>${data.firstPaymentDate}</span>
        </div>
        <div class="info-item">
          <strong>TOTAL COST OF BORROWING:</strong>
          <span>${formatCurrency(data.totalCostOfCredit)}</span>
        </div>
      </div>
    </div>
    
    <!-- PARTIES Section -->
    <div class="section">
      <div class="section-title">PARTIES</div>
      
      <div class="party">
        <span class="party-title">GOODFELLOW FINANCE LIMITED</span>
        <span>(hereinafter called the "Lender")</span>
      </div>
      
      <div class="party">
        <span class="party-title">AND</span>
      </div>
      
      <div class="party">
        <span class="party-title">THE BORROWER:</span>
        <span>${data.clientName}</span>
        <span style="margin-left: 20px;"><strong>NRC:</strong> ${data.nrc}</span>
        <span style="margin-left: 20px;"><strong>DOB:</strong> ${data.dateOfBirth}</span>
      </div>
      
      <div class="party">
        <span><strong>GENDER:</strong> ${data.gender}</span>
        <span style="margin-left: 20px;"><strong>EMPLOYER:</strong> ${data.employer || "N/A"}</span>
        <span style="margin-left: 20px;"><strong>EMPLOYEE NO.:</strong> ${data.employeeNo || "N/A"}</span>
      </div>
    </div>
    
    <!-- OBLIGATIONS Section -->
    <div class="section">
      <div class="section-title">OBLIGATIONS</div>
      <ol class="obligations-list">
        <li>
          Notify the Lender immediately of any changes to the following:
          <ul class="sub-list">
            <li>Address or contact information</li>
            <li>Bank details</li>
            <li>Employment details</li>
            <li>Financial condition</li>
          </ul>
        </li>
      </ol>
    </div>
    
    <!-- PERMISSIONS Section -->
    <div class="section">
      <div class="section-title">PERMISSIONS</div>
      <p>The Borrower hereby permits the Lender to:</p>
      <ol class="permissions-list">
        <li>Draw against any bank account registered in the name of the borrower. The borrower will incur the cost charged on bouncing a direct debit (DDACC).</li>
        <li>Obtain details from any party about the borrower's financial credit worthiness and banking details, including but not limited to credit records and payment history. Obtain and verify the Borrowers credit information, from any licenced Credit Reference Bureau.</li>
        <li>Obtain and verify the Borrowers credit information, from any licenced Credit Reference Bureau.</li>
        <li>In case of collection failure through Direct Debit (DDACC), use payroll deduction to recover the amount owed.</li>
        <li>Reschedule the outstanding balance if the advance repayment is not completed within the scheduled month. In this case, a full monthly interest rate may be applied to the outstanding amount for that period, along with any applicable administrative fees to cover the costs associated with managing the outstanding balance.</li>
        <li>To take legal action against the borrower in a court of competent jurisdiction in Zambia to recover money that is owed and is overdue. In the case of legal action, the borrower agrees to repay all expenses and legal costs incurred by the lender in the recovery of any overdue payment.</li>
      </ol>
    </div>
    
    <!-- DECLARATION Section -->
    <div class="section declaration">
      <div class="section-title">DECLARATION</div>
      <p>
        I <span class="dotted-fill" style="min-width: 250px; display: inline-block;">${data.clientName}</span> confirm that I have read and understood the terms of this salary advance contract, that it has been explained to me, and that I have understood the cost of borrowing for this loan.
      </p>
      
      <p style="margin-top: 20px;">
        Signed at: <span style="margin-left: 10px;">${data.branch}</span>
        <span style="margin-left: 50px;">on</span>
        <span style="margin-left: 10px;">${preparedDate}</span>
      </p>
    </div>
    
    <!-- Signatures -->
    <div class="signatures">
      <div class="signature-row">
        <div class="signature-block">
          <p><strong>Borrower's Name:</strong></p>
          <div class="signature-line">${data.clientName}</div>
        </div>
        <div class="signature-block">
          <p><strong>Borrower's Signature:</strong></p>
          ${borrowerSignatureImg}
        </div>
      </div>
      
      <div class="signature-row">
        <div class="signature-block">
          <p><strong>Loan Officer's Name:</strong></p>
          <div class="signature-line">${data.loanOfficer || ""}</div>
        </div>
        <div class="signature-block">
          <p><strong>Loan Officer's Signature:</strong></p>
          ${loanOfficerSignatureImg}
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 10px;">
      <p>Goodfellow Finance Limited | Licensed by Bank of Zambia</p>
      <p>Contract Reference: GFL/LC/${preparedYear}/${data.gflNo || "N/A"}</p>
    </div>
  </div>
</body>
</html>`;
}
