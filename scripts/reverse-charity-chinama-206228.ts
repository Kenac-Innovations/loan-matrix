/**
 * Reverse disbursement for 206228/32/1 CHARITY CHINAMA in Fineract, then record reversal in Loan Matrix.
 * Cashier: Rosemary Hanyuka - Kitwe.
 *
 * Fineract: loan 104403 (CHARITY CHINAMA, 1700) - undo disbursal.
 * Loan Matrix: create/update LoanPayout as REVERSED so it shows in cashier transaction history.
 *
 * Requires: FINERACT_BASE_URL, FINERACT_TENANT_ID, FINERACT_USERNAME, FINERACT_PASSWORD, DATABASE_URL
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

const GOODFELLOW_TENANT_ID = "cmh607k3d0000vc0k5xxjocsi";
const FINERACT_LOAN_ID = 104403; // CHARITY CHINAMA 206228/32/1, principal 1700
const FINERACT_CLIENT_ID = 19278;
const CLIENT_NAME = "CHARITY CHINAMA";
const LOAN_ACCOUNT_NO = "000104403";
const AMOUNT = 1700;
const REVERSED_BY = "Rosemary Hanyuka - Kitwe";
const REVERSAL_REASON = "Reversed in Fineract; cashier credited (Rosemary Hanyuka - Kitwe)";

// Cashier Rosemary Hanyuka - Kitwe (first match)
const CASHIER_ID = "cmknwwwrt00226201ag1ard2v";

async function undoDisbursalInFineract(): Promise<void> {
  const baseUrl = process.env.FINERACT_BASE_URL?.replace(/\/$/, "") || "http://10.10.0.24:8443";
  const tenantId = process.env.FINERACT_TENANT_ID || "goodfellow";
  const username = process.env.FINERACT_USERNAME || "mifos";
  const password = process.env.FINERACT_PASSWORD || "password";

  const url = `${baseUrl}/fineract-provider/api/v1/loans/${FINERACT_LOAN_ID}?command=undodisbursal`;
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      "Fineract-Platform-TenantId": tenantId,
    },
    body: JSON.stringify({ note: REVERSAL_REASON }),
  });

  if (!res.ok) {
    const text = await res.text();
    let err: string;
    try {
      const j = JSON.parse(text);
      err = j.errors?.[0]?.defaultUserMessage || j.developerMessage || text;
    } catch {
      err = text;
    }
    throw new Error(`Fineract undodisbursal failed (${res.status}): ${err}`);
  }
}

async function main() {
  console.log("Reverse 206228/32/1 CHARITY CHINAMA – Fineract + Loan Matrix\n");

  const skipFineract = process.env.SKIP_FINERACT === "1" || process.env.SKIP_FINERACT === "true";

  // 1. Fineract: undo disbursal (skip if SKIP_FINERACT=1, e.g. when reversal was done in Fineract DB or via UI)
  if (!skipFineract) {
    console.log("1. Calling Fineract API to undo disbursal for loan", FINERACT_LOAN_ID, "...");
    try {
      await undoDisbursalInFineract();
      console.log("   Fineract: undodisbursal succeeded.\n");
    } catch (e) {
      console.error("   Fineract error:", (e as Error).message);
      throw e;
    }
  } else {
    console.log("1. Skipping Fineract API (SKIP_FINERACT=1). Ensure reversal is already done in Fineract.\n");
  }

  // 2. Loan Matrix: create or update LoanPayout as REVERSED, linked to cashier Rosemary Hanyuka
  console.log("2. Updating Loan Matrix (REVERSED payout for cashier Rosemary Hanyuka - Kitwe)...");

  const cashier = await prisma.cashier.findUnique({
    where: { id: CASHIER_ID },
    select: { id: true, tellerId: true },
  });
  if (!cashier) {
    throw new Error(`Cashier ${CASHIER_ID} (Rosemary Hanyuka) not found in Loan Matrix`);
  }

  const existing = await prisma.loanPayout.findFirst({
    where: {
      tenantId: GOODFELLOW_TENANT_ID,
      fineractLoanId: FINERACT_LOAN_ID,
    },
  });

  const reversedAt = new Date();

  if (existing) {
    await prisma.loanPayout.update({
      where: { id: existing.id },
      data: {
        status: "REVERSED",
        voidedAt: reversedAt,
        voidedBy: REVERSED_BY,
        voidReason: REVERSAL_REASON,
        cashierId: cashier.id,
        tellerId: cashier.tellerId,
      },
    });
    console.log(`   Updated existing LoanPayout: fineractLoanId ${FINERACT_LOAN_ID} | ${CLIENT_NAME} | ${AMOUNT} → REVERSED`);
  } else {
    await prisma.loanPayout.create({
      data: {
        tenantId: GOODFELLOW_TENANT_ID,
        fineractLoanId: FINERACT_LOAN_ID,
        fineractClientId: FINERACT_CLIENT_ID,
        clientName: CLIENT_NAME,
        loanAccountNo: LOAN_ACCOUNT_NO,
        amount: AMOUNT,
        currency: "ZMK",
        status: "REVERSED",
        voidedAt: reversedAt,
        voidedBy: REVERSED_BY,
        voidReason: REVERSAL_REASON,
        cashierId: cashier.id,
        tellerId: cashier.tellerId,
      },
    });
    console.log(`   Created LoanPayout: fineractLoanId ${FINERACT_LOAN_ID} | ${CLIENT_NAME} | ${AMOUNT} → REVERSED`);
  }

  console.log("\nDone. Reversal will show in Rosemary Hanyuka (Kitwe) cashier transaction history.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
