import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

interface FineractCashierDetails {
  description?: string;
  staffId?: number;
  isFullDay?: boolean;
}

const formatDateForFineract = (date: Date) => {
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

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  return `${day} ${month} ${year}`;
};

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
    const { id: tellerIdParam, cashierId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { startDate, endDate, isFullDay, startTime, endTime } = body;
    const hasStartDate = Object.prototype.hasOwnProperty.call(body, "startDate");
    const hasEndDate = Object.prototype.hasOwnProperty.call(body, "endDate");
    const hasIsFullDay = Object.prototype.hasOwnProperty.call(body, "isFullDay");
    const hasStartTime = Object.prototype.hasOwnProperty.call(body, "startTime");
    const hasEndTime = Object.prototype.hasOwnProperty.call(body, "endTime");

    // Try to find teller by database ID first, then by Fineract ID
    let teller = await prisma.teller.findFirst({
      where: { id: tellerIdParam, tenantId: tenant.id },
    });

    if (!teller) {
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

    const parsedStartDate = hasStartDate
      ? new Date(startDate)
      : new Date(cashier.startDate);
    const parsedEndDate = hasEndDate
      ? endDate
        ? new Date(endDate)
        : null
      : cashier.endDate;

    if (Number.isNaN(parsedStartDate.getTime())) {
      return NextResponse.json(
        { error: "A valid start date is required" },
        { status: 400 }
      );
    }

    if (parsedEndDate && Number.isNaN(parsedEndDate.getTime())) {
      return NextResponse.json(
        { error: "End date is invalid" },
        { status: 400 }
      );
    }

    if (parsedEndDate && parsedEndDate < parsedStartDate) {
      return NextResponse.json(
        { error: "End date cannot be earlier than start date" },
        { status: 400 }
      );
    }

    if (!teller.fineractTellerId || !cashier.fineractCashierId) {
      return NextResponse.json(
        { error: "Cashier is not linked to Fineract and cannot be updated" },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    const currentFineractCashier =
      (await fineractService.getCashier(
        teller.fineractTellerId,
        cashier.fineractCashierId
      )) as FineractCashierDetails;

    await fineractService.updateCashier(
      teller.fineractTellerId,
      cashier.fineractCashierId,
      {
        staffId: currentFineractCashier.staffId ?? cashier.staffId,
        description: currentFineractCashier.description || "",
        startDate: formatDateForFineract(parsedStartDate),
        endDate: parsedEndDate ? formatDateForFineract(parsedEndDate) : "",
        isFullDay: hasIsFullDay
          ? isFullDay !== undefined
            ? isFullDay
            : true
          : currentFineractCashier.isFullDay ?? cashier.isFullDay,
        dateFormat: "dd MMMM yyyy",
        locale: "en",
      }
    );

    const updatedCashier = await prisma.cashier.update({
      where: { id: cashier.id },
      data: {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        ...(hasIsFullDay
          ? { isFullDay: isFullDay !== undefined ? isFullDay : true }
          : {}),
        ...(hasStartTime
          ? {
              startTime:
                startTime && startTime.trim() ? startTime.trim() : null,
            }
          : {}),
        ...(hasEndTime
          ? { endTime: endTime && endTime.trim() ? endTime.trim() : null }
          : {}),
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
