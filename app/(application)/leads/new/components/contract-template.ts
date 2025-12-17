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
  const chargesTableRows = data.charges
    .map(
      (charge) =>
        `<tr><td>${charge.name}</td><td>${formatCurrency(
          charge.amount
        )}</td><td>-</td></tr>`
    )
    .join("");

  const repaymentScheduleRows = data.repaymentSchedule
    .map(
      (period) =>
        `<tr><td>${period.paymentNumber}</td><td>${
          period.dueDate
        }</td><td>${formatCurrency(
          period.paymentAmount
        )}</td><td>${formatCurrency(period.principal)}</td><td>${formatCurrency(
          period.interestAndFees
        )}</td><td>${formatCurrency(period.remainingBalance)}</td></tr>`
    )
    .join("");

  const signatureTimestamp = format(new Date(), "dd/MM/yyyy HH:mm");
  const preparedDate = format(new Date(), "dd/MM/yyyy");
  const preparedYear = format(new Date(), "yyyy");

  const borrowerSignatureImg = signatures.borrower
    ? `<img src="${signatures.borrower}" alt="Borrower Signature" style="max-width:120px;max-height:50px;border:1px solid #e6eef2;border-radius:3px" />`
    : '<div style="border:1px dashed #e6eef2;padding:20px;text-align:center;color:#6b7280;font-size:8px">Signature required</div>';

  const logoImage =
    '<img src="/gfl-logo.png" alt="GFL Logo" style="max-width:60px;max-height:60px;display:block;margin:0 auto 4px auto" />';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>GFL - Key Facts Statement and Nano Loan Product Contract</title>
  <style>
    @page { margin: 0.4in; size: A4; }
    body{font-family:Arial,Helvetica,sans-serif;line-height:1.2;color:#0f1724;background:#fbfdff;margin:0;padding:8px;font-size:10px}
    .container{max-width:100%;margin:0 auto}
    header{margin-bottom:6px;overflow:hidden;padding-bottom:2px;border-bottom:1px solid #e6eef2;text-align:center}
    header > div{display:block;text-align:center}
    header img{display:block;margin:0 auto 4px auto;max-width:50px;max-height:50px}
    .logo{width:40px;height:40px;border-radius:4px;background:#004f73;display:block;text-align:center;line-height:40px;color:white;font-weight:700;font-size:14px;margin:0 auto 4px auto}
    h1{font-size:12px;margin:0 0 2px 0;color:#004f73;display:block;text-align:center}
    .meta{color:#6b7280;font-size:9px;margin-top:1px;text-align:center}

    .section{background:#ffffff;border:1px solid #e6eef2;border-radius:4px;padding:8px;margin-bottom:6px}
    h2{font-size:11px;color:#004f73;margin:0 0 3px 0;font-weight:700}
    h3{font-size:10px;color:#00a5c4;margin:4px 0 3px 0;font-weight:600}

    .row{display:block;overflow:hidden;margin-bottom:3px}
    .col{display:inline-block;width:31.33%;vertical-align:top;margin-right:1%;margin-bottom:3px;box-sizing:border-box}
    label{display:block;font-weight:600;margin-bottom:1px;color:#0b2b3b;font-size:9px}
    .value{background:#f1fcff;border:1px solid #e6eef2;padding:3px 5px;border-radius:3px;color:#0f1724;min-height:14px;font-size:9px}

    table{width:100%;border-collapse:collapse;margin-top:3px;font-size:8px}
    table th, table td{border:1px solid #e6eef2;padding:3px 4px;text-align:left}
    thead th{background:#004f73;color:white;font-weight:700;font-size:8px;padding:3px 4px}

    ul{margin:3px 0 0 14px;padding-left:10px;font-size:9px}
    ol{margin:3px 0 0 14px;padding-left:10px;font-size:9px}
    li{margin-bottom:1px;line-height:1.2}

    p{margin:3px 0;font-size:9px;line-height:1.2}

    .signature{margin-top:6px;display:block;overflow:hidden}
    .signature > div{display:inline-block;width:48%;vertical-align:top;margin-right:2%}
    .signature img{max-width:120px;max-height:50px;border:1px solid #e6eef2;border-radius:3px}
    .signature p{margin:1px 0;font-size:8px}
    .small{font-size:8px;color:#6b7280}
    
    .schedule-compact table{font-size:7px}
    .schedule-compact table th, .schedule-compact table td{padding:2px 3px}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div style="text-align:center">
        ${logoImage}
        <h1>GOODFELLOW FINANCE LIMITED (GFL)</h1>
        <div class="meta">Key Facts Statement and Nano Loan Product Contract</div>
      </div>
    </header>

    <!-- KEY FACTS STATEMENT -->
    <section class="section" id="key-facts-statement">
      <h2>ANNEX 1 - KEY FACTS STATEMENT FOR CONSUMER CREDIT</h2>
      <p class="small">Review carefully before agreeing to a loan. You have the right to get a copy of the full loan agreement.</p>

      <h3>SECTION I: KEY TERMS</h3>
      <div class="row">
        <div class="col">
          <label>1. Amount of Loan</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.loanAmount
  )}</div>
        </div>
        <div class="col">
          <label>2. Duration of Loan Agreement</label>
          <div class="value">${data.tenure}</div>
        </div>
        <div class="col">
          <label>3. Amount Received</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.disbursedAmount
  )}</div>
        </div>
      </div>

      <div class="row">
        <div class="col">
          <label>4. Interest</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.interest
  )}</div>
        </div>
        <div class="col">
          <label>5. Other Fees and Charges (Section III)</label>
          <div class="value">${data.currency} ${formatCurrency(data.fees)}</div>
        </div>
        <div class="col">
          <label>6. Percentage Rate</label>
          <div class="value">${data.monthlyPercentageRate.toFixed(2)}%</div>
        </div>
      </div>

      <div class="row">
        <div class="col">
          <label>7. Date First Payment Due</label>
          <div class="value">${data.firstPaymentDate}</div>
        </div>
        <div class="col">
          <label>8. Number of Payments</label>
          <div class="value">${data.numberOfPayments}</div>
        </div>
        <div class="col">
          <label>9. Payment Frequency</label>
          <div class="value">${data.paymentFrequency}</div>
        </div>
      </div>

      <div class="row">
        <div class="col">
          <label>10. Amount Per Payment</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.paymentPerPeriod
  )}</div>
        </div>
        <div class="col">
          <label>11. Total Cost of Credit</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.totalCostOfCredit
  )}</div>
        </div>
        <div class="col">
          <label>12. TOTAL AMOUNT YOU PAY</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.totalRepayment
  )}</div>
        </div>
      </div>

      <h3>SECTION II: RISKS TO YOU</h3>
      <ul>
        <li>Late or missing payments may be reported to a credit reference bureau and may severely affect your financial situation, collateral, and ability to reborrow.</li>
        <li>Your interest rate will change based on changes in the Bank of Zambia Policy Rate. This change will affect the duration of your loan and your repayment amount.</li>
      </ul>

      <h3>SECTION III: YOUR RIGHTS AND OBLIGATIONS</h3>
      <p>Any questions or complaints? Call <strong>+260 211 238719</strong>, email <a href="mailto:info@goodfellow.co.zm">info@goodfellow.co.zm</a> or write to P.O. Box 50644 Lusaka.</p>
      <p class="small">Unsatisfied with our response? Contact the Bank of Zambia at <strong>+260 211 399300</strong> or <a href="mailto:info@boz.zm">info@boz.zm</a>. Visit <a href="https://www.boz.zm">www.boz.zm</a>.</p>
      <p>You may pay off your loan early without penalties. You are required to make payments according to your loan agreement and to notify us of important changes in your situation.</p>

      <h3>SECTION IV: UPFRONT AND RECURRING FEES</h3>
      <table>
        <thead>
          <tr><th>Fee</th><th>Amount (${data.currency})</th><th>Notes</th></tr>
        </thead>
        <tbody>
          ${chargesTableRows}
          <tr><td><strong>Total (excluding interest)</strong></td><td><strong>${formatCurrency(
            data.fees
          )}</strong></td><td></td></tr>
        </tbody>
      </table>

      <h3>SECTION V: IMPORTANT TERMS AND CONDITIONS</h3>
      <p style="margin:2px 0"><strong>Late payment interest arrears:</strong> As per agreement | <strong>Default interest:</strong> As per agreement | <strong>Cash deposit:</strong> None</p>
      <p style="margin:2px 0"><strong>Variable interest rate applies:</strong> Yes | <strong>Collateral:</strong> As per agreement</p>

      <h3>SECTION VI: REPAYMENT SCHEDULE</h3>
      <div class="schedule-compact">
        <table>
          <thead>
            <tr><th>#</th><th>Due Date</th><th>Amount</th><th>Principal</th><th>Interest and Fees</th><th>Balance</th></tr>
          </thead>
          <tbody>
            ${repaymentScheduleRows}
          </tbody>
        </table>
      </div>

      <p class="small" style="margin:4px 0">This information is not final until signed by all parties and does not replace the loan agreement.</p>

      <div class="signature">
        <div>
          <p style="margin:2px 0"><strong>Borrower (I acknowledge receipt prior to signing)</strong></p>
          <p style="margin:2px 0">Name: <span class="value" style="display:inline;padding:2px 4px">${
            data.clientName
          }</span></p>
          <p style="margin:2px 0">Signature:</p>
          ${borrowerSignatureImg}
          <p class="small" style="margin:2px 0">Date and Time: ${signatureTimestamp}</p>
        </div>
      </div>

      <p class="small" style="margin:4px 0;text-align:center">Name of Borrower: ${
        data.clientName
      } | Application No: ${
    data.loanId || "N/A"
  } | Date prepared: ${preparedDate}</p>
    </section>

    <!-- SALARY ADVANCE CONTRACT -->
    <section class="section" id="nano-loan-contract">
      <div style="text-align:center;margin-bottom:8px">
        ${logoImage}
        <h1 style="font-size:12px;margin:0 0 2px 0;color:#004f73">GOODFELLOW FINANCE LIMITED (GFL)</h1>
      </div>
      <h2>SALARY ADVANCE CONTRACT</h2>
      <p class="small">GFL/LC/${preparedYear}/${data.gflNo || "N/A"}</p>

      <div class="row">
        <div class="col">
          <label>GFL NO.</label>
          <div class="value">${data.gflNo || "N/A"}</div>
        </div>
        <div class="col">
          <label>NRC</label>
          <div class="value">${data.nrc}</div>
        </div>
        <div class="col">
          <label>LOAN ID</label>
          <div class="value">${data.loanId || "N/A"}</div>
        </div>
      </div>

      <div style="margin-top:12px" class="row">
        <div class="col">
          <label>Loan Amount</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.loanAmount
  )}</div>
        </div>
        <div class="col">
          <label>Tenure</label>
          <div class="value">${data.tenure}</div>
        </div>
        <div class="col">
          <label>Payment Due</label>
          <div class="value">${data.firstPaymentDate}</div>
        </div>
      </div>

      <div style="margin-top:12px" class="row">
        <div class="col">
          <label>Interest</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.interest
  )}</div>
        </div>
        <div class="col">
          <label>Service Fee</label>
          <div class="value">${data.currency} ${formatCurrency(data.fees)}</div>
        </div>
        <div class="col">
          <label>Total Cost of Borrowing</label>
          <div class="value">${data.currency} ${formatCurrency(
    data.totalCostOfCredit
  )}</div>
        </div>
      </div>

      <h3 style="margin-top:12px">Parties</h3>
      <p><strong>Lender:</strong> Goodfellow Finance Limited ("Lender")</p>
      <p><strong>Borrower:</strong> <span class="value">${
        data.clientName
      }</span> NRC: <span class="value">${
    data.nrc
  }</span> DOB: <span class="value">${data.dateOfBirth}</span></p>
      <p>Employee No.: <span class="value">${
        data.employeeNo || "N/A"
      }</span> Employer: <span class="value">${
    data.employer || "N/A"
  }</span></p>

      <h3 style="margin-top:12px">Obligations and Permissions</h3>
      <ol>
        <li>Notify the Lender immediately of changes to address, contact, bank details, employment or financial condition.</li>
        <li>The Borrower permits the Lender to draw against any bank account registered to the borrower (costs for bounced direct debit apply).</li>
        <li>The Lender may obtain and verify credit information from licensed Credit Reference Bureaux.</li>
        <li>In case of collection failure through Direct Debit, payroll deduction may be used to recover the amount owed.</li>
        <li>Reschedule outstanding balance if repayment is not completed within the scheduled month; full monthly interest and administrative fees may apply.</li>
        <li>The Lender may take legal action in Zambia; borrower agrees to repay expenses and legal costs incurred in recovery.</li>
      </ol>

      <h3 style="margin-top:12px">Declaration and Signatures</h3>
      <p>I <span class="value">${
        data.clientName
      }</span> confirm that I have read and understood the terms of this Nano Loan Product contract.</p>

      <div style="margin-top:12px" class="row">
        <div class="col">
          <p>Signed at: <span class="value">${data.branch}</span></p>
          <p>Date: <span class="value">${preparedDate}</span></p>
          <p style="margin-top:8px">Loan Purpose: <span class="value">${
            data.loanPurpose || "N/A"
          }</span></p>
          <p style="margin-top:8px"><strong>Borrower Name:</strong> <span class="value">${
            data.clientName
          }</span></p>
          <p><strong>Borrower Signature:</strong></p>
          ${borrowerSignatureImg}
          <p class="small" style="margin-top:5px">Date and Time: ${signatureTimestamp}</p>
        </div>
      </div>

    </section>
  </div>
</body>
</html>`;
}
