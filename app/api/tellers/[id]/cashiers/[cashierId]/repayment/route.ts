import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/repayment
 * Record a loan repayment received by a cashier.
 * This adds to the cashier's balance WITHOUT reducing the teller vault balance.
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

    // Handle fineract-prefixed IDs for teller
    let dbTellerId = tellerId;
    let fineractTellerIdFromPrefix: number | null = null;
    if (tellerId.startsWith("fineract-")) {
      fineractTellerIdFromPrefix = parseInt(tellerId.replace("fineract-", ""));
    }

    // Get teller by database ID or Fineract ID
    let teller = await prisma.teller.findFirst({
      where: { id: dbTellerId, tenantId: tenant.id },
    });

    // Try by Fineract ID if not found
    const fineractTellerIdToSearch =
      fineractTellerIdFromPrefix ||
      (!isNaN(Number(tellerId)) ? Number(tellerId) : null);
    if (!teller && fineractTellerIdToSearch) {
      teller = await prisma.teller.findFirst({
        where: {
          fineractTellerId: fineractTellerIdToSearch,
          tenantId: tenant.id,
        },
      });
    }

    // Parse cashierId - could be database ID or Fineract ID
    const cashierIdNum = parseInt(cashierId);
    const isNumericId = !isNaN(cashierIdNum);

    // Try to find cashier by database ID first (using teller.id if found)
    let cashier = teller
      ? await prisma.cashier.findFirst({
          where: { id: cashierId, tellerId: teller.id, tenantId: tenant.id },
        })
      : null;

    // If not found by database ID and cashierId is numeric, try Fineract ID
    if (!cashier && isNumericId && teller) {
      cashier = await prisma.cashier.findFirst({
        where: {
          fineractCashierId: cashierIdNum,
          tellerId: teller.id,
          tenantId: tenant.id,
        },
      });
    }

    // Get Fineract cashier ID - use from database if found, otherwise use the provided ID
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

    // If cashier still doesn't exist in database, fetch from Fineract and create it
    if (!cashier && teller?.fineractTellerId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractCashier = await fineractService.getCashier(
          teller.fineractTellerId,
          fineractCashierId
        );

        // Parse Fineract date format
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
            staffName:
              fineractCashier.staffName ||
              fineractCashier.staff?.displayName ||
              `Staff ${fineractCashier.staffId}`,
            startDate: parseFineractDate(fineractCashier.startDate),
            endDate: fineractCashier.endDate
              ? parseFineractDate(fineractCashier.endDate)
              : null,
            isFullDay:
              fineractCashier.isFullDay !== undefined
                ? fineractCashier.isFullDay
                : true,
            startTime:
              fineractCashier.startTime && fineractCashier.startTime.trim()
                ? fineractCashier.startTime.trim()
                : null,
            endTime:
              fineractCashier.endTime && fineractCashier.endTime.trim()
                ? fineractCashier.endTime.trim()
                : null,
            status: "ACTIVE",
          },
        });

        console.log("Created missing cashier in database:", cashier.id);
      } catch (error: any) {
        console.error("Error creating cashier from Fineract:", {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
      }
    }

    if (!teller || !teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller not found or does not have a Fineract ID" },
        { status: 404 }
      );
    }

    // NOTE: No vault balance check here.
    // Repayments add to the cashier's balance without reducing the vault.

    // Format date for Fineract
    const formatDateForFineract = (dateInput: string | Date): string => {
      const date =
        typeof dateInput === "string" ? new Date(dateInput) : dateInput;
      const day = date.getDate();
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
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day.toString().padStart(2, "0")} ${month} ${year}`;
    };

    const isIsoDate = date && /^\d{4}-\d{2}-\d{2}$/.test(String(date).trim());
    const txnDate = isIsoDate
      ? String(date).trim()
      : date
      ? formatDateForFineract(date)
      : formatDateForFineract(new Date());
    const dateFormat = isIsoDate ? "yyyy-MM-dd" : "dd MMMM yyyy";

    // Allocate cash in Fineract (adds to cashier balance)
    let fineractAllocationId: number | null = null;
    try {
      const fineractService = await getFineractServiceWithSession();
      console.log("Calling Fineract allocateCashToCashier (repayment) with:", {
        tellerId: teller.fineractTellerId,
        cashierId: fineractCashierId,
        txnDate,
        currencyCode: currency,
        txnAmount: amount.toString(),
      });
      const result = await fineractService.allocateCashToCashier(
        teller.fineractTellerId,
        fineractCashierId,
        {
          txnDate,
          currencyCode: currency,
          txnAmount: amount.toString(),
          txnNote: notes || "Loan repayment received by cashier",
          dateFormat,
          locale: "en",
        }
      );
      console.log("Fineract allocateCashToCashier (repayment) result:", result);
      fineractAllocationId = result.resourceId || result.id || null;
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      };
      console.error("Error allocating repayment cash in Fineract:", errorDetails);
      return NextResponse.json(
        {
          error: "Failed to record repayment in Fineract",
          details:
            error.response?.data?.defaultUserMessage ||
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

    // Create allocation record in database with cashierId
    if (!cashier) {
      return NextResponse.json(
        {
          error: "Cashier not found",
          details:
            "The cashier does not exist in Fineract or could not be created in the database.",
        },
        { status: 404 }
      );
    }

    // Check if allocation with this fineractAllocationId already exists
    if (fineractAllocationId) {
      const existingAllocation = await prisma.cashAllocation.findUnique({
        where: { fineractAllocationId },
      });

      if (existingAllocation) {
        const isDuplicate =
          existingAllocation.cashierId === cashier.id &&
          Math.abs(existingAllocation.amount - parseFloat(amount)) < 0.01 &&
          existingAllocation.allocatedDate &&
          new Date(existingAllocation.allocatedDate).toDateString() ===
            new Date().toDateString();

        if (isDuplicate) {
          return NextResponse.json(
            {
              error: "Repayment allocation already exists",
              details: `A duplicate repayment allocation already exists for this cashier with the same amount today.`,
              existingAllocation,
            },
            { status: 409 }
          );
        }
        fineractAllocationId = null;
      }
    }

    try {
      const allocation = await prisma.cashAllocation.create({
        data: {
          tenantId: tenant.id,
          tellerId: teller.id,
          cashierId: cashier.id,
          fineractAllocationId: fineractAllocationId || null,
          amount: parseFloat(amount),
          currency: currency,
          allocatedBy: session.user.id,
          notes: notes || "Loan repayment received by cashier",
          status: "ACTIVE",
        },
      });

      return NextResponse.json(allocation);
    } catch (error: any) {
      if (
        error.code === "P2002" &&
        error.meta?.target?.includes("fineractAllocationId")
      ) {
        const allocation = await prisma.cashAllocation.create({
          data: {
            tenantId: tenant.id,
            tellerId: teller.id,
            cashierId: cashier.id,
            fineractAllocationId: null,
            amount: parseFloat(amount),
            currency: currency,
            allocatedBy: session.user.id,
            notes: `${
              notes || "Loan repayment received by cashier"
            } [Fineract ID: ${fineractAllocationId} - duplicate handled]`,
            status: "ACTIVE",
          },
        });
        return NextResponse.json(allocation);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error recording repayment:", error);
    return NextResponse.json(
      {
        error: "Failed to record repayment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
