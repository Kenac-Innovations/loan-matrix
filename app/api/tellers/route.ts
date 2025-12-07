import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tellers
 * Get all tellers, optionally filtered by office
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get("officeId");

    // Get tellers from Fineract
    const fineractService = await getFineractServiceWithSession();
    const fineractTellers = await fineractService.getTellers(
      officeId ? parseInt(officeId) : undefined
    );

    // Get tellers from database
    const dbTellers = await prisma.teller.findMany({
      where: {
        tenantId: tenant.id,
        ...(officeId && { officeId: parseInt(officeId) }),
        isActive: true,
      },
      include: {
        cashAllocations: {
          where: {
            status: "ACTIVE",
            cashierId: null, // Only teller vault allocations
          },
          orderBy: { allocatedDate: "desc" },
        },
        cashiers: {
          where: { isActive: true },
        },
        _count: {
          select: {
            settlements: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate available balance for each teller
    const tellersWithBalances = await Promise.all(
      dbTellers.map(async (dbTeller) => {
        const vaultBalance = dbTeller.cashAllocations.reduce(
          (sum, alloc) => sum + alloc.amount,
          0
        );

        // Exclude variance allocations - variance is tracked separately
        const cashierAllocations = await prisma.cashAllocation.findMany({
          where: {
            tellerId: dbTeller.id,
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

        const availableBalance = vaultBalance - allocatedToCashiers;
        const currency = dbTeller.cashAllocations[0]?.currency || "USD";

        return {
          ...dbTeller,
          vaultBalance,
          availableBalance,
          allocatedToCashiers,
          currentAllocation: {
            amount: availableBalance,
            currency: currency,
          },
        };
      })
    );

    // Merge Fineract and database data
    const mergedTellers = fineractTellers.map((ft: any) => {
      const dbTeller = tellersWithBalances.find(
        (dt) => dt.fineractTellerId === ft.id
      );
      return {
        ...ft,
        ...(dbTeller && {
          id: dbTeller.id,
          currentAllocation: dbTeller.currentAllocation,
          activeCashiers: dbTeller.cashiers.length,
          settlementCount: dbTeller._count.settlements,
        }),
      };
    });

    return NextResponse.json(mergedTellers);
  } catch (error) {
    console.error("Error fetching tellers:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch tellers",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tellers
 * Create a new teller
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { officeId, name, description, startDate, endDate } = body;

    if (!officeId || !name || !startDate) {
      return NextResponse.json(
        { error: "Missing required fields: officeId, name, startDate" },
        { status: 400 }
      );
    }

    // Format date from ISO to Fineract format (dd MMMM yyyy)
    const formatDateForFineract = (dateString: string): string => {
      if (!dateString) return "";
      const date = new Date(dateString);
      const months = [
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
      const day = date.getDate().toString().padStart(2, "0");
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    // Create teller in Fineract
    const fineractService = await getFineractServiceWithSession();
    const fineractTeller = await fineractService.createTeller({
      officeId: parseInt(officeId),
      name,
      description: description || "",
      startDate: formatDateForFineract(startDate),
      endDate: endDate ? formatDateForFineract(endDate) : "",
      status: 300, // Active status
      dateFormat: "dd MMMM yyyy",
      locale: "en",
    });

    // Create teller in database
    const dbTeller = await prisma.teller.create({
      data: {
        tenantId: tenant.id,
        fineractTellerId: fineractTeller.resourceId || fineractTeller.id,
        officeId: parseInt(officeId),
        officeName: body.officeName || `Office ${officeId}`,
        name,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      ...fineractTeller,
      id: dbTeller.id,
    });
  } catch (error) {
    console.error("Error creating teller:", error);
    return NextResponse.json(
      {
        error: "Failed to create teller",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
