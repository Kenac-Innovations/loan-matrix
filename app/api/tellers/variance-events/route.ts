import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { hasFineractPermissionServer, hasSuperAdminServer } from "@/lib/authorization";

/**
 * GET /api/tellers/variance-events
 *
 * List cash variance events with filtering and pagination.
 *
 * Query params:
 * - status: OPEN|UNDER_REVIEW|RESOLVED|ALL; default "UNRESOLVED" (OPEN+UNDER_REVIEW)
 * - type: SHORTAGE|OVERAGE
 * - officeId: int
 * - cashierId: string
 * - from, to: YYYY-MM-DD (inclusive on businessDate)
 * - page: 1-based, default 1
 * - pageSize: default 25, max 100
 *
 * Returns:
 * - items: array of events with cashier/teller details
 * - total, page, pageSize
 * - summary: openShortageTotal, openOverageTotal, openCount, currency
 * - canAct: boolean (has permission)
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query params
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status") || "UNRESOLVED";
    const typeParam = url.searchParams.get("type");
    const officeIdParam = url.searchParams.get("officeId");
    const cashierIdParam = url.searchParams.get("cashierId");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const pageParam = parseInt(url.searchParams.get("page") || "1");
    const pageSizeParam = parseInt(url.searchParams.get("pageSize") || "25");

    // Validate page params: must be finite integers
    if (!Number.isFinite(pageParam) || pageParam < 1) {
      return NextResponse.json(
        { error: "page must be a finite integer >= 1" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(pageSizeParam) || pageSizeParam < 1 || pageSizeParam > 100) {
      return NextResponse.json(
        { error: "pageSize must be a finite integer between 1 and 100" },
        { status: 400 }
      );
    }

    const page = pageParam;
    const pageSize = Math.min(pageSizeParam, 100);

    // Validate status param
    const validStatuses = ["OPEN", "UNDER_REVIEW", "RESOLVED", "UNRESOLVED", "ALL"];
    if (!validStatuses.includes(statusParam)) {
      return NextResponse.json(
        { error: "status must be one of: OPEN, UNDER_REVIEW, RESOLVED, UNRESOLVED, ALL" },
        { status: 400 }
      );
    }

    // Validate type param: only allow SHORTAGE, OVERAGE, or absent/ALL
    if (typeParam && typeParam !== "ALL") {
      if (!["SHORTAGE", "OVERAGE"].includes(typeParam.toUpperCase())) {
        return NextResponse.json(
          { error: "type must be SHORTAGE, OVERAGE, or ALL" },
          { status: 400 }
        );
      }
    }

    // Validate officeId param if present
    if (officeIdParam) {
      const officeId = parseInt(officeIdParam);
      if (!Number.isFinite(officeId)) {
        return NextResponse.json(
          { error: "officeId must be a finite integer" },
          { status: 400 }
        );
      }
    }

    // Build status filter
    let statusFilter: string[];
    if (statusParam === "ALL") {
      statusFilter = ["OPEN", "UNDER_REVIEW", "RESOLVED"];
    } else if (statusParam === "UNRESOLVED") {
      statusFilter = ["OPEN", "UNDER_REVIEW"];
    } else {
      // Single status or default
      statusFilter = statusParam.split(",").filter(Boolean);
    }

    // Build where clause
    const where: Prisma.CashVarianceEventWhereInput = {
      tenantId: tenant.id,
      status: { in: statusFilter },
    };

    // Only apply type filter if it's SHORTAGE or OVERAGE (not ALL or absent)
    if (typeParam && typeParam.toUpperCase() !== "ALL") {
      where.type = typeParam.toUpperCase();
    }

    if (officeIdParam) {
      where.officeId = parseInt(officeIdParam);
    }

    if (cashierIdParam) {
      where.cashierId = cashierIdParam;
    }

    // Date range filters on the business date (a @db.Date column; inclusive YYYY-MM-DD)
    const isDateParam = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (isDateParam(fromParam) || isDateParam(toParam)) {
      where.businessDate = {
        ...(isDateParam(fromParam) && { gte: new Date(`${fromParam}T00:00:00.000Z`) }),
        ...(isDateParam(toParam) && { lte: new Date(`${toParam}T00:00:00.000Z`) }),
      };
    }

    // Fetch total count
    const total = await prisma.cashVarianceEvent.count({ where });

    // Fetch paginated events with related data
    const events = await prisma.cashVarianceEvent.findMany({
      where,
      include: {
        cashier: {
          select: {
            id: true,
            staffId: true,
            staffName: true,
            tellerId: true,
            teller: {
              select: {
                id: true,
                name: true,
                officeId: true,
                officeName: true,
              },
            },
          },
        },
        session: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ businessDate: "desc" }, { raisedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Transform events to response format
    const items = events.map((event) => ({
      id: event.id,
      type: event.type,
      amount: event.amount,
      currency: event.currency,
      status: event.status,
      businessDate: event.businessDate.toISOString().split("T")[0], // YYYY-MM-DD
      expectedBalance: event.expectedBalance,
      countedAmount: event.countedAmount,
      raisedAt: event.raisedAt.toISOString(),
      raisedBy: event.raisedBy,
      resolutionType: event.resolutionType,
      resolvedAt: event.resolvedAt ? event.resolvedAt.toISOString() : null,
      resolvedBy: event.resolvedBy,
      cashier: {
        id: event.cashier.id,
        staffName: event.cashier.staffName,
      },
      teller: {
        id: event.cashier.teller.id,
        name: event.cashier.teller.name,
      },
      officeId: event.officeId,
      officeName: event.cashier.teller.officeName,
      sessionId: event.sessionId,
    }));

    // Calculate summary for OPEN and UNDER_REVIEW only
    const summaryWhere = { ...where, status: { in: ["OPEN", "UNDER_REVIEW"] } };
    const summaryEvents = await prisma.cashVarianceEvent.findMany({
      where: summaryWhere,
      select: {
        type: true,
        amount: true,
        currency: true,
      },
    });

    // Group by currency and calculate totals
    const byCurrencyMap: Record<
      string,
      { currency: string; openShortageTotal: number; openOverageTotal: number; openCount: number }
    > = {};

    for (const event of summaryEvents) {
      if (!byCurrencyMap[event.currency]) {
        byCurrencyMap[event.currency] = {
          currency: event.currency,
          openShortageTotal: 0,
          openOverageTotal: 0,
          openCount: 0,
        };
      }

      if (event.type === "SHORTAGE") {
        byCurrencyMap[event.currency].openShortageTotal += event.amount;
      } else if (event.type === "OVERAGE") {
        byCurrencyMap[event.currency].openOverageTotal += event.amount;
      }

      byCurrencyMap[event.currency].openCount += 1;
    }

    const byCurrency = Object.values(byCurrencyMap).sort((a, b) =>
      a.currency.localeCompare(b.currency)
    );

    const openCount = summaryEvents.length;

    // Check permission
    const hasPermission =
      (await hasFineractPermissionServer("SETTLECASHFROMCASHIER_TELLER")) ||
      (await hasSuperAdminServer());

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      summary: {
        byCurrency,
        openCount,
      },
      canAct: hasPermission,
    });
  } catch (error) {
    console.error("Error fetching variance events:", error);
    return NextResponse.json(
      { error: "Failed to fetch variance events" },
      { status: 500 }
    );
  }
}
