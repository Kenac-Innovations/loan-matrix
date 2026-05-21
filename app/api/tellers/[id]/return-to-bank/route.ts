import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { fetchFineractAPI } from "@/lib/api";
import { getGlAccountBalance } from "@/lib/gl-balance";

/**
 * POST /api/tellers/[id]/return-to-bank
 *
 * Move cash from a teller's vault back to its parent bank. Mirrors
 * `POST /api/tellers/[id]/allocate` in reverse:
 *
 *   - Posts a Fineract journal entry: DEBIT bank GL, CREDIT teller GL.
 *   - Writes a positive `BankAllocation` row so the bank's history page shows
 *     the inflow.
 *   - Writes a negative `CashAllocation` row (tellerId, cashierId=null) so the
 *     teller's local ledger reflects the outflow.
 *
 * Requires teller.glAccountId, teller.bankId, and teller.bank.glAccountId to
 * all be set – any "return" needs both halves of the double-entry to land.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency, notes, bankId: requestedBankId } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
      include: { bank: true },
    });

    if (!teller && !Number.isNaN(Number(tellerId))) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: Number(tellerId), tenantId: tenant.id },
        include: { bank: true },
      });
    }

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    if (!teller.glAccountId) {
      return NextResponse.json(
        {
          error: "Teller has no GL account configured",
          details:
            "Assign a Branch Cash GL account to this teller before returning cash to the bank.",
        },
        { status: 400 }
      );
    }

    // Resolve destination bank: explicit bankId overrides teller's parent bank.
    // When no override is provided we fall back to the teller's parent bank.
    let destinationBank = teller.bank;
    if (requestedBankId && requestedBankId !== teller.bankId) {
      destinationBank = await prisma.bank.findFirst({
        where: { id: requestedBankId, tenantId: tenant.id },
      });
      if (!destinationBank) {
        return NextResponse.json(
          {
            error: "Destination bank not found",
            details: "The selected bank does not exist for this tenant.",
          },
          { status: 404 }
        );
      }
    }

    if (!destinationBank) {
      return NextResponse.json(
        {
          error: "No destination bank available",
          details:
            "Select a bank to return cash to, or link this teller to a parent bank.",
        },
        { status: 400 }
      );
    }

    if (!destinationBank.glAccountId) {
      return NextResponse.json(
        {
          error: "Destination bank has no GL account configured",
          details: `Bank "${destinationBank.name}" needs a GL account before cash can be returned to it.`,
        },
        { status: 400 }
      );
    }

    const orgCurrency = await getOrgDefaultCurrencyCode();
    const requestedAmount = parseFloat(amount);
    const returnCurrency = currency || orgCurrency;

    const glResult = await getGlAccountBalance(teller.glAccountId);
    const vaultBalance =
      glResult.source === "fineract_calculated" ||
      glResult.source === "fineract_empty"
        ? glResult.balance
        : null;

    if (vaultBalance == null) {
      return NextResponse.json(
        {
          error: "Could not read teller vault balance from Fineract",
          details:
            "Fineract is not reachable or returned an error. Please try again.",
          glError: glResult.error,
        },
        { status: 502 }
      );
    }

    if (requestedAmount > vaultBalance) {
      return NextResponse.json(
        {
          error: "Insufficient teller vault balance",
          details: `Teller vault balance: ${vaultBalance.toFixed(
            2
          )} ${returnCurrency}. Requested: ${requestedAmount.toFixed(
            2
          )} ${returnCurrency}.`,
          vaultBalance,
        },
        { status: 400 }
      );
    }

    const today = new Date();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const fineractDate = `${today
      .getDate()
      .toString()
      .padStart(2, "0")} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

    let journalTransactionId: string | null = null;
    try {
      const journalResult = await fetchFineractAPI("/journalentries", {
        method: "POST",
        body: JSON.stringify({
          officeId: destinationBank.officeId ?? teller.officeId,
          transactionDate: fineractDate,
          currencyCode: returnCurrency,
          debits: [
            { glAccountId: destinationBank.glAccountId, amount: requestedAmount },
          ],
          credits: [
            { glAccountId: teller.glAccountId, amount: requestedAmount },
          ],
          comments: `Return from teller ${teller.name} to bank ${
            destinationBank.name
          }${notes ? ` - ${notes}` : ""}`.trim(),
          referenceNumber: `TELLER-RETURN-${teller.id}-${Date.now()}`,
          locale: "en",
          dateFormat: "dd MMMM yyyy",
        }),
      });
      journalTransactionId =
        journalResult?.transactionId || journalResult?.resourceId || null;
    } catch (err) {
      console.error(
        "Failed to post Fineract journal entry for teller return-to-bank:",
        err
      );
      return NextResponse.json(
        {
          error: "Failed to post journal entry in Fineract",
          details:
            "The return could not be recorded because Fineract did not accept the journal entry. No local rows were written.",
        },
        { status: 502 }
      );
    }

    // Record both legs locally for audit + so the bank/teller history pages
    // surface this movement. The teller-side row is a negative amount so the
    // local ledger sum still matches the GL direction.
    const noteTag = journalTransactionId ? ` [GL JE: ${journalTransactionId}]` : "";

    const cashAllocation = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId: teller.id,
        cashierId: null,
        fineractAllocationId: null,
        amount: -requestedAmount,
        currency: returnCurrency,
        allocatedBy: session.user.id,
        notes: `Return to bank ${destinationBank.name}${
          notes ? ` - ${notes}` : ""
        }${noteTag}`.trim(),
        status: "ACTIVE",
      },
    });

    const bankAllocation = await prisma.bankAllocation.create({
      data: {
        tenantId: tenant.id,
        bankId: destinationBank.id,
        amount: requestedAmount,
        currency: returnCurrency,
        allocatedBy: session.user.id,
        notes: `Return from teller ${teller.name} (${teller.officeName})${
          notes ? ` - ${notes}` : ""
        }${noteTag}`.trim(),
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      journalTransactionId,
      cashAllocation,
      bankAllocation,
    });
  } catch (error) {
    console.error("Error returning cash to bank:", error);
    return NextResponse.json(
      {
        error: "Failed to return cash to bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
