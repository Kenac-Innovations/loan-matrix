import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * PUT /api/tellers/[id]/cashiers/[cashierId]
 * Update a cashier
 */
export async function PUT(
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

    const body = await request.json();
    const { endDate, isFullDay, startTime, endTime } = body;

    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Try to find cashier by database ID first, then by Fineract ID
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId, tenantId: tenant.id },
    });

    // If not found by database ID, try Fineract ID
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

    if (!cashier) {
      return NextResponse.json({ error: "Cashier not found" }, { status: 404 });
    }

    // Format date for Fineract (dd MMMM yyyy format)
    const formatDateForFineract = (dateString: string | null): string => {
      if (!dateString) return "";
      const date = new Date(dateString);
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
      const day = date.getDate().toString().padStart(2, "0");
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    // Update in Fineract if we have the ID
    if (teller.fineractTellerId && cashier.fineractCashierId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        // Fineract doesn't have a direct update endpoint for cashiers,
        // but we can update the end date by closing and reopening if needed
        // For now, we'll just update the database
        console.log("Cashier update - Fineract update not supported, updating database only");
      } catch (error: any) {
        console.error("Error updating cashier in Fineract:", error);
        // Continue with database update even if Fineract fails
      }
    }

    // Update in database
    const updatedCashier = await prisma.cashier.update({
      where: { id: cashier.id },
      data: {
        endDate: endDate ? new Date(endDate) : null,
        isFullDay: isFullDay !== undefined ? isFullDay : true,
        startTime: startTime && startTime.trim() ? startTime.trim() : null,
        endTime: endTime && endTime.trim() ? endTime.trim() : null,
      },
    });

    return NextResponse.json(updatedCashier);
  } catch (error) {
    console.error("Error updating cashier:", error);
    return NextResponse.json(
      {
        error: "Failed to update cashier",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}



