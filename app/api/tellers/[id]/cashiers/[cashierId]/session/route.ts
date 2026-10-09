import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getOrgDefaultCurrencyCode, toFineractCurrencyCode } from "@/lib/currency-utils";
import { invalidateCashierSummary } from "@/lib/cashier-summary-cache";
import { getCashierSessionTenantSettings } from "@/lib/cashier-session-settings";
import {
  isSessionCountedForEnforcement,
  resolveSessionClosureEnforcement,
  toBusinessDateString,
} from "@/lib/cashier-session-enforcement-policy";
import {
  baselineAfterClose,
  buildSessionContextFields,
  computeSessionBalance,
  isBalanceReliableForVariance,
  toCashierSummarySnapshot,
  type FineractCashierSummarySnapshot,
} from "@/lib/cashier-session-balance";
import { hasFineractPermissionServer } from "@/lib/authorization";
import {
  resolveCurrentUserCashierContext,
  resolveStaffIdForFineractUser,
} from "@/lib/current-user-cashier";
import {
  classifyVariance,
  closureWorkflow,
  parseCashAmount,
  authorizeClosureInitiation,
  authorizeManagerClosure,
} from "@/lib/cashier-session-closure";

/**
 * Fetch the current Fineract cashier summary snapshot (running netCash).
 * Returns null when the teller/cashier isn't linked to Fineract or on any error.
 */
async function fetchCashierSummarySnapshot(
  fineractTellerId: number | null,
  fineractCashierId: number | null,
  currency: string | null | undefined,
  options: { fresh?: boolean } = {}
): Promise<FineractCashierSummarySnapshot | null> {
  if (!fineractTellerId || !fineractCashierId) return null;
  try {
    // Fineract expects its raw currency code (e.g. ZMK, not ZMW).
    const rawCurrency = await toFineractCurrencyCode(currency);
    // Loan transactions don't invalidate the summary cache, so session start/close read fresh.
    if (options.fresh) invalidateCashierSummary(fineractTellerId, fineractCashierId);
    const fineractService = await getFineractServiceWithSession();
    const raw = await fineractService.getCashierSummaryAndTransactions(
      fineractTellerId,
      fineractCashierId,
      rawCurrency
    );
    return toCashierSummarySnapshot(raw, rawCurrency, new Date());
  } catch (error) {
    console.error("Error fetching Fineract cashier summary snapshot:", error);
    return null;
  }
}

/** Fineract netCash left by this cashier's most recent close in the same currency, if any. */
async function findBaselineNetCash(
  tenantId: string,
  cashierId: string,
  currency: string
): Promise<number | null> {
  const previous = await prisma.cashierSession.findFirst({
    where: {
      tenantId,
      cashierId,
      currency,
      fineractBaselineNetCash: { not: null },
    },
    orderBy: { sessionEndTime: "desc" },
    select: { fineractBaselineNetCash: true },
  });
  return previous?.fineractBaselineNetCash ?? null;
}

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
    const { id: tellerIdParam, cashierId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const orgCurrency = await getOrgDefaultCurrencyCode();

    // Try to find teller by database ID first, then by Fineract ID
    let teller = await prisma.teller.findFirst({
      where: { id: tellerIdParam, tenantId: tenant.id },
    });

    if (!teller) {
      // Try to find by Fineract ID
      const fineractTellerId = parseInt(tellerIdParam);
      if (!isNaN(fineractTellerId)) {
        teller = await prisma.teller.findFirst({
          where: { fineractTellerId, tenantId: tenant.id },
        });
      }
    }

    const tellerId = teller?.id || tellerIdParam;

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

    // Get active or most recent pending/closed session from database (only if we have a database cashier)
    // First try to get active or pending closure session, if not found, get most recent closed session
    const activeSession = cashier
      ? await prisma.cashierSession.findFirst({
          where: {
            tellerId,
            cashierId: cashier.id,
            tenantId: tenant.id,
            sessionStatus: { in: ["ACTIVE", "PENDING_CLOSURE"] },
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
      // Null when the close had no reliable expected cash (first close after rollout).
      const expectedBalance = closedSession.expectedBalance;
      return NextResponse.json({
        session: closedSession,
        fineractSession: fineractSessionData,
        balances: {
          allocatedBalance: closedSession.allocatedBalance || 0,
          availableBalance: expectedBalance ?? 0, // Use expectedBalance for closed sessions
          openingFloat:
            closedSession.openingFloat || closedSession.allocatedBalance || 0,
          cashIn: closedSession.cashIn || 0,
          cashOut: closedSession.cashOut || 0,
          netCash: closedSession.netCash || 0,
          expectedBalance: expectedBalance,
        },
      });
    }

    // For active sessions, derive balances from Fineract's running netCash (which includes
    // cash loan/savings transactions posted by the cashier) measured from the last close.
    // Fineract-derived balances apply only when the tenant's teller module is on;
    // otherwise keep the legacy local opening-float figures.
    const { isTellerManagementModuleOn } = await getCashierSessionTenantSettings(tenant.id);
    const balance = activeSession && isTellerManagementModuleOn
      ? await (async () => {
          const currency = await toFineractCurrencyCode(activeSession.currency ?? orgCurrency);
          const [currentSnapshot, baselineNetCash] = await Promise.all([
            fetchCashierSummarySnapshot(teller.fineractTellerId, fineractCashierId, currency),
            findBaselineNetCash(tenant.id, activeSession.cashierId, currency),
          ]);

          return computeSessionBalance({
            baselineNetCash,
            opening: activeSession.fineractOpeningSummary as FineractCashierSummarySnapshot | null,
            current: currentSnapshot,
            fallbackOpeningFloat: allocatedBalance,
          });
        })()
      : computeSessionBalance({
          baselineNetCash: null,
          opening: null,
          current: null,
          fallbackOpeningFloat: allocatedBalance,
        });

    const displayBalances = {
      allocatedBalance,
      availableBalance: balance.expectedBalance,
      openingFloat: balance.openingFloat,
      cashIn: balance.cashIn,
      cashOut: balance.cashOut,
      netCash: balance.netCash,
      expectedBalance: balance.expectedBalance,
      allocations: balance.allocations,
      settlements: balance.settlements,
      balanceSource: balance.source,
    };

    // Determine if current user can close this session as a manager
    const session = await getSession();
    let canManagerClose = false;
    if (activeSession?.sessionStatus === "PENDING_CLOSURE" && isTellerManagementModuleOn) {
      const staffResult = await resolveStaffIdForFineractUser(session?.user?.userId);
      const hasPermission = await hasFineractPermissionServer("SETTLECASHFROMCASHIER_TELLER");
      const authResult = authorizeManagerClosure({
        hasManagerPermission: hasPermission,
        staff:
          staffResult.status === "ERROR"
            ? { status: "ERROR" }
            : staffResult.status === "OK"
              ? { status: "OK", staffId: staffResult.staffId }
              : { status: "NO_STAFF" },
        cashierStaffId: cashier?.staffId ?? 0,
        actorId: session?.user?.id ?? "",
        initiatorId: activeSession.closureInitiatedBy,
      });
      canManagerClose = authResult.ok;
    }

    return NextResponse.json({
      session: activeSession || closedSession,
      fineractSession: fineractSessionData,
      balances: displayBalances,
      closureWorkflow: closureWorkflow(isTellerManagementModuleOn),
      canManagerClose,
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
    const { id: tellerIdParam, cashierId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actorId = session.user.id;

    const orgCurrency = await getOrgDefaultCurrencyCode();
    const body = await request.json();
    const { action, countedCashAmount, comments, declaredAmount, managerCountedAmount, reason } = body;

    // Try to find teller by database ID first, then by Fineract ID
    let teller = await prisma.teller.findFirst({
      where: { id: tellerIdParam, tenantId: tenant.id },
    });

    if (!teller) {
      // Try to find by Fineract ID
      const fineractTellerId = parseInt(tellerIdParam);
      if (!isNaN(fineractTellerId)) {
        teller = await prisma.teller.findFirst({
          where: { fineractTellerId, tenantId: tenant.id },
        });
      }
    }

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    const tellerId = teller.id;

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

        // Create or update cashier in database (upsert to handle existing records)
        console.log("Upserting cashier from Fineract data:", {
          fineractCashierId: fineractCashier.id,
          staffId: fineractCashier.staffId,
          staffName: fineractCashier.staffName,
          startDate: fineractCashier.startDate,
          endDate: fineractCashier.endDate,
        });

        const cashierData = {
          tellerId,
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
        };

        cashier = await prisma.cashier.upsert({
          where: {
            tenantId_fineractCashierId: {
              tenantId: tenant.id,
              fineractCashierId: fineractCashier.id,
            },
          },
          update: cashierData,
          create: {
            tenantId: tenant.id,
            fineractCashierId: fineractCashier.id,
            ...cashierData,
          },
        });

        console.log("Upserted cashier in database:", cashier.id);
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
      const sessionSettings = await getCashierSessionTenantSettings(tenant.id);
      const { isTellerManagementModuleOn } = sessionSettings;

      // If module on, check for existing PENDING_CLOSURE sessions first
      if (isTellerManagementModuleOn) {
        if (!cashier) {
          return NextResponse.json({ error: "Cashier not found in database" }, { status: 404 });
        }

        const pendingSession = await prisma.cashierSession.findFirst({
          where: {
            tellerId,
            cashierId: cashier.id,
            tenantId: tenant.id,
            sessionStatus: "PENDING_CLOSURE",
          },
        });

        if (pendingSession) {
          return NextResponse.json(
            {
              error: "Previous session awaiting closure",
              code: "SESSION_CLOSURE_PENDING",
            },
            { status: 409 }
          );
        }

        // Enrolled cashiers must close their open session instead of having it
        // auto-closed. Sessions from before enrolment keep the legacy auto-close.
        const enforcement = resolveSessionClosureEnforcement(sessionSettings, cashier);
        if (enforcement.enforced) {
          const openSession = await prisma.cashierSession.findFirst({
            where: {
              tellerId,
              cashierId: cashier.id,
              tenantId: tenant.id,
              sessionStatus: "ACTIVE",
            },
            orderBy: { sessionStartTime: "desc" },
          });
          const openBusinessDate =
            openSession &&
            (openSession.businessDate ??
              new Date(
                `${toBusinessDateString(openSession.sessionStartTime ?? openSession.createdAt)}T00:00:00.000Z`
              ));
          if (
            openBusinessDate &&
            isSessionCountedForEnforcement(openBusinessDate, enforcement.enforcedFrom)
          ) {
            return NextResponse.json(
              {
                error: "Close the current session first",
                details:
                  "This cashier has an open session. Initiate closure and have a branch manager close it before starting a new session.",
                code: "SESSION_NOT_CLOSED",
              },
              { status: 409 }
            );
          }
        }
      }

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

      // Close any existing active sessions (legacy path - module off must not strand PENDING_CLOSURE)
      const statuses = isTellerManagementModuleOn ? ["ACTIVE"] : ["ACTIVE", "PENDING_CLOSURE"];
      await prisma.cashierSession.updateMany({
        where: {
          tellerId,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: { in: statuses },
        },
        data: {
          sessionStatus: "CLOSED",
          sessionEndTime: new Date(),
        },
      });

      const sessionCurrency = await toFineractCurrencyCode(orgCurrency);
      const fineractOpeningSnapshot = await fetchCashierSummarySnapshot(
        teller.fineractTellerId,
        fineractCashierId,
        sessionCurrency,
        { fresh: true }
      );

      // Create new session
      try {
        const contextFields = buildSessionContextFields({
          teller,
          now: new Date(),
          currency: sessionCurrency,
        });

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
            ...contextFields,
            ...(fineractOpeningSnapshot && {
              fineractOpeningSummary:
                fineractOpeningSnapshot as unknown as Prisma.InputJsonValue,
            }),
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
      // Close session - check if module is on (then use two-step closure)
      const { isTellerManagementModuleOn } = await getCashierSessionTenantSettings(tenant.id);

      if (isTellerManagementModuleOn) {
        return NextResponse.json(
          {
            error: "Two-step closure is enabled",
            details: "Use Initiate Closure; a branch manager completes the close.",
            code: "TWO_STEP_CLOSURE",
          },
          { status: 409 }
        );
      }

      // Legacy close (module off) continues below
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

          // Create or update cashier in database (upsert to handle existing records)
          console.log(
            "Upserting cashier from Fineract data for close session:",
            {
              fineractCashierId: fineractCashier.id,
              staffId: fineractCashier.staffId,
              staffName: fineractCashier.staffName,
            }
          );

          const cashierData = {
            tellerId,
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
          };

          cashier = await prisma.cashier.upsert({
            where: {
              tenantId_fineractCashierId: {
                tenantId: tenant.id,
                fineractCashierId: fineractCashier.id,
              },
            },
            update: cashierData,
            create: {
              tenantId: tenant.id,
              fineractCashierId: fineractCashier.id,
              ...cashierData,
            },
          });

          console.log("Upserted cashier in database:", cashier.id);
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

      // Close session (module is OFF at this point - allow PENDING_CLOSURE closure)
      // Try to find session by cashier database ID first
      let activeSession = await prisma.cashierSession.findFirst({
        where: {
          tellerId,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: { in: ["ACTIVE", "PENDING_CLOSURE"] },
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
            sessionStatus: { in: ["ACTIVE", "PENDING_CLOSURE"] },
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

      // Read Fineract fresh, BEFORE any settlement/vault writes, so expected excludes this close.
      const currency = await toFineractCurrencyCode(activeSession.currency ?? orgCurrency);
      const isFineractLinked = Boolean(teller.fineractTellerId && fineractCashierId);
      const [fineractClosingSnapshot, baselineNetCash] = await Promise.all([
        fetchCashierSummarySnapshot(teller.fineractTellerId, fineractCashierId, currency, {
          fresh: true,
        }),
        findBaselineNetCash(tenant.id, activeSession.cashierId, currency),
      ]);

      if (isTellerManagementModuleOn && isFineractLinked && !fineractClosingSnapshot) {
        return NextResponse.json(
          {
            error: "Cannot compute expected cash",
            details:
              "The cashier balance could not be read from Fineract. Please try closing the session again.",
          },
          { status: 503 }
        );
      }

      const allocatedBalance =
        activeSession.allocatedBalance || activeSession.openingFloat || 0;
      // With the module off, keep the legacy comparison against the local opening float.
      // Snapshots and the baseline are still stored so switching the module on starts clean.
      const balanceResult = computeSessionBalance(
        isTellerManagementModuleOn
          ? {
              baselineNetCash,
              opening: activeSession.fineractOpeningSummary as FineractCashierSummarySnapshot | null,
              current: fineractClosingSnapshot,
              fallbackOpeningFloat: allocatedBalance,
            }
          : { baselineNetCash: null, opening: null, current: null, fallbackOpeningFloat: allocatedBalance }
      );

      // Unlinked cashiers keep the legacy local-float comparison. For Fineract-linked
      // cashiers, the first close without a baseline only establishes one: no variance.
      const recordVariance =
        !isTellerManagementModuleOn ||
        !isFineractLinked ||
        isBalanceReliableForVariance(balanceResult);

      // 0 is a valid count (empty drawer); only a missing value is "not entered".
      // Legacy (module off) treats a falsy count as "not entered".
      const hasCountedCash = isTellerManagementModuleOn
        ? countedCashAmount !== undefined && countedCashAmount !== null && countedCashAmount !== ""
        : Boolean(countedCashAmount);
      const countedCash = !hasCountedCash
        ? null
        : isTellerManagementModuleOn
          ? Number(countedCashAmount)
          : parseFloat(countedCashAmount);
      if (
        isTellerManagementModuleOn &&
        countedCash !== null &&
        (!Number.isFinite(countedCash) || countedCash < 0)
      ) {
        return NextResponse.json(
          { error: "Counted cash must be a number of 0 or more" },
          { status: 400 }
        );
      }
      if (!recordVariance && countedCash === null) {
        return NextResponse.json(
          {
            error: "Counted cash is required",
            details: "Enter the counted cash amount to close this session.",
          },
          { status: 400 }
        );
      }

      const cashIn = balanceResult.cashIn;
      const cashOut = balanceResult.cashOut;
      const netCash = balanceResult.netCash;
      const expectedBalance = recordVariance ? balanceResult.expectedBalance : null;
      const closingBalance = countedCash ?? balanceResult.expectedBalance;
      const difference =
        expectedBalance === null ? null : closingBalance - expectedBalance;

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

      // Close in Fineract. Track whether it settled, because a successful settle lowers
      // Fineract netCash and the next session's baseline must account for it.
      let settledToFineract = 0;
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
          settledToFineract = closingBalance;
        } catch (error) {
          console.error("Error closing session in Fineract:", error);
          // Continue with database closure
        }
      }

      // Backfill context fields if not already set (from Phase 1)
      const contextFields =
        !activeSession.businessDate || !activeSession.officeId || !activeSession.currency
          ? buildSessionContextFields({
              teller,
              now: activeSession.sessionStartTime ?? new Date(),
              currency,
            })
          : undefined;

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
          countedCashAmount: countedCash,
          comments,
          ...contextFields,
          ...(fineractClosingSnapshot && {
            fineractClosingSummary:
              fineractClosingSnapshot as unknown as Prisma.InputJsonValue,
            fineractBaselineNetCash: baselineAfterClose(
              fineractClosingSnapshot,
              settledToFineract
            ),
          }),
        },
      });

      // AUTO-SETTLE: Return counted cash to vault
      // This ensures vault balance is updated when session closes
      if (closingBalance > 0) {
        try {
          // Get currency from cashier's allocations or default
          const cashierAllocation = await prisma.cashAllocation.findFirst({
            where: {
              tellerId,
              cashierId: cashier.id,
              tenantId: tenant.id,
              status: "ACTIVE",
              notes: { not: { contains: "Variance" } },
            },
            orderBy: { allocatedDate: "desc" },
          });
          const currency = cashierAllocation?.currency || orgCurrency;

          // Create negative allocation for cashier (cash out)
          await prisma.cashAllocation.create({
            data: {
              tenantId: tenant.id,
              tellerId,
              cashierId: cashier.id,
              fineractAllocationId: null,
              amount: -closingBalance, // Negative = cash out from cashier
              currency: currency,
              allocatedBy: session.user.id,
              notes: `Session close settlement: Return to vault`,
              status: "ACTIVE",
            },
          });
          console.log(`Created cashier settlement: -${closingBalance} ${currency}`);

          // Create positive allocation for vault (cash in)
          await prisma.cashAllocation.create({
            data: {
              tenantId: tenant.id,
              tellerId,
              cashierId: null, // null = vault
              fineractAllocationId: null,
              amount: closingBalance, // Positive = cash in to vault
              currency: currency,
              allocatedBy: session.user.id,
              notes: `Return from ${cashier.staffName || "Cashier"}: Session close`,
              status: "ACTIVE",
            },
          });
          console.log(`Created vault allocation: +${closingBalance} ${currency}`);
        } catch (settleError: any) {
          console.error("Error auto-settling on session close:", settleError.message);
          // Don't fail the close, just log the error
        }
      }

      // If there's a variance, create an allocation record for audit trail
      // NOTE: Variance allocations are EXCLUDED from cashier balance calculations
      // Variance is tracked separately and does not affect cashier balance
      if (difference !== null && Math.abs(difference) > 0.01) {
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
          const currency = cashierAllocations?.currency || orgCurrency;

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
    } else if (action === "initiate-close") {
      // Initiate two-step closure (Phase 3) - only the cashier may initiate
      const { isTellerManagementModuleOn } = await getCashierSessionTenantSettings(tenant.id);

      if (!isTellerManagementModuleOn) {
        return NextResponse.json(
          { error: "Invalid action. Two-step closure is not enabled", code: "TWO_STEP_CLOSURE_DISABLED" },
          { status: 400 }
        );
      }

      if (!cashier) {
        return NextResponse.json(
          { error: "Cashier not found in database" },
          { status: 404 }
        );
      }

      // Session must be ACTIVE
      const activeSession = await prisma.cashierSession.findFirst({
        where: {
          tellerId,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: "ACTIVE",
        },
      });

      if (!activeSession) {
        return NextResponse.json(
          { error: "No active session found", code: "NO_ACTIVE_SESSION" },
          { status: 409 }
        );
      }

      // Validate declared amount
      const declared = parseCashAmount(declaredAmount);
      if (declared === null) {
        return NextResponse.json(
          { error: "Declared amount is required and must be a valid non-negative number" },
          { status: 400 }
        );
      }

      // Authorization: only the cashier may initiate closure
      const staffResult = await resolveStaffIdForFineractUser(session?.user?.userId);
      const authResult = authorizeClosureInitiation({
        staff:
          staffResult.status === "ERROR"
            ? { status: "ERROR" }
            : staffResult.status === "OK"
              ? { status: "OK", staffId: staffResult.staffId }
              : { status: "NO_STAFF" },
        cashierStaffId: cashier.staffId,
      });

      if (!authResult.ok) {
        return NextResponse.json(
          {
            error: authResult.error,
            code: authResult.code,
          },
          { status: authResult.status }
        );
      }

      // Atomic transition: ACTIVE -> PENDING_CLOSURE
      const updateResult = await prisma.cashierSession.updateMany({
        where: {
          id: activeSession.id,
          tenantId: tenant.id,
          sessionStatus: "ACTIVE",
        },
        data: {
          sessionStatus: "PENDING_CLOSURE",
          declaredAmount: declared,
          closureInitiatedBy: actorId,
          closureInitiatedAt: new Date(),
          closureRejectedBy: null,
          closureRejectedAt: null,
          closureRejectionReason: null,
          comments: comments
            ? `${activeSession.comments || ""}\n[Closure initiated]: ${comments}`.trim()
            : activeSession.comments,
        },
      });

      if (updateResult.count !== 1) {
        return NextResponse.json(
          {
            error: "Session state changed",
            details: "This session was updated by someone else. Refresh and try again.",
            code: "SESSION_STATE_CONFLICT",
          },
          { status: 409 }
        );
      }

      // Re-read the updated session for response
      const updatedSession = await prisma.cashierSession.findUnique({
        where: { id: activeSession.id },
      });

      return NextResponse.json(updatedSession);
    } else if (action === "manager-close") {
      // Manager completes two-step closure (Phase 3)
      const { isTellerManagementModuleOn, cashVarianceTolerance } = await getCashierSessionTenantSettings(tenant.id);

      if (!isTellerManagementModuleOn) {
        return NextResponse.json(
          { error: "Invalid action. Two-step closure is not enabled", code: "TWO_STEP_CLOSURE_DISABLED" },
          { status: 400 }
        );
      }

      if (!cashier) {
        return NextResponse.json(
          { error: "Cashier not found in database" },
          { status: 404 }
        );
      }

      // Session must be PENDING_CLOSURE
      const pendingSession = await prisma.cashierSession.findFirst({
        where: {
          tellerId,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: "PENDING_CLOSURE",
        },
      });

      if (!pendingSession) {
        return NextResponse.json(
          { error: "No pending closure session found", code: "NO_PENDING_CLOSURE" },
          { status: 409 }
        );
      }

      // Authorization: manager must have permission, not be the cashier, and not be the initiator
      const staffResult = await resolveStaffIdForFineractUser(session?.user?.userId);
      const hasManagerPermission = await hasFineractPermissionServer("SETTLECASHFROMCASHIER_TELLER");

      const authResult = authorizeManagerClosure({
        hasManagerPermission,
        staff:
          staffResult.status === "ERROR"
            ? { status: "ERROR" }
            : staffResult.status === "OK"
              ? { status: "OK", staffId: staffResult.staffId }
              : { status: "NO_STAFF" },
        cashierStaffId: cashier.staffId,
        actorId,
        initiatorId: pendingSession.closureInitiatedBy,
      });

      if (!authResult.ok) {
        return NextResponse.json(
          {
            error: authResult.error,
            details:
              authResult.status === 503
                ? "Could not verify your identity. Please try again."
                : undefined,
            code: authResult.code,
          },
          { status: authResult.status }
        );
      }

      // Validate manager counted amount
      const counted = parseCashAmount(managerCountedAmount);
      if (counted === null) {
        return NextResponse.json(
          { error: "Manager counted amount is required and must be a valid non-negative number" },
          { status: 400 }
        );
      }

      // Fetch Fineract snapshot and baseline
      const currency = await toFineractCurrencyCode(pendingSession.currency ?? orgCurrency);
      const isFineractLinked = Boolean(teller.fineractTellerId && fineractCashierId);
      const [fineractClosingSnapshot, baselineNetCash] = await Promise.all([
        fetchCashierSummarySnapshot(teller.fineractTellerId, fineractCashierId, currency, {
          fresh: true,
        }),
        findBaselineNetCash(tenant.id, pendingSession.cashierId, currency),
      ]);

      if (isFineractLinked && !fineractClosingSnapshot) {
        return NextResponse.json(
          {
            error: "Cannot compute expected cash",
            details: "The cashier balance could not be read from Fineract. Please try closing the session again.",
          },
          { status: 503 }
        );
      }

      // Compute expected balance
      const allocatedBalance = pendingSession.allocatedBalance || pendingSession.openingFloat || 0;
      const balanceResult = computeSessionBalance({
        baselineNetCash,
        opening: pendingSession.fineractOpeningSummary as FineractCashierSummarySnapshot | null,
        current: fineractClosingSnapshot,
        fallbackOpeningFloat: allocatedBalance,
      });

      // Unlinked cashiers keep the legacy local-float comparison (balanceResult is UNAVAILABLE).
      const reliable = !isFineractLinked || isBalanceReliableForVariance(balanceResult);
      const expected = reliable ? balanceResult.expectedBalance : null;
      const variance = expected === null ? null : classifyVariance({ expected, counted, tolerance: cashVarianceTolerance });

      // Backfill context fields if needed
      const contextFields =
        !pendingSession.businessDate || !pendingSession.officeId || !pendingSession.currency
          ? buildSessionContextFields({
              teller,
              now: pendingSession.sessionStartTime ?? new Date(),
              currency,
            })
          : undefined;

      // Use display currency for variance event and allocations
      const displayCurrency = orgCurrency;

      // Create transaction: update session, create variance event, and auto-settle
      let updatedSession: typeof pendingSession | null = null;
      let varianceEvent: Awaited<ReturnType<typeof prisma.cashVarianceEvent.create>> | null = null;

      try {
        const closingCashier = cashier; // narrowed above; closures lose the narrowing
        const result = await prisma.$transaction(async (tx) => {
          // Atomic state transition: PENDING_CLOSURE -> CLOSED
          const updateResult = await tx.cashierSession.updateMany({
            where: {
              id: pendingSession.id,
              tenantId: tenant.id,
              sessionStatus: "PENDING_CLOSURE",
            },
            data: {
              sessionStatus: "CLOSED",
              sessionEndTime: new Date(),
              managerCountedAmount: counted,
              countedCashAmount: counted,
              closingBalance: counted,
              closedBy: actorId,
              closedAt: new Date(),
              cashIn: balanceResult.cashIn,
              cashOut: balanceResult.cashOut,
              netCash: balanceResult.netCash,
              expectedBalance: expected,
              difference: variance?.difference ?? null,
              comments: comments
                ? `${pendingSession.comments || ""}\n[Closed by manager]: ${comments}`.trim()
                : pendingSession.comments,
              ...contextFields,
              ...(fineractClosingSnapshot && {
                fineractClosingSummary:
                  fineractClosingSnapshot as unknown as Prisma.InputJsonValue,
                fineractBaselineNetCash: baselineAfterClose(fineractClosingSnapshot, 0),
              }),
            },
          });

          if (updateResult.count !== 1) {
            throw new Error("Session state conflict");
          }

          // Re-read the updated session
          const updated = await tx.cashierSession.findUnique({
            where: { id: pendingSession.id },
          });

          let varEvent = null;
          if (variance?.raise) {
            // Use businessDate from session with fallback based on session start time
            const eventBusinessDate =
              updated?.businessDate ??
              new Date(`${toBusinessDateString(updated?.sessionStartTime ?? new Date())}T00:00:00.000Z`);

            varEvent = await tx.cashVarianceEvent.create({
              data: {
                tenantId: tenant.id,
                sessionId: updated!.id,
                cashierId: updated!.cashierId,
                tellerId,
                officeId: updated!.officeId,
                businessDate: eventBusinessDate,
                type: variance.type!,
                amount: variance.amount,
                currency: displayCurrency,
                expectedBalance: expected!,
                countedAmount: counted,
                status: "OPEN",
                raisedBy: actorId,
              },
            });

            await tx.cashVarianceEventLog.create({
              data: {
                tenantId: tenant.id,
                eventId: varEvent.id,
                action: "RAISED",
                toStatus: "OPEN",
                notes: comments || "",
                performedBy: actorId,
              },
            });
          }

          // Auto-settle: return counted cash to vault (inside transaction)
          if (counted > 0) {
            await tx.cashAllocation.create({
              data: {
                tenantId: tenant.id,
                tellerId,
                cashierId: closingCashier.id,
                fineractAllocationId: null,
                amount: -counted,
                currency: displayCurrency,
                allocatedBy: actorId,
                notes: `Session close settlement: Return to vault`,
                status: "ACTIVE",
              },
            });

            await tx.cashAllocation.create({
              data: {
                tenantId: tenant.id,
                tellerId,
                cashierId: null,
                fineractAllocationId: null,
                amount: counted,
                currency: displayCurrency,
                allocatedBy: actorId,
                notes: `Return from ${closingCashier.staffName || "Cashier"}: Session close`,
                status: "ACTIVE",
              },
            });
          }

          return { updated, varEvent };
        });

        updatedSession = result.updated;
        varianceEvent = result.varEvent;
      } catch (error: unknown) {
        if (error instanceof Error && error.message === "Session state conflict") {
          return NextResponse.json(
            {
              error: "Session state changed",
              details: "This session was updated by someone else. Refresh and try again.",
              code: "SESSION_STATE_CONFLICT",
            },
            { status: 409 }
          );
        }
        throw error;
      }

      return NextResponse.json({ session: updatedSession, varianceEvent });
    } else if (action === "reject-closure") {
      // Reject two-step closure and revert to ACTIVE
      const { isTellerManagementModuleOn } = await getCashierSessionTenantSettings(tenant.id);

      if (!isTellerManagementModuleOn) {
        return NextResponse.json(
          { error: "Invalid action. Two-step closure is not enabled", code: "TWO_STEP_CLOSURE_DISABLED" },
          { status: 400 }
        );
      }

      if (!reason || reason.trim() === "") {
        return NextResponse.json(
          { error: "Rejection reason is required and must be non-empty" },
          { status: 400 }
        );
      }

      if (!cashier) {
        return NextResponse.json(
          { error: "Cashier not found in database" },
          { status: 404 }
        );
      }

      // Session must be PENDING_CLOSURE
      const pendingSession = await prisma.cashierSession.findFirst({
        where: {
          tellerId,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: "PENDING_CLOSURE",
        },
      });

      if (!pendingSession) {
        return NextResponse.json(
          { error: "No pending closure session found", code: "NO_PENDING_CLOSURE" },
          { status: 409 }
        );
      }

      // Authorization: manager must have permission, not be the cashier, and not be the initiator
      const staffResult = await resolveStaffIdForFineractUser(session?.user?.userId);
      const hasManagerPermission = await hasFineractPermissionServer("SETTLECASHFROMCASHIER_TELLER");

      const authResult = authorizeManagerClosure({
        hasManagerPermission,
        staff:
          staffResult.status === "ERROR"
            ? { status: "ERROR" }
            : staffResult.status === "OK"
              ? { status: "OK", staffId: staffResult.staffId }
              : { status: "NO_STAFF" },
        cashierStaffId: cashier.staffId,
        actorId,
        initiatorId: pendingSession.closureInitiatedBy,
      });

      if (!authResult.ok) {
        return NextResponse.json(
          {
            error: authResult.error,
            details:
              authResult.status === 503
                ? "Could not verify your identity. Please try again."
                : undefined,
            code: authResult.code,
          },
          { status: authResult.status }
        );
      }

      // Atomic transition: PENDING_CLOSURE -> ACTIVE
      const updateResult = await prisma.cashierSession.updateMany({
        where: {
          id: pendingSession.id,
          tenantId: tenant.id,
          sessionStatus: "PENDING_CLOSURE",
        },
        data: {
          sessionStatus: "ACTIVE",
          closureRejectedBy: actorId,
          closureRejectedAt: new Date(),
          closureRejectionReason: reason,
          declaredAmount: null,
          comments: `${pendingSession.comments || ""}\n[Closure rejected]: ${reason}`.trim(),
        },
      });

      if (updateResult.count !== 1) {
        return NextResponse.json(
          {
            error: "Session state changed",
            details: "This session was updated by someone else. Refresh and try again.",
            code: "SESSION_STATE_CONFLICT",
          },
          { status: 409 }
        );
      }

      // Re-read the updated session for response
      const updatedSession = await prisma.cashierSession.findUnique({
        where: { id: pendingSession.id },
      });

      return NextResponse.json(updatedSession);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Valid actions are: 'start', 'close' (module off only), 'initiate-close', 'manager-close', 'reject-closure'" },
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
