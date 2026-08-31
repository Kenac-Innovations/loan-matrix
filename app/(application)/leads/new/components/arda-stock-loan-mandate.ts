import { format } from "date-fns";
import type { ContractData } from "./contract-types";

type SignatureData = {
  borrower?: string | null;
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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

/**
 * Generates the ARDA-only repayment mandate for an agricultural input issue.
 * It deliberately does not share the cash-loan mandate wording used by other
 * products in the Omama tenant.
 */
export function generateArdaStockLoanMandateHTML(
  data: ContractData,
  signatures: SignatureData = {},
): string {
  const stock = data.stockLoanSelection;
  if (!stock) {
    throw new Error("ARDA stock details are required to generate this mandate.");
  }

  const currency = stock.currencyCode || data.currency || "USD";
  const mandateDate = data.executionDate || format(new Date(), "dd/MM/yyyy");
  const borrowerSignature = signatures.borrower
    ? `<img src="${escapeHtml(signatures.borrower)}" alt="Farmer signature" />`
    : '<div class="signature-space"></div>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ARDA Agricultural Input Credit Repayment Mandate - ${escapeHtml(data.clientName)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #14251a; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.5; }
    .document { max-width: 180mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 4px solid #347534; padding-bottom: 13px; }
    .brand { color: #225c2b; font-size: 23pt; font-weight: 800; letter-spacing: .08em; }
    .brand-subtitle { color: #537058; font-size: 8.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .reference { text-align: right; color: #425348; font-size: 9pt; }
    h1 { margin: 25px 0 5px; color: #183c1d; font-family: Georgia, "Times New Roman", serif; font-size: 19pt; text-align: center; text-transform: uppercase; }
    .subtitle { margin: 0 0 20px; color: #59705e; text-align: center; }
    .notice { margin: 16px 0; padding: 11px 13px; border-left: 4px solid #d7a329; background: #fbf7e9; color: #52421b; }
    h2 { margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #b8cbb8; color: #225c2b; font-size: 11pt; text-transform: uppercase; }
    .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 10px 0; }
    .detail { padding: 8px 10px; border: 1px solid #d6e1d6; background: #f8fbf8; }
    .label { display: block; color: #5a6c5e; font-size: 8pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .value { display: block; margin-top: 2px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; }
    th { padding: 8px; background: #225c2b; color: #fff; font-size: 8.5pt; text-align: left; text-transform: uppercase; }
    td { padding: 8px; border: 1px solid #d6e1d6; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fbf8; }
    ol { margin: 8px 0 0; padding-left: 21px; }
    li { margin: 0 0 8px; }
    .signature { margin-top: 36px; max-width: 90mm; border-top: 1px solid #46634b; padding-top: 8px; }
    .signature img { display: block; max-width: 180px; max-height: 55px; margin-bottom: 6px; object-fit: contain; }
    .signature-space { height: 58px; }
    .footer { margin-top: 25px; padding-top: 8px; border-top: 1px solid #b8cbb8; color: #5a6c5e; font-size: 8pt; text-align: center; }
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
        <strong>Agricultural Input Credit Repayment Mandate</strong><br />
        Mandate reference: ${escapeHtml(data.loanId || "Pending")}<br />
        Issuing office: ${escapeHtml(stock.fineractOfficeName || data.branch)}<br />
        Mandate date: ${escapeHtml(mandateDate)}
      </div>
    </header>

    <h1>Agricultural Input Credit Repayment Mandate</h1>
    <p class="subtitle">Authority to collect repayment for agricultural inputs issued on credit</p>

    <div class="notice">
      This mandate accompanies the ARDA Agricultural Input Credit Agreement. It records the farmer's authority for ARDA to collect the agreed repayment amount for the agricultural inputs issued on credit.
    </div>

    <h2>1. Farmer and Credit Reference</h2>
    <div class="details">
      <div class="detail"><span class="label">Farmer / Borrower</span><span class="value">${escapeHtml(data.clientName)}</span></div>
      <div class="detail"><span class="label">National Identification Number</span><span class="value">${escapeHtml(data.nrc)}</span></div>
      <div class="detail"><span class="label">Farmer Account Number</span><span class="value">${escapeHtml(data.accountNumber || data.gflNo || "N/A")}</span></div>
      <div class="detail"><span class="label">ARDA Office</span><span class="value">${escapeHtml(stock.fineractOfficeName || data.branch)}</span></div>
    </div>

    <h2>2. Inputs and Repayment Obligation</h2>
    <table>
      <thead><tr><th>Input Item</th><th>Quantity</th><th>Unit</th><th>Total Credit Value</th></tr></thead>
      <tbody><tr>
        <td>${escapeHtml(stock.inventoryItemName)}</td>
        <td>${escapeHtml(stock.quantity)}</td>
        <td>${escapeHtml(stock.unitOfMeasure || "units")}</td>
        <td><strong>${formatMoney(stock.totalValue, currency)}</strong></td>
      </tr></tbody>
    </table>
    <div class="details">
      <div class="detail"><span class="label">Total Amount Payable</span><span class="value">${formatMoney(data.totalRepayment, currency)}</span></div>
      <div class="detail"><span class="label">Repayment Period</span><span class="value">${escapeHtml(data.tenure)}</span></div>
      <div class="detail"><span class="label">Repayment Frequency</span><span class="value">${escapeHtml(data.paymentFrequency)}</span></div>
      <div class="detail"><span class="label">First Payment Date</span><span class="value">${escapeHtml(data.firstPaymentDate)}</span></div>
    </div>

    <h2>3. Mandate and Authority</h2>
    <p>I, ${escapeHtml(data.clientName)}, acknowledge the agricultural inputs listed above and the related credit obligation. I authorise ARDA to receive and apply repayments against this agricultural input credit in accordance with the agreed repayment schedule and applicable ARDA programme procedures.</p>
    <ol>
      <li>I will make repayments on or before each scheduled due date.</li>
      <li>I authorise ARDA to issue receipts and maintain a repayment record for this agreement.</li>
      <li>I will promptly notify ARDA of any change that may affect my ability to meet the agreed repayments.</li>
      <li>This authority applies only to the agricultural input credit identified in this mandate and does not authorise an unrelated cash-loan transaction.</li>
    </ol>

    <h2>4. Farmer Confirmation</h2>
    <p>By signing below, I confirm that I understand the repayment obligation and give this mandate voluntarily in relation to the agricultural inputs issued on credit.</p>
    <section class="signature">
      ${borrowerSignature}
      <strong>Farmer / Borrower: ${escapeHtml(data.clientName)}</strong><br />
      <span>Signature and date</span>
    </section>

    <footer class="footer">ARDA Agricultural Input Credit Repayment Mandate | Reference: ${escapeHtml(data.loanId || "Pending")}</footer>
  </main>
</body>
</html>`;
}
