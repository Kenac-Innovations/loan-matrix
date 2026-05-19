import type { RcfContractData } from "./rcf-contract-types";

const fmt = (n: number, symbol = ""): string =>
  `${symbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function generateRcfContractHTML(data: RcfContractData): string {
  const symbol = data.currencySymbol || data.currency;
  const creditLimitFmt = fmt(data.creditLimit, symbol);
  const availableFmt = fmt(data.availableBalance, symbol);
  const utilizedFmt = fmt(data.utilizedAmount, symbol);
  const totalDisbursedFmt = fmt(data.drawdownSummary.totalDisbursed, symbol);
  const totalRepaidFmt = fmt(data.drawdownSummary.totalRepaid, symbol);
  const interestRate = data.nominalInterestRate != null ? `${data.nominalInterestRate}% per annum` : "As per product terms";
  const tenor = data.tenorMonths != null ? `${data.tenorMonths} months` : "Open-ended";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Revolving Credit Facility Agreement — ${data.clientName}</title>
  <style>
    @page { margin: 0.6in; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #111;
      background: #fff;
      padding: 24px;
    }
    .container { max-width: 780px; margin: 0 auto; }

    /* Header */
    .header {
      text-align: center;
      border-bottom: 2px solid #111;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .header h1 {
      font-size: 15px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .header .subtitle { font-size: 10px; color: #555; }

    /* Summary box */
    .summary-box {
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 12px 14px;
      margin-bottom: 18px;
      background: #f9f9f9;
    }
    .summary-box table { width: 100%; border-collapse: collapse; }
    .summary-box td {
      padding: 3px 8px 3px 0;
      font-size: 11px;
      vertical-align: top;
      width: 50%;
    }
    .summary-box td.label { font-weight: bold; white-space: nowrap; }

    /* Sections */
    .section { margin-bottom: 16px; }
    .section-title {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 3px;
      margin-bottom: 8px;
    }
    p { margin-bottom: 6px; text-align: justify; }

    /* Parties */
    .party-block { margin-bottom: 8px; }
    .party-name { font-weight: bold; }
    .party-detail { margin-left: 0; }

    /* Drawdown table */
    .summary-stats { display: flex; gap: 24px; flex-wrap: wrap; }
    .stat { }
    .stat .val { font-weight: bold; }

    /* Numbered list */
    ol.terms { padding-left: 20px; margin: 6px 0; }
    ol.terms li { margin-bottom: 5px; text-align: justify; }
    ul.bullets { padding-left: 18px; margin: 4px 0; }
    ul.bullets li { margin-bottom: 3px; }

    /* Signature area */
    .signatures { margin-top: 28px; }
    .sig-row { display: flex; justify-content: space-between; margin-bottom: 28px; }
    .sig-block { width: 46%; }
    .sig-line {
      border-bottom: 1px dotted #555;
      min-height: 36px;
      display: block;
      margin-bottom: 4px;
    }
    .sig-label { font-size: 10px; color: #444; }

    /* Footer */
    .doc-footer {
      margin-top: 24px;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      text-align: center;
      font-size: 9px;
      color: #777;
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
    <h1>Revolving Credit Facility Agreement</h1>
    <div class="subtitle">${data.lenderName} &mdash; ${data.branch}</div>
  </div>

  <!-- Summary box -->
  <div class="summary-box">
    <table>
      <tr>
        <td class="label">Account No.:</td>
        <td>${data.accountNo || "N/A"}</td>
        <td class="label">Activation Date:</td>
        <td>${data.activationDate}</td>
      </tr>
      <tr>
        <td class="label">Credit Limit:</td>
        <td>${creditLimitFmt}</td>
        <td class="label">Tenor:</td>
        <td>${tenor}</td>
      </tr>
      <tr>
        <td class="label">Available Balance:</td>
        <td>${availableFmt}</td>
        <td class="label">Interest Rate:</td>
        <td>${interestRate}</td>
      </tr>
      <tr>
        <td class="label">Utilized Amount:</td>
        <td>${utilizedFmt}</td>
        <td class="label">Max Drawdowns:</td>
        <td>${data.maxDrawdowns}</td>
      </tr>
    </table>
  </div>

  <!-- Parties -->
  <div class="section">
    <div class="section-title">Parties to this Agreement</div>

    <div class="party-block">
      <span class="party-name">THE LENDER:</span>
      <span class="party-detail">&nbsp;${data.lenderName} (&ldquo;the Lender&rdquo;), ${data.branch} Branch</span>
    </div>

    <div class="party-block">
      <span class="party-name">THE BORROWER:</span>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-left:0;margin-bottom:8px;">
      <tr>
        <td style="padding:2px 6px 2px 0;width:25%;font-weight:bold;">Full Name:</td>
        <td style="padding:2px 0;">${data.clientName}</td>
        <td style="padding:2px 6px 2px 16px;width:25%;font-weight:bold;">National ID:</td>
        <td style="padding:2px 0;">${data.nationalId || "N/A"}</td>
      </tr>
      <tr>
        <td style="padding:2px 6px 2px 0;font-weight:bold;">Date of Birth:</td>
        <td>${data.dateOfBirth || "N/A"}</td>
        <td style="padding:2px 6px 2px 16px;font-weight:bold;">Gender:</td>
        <td>${data.gender || "N/A"}</td>
      </tr>
      <tr>
        <td style="padding:2px 6px 2px 0;font-weight:bold;">Mobile:</td>
        <td>${data.mobileNo || "N/A"}</td>
        <td style="padding:2px 6px 2px 16px;font-weight:bold;">Credit Officer:</td>
        <td>${data.fieldOfficerName || "N/A"}</td>
      </tr>
    </table>
  </div>

  <!-- Facility Terms -->
  <div class="section">
    <div class="section-title">Facility Terms</div>
    <ol class="terms">
      <li>The Lender agrees to make available to the Borrower a revolving credit facility of up to <strong>${creditLimitFmt}</strong> (&ldquo;the Credit Limit&rdquo;) under the terms set out in this Agreement.</li>
      <li>The facility shall remain available for a period of <strong>${tenor}</strong> commencing on the Activation Date, subject to satisfactory conduct of the account.</li>
      <li>A nominal annual interest rate of <strong>${interestRate}</strong> shall be charged on the outstanding drawn balance. Interest shall accrue daily and be applied to the savings account in accordance with the product schedule.</li>
      <li>The Borrower may make up to <strong>${data.maxDrawdowns}</strong> drawdown requests during the life of this facility. Each drawdown must not exceed the available balance at the time of the request.</li>
      <li>All amounts drawn under this facility are denominated in <strong>${data.currency}</strong>.</li>
    </ol>
  </div>

  <!-- Drawdown Conditions -->
  <div class="section">
    <div class="section-title">Conditions for Drawdown</div>
    <ol class="terms">
      <li>Each drawdown request must be submitted in writing or through the Lender&apos;s approved digital platform and is subject to approval by the Lender.</li>
      <li>A drawdown will be approved only if:
        <ul class="bullets">
          <li>The requested amount does not exceed the available credit balance;</li>
          <li>The Borrower&apos;s account is in good standing with no arrears;</li>
          <li>The total number of drawdowns taken has not exceeded the maximum of ${data.maxDrawdowns}.</li>
        </ul>
      </li>
      <li>Funds will be disbursed to the savings account linked to this facility (Account No. <strong>${data.accountNo || "N/A"}</strong>) within the Lender&apos;s normal processing period.</li>
    </ol>
  </div>

  <!-- Repayment Obligations -->
  <div class="section">
    <div class="section-title">Repayment Obligations</div>
    <ol class="terms">
      <li>The Borrower agrees to repay all amounts drawn, together with accrued interest, as agreed at the time of each drawdown.</li>
      <li>Repayments are applied as deposits to the linked savings account, which restores the available credit balance up to the Credit Limit.</li>
      <li>The Borrower shall ensure that the full outstanding balance, including all accrued interest and charges, is repaid no later than the expiry of the facility tenor.</li>
      <li>The Lender may, in its discretion, apply any credit balance in the savings account towards amounts owing under this facility.</li>
    </ol>
  </div>

  <!-- Events of Default -->
  <div class="section">
    <div class="section-title">Events of Default</div>
    <p>The following shall each constitute an event of default:</p>
    <ol class="terms">
      <li>Failure to repay any drawdown in accordance with agreed terms;</li>
      <li>Any material misrepresentation made by the Borrower in connection with this facility;</li>
      <li>Insolvency or inability of the Borrower to service the facility;</li>
      <li>Any other event that, in the Lender&apos;s reasonable opinion, materially threatens repayment.</li>
    </ol>
    <p style="margin-top:6px;">Upon an event of default the Lender may, without notice, suspend drawdown rights, declare the full outstanding balance immediately due and payable, and take such steps as are necessary to recover amounts owing.</p>
  </div>

  <!-- Facility Activity at Signing -->
  <div class="section">
    <div class="section-title">Facility Activity at Date of Signing</div>
    <div class="summary-stats">
      <div class="stat"><span class="val">${data.drawdownSummary.count}</span> drawdown(s) taken</div>
      <div class="stat">Total disbursed: <span class="val">${totalDisbursedFmt}</span></div>
      <div class="stat">Total repaid: <span class="val">${totalRepaidFmt}</span></div>
      <div class="stat">Current balance utilized: <span class="val">${utilizedFmt}</span></div>
    </div>
  </div>

  <!-- Declaration -->
  <div class="section">
    <div class="section-title">Declaration</div>
    <p>
      I, <strong>${data.clientName}</strong>, confirm that I have read and fully understood the terms of this Revolving Credit Facility Agreement, that the terms have been explained to me in a language I understand, and that I accept all obligations set out herein.
    </p>
    <p>
      Signed at <strong>${data.branch}</strong> on this <strong>${data.executionDay}</strong> day of <strong>${data.executionMonth}</strong> <strong>${data.executionYear}</strong>.
    </p>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-row">
      <div class="sig-block">
        <p style="margin-bottom:6px;font-weight:bold;">Borrower</p>
        <span class="sig-line"></span>
        <div class="sig-label">Signature</div>
        <div class="sig-label" style="margin-top:6px;">${data.clientName}</div>
        <div class="sig-label">Date: ___________________</div>
      </div>
      <div class="sig-block">
        <p style="margin-bottom:6px;font-weight:bold;">Credit Officer / Lender Representative</p>
        <span class="sig-line"></span>
        <div class="sig-label">Signature</div>
        <div class="sig-label" style="margin-top:6px;">${data.fieldOfficerName || "___________________________"}</div>
        <div class="sig-label">Date: ___________________</div>
      </div>
    </div>

    <div class="sig-row">
      <div class="sig-block">
        <p style="margin-bottom:6px;font-weight:bold;">Witness</p>
        <span class="sig-line"></span>
        <div class="sig-label">Signature</div>
        <div class="sig-label" style="margin-top:6px;">Name: ___________________________</div>
        <div class="sig-label">Date: ___________________</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="doc-footer">
    <p>${data.lenderName} &mdash; Revolving Credit Facility Agreement</p>
    <p>Account No. ${data.accountNo || "N/A"} &mdash; Executed ${data.executionDate}</p>
  </div>

</div>
</body>
</html>`;
}
