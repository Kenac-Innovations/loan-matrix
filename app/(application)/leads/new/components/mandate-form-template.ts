import { addYears, format } from "date-fns";
import { ContractData } from "./contract-types";

interface MandateSignatures {
  borrower?: string | null;
  organization?: {
    name?: string | null;
    logoUrl?: string | null;
  };
}

function frequencyCode(paymentFrequency: string): string {
  const f = paymentFrequency.toLowerCase();
  if (f.includes("daily")) return "D";
  if (f.includes("week") && (f.includes("bi") || f.includes("fort"))) return "FN";
  if (f.includes("week")) return "W";
  if (f.includes("quarter")) return "Q";
  if (f.includes("half") || f.includes("semi")) return "H";
  if (f.includes("annual") || f.includes("year")) return "A";
  return "M";
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function freqBoxes(activeCode: string): string {
  const codes = ["D", "W", "FN", "M", "Q", "H", "A"];
  return codes
    .map((code) => {
      const active = code === activeCode;
      return `<span style="display:inline-flex;align-items:center;gap:2px;margin-right:8px;">
        <span style="display:inline-block;width:20px;height:18px;border:1px solid #888;text-align:center;line-height:18px;font-size:9px;${active ? "background:#ccc;font-weight:bold;" : ""}">${active ? code : ""}</span>
        <span style="font-size:8px;">${code}</span>
      </span>`;
    })
    .join("");
}

export function generateMandateFormHTML(
  contractData: ContractData | null,
  signatures: MandateSignatures = {}
): string {
  const currentDate = new Date();
  const gflNo = contractData?.gflNo ?? "";
  const paymentDate = fmtDate(contractData?.firstPaymentDate);
  const expiryDate = format(addYears(currentDate, 5), "dd/MM/yyyy");
  const freqCode = frequencyCode(contractData?.paymentFrequency ?? "Monthly");
  const fixedAmount = "K 1";
  const variableAmount = "K 75,000";
  const clientName = contractData?.clientName ?? "";
  const mobileNo = contractData?.mobileNo ?? "";
  const address = contractData?.residentialAddress ?? "";
  const bankName = contractData?.bankName ?? "";
  const branchName = contractData?.branchName ?? "";
  const sortCode = contractData?.sortCode ?? "";
  const accountNumber = contractData?.accountNumber ?? "";
  const organizationName =
    signatures.organization?.name?.trim() || "Goodfellow Finance Limited";
  const organizationLogoUrl = signatures.organization?.logoUrl ?? null;
  const today = format(currentDate, "dd/MM/yyyy");
  const borrowerSig = signatures.borrower ?? null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Direct Debit Mandate Form</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; margin: 0; padding: 20px; background: #fff; }
    .page { max-width: 740px; margin: 0 auto; }
    h1 { text-align: center; font-size: 13px; font-weight: bold; margin: 0 0 12px; letter-spacing: 1px; }
    .header-row { display: flex; border: 1px solid #666; margin-bottom: 8px; }
    .logo-box { padding: 10px 14px; border-right: 1px solid #666; min-width: 180px; display: flex; align-items: center; }
    .logo-stack { display: flex; flex-direction: column; gap: 6px; }
    .logo-image { max-width: 130px; max-height: 42px; width: auto; height: auto; object-fit: contain; }
    .logo-fallback { font-size: 30px; font-weight: 900; color: #2d7a27; line-height: 1; }
    .logo-name { font-size: 8px; color: #2d7a27; font-weight: 700; letter-spacing: 0.4px; line-height: 1.25; }
    .address-box { padding: 10px 14px; font-size: 10px; line-height: 1.6; }
    .section-wrap { border: 1px solid #666; margin-bottom: 8px; display: flex; }
    .section-sidebar { writing-mode: vertical-rl; transform: rotate(180deg); background: #e0e0e0; border-right: 1px solid #666; padding: 6px 3px; font-size: 7.5px; font-weight: bold; letter-spacing: 0.8px; white-space: nowrap; text-align: center; }
    .section-body { padding: 8px 10px; flex: 1; }
    .field { margin-bottom: 6px; }
    .field-label { font-size: 8px; color: #444; margin-bottom: 2px; }
    .field-input { border: 1px solid #888; padding: 2px 5px; min-height: 17px; font-size: 10px; }
    .field-input-full { width: 100%; }
    .row { display: flex; gap: 10px; }
    .col { flex: 1; }
    .sig-line { border-bottom: 1px solid #000; min-height: 38px; margin-bottom: 3px; display: flex; align-items: flex-end; }
    .sig-label { font-size: 8px; color: #444; }
    .guarantee { border: 2px solid #333; margin-top: 14px; padding: 10px 14px; }
    .guarantee-title { text-align: center; font-weight: bold; font-size: 10px; margin-bottom: 6px; border-bottom: 1px solid #555; padding-bottom: 4px; }
    .guarantee-list { font-size: 8.5px; line-height: 1.55; padding-left: 18px; margin: 0; }
    .instruction-text { font-size: 8.5px; line-height: 1.55; margin: 6px 0; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
<div class="page">

  <h1>MANDATE TO YOUR BANK TO PAY BY DIRECT DEBIT</h1>

  <!-- Header -->
  <div class="header-row">
    <div class="logo-box">
      <div class="logo-stack">
        ${
          organizationLogoUrl
            ? `<img src="${escapeHtml(organizationLogoUrl)}" alt="${escapeHtml(organizationName)} logo" class="logo-image" onerror="this.style.display='none'" />`
            : `<div class="logo-fallback">GFL</div>`
        }
        <div class="logo-name">${escapeHtml(organizationName)}</div>
      </div>
    </div>
    <div class="address-box">
      <strong>${escapeHtml(organizationName)}</strong><br/>
      Plot 8 Chaholi Rd, Rhodespark<br/>
      P.O.Box 50644<br/>
      LUSAKA
    </div>
  </div>

  <!-- Service Details -->
  <div class="section-wrap">
    <div class="section-sidebar">Service Details</div>
    <div class="section-body">
      <div class="field">
        <div class="field-label">Service Provider's Reference Number:</div>
        <div class="field-input field-input-full">&nbsp;</div>
      </div>
      <div class="field">
        <div class="field-label">Payer's Account Number with Service Provider:</div>
        <div class="field-input" style="width:260px;">${escapeHtml(gflNo)}</div>
      </div>
      <div class="row" style="align-items:flex-start;margin-top:4px;">
        <div class="col">
          <div class="field">
            <div class="field-label">Payment Date (DD/MM/YYYY):</div>
            <div class="field-input" style="width:140px;">${escapeHtml(paymentDate)}</div>
          </div>
          <div class="field">
            <div class="field-label">Expiry Date (DD/MM/YYYY):</div>
            <div class="field-input" style="width:140px;">${escapeHtml(expiryDate)}</div>
          </div>
          <div class="field">
            <div class="field-label">Payment Frequency* (Tick as applicable):</div>
            <div style="margin-top:3px;">${freqBoxes(freqCode)}</div>
            <div style="font-size:7px;margin-top:3px;color:#555;">*D=Daily W=Weekly FN=Fortnightly M=Monthly Q=Quarterly H=Half Yearly A=Annually</div>
          </div>
        </div>
        <div style="min-width:200px;">
          <div style="margin-bottom:6px;">
            <div style="font-size:8px;color:#444;margin-bottom:2px;">How many days can the Direct Debit be processed <strong>before</strong> Payment Date?</div>
            <div class="field-input" style="width:36px;text-align:center;">5</div>
          </div>
          <div style="margin-bottom:8px;">
            <div style="font-size:8px;color:#444;margin-bottom:2px;">How many days can the Direct Debit be processed <strong>after</strong> Payment Date?</div>
            <div class="field-input" style="width:36px;text-align:center;">5</div>
          </div>
          <div class="field">
            <div class="field-label">Fixed amount to be debited:</div>
            <div class="field-input field-input-full">${escapeHtml(fixedAmount)}</div>
          </div>
          <div class="field">
            <div class="field-label">Variable amount to be debited subject to maximum of:</div>
            <div class="field-input field-input-full">${escapeHtml(variableAmount)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Payer's Personal Details -->
  <div class="section-wrap">
    <div class="section-sidebar">Payer's Personal Details</div>
    <div class="section-body">
      <div class="field">
        <div class="field-label">Name:</div>
        <div class="field-input field-input-full">${escapeHtml(clientName)}</div>
      </div>
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="field-label">Telephone Number:</div>
            <div class="field-input field-input-full">${escapeHtml(mobileNo)}</div>
          </div>
        </div>
        <div class="col">
          <div class="field">
            <div class="field-label">Email:</div>
            <div class="field-input field-input-full">&nbsp;</div>
          </div>
        </div>
      </div>
      <div class="field">
        <div class="field-label">Address:</div>
        <div class="field-input field-input-full">${escapeHtml(address)}</div>
      </div>
    </div>
  </div>

  <!-- Payer's Bank Details -->
  <div class="section-wrap">
    <div class="section-sidebar">Payer's Bank Details</div>
    <div class="section-body">
      <div class="field">
        <div class="field-label">Bank Name:</div>
        <div class="field-input field-input-full">${escapeHtml(bankName)}</div>
      </div>
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="field-label">Branch Name:</div>
            <div class="field-input field-input-full">${escapeHtml(branchName)}</div>
          </div>
        </div>
        <div class="col">
          <div class="field">
            <div class="field-label">Sortcode:</div>
            <div class="field-input field-input-full">${escapeHtml(sortCode)}</div>
          </div>
        </div>
      </div>
      <div class="field">
        <div class="field-label">Bank Account Number:</div>
        <div class="field-input field-input-full">${escapeHtml(accountNumber)}</div>
      </div>
    </div>
  </div>

  <!-- Instruction to Bank/NBFI -->
  <div class="section-wrap">
    <div class="section-sidebar">Instruction to your Bank/NBFI</div>
    <div class="section-body">
      <p style="font-size:9px;margin:0 0 2px;">To: The Manager</p>
      <div style="border-bottom:1px solid #999;height:18px;margin-bottom:3px;font-size:9px;padding:2px 0;">${escapeHtml(bankName)}</div>
      <div style="border-bottom:1px solid #999;height:18px;margin-bottom:3px;">&nbsp;</div>
      <div style="border-bottom:1px solid #999;height:18px;margin-bottom:10px;">&nbsp;</div>

      <p style="font-weight:bold;font-size:10px;margin:0 0 4px;">INSTRUCTION TO DEBIT MY ACCOUNT</p>
      <p class="instruction-text">
        Please pay ${escapeHtml(organizationName)} Direct Debits from my account detailed in this mandate subject to safeguards
        assured by the Direct Debits Guarantee. I/we understand that this mandate may remain with ${escapeHtml(organizationName)}
        and, if so, details will be passed electronically to my Bank/NBFI.
      </p>

      <p style="font-size:8px;color:#555;margin:4px 0 12px;text-align:center;">
        Banks/NBFIs may not accept Direct Debit Mandates for some types of accounts
      </p>

      <div class="row">
        <div class="col">
          <div class="sig-line">
            ${borrowerSig ? `<img src="${escapeHtml(borrowerSig)}" style="max-height:36px;max-width:160px;object-fit:contain;" alt="Signature" />` : ""}
          </div>
          <div class="sig-label">Signatures</div>
        </div>
        <div class="col">
          <div class="sig-line" style="padding:4px 0;font-size:9px;">${escapeHtml(today)}</div>
          <div class="sig-label">Date</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Direct Debit Guarantee -->
  <div class="guarantee">
    <div class="guarantee-title">The Direct Debit Guarantee</div>
    <ol class="guarantee-list">
      <li>This Guarantee is offered by all Banks/NBFI that take part in the DDACC System. The efficiency and security of the Direct Debit is monitored and protected by your own Bank/NBFI.</li>
      <li>If the amounts to be paid or the payment dates change, ${escapeHtml(organizationName)} will notify you 14 working days in advance of your account being debited or as otherwise agreed.</li>
      <li>If an error is made by ${escapeHtml(organizationName)}, you are guaranteed a full and immediate refund of the amount paid from ${escapeHtml(organizationName)}.</li>
      <li>If an error is made by your bank/NBFI, you are guaranteed a full and immediate refund from your branch of the amount paid.</li>
      <li>You can cancel a Direct Debit at any time by writing to your Bank/NBFI. Please also send a copy of your letter to us.</li>
    </ol>
  </div>

</div>
</body>
</html>`;
}
