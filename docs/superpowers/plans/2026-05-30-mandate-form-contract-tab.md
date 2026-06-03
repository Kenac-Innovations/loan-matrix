# Mandate Form Contract Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mandate Form" (Universal Direct Debit Mandate) as a third document preview tab in the loan contract step, auto-filled from available lead/contract data, printable standalone and included in Print All.

**Architecture:** Two-task split — Task 1 creates a standalone HTML template generator (`mandate-form-template.ts`) following the same pattern as `key-facts-statement-template.ts`. Task 2 wires it into `loan-contracts.tsx`: replaces the `showKeyFacts: boolean` state with `activeDoc: "kfs" | "contract" | "mandate"`, adds the iframe preview, extends `handlePrint` to support mandate, and adds print buttons.

**Tech Stack:** TypeScript, React, Next.js 14, date-fns, existing shadcn/ui components, HTML-string-based document rendering (same as KFS and Loan Contract).

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Create | `app/(application)/leads/new/components/mandate-form-template.ts` | Generates mandate form HTML string from ContractData |
| Modify | `app/(application)/leads/new/components/loan-contracts.tsx` | Tab switching, iframe, print wiring |

---

## Task 1: Create Mandate Form HTML Template

**Files:**
- Create: `app/(application)/leads/new/components/mandate-form-template.ts`

**Context:**
- Working directory: `/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix`
- Branch: `parten-main`
- Pattern to follow: `app/(application)/leads/new/components/key-facts-statement-template.ts` — exports a single function returning a complete HTML document string
- `ContractData` type lives in `./contract-types.ts` — already has all fields needed

**Field mapping from `ContractData`:**

| Form section | Form field | `ContractData` source | Blank if missing |
|---|---|---|---|
| Service Details | Payer Account No | `gflNo` | yes |
| Service Details | Payment Date | `firstPaymentDate` formatted DD/MM/YYYY | yes |
| Service Details | Expiry Date | `repaymentSchedule[last].dueDate` formatted DD/MM/YYYY | yes |
| Service Details | Frequency tick | `paymentFrequency` → code (M/W/D/FN/Q/H/A) | M |
| Service Details | Fixed debit amount | `paymentPerPeriod` with "K " prefix | yes |
| Payer Personal | Name | `clientName` | yes |
| Payer Personal | Telephone | `mobileNo` | yes |
| Payer Personal | Address | `residentialAddress` | yes |
| Payer Bank | Bank Name | `bankName` | yes |
| Payer Bank | Account Number | `accountNumber` | yes |
| Instruction | To: The Manager | `bankName` as first line | yes |
| Instruction | Signature | `signatures.borrower` as `<img>` | blank line |
| Instruction | Date | today's date (format DD/MM/YYYY) | yes |

- [ ] **Step 1: Create the file**

Create `app/(application)/leads/new/components/mandate-form-template.ts` with this exact content:

```typescript
import { format } from "date-fns";
import { ContractData } from "./contract-types";

interface MandateSignatures {
  borrower?: string | null;
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

function fmtAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const gflNo = contractData?.gflNo ?? "";
  const paymentDate = fmtDate(contractData?.firstPaymentDate);
  const lastSchedule = contractData?.repaymentSchedule?.slice(-1)[0];
  const expiryDate = lastSchedule ? fmtDate(lastSchedule.dueDate) : "";
  const freqCode = frequencyCode(contractData?.paymentFrequency ?? "Monthly");
  const fixedAmount = contractData ? `K&nbsp;&nbsp;${fmtAmount(contractData.paymentPerPeriod)}` : "K";
  const clientName = contractData?.clientName ?? "";
  const mobileNo = contractData?.mobileNo ?? "";
  const address = contractData?.residentialAddress ?? "";
  const bankName = contractData?.bankName ?? "";
  const accountNumber = contractData?.accountNumber ?? "";
  const today = format(new Date(), "dd/MM/yyyy");
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
    .logo-box { padding: 10px 14px; border-right: 1px solid #666; min-width: 140px; }
    .logo-gfl { font-size: 30px; font-weight: 900; color: #2d7a27; line-height: 1; }
    .logo-sub { font-size: 7px; color: #2d7a27; letter-spacing: 0.5px; margin-top: 2px; }
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
      <div class="logo-gfl">GFL</div>
      <div class="logo-sub">GOODFELLOW FINANCE LIMITED</div>
    </div>
    <div class="address-box">
      <strong>Goodfellow Finance Limited</strong><br/>
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
        <div class="field-input" style="width:260px;">${gflNo}</div>
      </div>
      <div class="row" style="align-items:flex-start;margin-top:4px;">
        <div class="col">
          <div class="field">
            <div class="field-label">Payment Date (DD/MM/YYYY):</div>
            <div class="field-input" style="width:140px;">${paymentDate}</div>
          </div>
          <div class="field">
            <div class="field-label">Expiry Date (DD/MM/YYYY):</div>
            <div class="field-input" style="width:140px;">${expiryDate}</div>
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
            <div class="field-input field-input-full">${fixedAmount}</div>
          </div>
          <div class="field">
            <div class="field-label">Variable amount to be debited subject to maximum of:</div>
            <div class="field-input field-input-full">K</div>
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
        <div class="field-input field-input-full">${clientName}</div>
      </div>
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="field-label">Telephone Number:</div>
            <div class="field-input field-input-full">${mobileNo}</div>
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
        <div class="field-input field-input-full">${address}</div>
      </div>
    </div>
  </div>

  <!-- Payer's Bank Details -->
  <div class="section-wrap">
    <div class="section-sidebar">Payer's Bank Details</div>
    <div class="section-body">
      <div class="field">
        <div class="field-label">Bank Name:</div>
        <div class="field-input field-input-full">${bankName}</div>
      </div>
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="field-label">Branch Name:</div>
            <div class="field-input field-input-full">&nbsp;</div>
          </div>
        </div>
        <div class="col">
          <div class="field">
            <div class="field-label">Sortcode:</div>
            <div class="field-input field-input-full">&nbsp;</div>
          </div>
        </div>
      </div>
      <div class="field">
        <div class="field-label">Bank Account Number:</div>
        <div class="field-input field-input-full">${accountNumber}</div>
      </div>
    </div>
  </div>

  <!-- Instruction to Bank/NBFI -->
  <div class="section-wrap">
    <div class="section-sidebar">Instruction to your Bank/NBFI</div>
    <div class="section-body">
      <p style="font-size:9px;margin:0 0 2px;">To: The Manager</p>
      <div style="border-bottom:1px solid #999;height:18px;margin-bottom:3px;font-size:9px;padding:2px 0;">${bankName}</div>
      <div style="border-bottom:1px solid #999;height:18px;margin-bottom:3px;">&nbsp;</div>
      <div style="border-bottom:1px solid #999;height:18px;margin-bottom:10px;">&nbsp;</div>

      <p style="font-weight:bold;font-size:10px;margin:0 0 4px;">INSTRUCTION TO DEBIT MY ACCOUNT</p>
      <p class="instruction-text">
        Please pay Goodfellow Finance Limited Direct Debits from my account detailed in this mandate subject to safeguards
        assured by the Direct Debits Guarantee. I/we understand that this mandate may remain with Goodfellow Finance Limited
        and, if so, details will be passed electronically to my Bank/NBFI.
      </p>

      <p style="font-size:8px;color:#555;margin:4px 0 12px;text-align:center;">
        Banks/NBFIs may not accept Direct Debit Mandates for some types of accounts
      </p>

      <div class="row">
        <div class="col">
          <div class="sig-line">
            ${borrowerSig ? `<img src="${borrowerSig}" style="max-height:36px;max-width:160px;object-fit:contain;" alt="Signature" />` : ""}
          </div>
          <div class="sig-label">Signatures</div>
        </div>
        <div class="col">
          <div class="sig-line" style="padding:4px 0;font-size:9px;">${today}</div>
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
      <li>If the amounts to be paid or the payment dates change, Goodfellow Finance Limited will notify you 14 working days in advance of your account being debited or as otherwise agreed.</li>
      <li>If an error is made by Goodfellow Finance Limited, you are guaranteed a full and immediate refund of the amount paid from Goodfellow Finance Limited.</li>
      <li>If an error is made by your bank/NBFI, you are guaranteed a full and immediate refund from your branch of the amount paid.</li>
      <li>You can cancel a Direct Debit at any time by writing to your Bank/NBFI. Please also send a copy of your letter to us.</li>
    </ol>
  </div>

</div>
</body>
</html>`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npx tsc --noEmit 2>&1 | grep "mandate-form-template"
```

Expected: no output (no errors).

---

## Task 2: Wire Mandate Form into LoanContracts

**Files:**
- Modify: `app/(application)/leads/new/components/loan-contracts.tsx`

**Context:**
- The file is ~3270 lines. All line numbers below are approximate — read the surrounding context before editing.
- Current state after previous commits: has `showKeyFacts: boolean` at line ~93, tab buttons at ~2552, iframes at ~2573, print functions at ~1247, print buttons at ~3224.
- `handlePrint` accepts `"kfs" | "contract" | "both"` — extend to add `"mandate"` case and update `"both"` to include mandate as third page.
- Do NOT touch any other logic — signatures, completion, contract data building.

### Step-by-step changes:

- [ ] **Step 1: Add import for `generateMandateFormHTML`**

Find the existing import from `./key-facts-statement-template` and add the mandate import below it:

```typescript
import {
  generateKeyFactsStatementHTML,
  KeyFactsData,
} from "./key-facts-statement-template";
import { generateMandateFormHTML } from "./mandate-form-template";
```

- [ ] **Step 2: Replace `showKeyFacts` state with `activeDoc`**

Find (around line 93):
```typescript
const [showKeyFacts, setShowKeyFacts] = useState(false);
```

Replace with:
```typescript
const [activeDoc, setActiveDoc] = useState<"kfs" | "contract" | "mandate">("contract");
```

- [ ] **Step 3: Update `handlePrint` — add "mandate" case and update "both"**

Find `const handlePrint = (printType: "kfs" | "contract" | "both" = "both") => {` (around line 1247).

Replace the entire function (from `const handlePrint` through its closing `};`) with:

```typescript
const handlePrint = (
  printType: "kfs" | "contract" | "mandate" | "both" = "both"
) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  if (printType === "kfs") {
    const keyFactsData = getKeyFactsData();
    if (!keyFactsData) return;
    const kfsHTML = generateKeyFactsStatementHTML(keyFactsData, {
      borrower: borrowerSignature,
      guarantor: guarantorSignature,
      creditProvider: loanOfficerSignature,
    });
    printWindow.document.write(kfsHTML);
  } else if (printType === "contract") {
    const contractHTML =
      filledTenantContractHtml ||
      generateContractHTML(contractData, {
        borrower: borrowerSignature,
        guarantor: guarantorSignature,
        loanOfficer: loanOfficerSignature,
      });
    printWindow.document.write(contractHTML);
  } else if (printType === "mandate") {
    const mandateHTML = generateMandateFormHTML(contractData, {
      borrower: borrowerSignature,
    });
    printWindow.document.write(mandateHTML);
  } else {
    // Print all three: KFS + Contract + Mandate
    const keyFactsData = getKeyFactsData();
    if (!keyFactsData) return;

    const kfsHTML = generateKeyFactsStatementHTML(keyFactsData, {
      borrower: borrowerSignature,
      guarantor: guarantorSignature,
      creditProvider: loanOfficerSignature,
    });

    const contractHTML =
      filledTenantContractHtml ||
      generateContractHTML(contractData, {
        borrower: borrowerSignature,
        guarantor: guarantorSignature,
        loanOfficer: loanOfficerSignature,
      });

    const mandateHTML = generateMandateFormHTML(contractData, {
      borrower: borrowerSignature,
    });

    const extractBody = (html: string): string =>
      html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "";
    const extractStyles = (html: string): string[] =>
      html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];

    const combinedStyles = [
      ...extractStyles(kfsHTML),
      ...extractStyles(contractHTML),
      ...extractStyles(mandateHTML),
    ].join("\n");

    const combinedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GFL - All Documents</title>
  ${combinedStyles}
  <style>
    .page-break { page-break-after: always; break-after: page; }
    @media print { .page-break { page-break-after: always; break-after: page; } }
  </style>
</head>
<body>
  <div class="page-break">${extractBody(kfsHTML)}</div>
  <div class="page-break">${extractBody(contractHTML)}</div>
  <div>${extractBody(mandateHTML)}</div>
</body>
</html>`;

    printWindow.document.write(combinedHTML);
  }

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const handlePrintKeyFacts = () => handlePrint("kfs");
const handlePrintContract = () => handlePrint("contract");
const handlePrintMandate = () => handlePrint("mandate");
const handlePrintBoth = () => handlePrint("both");
```

> **Note:** Remove the existing `handlePrintKeyFacts`, `handlePrintContract`, `handlePrintBoth` lines that follow — they are now inside the replacement block above.

- [ ] **Step 4: Update the document tab toggle buttons**

Find the tab button block (around line 2552). It currently looks like:

```tsx
{!tenantContractHtml && (
  <div className="flex gap-2">
    <Button
      variant={showKeyFacts ? "default" : "outline"}
      size="sm"
      onClick={() => setShowKeyFacts(true)}
    >
      Key Facts Statement
    </Button>
    <Button
      variant={!showKeyFacts ? "default" : "outline"}
      size="sm"
      onClick={() => setShowKeyFacts(false)}
    >
      Loan Contract
    </Button>
  </div>
)}
```

Replace with:

```tsx
<div className="flex gap-2">
  {!tenantContractHtml && (
    <Button
      variant={activeDoc === "kfs" ? "default" : "outline"}
      size="sm"
      onClick={() => setActiveDoc("kfs")}
    >
      Key Facts Statement
    </Button>
  )}
  <Button
    variant={activeDoc === "contract" ? "default" : "outline"}
    size="sm"
    onClick={() => setActiveDoc("contract")}
  >
    Loan Contract
  </Button>
  <Button
    variant={activeDoc === "mandate" ? "default" : "outline"}
    size="sm"
    onClick={() => setActiveDoc("mandate")}
  >
    Mandate Form
  </Button>
</div>
```

- [ ] **Step 5: Update the iframe preview section**

Find the iframe section (around line 2573). It currently uses a `showKeyFacts ? <kfsIframe> : <contractIframe>` ternary. Replace it with:

```tsx
{activeDoc === "kfs" ? (
  <iframe
    srcDoc={
      getKeyFactsData()
        ? generateKeyFactsStatementHTML(getKeyFactsData()!, {
            borrower: borrowerSignature,
            guarantor: guarantorSignature,
            creditProvider: loanOfficerSignature,
          })
        : "<p>Loading...</p>"
    }
    className="w-full border rounded bg-white"
    style={{ height: "700px", minHeight: "500px" }}
    title="Key Facts Statement Preview"
  />
) : activeDoc === "mandate" ? (
  <iframe
    srcDoc={generateMandateFormHTML(contractData, {
      borrower: borrowerSignature,
    })}
    className="w-full border rounded bg-white"
    style={{ height: "700px", minHeight: "500px" }}
    title="Mandate Form Preview"
  />
) : (
  <iframe
    srcDoc={
      filledTenantContractHtml ??
      generateContractHTML(contractData, {
        borrower: borrowerSignature,
        guarantor: guarantorSignature,
        loanOfficer: loanOfficerSignature,
      })
    }
    className="w-full border rounded bg-white"
    style={{ height: "700px", minHeight: "500px" }}
    title="Loan Contract Preview"
  />
)}
```

- [ ] **Step 6: Update the footer print buttons**

Find the print buttons section in the `CardFooter` (around line 3224). It currently has Print Key Facts, Print Contract, Print All. Replace the entire buttons block with:

```tsx
<div className="flex gap-4 ml-auto">
  {!tenantContractHtml && (
    <Button onClick={handlePrintKeyFacts} variant="outline" size="sm">
      <FileText className="mr-2 h-4 w-4" />
      Print Key Facts
    </Button>
  )}
  <Button onClick={handlePrintContract} variant="outline" size="sm">
    <FileText className="mr-2 h-4 w-4" />
    Print Contract
  </Button>
  <Button onClick={handlePrintMandate} variant="outline" size="sm">
    <FileText className="mr-2 h-4 w-4" />
    Print Mandate
  </Button>
  {!tenantContractHtml && (
    <Button onClick={handlePrintBoth} variant="outline" size="sm">
      <FileText className="mr-2 h-4 w-4" />
      Print All
    </Button>
  )}
```

> Keep the Complete button that follows unchanged.

- [ ] **Step 7: Verify TypeScript compiles clean**

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npx tsc --noEmit 2>&1 | grep -E "loan-contracts|mandate" | grep -v "contractData"
```

Expected: no output (no new errors beyond the pre-existing `contractData` nullability ones).

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| "Mandate Form" tab in Document Preview | Task 2 Step 4 |
| Auto-fill from ContractData (all listed fields) | Task 1 Step 1 |
| Leave blank for missing fields | Task 1 Step 1 (all `?? ""` guards) |
| Same save behavior (no new save needed) | Mandate content derived at render time — nothing to save |
| Included in Print All | Task 2 Step 3 ("both" case) |
| Standalone Print Mandate button | Task 2 Steps 3 & 6 |
| Borrower signature in mandate | Task 1 + Task 2 Step 5 |

### No Placeholders
All HTML is complete. All field values have explicit fallbacks. No TBDs.

### Type Consistency
- `generateMandateFormHTML(contractData: ContractData | null, signatures: MandateSignatures)` — used consistently in Task 2 Steps 3 and 5.
- `activeDoc: "kfs" | "contract" | "mandate"` — used in Steps 2, 4, 5 consistently.
- `handlePrintMandate` defined in Step 3, used in Step 6.
