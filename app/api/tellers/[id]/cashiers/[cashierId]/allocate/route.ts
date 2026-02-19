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
    const { amount, currency, notes, date, source } = body;

    // Loan repayments: money flows customer → cashier, NOT vault → cashier. Skip vault check.
    const isRepayment = source === "repayment" || (notes && String(notes).toLowerCase().includes("loan repayment"));

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
        // Continue anyway - we can still create the allocation without the cashier record
      }
    }

    if (!teller || !teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller not found or does not have a Fineract ID" },
        { status: 404 }
      );
    }

    // Note: No session required for allocating cash to cashier
    // Cash allocation happens BEFORE starting a session - the allocated cash becomes the opening float

    // Calculate available balance - must DECREASE when loans are disbursed, and handle deposits
    // allocatedToCashiers = cash currently in cashier tills. Use netCash (current balance), NOT sumCashAllocation (cumulative).
    // Fineract only recognizes ZMK. Use ZMK for getCashierSummaryAndTransactions so we get valid data.
    // Must match teller details and local DB currency for consistent vault validation.
    const validationCurrency = "ZMK";
    const tellerVaultAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        tenantId: tenant.id,
        cashierId: null,
        status: "ACTIVE",
      },
    });

    const vaultBalance = tellerVaultAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    const cashierAllocsForCheck = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        tenantId: tenant.id,
        cashierId: { not: null },
        status: "ACTIVE",
        notes: { not: { contains: "Variance" } },
      },
    });
    const localAllocated = (() => {
      const positiveSum = cashierAllocsForCheck.reduce(
        (sum, alloc) => sum + (alloc.amount > 0 ? alloc.amount : 0),
        0
      );
      const netSum = cashierAllocsForCheck.reduce((sum, alloc) => sum + alloc.amount, 0);
      return Math.max(positiveSum, netSum);
    })();

    let allocatedToCashiers = localAllocated;
    try {
      const fineractService = await getFineractServiceWithSession();
      const fineractCashiers = await fineractService.getCashiers(teller.fineractTellerId);
      let fineractAllocated = 0;
      for (const fc of fineractCashiers || []) {
        try {
          const summary = await fineractService.getCashierSummaryAndTransactions(
            teller.fineractTellerId,
            fc.id,
            validationCurrency
          );
          fineractAllocated += summary.netCash ?? summary.sumCashAllocation ?? 0;
        } catch (err) {
          // Silently continue if single cashier fails
        }
      }
      allocatedToCashiers = Math.max(localAllocated, fineractAllocated);
    } catch (err) {
      console.error("Error fetching Fineract cashier balances, using local DB:", err);
    }

    const availableBalance = vaultBalance - allocatedToCashiers;

    // Only enforce vault balance when moving money vault → cashier (manual allocation).
    // Loan repayments: money flows customer → cashier, so skip vault check.
    if (!isRepayment && parseFloat(amount) > availableBalance) {
      return NextResponse.json(
        {
          error: "Insufficient available balance in teller vault",
          details: `Available balance: ${availableBalance.toFixed(
            2
          )} ${validationCurrency}, Requested: ${parseFloat(amount).toFixed(
            2
          )} ${currency}. Available balance = Vault balance - Allocated to cashiers.`,
        },
        { status: 400 }
      );
    }

    // Format date for Fineract - use yyyy-MM-dd when already in that format (e.g. loan repayments)
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

    // Use the same currency the loan (and summary view) expects – do NOT map ZMW→ZMK.
    // Fineract filters cashier summary by currencyCode; ZMK allocations do not appear in ZMW summary.
    const allocateCurrency = currency?.toUpperCase() || "ZMW";

    // Allocate cash in Fineract – require resourceId as proof the request hit Fineract
    let fineractAllocationId: number | null = null;
    let rawFineractResponse: unknown = null;
    const fineractRequest = {
      endpoint: `POST /fineract-provider/api/v1/tellers/${teller.fineractTellerId}/cashiers/${fineractCashierId}/allocate`,
      tellerId: teller.fineractTellerId,
      cashierId: fineractCashierId,
      txnDate,
      currencyCode: allocateCurrency,
      txnAmount: amount.toString(),
    };
    try {
      const fineractService = await getFineractServiceWithSession();
      console.log("[Allocate] Calling Fineract allocateCashToCashier:", fineractRequest);
      const result = await fineractService.allocateCashToCashier(
        teller.fineractTellerId,
        fineractCashierId,
        {
          txnDate,
          currencyCode: allocateCurrency,
          txnAmount: amount.toString(),
          txnNote: notes || "Allocation from teller safe",
          dateFormat,
          locale: "en",
        }
      );
      rawFineractResponse = result;
      console.log("[Allocate] Fineract raw response:", JSON.stringify(result));

      const id = result?.resourceId ?? result?.id;
      const hasValidResourceId = id != null && !isNaN(Number(id)) && Number(id) > 0;
      if (!hasValidResourceId) {
        console.error("[Allocate] Fineract did not return resourceId – cannot verify allocation", {
          request: fineractRequest,
          response: result,
        });
        return NextResponse.json(
          {
            error: "Fineract did not return a valid allocation ID",
            details:
              "The allocate request may not have reached Fineract, or Fineract returned an invalid response. Allocation cannot be verified.",
            fineractRequest,
            rawFineractResponse: result,
            proofRequired: "resourceId must be present in Fineract response to confirm allocation",
          },
          { status: 502 }
        );
      }
      fineractAllocationId = Number(id);
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      };
      console.error("[Allocate] Fineract allocate failed:", errorDetails);
      return NextResponse.json(
        {
          error: "Failed to allocate cash in Fineract",
          details:
            error.response?.data?.defaultUserMessage ||
            error.response?.data?.errors?.[0]?.defaultUserMessage ||
            error.message,
          fineractError: error.response?.data || null,
          fineractRequest,
          rawFineractResponse: error.response?.data ?? null,
        },
        { status: error.response?.status || 500 }
      );
    }

    // Repayments: customer → cashier. Only Fineract was updated. Do NOT create local record.
    // Local CashAllocation would incorrectly count toward allocatedToCashiers (vault math).
    if (isRepayment) {
      return NextResponse.json({
        success: true,
        source: "repayment",
        message: "Cashier balance updated in Fineract (customer payment, no vault change)",
        fineractResult: {
          resourceId: fineractAllocationId,
          tellerId: teller.fineractTellerId,
          cashierId: fineractCashierId,
          txnAmount: amount,
          currencyCode: allocateCurrency,
          txnDate,
        },
        proof: {
          fineractRequest,
          rawFineractResponse,
          resourceIdPresent: !!fineractAllocationId,
          verifyUrl: `GET .../tellers/${teller.fineractTellerId}/cashiers/${fineractCashierId}/summaryandtransactions?currencyCode=${allocateCurrency}`,
        },
      });
    }

    // Create allocation record in database with cashierId (vault → cashier only)
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
