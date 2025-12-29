import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/allocate
 * Allocate cash to a cashier
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
    const fineractTellerIdToSearch = fineractTellerIdFromPrefix || (!isNaN(Number(tellerId)) ? Number(tellerId) : null);
    if (!teller && fineractTellerIdToSearch) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: fineractTellerIdToSearch, tenantId: tenant.id },
      });
    }

    // Parse cashierId - could be database ID or Fineract ID
    const cashierIdNum = parseInt(cashierId);
    const isNumericId = !isNaN(cashierIdNum);

    // Try to find cashier by database ID first (using teller.id if found)
    let cashier = teller ? await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId: teller.id, tenantId: tenant.id },
    }) : null;

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
        // Continue anyway - we can still create the allocation without the cashier record
      }
    }

    if (!teller || !teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller not found or does not have a Fineract ID" },
        { status: 404 }
      );
    }

    // Check teller vault balance (allocations where cashierId is null)
    const tellerVaultAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        tenantId: tenant.id,
        cashierId: null, // Teller vault allocations
        status: "ACTIVE",
      },
    });

    const tellerVaultBalance = tellerVaultAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Check how much has been allocated to cashiers (allocations where cashierId is not null)
    // Exclude variance allocations - variance is tracked separately
    const cashierAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        tenantId: tenant.id,
        cashierId: { not: null },
        status: "ACTIVE",
        // Exclude variance allocations (those with notes containing "Variance")
        notes: { not: { contains: "Variance" } },
      },
    });

    const allocatedToCashiers = cashierAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    const availableBalance = tellerVaultBalance - allocatedToCashiers;

    if (parseFloat(amount) > availableBalance) {
      return NextResponse.json(
        {
          error: "Insufficient available balance in teller vault",
          details: `Available balance: ${availableBalance.toFixed(
            2
          )} ${currency}, Requested: ${parseFloat(amount).toFixed(
            2
          )} ${currency}. Available balance = Vault balance - Allocated to cashiers.`,
        },
        { status: 400 }
      );
    }

    // Format date for Fineract (dd MMMM yyyy format)
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

    const txnDate = date
      ? formatDateForFineract(date)
      : formatDateForFineract(new Date());

    // Allocate cash in Fineract
    let fineractAllocationId: number | null = null;
    try {
      const fineractService = await getFineractServiceWithSession();
      console.log("Calling Fineract allocateCashToCashier with:", {
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
          txnNote: notes || "Allocation from teller safe",
          dateFormat: "dd MMMM yyyy",
          locale: "en",
        }
      );
      console.log("Fineract allocateCashToCashier result:", result);
      fineractAllocationId = result.resourceId || result.id || null;
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      };
      console.error("Error allocating cash in Fineract:", errorDetails);
      // Return full error details so user can see what went wrong
      return NextResponse.json(
        {
          error: "Failed to allocate cash in Fineract",
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

    // Create allocation record in database with cashierId
    // cashierId must be set for cashier allocations (not null)
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
    // Only prevent if it's a true duplicate (same cashier, amount, and recent date)
    if (fineractAllocationId) {
      const existingAllocation = await prisma.cashAllocation.findUnique({
        where: { fineractAllocationId },
      });

      if (existingAllocation) {
        // Check if it's a true duplicate (same cashier, similar amount, same day)
        const isDuplicate =
          existingAllocation.cashierId === cashier.id &&
          Math.abs(existingAllocation.amount - parseFloat(amount)) < 0.01 &&
          existingAllocation.allocatedDate &&
          new Date(existingAllocation.allocatedDate).toDateString() ===
            new Date().toDateString();

        if (isDuplicate) {
          return NextResponse.json(
            {
              error: "Allocation already exists",
              details: `A duplicate allocation already exists for this cashier with the same amount today.`,
              existingAllocation,
            },
            { status: 409 } // Conflict
          );
        }
        // If it's not a duplicate, allow it but set fineractAllocationId to null to avoid unique constraint
        // This handles cases where Fineract returns the same ID for different allocations
        fineractAllocationId = null;
      }
    }

    try {
      const allocation = await prisma.cashAllocation.create({
        data: {
          tenantId: tenant.id,
          tellerId: teller.id,
          cashierId: cashier.id, // Must be set for cashier allocations
          fineractAllocationId: fineractAllocationId || null, // Use null if undefined/0 or duplicate
          amount: parseFloat(amount),
          currency: currency,
          allocatedBy: session.user.id,
          notes,
          status: "ACTIVE",
        },
      });

      return NextResponse.json(allocation);
    } catch (error: any) {
      // Handle unique constraint violation
      if (
        error.code === "P2002" &&
        error.meta?.target?.includes("fineractAllocationId")
      ) {
        // If we get a unique constraint error, try again without fineractAllocationId
        const allocation = await prisma.cashAllocation.create({
          data: {
            tenantId: tenant.id,
            tellerId: teller.id,
            cashierId: cashier.id,
            fineractAllocationId: null, // Set to null to avoid constraint
            amount: parseFloat(amount),
            currency: currency,
            allocatedBy: session.user.id,
            notes: `${
              notes || ""
            } [Fineract ID: ${fineractAllocationId} - duplicate handled]`,
            status: "ACTIVE",
          },
        });
        return NextResponse.json(allocation);
      }
      throw error; // Re-throw if it's a different error
    }

    return NextResponse.json(allocation);
  } catch (error) {
    console.error("Error allocating cash:", error);
    return NextResponse.json(
      {
        error: "Failed to allocate cash",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
