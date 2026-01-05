import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/settle
 * Settle/withdraw cash from a cashier (cash out transaction)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId, cashierId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency, notes, date } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        { error: "Currency is required" },
        { status: 400 }
      );
    }

    // Handle fineract-prefixed IDs
    let dbTellerId = tellerId;
    let fineractTellerIdFromPrefix: number | null = null;
    if (tellerId.startsWith("fineract-")) {
      fineractTellerIdFromPrefix = parseInt(tellerId.replace("fineract-", ""));
    }

    // Get teller
    let teller = await prisma.teller.findFirst({
      where: { id: dbTellerId, tenantId: tenant.id },
    });

    // Try by Fineract ID if not found
    const fineractTellerIdToSearch = fineractTellerIdFromPrefix || (!isNaN(Number(tellerId)) ? Number(tellerId) : null);
    if (!teller && fineractTellerIdToSearch) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: fineractTellerIdToSearch, tenantId: tenant.id },
      });
    }

    if (!teller || !teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller not found or does not have a Fineract ID" },
        { status: 404 }
      );
    }

    // Parse cashierId - could be database ID or Fineract ID
    const cashierIdNum = parseInt(cashierId);
    const isNumericId = !isNaN(cashierIdNum);

    // Try to find cashier by database ID first
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId: teller.id, tenantId: tenant.id },
    });

    // If not found by database ID and cashierId is numeric, try Fineract ID
    if (!cashier && isNumericId) {
      cashier = await prisma.cashier.findFirst({
        where: {
          fineractCashierId: cashierIdNum,
          tellerId: teller.id,
          tenantId: tenant.id,
        },
      });
    }

    // Get Fineract cashier ID
    let fineractCashierId: number;
    if (cashier?.fineractCashierId) {
      fineractCashierId = cashier.fineractCashierId;
    } else if (isNumericId) {
      fineractCashierId = cashierIdNum;
    } else {
      return NextResponse.json(
        { error: "Invalid cashier ID format" },
        { status: 400 }
      );
    }

    // If cashier doesn't exist in database, sync from Fineract
    if (!cashier) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractCashier = await fineractService.getCashier(
          teller.fineractTellerId,
          fineractCashierId
        );

        const parseFineractDate = (dateInput: any): Date => {
          if (Array.isArray(dateInput)) {
            return new Date(dateInput[0], dateInput[1] - 1, dateInput[2]);
          } else if (typeof dateInput === "string") {
            return new Date(dateInput);
          }
          return new Date();
        };

        cashier = await prisma.cashier.create({
          data: {
            tenantId: tenant.id,
            tellerId: teller.id,
            fineractCashierId: fineractCashier.id,
            staffId: fineractCashier.staffId || 0,
            staffName: fineractCashier.staffName || `Staff ${fineractCashier.staffId}`,
            startDate: parseFineractDate(fineractCashier.startDate),
            endDate: fineractCashier.endDate ? parseFineractDate(fineractCashier.endDate) : null,
            isFullDay: fineractCashier.isFullDay !== undefined ? fineractCashier.isFullDay : true,
            status: "ACTIVE",
          },
        });
      } catch (error: any) {
        console.error("Error creating cashier from Fineract:", error.message);
      }
    }

    if (!cashier) {
      return NextResponse.json(
        { error: "Cashier not found" },
        { status: 404 }
      );
    }

    // Check cashier's available balance
    const cashierAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        cashierId: cashier.id,
        tenantId: tenant.id,
        status: "ACTIVE",
      },
    });

    const cashierBalance = cashierAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    if (parseFloat(amount) > cashierBalance) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          details: `Cashier balance: ${cashierBalance.toFixed(2)} ${currency}, Requested: ${parseFloat(amount).toFixed(2)} ${currency}`,
        },
        { status: 400 }
      );
    }

    // Format date for Fineract
    const formatDateForFineract = (dateInput: string | Date): string => {
      const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
      const day = d.getDate();
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day.toString().padStart(2, "0")} ${month} ${year}`;
    };

    const txnDate = date ? formatDateForFineract(date) : formatDateForFineract(new Date());

    // Settle cash in Fineract (cash out transaction)
    let fineractSettlementId: number | null = null;
      try {
        const fineractService = await getFineractServiceWithSession();
      console.log("Calling Fineract settleCashForCashier with:", {
        tellerId: teller.fineractTellerId,
        cashierId: fineractCashierId,
        txnDate,
        currencyCode: currency,
        txnAmount: amount.toString(),
      });
        const result = await fineractService.settleCashForCashier(
          teller.fineractTellerId,
        fineractCashierId,
          {
          txnDate,
          currencyCode: currency,
          txnAmount: amount.toString(),
          txnNote: notes || "Cash Out",
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          }
        );
      fineractSettlementId = result.resourceId || result.id || null;
      console.log("Fineract settle response:", result);
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      };
      console.error("Error settling cash in Fineract:", errorDetails);
      // Return full error details so user can see what went wrong
      return NextResponse.json(
        {
          error: "Failed to settle cash in Fineract",
          details: error.response?.data?.defaultUserMessage || 
                   error.response?.data?.errors?.[0]?.defaultUserMessage ||
                   error.message,
          fineractError: error.response?.data || null,
          debugInfo: {
            tellerId: teller.fineractTellerId,
            cashierId: fineractCashierId,
            txnDate,
            currencyCode: currency,
            txnAmount: amount.toString(),
          },
        },
        { status: error.response?.status || 500 }
      );
    }

    // Check if this fineract settlement already exists in our database
    if (fineractSettlementId) {
      const existingSettlement = await prisma.cashAllocation.findUnique({
        where: { fineractAllocationId: fineractSettlementId },
      });

      if (existingSettlement) {
        // Settlement already recorded, return success with existing record
        return NextResponse.json({
          success: true,
          transaction: existingSettlement,
          type: "CASH_OUT",
          message: "Settlement already recorded",
        });
      }
    }

    // Create a negative allocation record (cash out)
    const settlement = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId: teller.id,
        cashierId: cashier.id,
        fineractAllocationId: fineractSettlementId,
        amount: -parseFloat(amount), // Negative for cash out
        currency: currency,
        allocatedBy: session.user.id,
        notes: notes || "Settlement to teller safe",
        status: "ACTIVE",
      },
    });

    // Update the cashier session status to SETTLED
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await prisma.cashierSession.updateMany({
        where: {
          cashierId: cashier.id,
          tenantId: tenant.id,
        sessionStatus: "CLOSED",
        sessionDate: {
          gte: today,
        },
      },
          data: {
        sessionStatus: "SETTLED",
        updatedAt: new Date(),
          },
        });

    return NextResponse.json({
      success: true,
      transaction: settlement,
      type: "CASH_OUT",
      amount: parseFloat(amount),
      currency,
      fineractSettlementId,
      sessionStatus: "SETTLED",
    });
  } catch (error) {
    console.error("Error settling cash:", error);
    return NextResponse.json(
      {
        error: "Failed to settle cash",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
