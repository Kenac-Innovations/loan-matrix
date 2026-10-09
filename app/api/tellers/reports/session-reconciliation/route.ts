import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import {
  getOrgDefaultCurrencyCode,
  normalizeCode,
} from "@/lib/currency-utils";
import {
  hasFineractPermissionServer,
  hasSuperAdminServer,
} from "@/lib/authorization";
import {
  buildSessionReconciliationReport,
  toCsv,
  type ReportSessionInput,
  type OpenVarianceInput,
} from "@/lib/cash-session-reconciliation-report";
import { toBusinessDateString } from "@/lib/cashier-session-enforcement-policy";

function isValidDateString(dateStr: string): boolean {
  if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
  // Round-trip test: verify the date can be serialized back to the same string
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return false;
  // Ensure the date round-trips correctly
  return d.toISOString().slice(0, 10) === dateStr;
}

function parseDateRange(
  from: string | null,
  to: string | null
): {
  ok: false;
  status: number;
  error: string;
} | {
  ok: true;
  from: Date;
  to: Date;
} {
  if (!from || !to) {
    return {
      ok: false,
      status: 400,
      error: "Missing required query parameters: from, to (YYYY-MM-DD)",
    };
  }

  if (!isValidDateString(from) || !isValidDateString(to)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid date format. Use YYYY-MM-DD (impossible dates will be rejected)",
    };
  }

  const fromDate = new Date(from + "T00:00:00Z");
  const toDate = new Date(to + "T00:00:00Z");

  if (fromDate > toDate) {
    return {
      ok: false,
      status: 400,
      error: "from date must be <= to date",
    };
  }

  // Max range 366 days (inclusive)
  // Compute the number of days inclusive: if from == to, that's 1 day
  const daysDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  if (daysDiff > 366) {
    return {
      ok: false,
      status: 400,
      error: "Date range cannot exceed 366 days",
    };
  }

  return {
    ok: true,
    from: fromDate,
    to: toDate,
  };
}

/**
 * GET /api/tellers/reports/session-reconciliation
 *
 * Query parameters:
 *   from, to (YYYY-MM-DD, required)
 *   officeId (int, optional)
 *   tellerId (string, optional)
 *   cashierId (string, optional)
 *   status (ALL|CLOSED|UNCLOSED|PENDING_CLOSURE, default ALL)
 *   format (json|csv, default json)
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization: require SETTLECASHFROMCASHIER_TELLER permission or superadmin
    const hasPermission = await hasFineractPermissionServer(
      "SETTLECASHFROMCASHIER_TELLER"
    );
    const isSuperAdmin = await hasSuperAdminServer();

    if (!hasPermission && !isSuperAdmin) {
      return NextResponse.json(
        { error: "You don't have access to the reconciliation report." },
        { status: 403 }
      );
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const searchParams = new URL(request.url).searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format") || "json";

    // Parse and validate date range
    const dateRangeResult = parseDateRange(from, to);
    if (!dateRangeResult.ok) {
      return NextResponse.json(
        { error: dateRangeResult.error },
        { status: dateRangeResult.status }
      );
    }

    const { from: fromDate, to: toDate } = dateRangeResult;

    // Parse filters
    const officeId = searchParams.get("officeId");
    const tellerId = searchParams.get("tellerId");
    const cashierId = searchParams.get("cashierId");
    const statusFilter = searchParams.get("status") || "ALL";

    const parsedOfficeId = officeId ? parseInt(officeId, 10) : undefined;
    if (officeId && isNaN(parsedOfficeId!)) {
      return NextResponse.json(
        { error: "Invalid officeId: must be an integer" },
        { status: 400 }
      );
    }

    // Validate status filter
    const validStatuses = ["ALL", "CLOSED", "UNCLOSED", "PENDING_CLOSURE"];
    if (!validStatuses.includes(statusFilter)) {
      return NextResponse.json(
        { error: `Invalid status filter. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Build where clause for sessions
    const sessionWhereClause: Prisma.CashierSessionWhereInput = {
      tenantId: tenant.id,
      sessionStatus: {
        not: "NOT_STARTED",
      },
      businessDate: {
        gte: fromDate,
        lte: toDate,
      },
    };

    // Apply status filter
    if (statusFilter === "CLOSED") {
      sessionWhereClause.sessionStatus = {
        in: ["CLOSED", "CLOSED_VERIFIED"],
      };
    } else if (statusFilter === "UNCLOSED") {
      sessionWhereClause.sessionStatus = {
        in: ["ACTIVE", "PENDING_CLOSURE"],
      };
    } else if (statusFilter === "PENDING_CLOSURE") {
      sessionWhereClause.sessionStatus = "PENDING_CLOSURE";
    }

    // Apply office filter with OR clause: officeId matches OR officeId is null and teller.officeId matches
    if (parsedOfficeId) {
      sessionWhereClause.OR = [
        { officeId: parsedOfficeId },
        { officeId: null, teller: { officeId: parsedOfficeId } },
      ];
    }

    // Apply teller and cashier filters
    if (tellerId) {
      sessionWhereClause.tellerId = tellerId;
    }
    if (cashierId) {
      sessionWhereClause.cashierId = cashierId;
    }

    // Fetch sessions with null businessDate within range
    const sessionsCond = await prisma.cashierSession.findMany({
      where: sessionWhereClause,
      select: {
        id: true,
        tenantId: true,
        tellerId: true,
        cashierId: true,
        sessionStatus: true,
        sessionStartTime: true,
        sessionEndTime: true,
        openingFloat: true,
        allocatedBalance: true,
        cashIn: true,
        cashOut: true,
        netCash: true,
        expectedBalance: true,
        countedCashAmount: true,
        managerCountedAmount: true,
        declaredAmount: true,
        difference: true,
        businessDate: true,
        currency: true,
        closureInitiatedBy: true,
        closureInitiatedAt: true,
        closedBy: true,
        closedAt: true,
        verifiedBy: true,
        verifiedAt: true,
        createdAt: true,
        officeId: true,
        teller: {
          select: {
            name: true,
            officeId: true,
            officeName: true,
          },
        },
        cashier: {
          select: {
            staffName: true,
          },
        },
        varianceEvents: {
          select: {
            type: true,
            amount: true,
            currency: true,
            status: true,
            resolutionType: true,
          },
        },
      },
      take: 5001, // fetch one extra to detect if we exceed limit
    });

    // Also check for sessions with null businessDate
    // Apply the same status/office/teller/cashier where-clause to the fallback query
    let sessionsWithNullBd: typeof sessionsCond = [];
    const nullBdWhereClause: Prisma.CashierSessionWhereInput = {
      tenantId: tenant.id,
      sessionStatus: {
        not: "NOT_STARTED",
      },
      businessDate: null,
      OR: [
        {
          sessionStartTime: {
            gte: new Date(fromDate.getTime() - 86400000), // from - 1 day
            lte: new Date(toDate.getTime() + 86400000), // to + 1 day
          },
        },
        {
          sessionStartTime: null,
          createdAt: {
            gte: new Date(fromDate.getTime() - 86400000), // from - 1 day
            lte: new Date(toDate.getTime() + 86400000), // to + 1 day
          },
        },
      ],
    };

    // Apply status filter
    if (statusFilter === "CLOSED") {
      nullBdWhereClause.sessionStatus = {
        in: ["CLOSED", "CLOSED_VERIFIED"],
      };
    } else if (statusFilter === "UNCLOSED") {
      nullBdWhereClause.sessionStatus = {
        in: ["ACTIVE", "PENDING_CLOSURE"],
      };
    } else if (statusFilter === "PENDING_CLOSURE") {
      nullBdWhereClause.sessionStatus = "PENDING_CLOSURE";
    }

    // Apply office filter alongside (not instead of) the date-window OR
    if (parsedOfficeId) {
      nullBdWhereClause.AND = [
        {
          OR: [
            { officeId: parsedOfficeId },
            { officeId: null, teller: { officeId: parsedOfficeId } },
          ],
        },
      ];
    }

    // Apply teller and cashier filters
    if (tellerId) {
      nullBdWhereClause.tellerId = tellerId;
    }
    if (cashierId) {
      nullBdWhereClause.cashierId = cashierId;
    }

    sessionsWithNullBd = await prisma.cashierSession.findMany({
      where: nullBdWhereClause,
      select: {
        id: true,
        tenantId: true,
        tellerId: true,
        cashierId: true,
        sessionStatus: true,
        sessionStartTime: true,
        sessionEndTime: true,
        openingFloat: true,
        allocatedBalance: true,
        cashIn: true,
        cashOut: true,
        netCash: true,
        expectedBalance: true,
        countedCashAmount: true,
        managerCountedAmount: true,
        declaredAmount: true,
        difference: true,
        businessDate: true,
        currency: true,
        closureInitiatedBy: true,
        closureInitiatedAt: true,
        closedBy: true,
        closedAt: true,
        verifiedBy: true,
        verifiedAt: true,
        createdAt: true,
        officeId: true,
        teller: {
          select: {
            name: true,
            officeId: true,
            officeName: true,
          },
        },
        cashier: {
          select: {
            staffName: true,
          },
        },
        varianceEvents: {
          select: {
            type: true,
            amount: true,
            currency: true,
            status: true,
            resolutionType: true,
          },
        },
      },
      take: 5001, // fetch one extra to detect if we exceed limit
    });

    // Check session count limits
    if (sessionsCond.length > 5000) {
      return NextResponse.json(
        {
          error:
            "Too many sessions for one report. Narrow the date range or add a branch filter.",
        },
        { status: 413 }
      );
    }

    // Get org default currency code
    const orgDisplayCode = await getOrgDefaultCurrencyCode();

    // Combine and convert sessions
    const allSessions = [...sessionsCond, ...sessionsWithNullBd];

    // Check combined session count
    if (allSessions.length > 5000) {
      return NextResponse.json(
        {
          error:
            "Too many sessions for one report. Narrow the date range or add a branch filter.",
        },
        { status: 413 }
      );
    }

    // Validated above; compare business dates as YYYY-MM-DD strings.
    const fromKey = fromDate.toISOString().slice(0, 10);
    const toKey = toDate.toISOString().slice(0, 10);
    const reportSessions = allSessions.map((s): ReportSessionInput | null => {
      // Normalize session currency (ZMK -> ZMW)
      const currency = normalizeCode(s.currency || orgDisplayCode);

      // Determine businessDate
      const businessDate = s.businessDate
        ? s.businessDate.toISOString().split("T")[0]
        : toBusinessDateString(s.sessionStartTime || s.createdAt);

      // Filter by date range if businessDate was null
      if (!s.businessDate && (businessDate < fromKey || businessDate > toKey)) {
        return null;
      }

      // Get variance if any, normalizing its currency
      const variance = s.varianceEvents[0]
        ? {
            type: s.varianceEvents[0].type as "SHORTAGE" | "OVERAGE",
            amount: s.varianceEvents[0].amount,
            currency: normalizeCode(s.varianceEvents[0].currency || currency),
            status: s.varianceEvents[0].status as "OPEN" | "UNDER_REVIEW" | "RESOLVED",
            resolutionType: s.varianceEvents[0].resolutionType,
          }
        : null;

      // Use officeId from session or fallback to teller.officeId
      const officeId = s.officeId ?? s.teller.officeId;

      return {
        id: s.id,
        tenantId: s.tenantId,
        tellerId: s.tellerId,
        tellerName: s.teller.name,
        officeId,
        // The teller's current office name only applies when the session's office matches it.
        officeName:
          s.officeId === null || s.officeId === s.teller.officeId
            ? s.teller.officeName
            : `Office #${s.officeId}`,
        cashierId: s.cashierId,
        cashierName: s.cashier.staffName,
        sessionStatus: s.sessionStatus as ReportSessionInput["sessionStatus"],
        sessionStartTime: s.sessionStartTime,
        sessionEndTime: s.sessionEndTime,
        openingFloat: s.openingFloat,
        allocatedBalance: s.allocatedBalance,
        cashIn: s.cashIn,
        cashOut: s.cashOut,
        netCash: s.netCash,
        expectedBalance: s.expectedBalance,
        countedCashAmount: s.countedCashAmount,
        managerCountedAmount: s.managerCountedAmount,
        declaredAmount: s.declaredAmount,
        difference: s.difference,
        businessDate,
        currency,
        closureInitiatedBy: s.closureInitiatedBy,
        closureInitiatedAt: s.closureInitiatedAt,
        closedBy: s.closedBy,
        closedAt: s.closedAt,
        verifiedBy: s.verifiedBy,
        verifiedAt: s.verifiedAt,
        variance,
      };
    }).filter((row): row is ReportSessionInput => row !== null);

    // Fetch open variances (ignoring date range)
    const varianceWhereClause: Prisma.CashVarianceEventWhereInput = {
      tenantId: tenant.id,
      status: {
        in: ["OPEN", "UNDER_REVIEW"],
      },
    };

    if (parsedOfficeId) {
      varianceWhereClause.officeId = parsedOfficeId;
    }
    if (tellerId) {
      varianceWhereClause.tellerId = tellerId;
    }
    if (cashierId) {
      varianceWhereClause.cashierId = cashierId;
    }

    const varianceEvents = await prisma.cashVarianceEvent.findMany({
      where: varianceWhereClause,
      select: {
        id: true,
        businessDate: true,
        type: true,
        amount: true,
        currency: true,
        status: true,
        officeId: true,
        cashierId: true,
        cashier: {
          select: {
            staffName: true,
          },
        },
        session: {
          select: {
            teller: {
              select: {
                officeName: true,
              },
            },
          },
        },
      },
      take: 20001, // fetch one extra to detect if we exceed limit
    });

    // Check variance count limit
    if (varianceEvents.length > 20000) {
      return NextResponse.json(
        {
          error:
            "Too many variance events for one report. Narrow the date range or add a branch filter.",
        },
        { status: 413 }
      );
    }

    const openVariances: OpenVarianceInput[] = varianceEvents.map((v) => ({
      id: v.id,
      businessDate: v.businessDate.toISOString().split("T")[0],
      type: v.type as "SHORTAGE" | "OVERAGE",
      amount: v.amount,
      currency: normalizeCode(v.currency || orgDisplayCode),
      officeId: v.officeId,
      officeName: v.session?.teller?.officeName || null,
      cashierName: v.cashier.staffName,
      status: v.status as "OPEN" | "UNDER_REVIEW",
    }));

    // Build the report
    const today = toBusinessDateString(new Date());
    const report = buildSessionReconciliationReport({
      sessions: reportSessions,
      openVariances,
      today,
    });

    // Prepare response based on format
    if (format === "csv") {
      const csv = toCsv(report.rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="session-reconciliation-${from!}-to-${to!}.csv"`,
        },
      });
    }

    // JSON format (default)
    return NextResponse.json({
      from: from!,
      to: to!,
      generatedAt: new Date().toISOString(),
      filters: {
        officeId: parsedOfficeId || null,
        tellerId: tellerId || null,
        cashierId: cashierId || null,
        status: statusFilter,
      },
      ...report,
    });
  } catch (error) {
    console.error("Error fetching session reconciliation report:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch report",
      },
      { status: 500 }
    );
  }
}
