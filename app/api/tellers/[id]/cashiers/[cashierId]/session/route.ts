import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * GET /api/tellers/[id]/cashiers/[cashierId]/session
 * Get current cashier session
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId, cashierId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // Try to find cashier by database ID first, then by Fineract ID
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId, tenantId: tenant.id },
    });

    if (!cashier) {
      const fineractCashierId = parseInt(cashierId);
      if (!isNaN(fineractCashierId)) {
        cashier = await prisma.cashier.findFirst({
          where: {
            fineractCashierId,
            tellerId,
            tenantId: tenant.id,
          },
        });
      }
    }

    if (!teller || !teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller not found or does not have a Fineract ID" },
        { status: 404 }
      );
    }

    // Get Fineract cashier ID - use from database if found, otherwise use the provided ID
    const fineractCashierId = cashier?.fineractCashierId || parseInt(cashierId);

    if (isNaN(fineractCashierId)) {
      return NextResponse.json(
        { error: "Invalid cashier ID" },
        { status: 400 }
      );
    }

    // Get active or most recent closed session from database (only if we have a database cashier)
    // First try to get active session, if not found, get most recent closed session
    const activeSession = cashier
      ? await prisma.cashierSession.findFirst({
          where: {
            tellerId,
            cashierId: cashier.id,
            tenantId: tenant.id,
            sessionStatus: "ACTIVE",
          },
          orderBy: { sessionStartTime: "desc" },
        })
      : null;

    // If no active session, get the most recent closed session for display purposes
    const closedSession =
      !activeSession && cashier
        ? await prisma.cashierSession.findFirst({
            where: {
              tellerId,
              cashierId: cashier.id,
              tenantId: tenant.id,
              sessionStatus: "CLOSED",
            },
            orderBy: { sessionEndTime: "desc" },
          })
        : null;

    // Get session data from Fineract if available
    let fineractSessionData = null;
    if (teller.fineractTellerId && fineractCashierId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        fineractSessionData = await fineractService.getCashierSession(
          teller.fineractTellerId,
          fineractCashierId
        );
      } catch (error) {
        console.error("Error fetching Fineract session:", error);
      }
    }

    // Calculate balances - use session's opening float if active session exists
    // Otherwise calculate from allocations
    const cashierDbId = cashier?.id;
    let allocatedBalance = 0;

    // If we have an active session, use its recorded opening float
    if (activeSession) {
      allocatedBalance =
        activeSession.allocatedBalance || activeSession.openingFloat || 0;
    } else if (cashierDbId) {
      // Only get allocations specifically for this cashier (cashierId is set)
      const activeAllocations = await prisma.cashAllocation.findMany({
        where: {
          tellerId,
          cashierId: cashierDbId, // Only this cashier's allocations
          status: "ACTIVE",
        },
        orderBy: { allocatedDate: "desc" },
      });

      allocatedBalance = activeAllocations.reduce(
        (sum, alloc) => sum + alloc.amount,
        0
      );
    }

    // If no database cashier, return Fineract-only data with zero allocation
    // (cashiers don't get automatic allocations - they must be allocated by branch manager)
    if (!cashier) {
      return NextResponse.json({
        session: null,
        fineractSession: fineractSessionData,
        balances: {
          allocatedBalance: 0, // No automatic allocation
          availableBalance: 0,
          openingFloat: 0,
          cashIn: 0,
          cashOut: 0,
          netCash: 0,
          expectedBalance: 0,
        },
        note: "Cashier not found in database, using Fineract data only",
      });
    }

    // If we have a closed session, use its recorded balances (don't recalculate)
    // For closed sessions, the balances are already calculated and stored
    if (closedSession && !activeSession) {
      const expectedBalance = closedSession.expectedBalance || 0;
      return NextResponse.json({
        session: closedSession,
        fineractSession: fineractSessionData,
        balances: {
          allocatedBalance: closedSession.allocatedBalance || 0,
          availableBalance: expectedBalance, // Use expectedBalance for closed sessions
          openingFloat:
            closedSession.openingFloat || closedSession.allocatedBalance || 0,
          cashIn: closedSession.cashIn || 0,
          cashOut: closedSession.cashOut || 0,
          netCash: closedSession.netCash || 0,
          expectedBalance: expectedBalance,
        },
      });
    }

    // For active sessions, calculate balances from current allocations and transactions
    let cashIn = 0;
    let cashOut = 0;
    if (teller.fineractTellerId && fineractCashierId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const transactions = await fineractService.getCashierTransactions(
          teller.fineractTellerId,
          fineractCashierId
        );

        transactions.forEach((tx: any) => {
          if (tx.type?.deposit || tx.type?.cashIn) {
            cashIn += tx.amount || 0;
          } else if (tx.type?.withdrawal || tx.type?.cashOut) {
            cashOut += tx.amount || 0;
          }
        });
      } catch (error) {
        console.error("Error fetching transactions:", error);
      }
    }

    const netCash = cashIn - cashOut;
    const expectedBalance = allocatedBalance + cashIn - cashOut;
    // availableBalance should be the same as expectedBalance (allocated + cash in - cash out)
    const availableBalance = expectedBalance;

    const displayBalances = {
      allocatedBalance,
      availableBalance,
      openingFloat: allocatedBalance,
      cashIn,
      cashOut,
      netCash,
      expectedBalance,
    };

    return NextResponse.json({
      session: activeSession || closedSession,
      fineractSession: fineractSessionData,
      balances: displayBalances,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/session
 * Start or close cashier session
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
    const { action, countedCashAmount, comments } = body;

    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // Try to find cashier by database ID first, then by Fineract ID
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId, tenantId: tenant.id },
    });

    if (!cashier) {
      const fineractCashierId = parseInt(cashierId);
      if (!isNaN(fineractCashierId)) {
        cashier = await prisma.cashier.findFirst({
          where: {
            fineractCashierId,
            tellerId,
            tenantId: tenant.id,
          },
        });
      }
    }

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Get Fineract cashier ID - use from database if found, otherwise use the provided ID
    const fineractCashierId = cashier?.fineractCashierId || parseInt(cashierId);

    if (isNaN(fineractCashierId)) {
      return NextResponse.json(
        { error: "Invalid cashier ID" },
        { status: 400 }
      );
    }

    // For starting/closing sessions, we need a database cashier record
    // If cashier doesn't exist in database but exists in Fineract, create it
    if (!cashier && action === "start") {
      try {
        // Fetch cashier details from Fineract
        const fineractService = await getFineractServiceWithSession();
        const fineractCashier = await fineractService.getCashier(
          teller.fineractTellerId,
          fineractCashierId
        );

        if (!fineractCashier) {
          return NextResponse.json(
            {
              error: "Cashier not found in Fineract",
              details: "The cashier does not exist in Fineract.",
            },
            { status: 404 }
          );
        }

        // Parse dates from Fineract format
        const parseFineractDate = (dateInput: any): Date => {
          if (!dateInput) return new Date();
          if (Array.isArray(dateInput) && dateInput.length >= 3) {
            return new Date(dateInput[0], dateInput[1] - 1, dateInput[2]);
          }
          if (typeof dateInput === "string") {
            const parsed = new Date(dateInput);
            if (!isNaN(parsed.getTime())) return parsed;
          }
          return new Date();
        };

        // Create cashier in database
        console.log("Creating cashier from Fineract data:", {
          fineractCashierId: fineractCashier.id,
          staffId: fineractCashier.staffId,
          staffName: fineractCashier.staffName,
          startDate: fineractCashier.startDate,
          endDate: fineractCashier.endDate,
        });

        cashier = await prisma.cashier.create({
          data: {
            tenantId: tenant.id,
            tellerId,
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
        return NextResponse.json(
          {
            error: "Failed to create cashier in database",
            details:
              "The cashier exists in Fineract but could not be created in the local database.",
            hint: "Please try creating the cashier manually or contact support.",
            fineractError: error.response?.data || error.message,
          },
          { status: 500 }
        );
      }
    }

    if (action === "start") {
      // Start session
      let fineractSessionId: number | undefined;
      let fineractError: any = null;
      try {
        const fineractService = await getFineractServiceWithSession();
        const result = await fineractService.startCashierSession(
          teller.fineractTellerId,
          fineractCashierId
        );
        fineractSessionId = result.resourceId || result.id;
        console.log("Session started in Fineract:", fineractSessionId);
      } catch (error: any) {
        fineractError = error;
        console.error("Error starting session in Fineract:", {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        // Continue with database session even if Fineract fails
      }

      // Get allocated balance - use cashier-specific allocations ONLY
      const activeAllocations = await prisma.cashAllocation.findMany({
        where: {
          tellerId,
          cashierId: cashier.id, // Only this cashier's allocations
          status: "ACTIVE",
        },
        orderBy: { allocatedDate: "desc" },
      });

      const allocatedBalance = activeAllocations.reduce(
        (sum, alloc) => sum + alloc.amount,
        0
      );

      // Close any existing active sessions
      await prisma.cashierSession.updateMany({
        where: {
          tellerId,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: "ACTIVE",
        },
        data: {
          sessionStatus: "CLOSED",
          sessionEndTime: new Date(),
        },
      });

      // Create new session
      try {
        const newSession = await prisma.cashierSession.create({
          data: {
            tenantId: tenant.id,
            tellerId,
            cashierId: cashier.id,
            fineractSessionId,
            sessionStatus: "ACTIVE",
            sessionStartTime: new Date(),
            allocatedBalance,
            availableBalance: allocatedBalance,
            openingFloat: allocatedBalance,
            cashIn: 0,
            cashOut: 0,
            netCash: 0,
          },
        });

        console.log("Session created in database:", newSession.id);

        // If Fineract failed, return warning but still success
        if (fineractError) {
          return NextResponse.json(
            {
              ...newSession,
              warning:
                "Session created in database but Fineract activation failed",
              fineractError:
                fineractError.response?.data || fineractError.message,
            },
            { status: 207 } // Multi-Status
          );
        }

        return NextResponse.json(newSession);
      } catch (dbError: any) {
        console.error("Error creating session in database:", {
          message: dbError.message,
          code: dbError.code,
          meta: dbError.meta,
          stack: dbError.stack,
        });

        // Check if it's a foreign key constraint error (cashier doesn't exist)
        if (
          dbError.code === "P2003" ||
          dbError.message?.includes("Foreign key constraint")
        ) {
          return NextResponse.json(
            {
              error: "Cashier not found in database",
              details:
                "The cashier record does not exist. Please ensure the cashier is properly created and assigned to this teller.",
              hint: "Try refreshing the cashiers list or creating the cashier first.",
            },
            { status: 404 }
          );
        }

        return NextResponse.json(
          {
            error: "Failed to create session in database",
            details: dbError.message || "Unknown database error",
            code: dbError.code,
            fineractError:
              fineractError?.response?.data || fineractError?.message,
          },
          { status: 500 }
        );
      }
    } else if (action === "close") {
      // Close session - cashier must exist in database
      // If cashier doesn't exist in database but exists in Fineract, create it
      if (!cashier) {
        try {
          // Fetch cashier details from Fineract
          const fineractService = await getFineractServiceWithSession();
          const fineractCashier = await fineractService.getCashier(
            teller.fineractTellerId!,
            fineractCashierId
          );

          if (!fineractCashier) {
            return NextResponse.json(
              {
                error: "Cashier not found in Fineract",
                details: "The cashier does not exist in Fineract.",
              },
              { status: 404 }
            );
          }

          // Parse dates from Fineract format
          const parseFineractDate = (dateInput: any): Date => {
            if (!dateInput) return new Date();
            if (Array.isArray(dateInput) && dateInput.length >= 3) {
              return new Date(dateInput[0], dateInput[1] - 1, dateInput[2]);
            }
            if (typeof dateInput === "string") {
              const parsed = new Date(dateInput);
              if (!isNaN(parsed.getTime())) return parsed;
            }
            return new Date();
          };

          // Create cashier in database
          console.log(
            "Creating cashier from Fineract data for close session:",
            {
              fineractCashierId: fineractCashier.id,
              staffId: fineractCashier.staffId,
              staffName: fineractCashier.staffName,
            }
          );

          cashier = await prisma.cashier.create({
            data: {
              tenantId: tenant.id,
              tellerId,
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
          return NextResponse.json(
            {
              error: "Cashier not found in database",
              details:
                "The cashier does not exist in the database and could not be created from Fineract.",
              fineractError: error.response?.data || error.message,
            },
            { status: 404 }
          );
        }
      }

      if (!cashier) {
        return NextResponse.json(
          {
            error: "Cashier not found in database",
            details:
              "The cashier does not exist in the database. Please ensure the cashier is properly created.",
          },
          { status: 404 }
        );
      }

      // Close session
      // Try to find session by cashier database ID first
      let activeSession = await prisma.cashierSession.findFirst({
        where: {
          tellerId,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: "ACTIVE",
        },
      });

      // If not found by database ID, try to find by matching Fineract cashier ID
      // This handles cases where session was created before cashier was synced to database
      if (!activeSession && cashier.fineractCashierId) {
        // Find all active sessions for this teller and check if any match by Fineract ID
        const allActiveSessions = await prisma.cashierSession.findMany({
          where: {
            tellerId,
            tenantId: tenant.id,
            sessionStatus: "ACTIVE",
          },
          include: {
            cashier: {
              select: {
                fineractCashierId: true,
              },
            },
          },
        });

        const matchingSession = allActiveSessions.find(
          (s) => s.cashier.fineractCashierId === cashier.fineractCashierId
        );

        if (matchingSession) {
          // If we found a session with a different cashier database ID, update it
          if (matchingSession.cashierId !== cashier.id) {
            console.log(
              `Updating session cashierId from ${matchingSession.cashierId} to ${cashier.id}`
            );
            activeSession = await prisma.cashierSession.update({
              where: { id: matchingSession.id },
              data: { cashierId: cashier.id },
            });
          } else {
            activeSession = matchingSession;
          }
        }
      }

      if (!activeSession) {
        // Also check if there's a session in Fineract that we should sync
        if (teller.fineractTellerId && fineractCashierId) {
          try {
            const fineractService = await getFineractServiceWithSession();
            const fineractSession = await fineractService.getCashierSession(
              teller.fineractTellerId,
              fineractCashierId
            );

            if (fineractSession && fineractSession.status === "ACTIVE") {
              // Create session in database from Fineract data
              activeSession = await prisma.cashierSession.create({
                data: {
                  tenantId: tenant.id,
                  tellerId,
                  cashierId: cashier.id,
                  fineractSessionId: fineractSession.id,
                  sessionStatus: "ACTIVE",
                  sessionStartTime: fineractSession.startDate
                    ? new Date(fineractSession.startDate)
                    : new Date(),
                  allocatedBalance: fineractSession.openingBalance || 0,
                  availableBalance: fineractSession.openingBalance || 0,
                  openingFloat: fineractSession.openingBalance || 0,
                  cashIn: 0,
                  cashOut: 0,
                  netCash: 0,
                },
              });
              console.log(
                "Created session in database from Fineract:",
                activeSession.id
              );
            }
          } catch (error) {
            console.error("Error checking Fineract session:", error);
          }
        }
      }

      if (!activeSession) {
        return NextResponse.json(
          {
            error: "No active session found",
            details:
              "No active session found for this cashier. Please ensure a session has been started.",
            cashierId: cashier.id,
            fineractCashierId: cashier.fineractCashierId,
          },
          { status: 404 }
        );
      }

      // Use the session's recorded opening float (allocatedBalance from when session started)
      // Don't recalculate from allocations - use what was recorded at session start
      const allocatedBalance =
        activeSession.allocatedBalance || activeSession.openingFloat || 0;

      let cashIn = 0;
      let cashOut = 0;
      if (teller.fineractTellerId && fineractCashierId) {
        try {
          const fineractService = await getFineractServiceWithSession();
          const transactions = await fineractService.getCashierTransactions(
            teller.fineractTellerId,
            fineractCashierId
          );

          transactions.forEach((tx: any) => {
            if (tx.type?.deposit || tx.type?.cashIn) {
              cashIn += tx.amount || 0;
            } else if (tx.type?.withdrawal || tx.type?.cashOut) {
              cashOut += tx.amount || 0;
            }
          });
        } catch (error) {
          console.error("Error fetching transactions:", error);
        }
      }

      const netCash = cashIn - cashOut;
      const expectedBalance = allocatedBalance + cashIn - cashOut;
      const closingBalance = countedCashAmount
        ? parseFloat(countedCashAmount)
        : expectedBalance;
      const difference = closingBalance - expectedBalance;

      // Format date for Fineract
      const formatDateForFineract = (date: Date): string => {
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

      // Close in Fineract
      if (teller.fineractTellerId && fineractCashierId) {
        try {
          const fineractService = await getFineractServiceWithSession();
          await fineractService.closeCashierSession(
            teller.fineractTellerId,
            fineractCashierId,
            {
              txnDate: formatDateForFineract(new Date()),
              txnAmount: closingBalance.toString(),
              txnNote: comments || "",
              dateFormat: "dd MMMM yyyy",
              locale: "en",
            }
          );
        } catch (error) {
          console.error("Error closing session in Fineract:", error);
          // Continue with database closure
        }
      }

      // Update session
      const updatedSession = await prisma.cashierSession.update({
        where: { id: activeSession.id },
        data: {
          sessionStatus: "CLOSED",
          sessionEndTime: new Date(),
          cashIn,
          cashOut,
          netCash,
          closingBalance,
          expectedBalance,
          difference,
          countedCashAmount: countedCashAmount
            ? parseFloat(countedCashAmount)
            : null,
          comments,
        },
      });

      // If there's a variance, create an allocation record for audit trail
      // NOTE: Variance allocations are EXCLUDED from cashier balance calculations
      // Variance is tracked separately and does not affect cashier balance
      if (Math.abs(difference) > 0.01) {
        try {
          // Get currency from cashier's allocations or default to USD
          const cashierAllocations = await prisma.cashAllocation.findFirst({
            where: {
              tellerId,
              cashierId: cashier.id,
              tenantId: tenant.id,
              status: "ACTIVE",
              notes: { not: { contains: "Variance" } },
            },
            orderBy: { allocatedDate: "desc" },
          });
          const currency = cashierAllocations?.currency || "USD";

          // Create a variance allocation record for audit trail
          // This is tracked separately and excluded from balance calculations
          await prisma.cashAllocation.create({
            data: {
              tenantId: tenant.id,
              tellerId,
              cashierId: cashier.id,
              fineractAllocationId: null, // Variance adjustment, not from Fineract
              amount: difference, // Can be positive (surplus) or negative (shortage)
              currency: currency,
              allocatedBy: session.user.id,
              notes: `Variance from session closure: ${
                difference > 0 ? "Surplus" : "Shortage"
              } of ${Math.abs(difference).toFixed(2)} ${currency}. ${
                comments || ""
              }`,
              status: "ACTIVE", // For audit trail, but excluded from balance calculations
            },
          });

          console.log(
            `Variance recorded (tracked separately): ${
              difference > 0 ? "Surplus" : "Shortage"
            } of ${Math.abs(difference).toFixed(2)} ${currency}`
          );
        } catch (varianceError: any) {
          // Log error but don't fail session closure
          console.error("Error creating variance allocation:", {
            message: varianceError.message,
            code: varianceError.code,
            difference,
          });
          // Continue - variance allocation is for audit trail only
        }
      }

      return NextResponse.json(updatedSession);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'start' or 'close'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error managing session:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
      name: error.name,
      cause: error.cause,
    });

    // Handle Prisma errors specifically
    if (error.code && error.code.startsWith("P")) {
      return NextResponse.json(
        {
          error: "Database error",
          details: error.message,
          code: error.code,
          hint: "This might be a database constraint issue. Please check if all required records exist.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to manage session",
        details: error instanceof Error ? error.message : "Unknown error",
        code: error.code,
        type: error.name,
      },
      { status: 500 }
    );
  }
}
