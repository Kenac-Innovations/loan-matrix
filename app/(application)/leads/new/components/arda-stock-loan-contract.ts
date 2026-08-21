import { format } from "date-fns";
import type { ContractData } from "./contract-types";

type SignatureData = {
  borrower?: string | null;
  loanOfficer?: string | null;
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: string | number, currency: string): string {
  const amount = Number(value);
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
  return `${escapeHtml(currency)} ${formatted}`;
}

function signatureMarkup(signature: string | null | undefined, label: string): string {
  if (signature) {
    return `<img src="${escapeHtml(signature)}" alt="${escapeHtml(label)} signature" />`;
  }
  return '<div class="signature-space"></div>';
}

/**
 * Produces the ARDA-specific agreement for an in-kind stock loan. It is kept
 * separate from tenant templates so an ARDA stock issue never renders an
 * unrelated cash-loan contract.
 */
export function generateArdaStockLoanContractHTML(
  data: ContractData,
  signatures: SignatureData = {}
): string {
  const stock = data.stockLoanSelection;
  if (!stock) {
    throw new Error("ARDA stock details are required to generate this agreement.");
  }

  const currency = stock.currencyCode || data.currency || "USD";
  const agreementDate = data.executionDate || format(new Date(), "dd/MM/yyyy");
  const repaymentRows = data.repaymentSchedule
    .map(
      (payment) => `
        <tr>
          <td>${escapeHtml(payment.paymentNumber)}</td>
          <td>${escapeHtml(payment.dueDate)}</td>
          <td>${formatMoney(payment.paymentAmount, currency)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ARDA Agricultural Input Credit Agreement - ${escapeHtml(data.clientName)}</title>
  <style>
    @page { size: A4; margin: 13mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #14251a; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.45; }
    .document { max-width: 190mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 4px solid #347534; padding-bottom: 14px; }
    .brand { color: #225c2b; font-size: 22pt; font-weight: 800; letter-spacing: .08em; }
    .brand-subtitle { margin-top: 2px; color: #537058; font-size: 8.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .reference { text-align: right; color: #425348; font-size: 9pt; }
    h1 { margin: 22px 0 5px; color: #183c1d; font-family: Georgia, "Times New Roman", serif; font-size: 19pt; text-align: center; text-transform: uppercase; }
    .subtitle { margin: 0 0 20px; color: #59705e; font-size: 10pt; text-align: center; }
    .notice { margin: 15px 0; padding: 10px 12px; border-left: 4px solid #d7a329; background: #fbf7e9; color: #52421b; font-size: 9.5pt; }
    h2 { margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #b8cbb8; color: #225c2b; font-size: 11pt; text-transform: uppercase; }
    p { margin: 0 0 10px; }
    .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 10px 0; }
    .detail { padding: 8px 10px; border: 1px solid #d6e1d6; background: #f8fbf8; }
    .label { display: block; color: #5a6c5e; font-size: 8pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .value { display: block; margin-top: 2px; color: #14251a; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; }
    th { padding: 8px; background: #225c2b; color: #fff; font-size: 8.5pt; text-align: left; text-transform: uppercase; }
    td { padding: 8px; border: 1px solid #d6e1d6; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fbf8; }
    ol { margin: 8px 0 0; padding-left: 21px; }
    li { margin: 0 0 8px; }
    .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; margin-top: 28px; page-break-inside: avoid; }
    .signature { min-height: 100px; border-top: 1px solid #46634b; padding-top: 6px; }
    .signature img { display: block; max-width: 180px; max-height: 55px; margin-bottom: 6px; object-fit: contain; }
    .signature-space { height: 58px; }
    .signature-label { font-size: 9pt; font-weight: 700; }
    .signature-note { color: #5a6c5e; font-size: 8.5pt; }
    .footer { margin-top: 25px; padding-top: 8px; border-top: 1px solid #b8cbb8; color: #5a6c5e; font-size: 8pt; text-align: center; }
    @media print { .document { max-width: none; } }
  </style>
</head>
<body>
  <main class="document">
    <header class="header">
      <div>
        <div class="brand">ARDA</div>
        <div class="brand-subtitle">Agricultural and Rural Development Authority</div>
      </div>
      <div class="reference">
        <strong>Agricultural Input Credit Agreement</strong><br />
        Agreement reference: ${escapeHtml(data.loanId || "Pending") }<br />
        Issuing office: ${escapeHtml(stock.fineractOfficeName || data.branch)}<br />
        Agreement date: ${escapeHtml(agreementDate)}
      </div>
    </header>

    <h1>Agricultural Input Credit Agreement</h1>
    <p class="subtitle">In-kind agricultural inputs issued on credit</p>

    <div class="notice">
      This agreement records the issue of agricultural inputs by the Agricultural and Rural Development Authority (ARDA) to the farmer named below. The credit value is the agreed value of the inputs issued, not a cash payment to the farmer.
    </div>

    <h2>1. Parties and Programme Details</h2>
    <div class="details">
      <div class="detail"><span class="label">Lender / Issuing Authority</span><span class="value">Agricultural and Rural Development Authority (ARDA)</span></div>
      <div class="detail"><span class="label">Farmer / Borrower</span><span class="value">${escapeHtml(data.clientName)}</span></div>
      <div class="detail"><span class="label">National Identification Number</span><span class="value">${escapeHtml(data.nrc)}</span></div>
      <div class="detail"><span class="label">Farmer Account Number</span><span class="value">${escapeHtml(data.accountNumber || data.gflNo || "N/A")}</span></div>
      <div class="detail"><span class="label">Issuing Office</span><span class="value">${escapeHtml(stock.fineractOfficeName || data.branch)}</span></div>
      <div class="detail"><span class="label">Purpose</span><span class="value">${escapeHtml(data.loanPurpose || "Agricultural production inputs")}</span></div>
    </div>
    <p>ARDA is a Government of Zimbabwe parastatal established in terms of the Agricultural and Rural Development Authority Act [Chapter 18:01]. This agreement supports the issue of agricultural inputs for productive farming activities.</p>

    <h2>2. Agricultural Inputs Issued on Credit</h2>
    <table>
      <thead><tr><th>Input Item</th><th>Quantity</th><th>Unit</th><th>Agreed Unit Value</th><th>Total Credit Value</th></tr></thead>
      <tbody><tr>
        <td>${escapeHtml(stock.inventoryItemName)}</td>
        <td>${escapeHtml(stock.quantity)}</td>
        <td>${escapeHtml(stock.unitOfMeasure || "units")}</td>
        <td>${formatMoney(stock.unitValue, currency)}</td>
        <td><strong>${formatMoney(stock.totalValue, currency)}</strong></td>
      </tr></tbody>
    </table>
    <p>The farmer acknowledges receipt of the listed inputs in good order and condition. The total credit value above is the principal amount recorded for this agreement.</p>

    <h2>3. Credit and Repayment Terms</h2>
    <div class="details">
      <div class="detail"><span class="label">Principal Credit Value</span><span class="value">${formatMoney(data.loanAmount, currency)}</span></div>
      <div class="detail"><span class="label">Interest Rate</span><span class="value">${escapeHtml(data.monthlyPercentageRate.toFixed(2))}% per month</span></div>
      <div class="detail"><span class="label">Repayment Period</span><span class="value">${escapeHtml(data.tenure)}</span></div>
      <div class="detail"><span class="label">Total Amount Payable</span><span class="value">${formatMoney(data.totalRepayment, currency)}</span></div>
    </div>
    <table>
      <thead><tr><th>Instalment</th><th>Due Date</th><th>Amount Due</th></tr></thead>
      <tbody>${repaymentRows || '<tr><td colspan="3">Repayment schedule will be confirmed on loan approval.</td></tr>'}</tbody>
    </table>

    <h2>4. Farmer Commitments</h2>
    <ol>
      <li>Use the inputs solely for the agricultural production activity approved under this agreement.</li>
      <li>Keep the inputs secure, use them responsibly, and promptly report any loss, damage, or material issue affecting their intended use.</li>
      <li>Make each repayment in full on or before the due date shown in the repayment schedule.</li>
      <li>Cooperate with ARDA officers, extension personnel, and authorised programme monitoring activities reasonably connected to the funded agricultural activity.</li>
      <li>Notify ARDA promptly if circumstances arise that may materially affect production or the ability to meet repayments.</li>
    </ol>

    <h2>5. Default and Recovery</h2>
    <p>If a repayment is overdue or a material commitment in this agreement is breached, ARDA may apply its approved recovery procedures and take any lawful action available to it. Any recovery action will be subject to applicable Zimbabwean law and ARDA programme policies.</p>

    <h2>6. Acknowledgement and Signatures</h2>
    <p>By signing below, the farmer confirms that the information in this agreement is correct, the listed agricultural inputs have been received, and the repayment obligations are understood. The ARDA representative confirms the recorded issue of inputs on behalf of ARDA.</p>
    <section class="signatures">
      <div class="signature">
        ${signatureMarkup(signatures.borrower, "Farmer")}
        <div class="signature-label">Farmer / Borrower: ${escapeHtml(data.clientName)}</div>
        <div class="signature-note">Signature and date</div>
      </div>
      <div class="signature">
        ${signatureMarkup(signatures.loanOfficer, "ARDA representative")}
        <div class="signature-label">ARDA Authorised Representative: ${escapeHtml(data.loanOfficer || "")}</div>
        <div class="signature-note">Signature and date</div>
      </div>
      <div class="signature"><div class="signature-space"></div><div class="signature-label">Witness 1</div><div class="signature-note">Name, signature and date</div></div>
      <div class="signature"><div class="signature-space"></div><div class="signature-label">Witness 2</div><div class="signature-note">Name, signature and date</div></div>
    </section>

    <footer class="footer">ARDA Agricultural Input Credit Agreement | Agreement reference: ${escapeHtml(data.loanId || "Pending")} | Page 1</footer>
  </main>
</body>
</html>`;
}
