/** Rulethu's installment statement, based on Loan_Statement_.xlsx. */
type DateValue = number[] | string;
interface Period {
  period: number; dueDate?: DateValue; obligationsMetOnDate?: DateValue;
  principalDue?: number; principalPaid?: number; principalOutstanding?: number;
  interestDue?: number; interestPaid?: number; penaltyChargesDue?: number;
  totalDueForPeriod?: number; totalPaidForPeriod?: number; totalOutstandingForPeriod?: number;
}
export interface RulethuStatementLoan {
  accountNo?: string; clientId?: number; clientName?: string; principal?: number;
  loanProductName?: string; loanOfficerName?: string; numberOfRepayments?: number;
  annualInterestRate?: number; interestType?: { id?: number; value?: string };
  repaymentEvery?: number; repaymentFrequencyType?: { value?: string };
  currency?: { code?: string }; timeline?: { actualDisbursementDate?: DateValue };
  summary?: { principalDisbursed?: number; principalOutstanding?: number; totalOutstanding?: number;
    totalOverdue?: number; overdueSinceDate?: DateValue; totalRepayment?: number;
    interestCharged?: number; feeChargesDueAtDisbursementCharged?: number };
  repaymentSchedule?: { periods?: Period[] };
}
interface Client { displayName?: string; accountNo?: string; officeName?: string; mobileNo?: string }
const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (value: number | undefined) => value == null ? "—" : value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function date(value?: DateValue): Date | undefined {
  if (!value) return;
  const key = Array.isArray(value) ? `${value[0]}-${String(value[1]).padStart(2,"0")}-${String(value[2]).padStart(2,"0")}` : value.slice(0,10);
  const result = new Date(`${key}T00:00:00Z`);
  return Number.isFinite(result.getTime()) ? result : undefined;
}
const showDate = (value?: DateValue) => date(value)?.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) ?? "—";
export function isRulethuStatementTenant(slug?: string | null) { return slug?.trim().toLowerCase() === "rulethu"; }

export function generateRulethuLoanStatementHTML(loan: RulethuStatementLoan, client: Client | null,
  company: { name: string }, preparedBy?: string, now = new Date()): string {
  const periods = (loan.repaymentSchedule?.periods ?? []).filter(p => p.period > 0);
  if (!periods.length) throw new Error("Repayment schedule is unavailable for this loan");
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "Africa/Harare" });
  const today = date(todayKey)!;
  const sum = (field: keyof Period, rows = periods) => rows.reduce((total, p) => total + (typeof p[field] === "number" ? p[field] as number : 0), 0);
  const overdue = periods.filter(p => date(p.dueDate) && date(p.dueDate)! <= today && (p.totalOutstandingForPeriod ?? 0) > 0);
  const upcoming = periods.find(p => date(p.dueDate) && date(p.dueDate)! > today && (p.totalOutstandingForPeriod ?? 0) > 0);
  const summary = loan.summary ?? {};
  const principal = summary.principalDisbursed ?? loan.principal;
  const outstanding = summary.totalOutstanding;
  const arrears = summary.totalOverdue ?? sum("totalOutstandingForPeriod", overdue);
  const oldest = date(summary.overdueSinceDate) ?? date(overdue[0]?.dueDate);
  const days = arrears > 0 && oldest ? Math.max(0, Math.floor((today.getTime()-oldest.getTime())/86400000)) : 0;
  const flat = loan.interestType?.id === 1;
  const method = flat ? "FLAT RATE" : "REDUCING BALANCE";
  const frequency = `${loan.repaymentEvery && loan.repaymentEvery > 1 ? `Every ${loan.repaymentEvery} ` : ""}${loan.repaymentFrequencyType?.value ?? "—"}`;
  const perYear: Record<string, number> = { Days: 365, Weeks: 52, Months: 12, Years: 1 };
  const yearly = (perYear[loan.repaymentFrequencyType?.value ?? ""] ?? 0) / (loan.repaymentEvery || 1);
  const borrower = [["Borrower name",client?.displayName ?? loan.clientName],["Client ID",client?.accountNo ?? loan.clientId],["Loan account no.",loan.accountNo],["Branch",client?.officeName],["Loan officer",loan.loanOfficerName],["Loan product",loan.loanProductName],["Phone",client?.mobileNo],["Group / Guarantor","—"]];
  const terms = [["Principal disbursed",money(principal)],[`Annual interest rate (${flat ? "flat" : "reducing"})`,loan.annualInterestRate == null ? "—" : `${loan.annualInterestRate.toFixed(2)}%`],["No. of installments",loan.numberOfRepayments ?? periods.length],["Repayment frequency",frequency],["Disbursement date",showDate(loan.timeline?.actualDisbursementDate)],["Upfront fees (processing/insurance)",money(summary.feeChargesDueAtDisbursementCharged)],["Currency",loan.currency?.code],["Statement date",showDate(todayKey)],["Installments per year",yearly || "—"],["Rate per period",yearly && loan.annualInterestRate != null ? `${(loan.annualInterestRate/yearly).toFixed(4)}%` : "—"],["Scheduled installment",money(periods[0]?.totalDueForPeriod)],["Total interest",money(summary.interestCharged)],["Total repayable",money(sum("totalDueForPeriod"))]];
  const totals = [["Installments due to date",money(sum("totalDueForPeriod",periods.filter(p => date(p.dueDate) && date(p.dueDate)! <= today)))],["Penalties charged",money(sum("penaltyChargesDue"))],["Total amount paid",money(summary.totalRepayment)],["Arrears (overdue unpaid)",money(arrears)],["Days in arrears",days],["Outstanding principal",money(summary.principalOutstanding)],["Total outstanding balance",money(outstanding)],["Next due date",showDate(upcoming?.dueDate)],["Next installment amount",money(upcoming?.totalOutstandingForPeriod)],["Installments fully paid",`${periods.filter(p => p.totalOutstandingForPeriod === 0).length} of ${periods.length}`],["Loan status",outstanding === 0 ? "FULLY REPAID" : arrears > 0 ? "IN ARREARS" : "CURRENT"]];
  const details = (title: string, rows: unknown[][]) => `<section><h2>${title}</h2><table class="details">${rows.map(([label,value])=>`<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join("")}</table></section>`;
  let opening = principal;
  const rows = periods.map(p => {
    const closing = opening == null || p.principalDue == null ? undefined : Math.max(0,opening-p.principalDue);
    const balance = p.totalOutstandingForPeriod;
    const paid = p.totalPaidForPeriod ?? 0;
    const future = date(p.dueDate) && date(p.dueDate)! > today;
    const status = balance === 0 ? "Paid" : future ? (paid > 0 ? "Part-paid" : "Upcoming") : (paid > 0 ? "Partial – overdue" : "Overdue");
    const values = [p.period,showDate(p.dueDate),money(opening),money(p.principalDue),money(p.interestDue),money(p.totalDueForPeriod),money(closing),showDate(p.obligationsMetOnDate),money(p.totalPaidForPeriod),money(p.penaltyChargesDue),money(p.interestPaid),money(p.principalPaid),money(balance),status];
    opening = closing;
    return `<tr>${values.map((v,i)=>`<td class="${i===13 ? status === "Paid" ? "paid" : future ? "upcoming" : "overdue" : ""}">${escape(v)}</td>`).join("")}</tr>`;
  }).join("");
  const headers = ["No.","Due date","Opening principal","Principal due","Interest due","Installment due","Closing principal","Payment date","Amount paid","Penalty charged","Interest paid","Principal paid","Balance on installment","Status"];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Loan Statement - ${escape(loan.accountNo)}</title><style>
    @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#000;margin:20px;font-size:12px}.container{max-width:1600px;margin:auto}header{text-align:center;background:#1f3864;color:white;padding:10px}h1{font-size:21px;margin:0}header p{margin:5px}.title{background:#d9e2f3;color:#1f3864;text-align:center;font-size:17px;padding:8px;margin:0}.subtitle{text-align:center;padding:7px}.overview{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:22px}h2{background:#1f3864;color:#fff;font-size:13px;padding:7px;margin:8px 0 0}table{width:100%;border-collapse:collapse}.details th{text-align:left;font-weight:normal;width:65%}.details td{text-align:right}.details th,.details td{padding:5px;border-bottom:1px solid #d9e2f3}.overview section:nth-child(2) td{background:#fff2cc;color:#00f}.schedule{table-layout:fixed;font-size:10px}.schedule th,.schedule td{border:1px solid #b4c6e7;padding:6px 3px;text-align:right;overflow-wrap:anywhere}.schedule th{background:#1f3864;color:white;text-align:center}.schedule .groups th{background:#d9e2f3;color:#1f3864}.schedule tbody tr:nth-child(even){background:#f2f5fa}.schedule .paid{background:#e2efda}.schedule .overdue{background:#fce4d6;color:#9c0006}.schedule .upcoming{background:#fff2cc}.schedule tfoot{background:#d9e2f3;font-weight:bold}.notes{font-size:11px;line-height:1.6}.signatures{margin-top:24px}.toolbar{max-width:1600px;margin:0 auto 15px;display:flex;gap:10px}.toolbar button{padding:9px 16px;cursor:pointer}@media print{body{margin:0}.toolbar{display:none}.container{max-width:none}.overview{gap:10px;font-size:8px}.details th,.details td{padding:3px}.schedule{font-size:7px}.schedule th,.schedule td{padding:4px 2px}h2{font-size:10px}thead{display:table-header-group}tr{break-inside:avoid}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div><div class="container"><header><h1>${escape(company.name)}</h1></header><h2 class="title">LOAN STATEMENT – ${method} METHOD</h2><div class="subtitle">Statement as at ${escape(today.toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric",timeZone:"UTC"}))} &nbsp; | &nbsp; All amounts in ${escape(loan.currency?.code)}</div><div class="overview">${details("BORROWER DETAILS",borrower)}${details("LOAN TERMS",terms)}${details("ACCOUNT SUMMARY",totals)}</div><h3>REPAYMENT SCHEDULE AND TRANSACTION HISTORY</h3><table class="schedule"><thead><tr class="groups"><th colspan="7">SCHEDULED (system-generated)</th><th colspan="3">ACTUAL (from loan records)</th><th colspan="4">ALLOCATION &amp; STATUS</th></tr><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">TOTALS</td>${[sum("principalDue"),sum("interestDue"),sum("totalDueForPeriod")].map(v=>`<td>${money(v)}</td>`).join("")}<td></td><td></td>${[sum("totalPaidForPeriod"),sum("penaltyChargesDue"),sum("interestPaid"),sum("principalPaid"),sum("totalOutstandingForPeriod")].map(v=>`<td>${money(v)}</td>`).join("")}<td></td></tr></tfoot></table><h2>NOTES</h2><div class="notes">1. ${flat ? "Interest is calculated on the ORIGINAL principal for the full term and spread across installments (flat rate method)." : "Interest is calculated each period on the scheduled OUTSTANDING principal balance (reducing balance / amortising method)."}<br>2. Payment allocations and balances are taken from the loan system. Payment date shows the date the installment was fully settled.<br>3. Upfront fees shown are deducted/paid at disbursement. Scheduled amounts include charges recorded against each installment.<br>4. Please report any discrepancy within 14 days of the statement date. This is a computer-generated statement.</div><div class="signatures">Prepared by: ${escape(preparedBy ?? "______________________")} &nbsp; Checked by: ______________________ &nbsp; Official stamp:</div></div></body></html>`;
}
