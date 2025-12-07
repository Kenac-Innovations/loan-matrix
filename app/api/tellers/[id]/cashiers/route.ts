import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tellers/[id]/cashiers
 * Get all cashiers for a teller
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Get cashiers from Fineract only
    if (!teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller does not have a Fineract ID" },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    const fineractCashiers = await fineractService.getCashiers(
      teller.fineractTellerId
    );

    console.log(`Fetched ${fineractCashiers.length} cashiers from Fineract`);

    // Look up database cashiers by Fineract ID to get database IDs
    const dbCashiers = await prisma.cashier.findMany({
      where: {
        tellerId,
        tenantId: tenant.id,
        fineractCashierId: {
          not: null,
        },
      },
    });

    // Merge Fineract data with database IDs
    const mergedCashiers = fineractCashiers.map((fc: any) => {
      const dbCashier = dbCashiers.find((dc) => dc.fineractCashierId === fc.id);
      return {
        ...fc,
        // Include database ID if found, otherwise use Fineract ID as fallback
        dbId: dbCashier?.id || null,
      };
    });

    return NextResponse.json(mergedCashiers);
  } catch (error) {
    console.error("Error fetching cashiers:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch cashiers",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tellers/[id]/cashiers
 * Assign a cashier to a teller
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      staffId,
      staffName,
      startDate,
      endDate,
      startTime,
      endTime,
      isFullDay,
      description,
    } = body;

    if (!staffId || !startDate) {
      return NextResponse.json(
        { error: "Missing required fields: staffId, startDate" },
        { status: 400 }
      );
    }

    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
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

    // Create cashier in Fineract if we have teller ID
    let fineractCashierId: number | undefined;
    let fineractError: any = null;

    if (teller.fineractTellerId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        // Fineract requires endDate, so if not provided, set it to 1 year from start date
        let finalEndDate = endDate;
        if (!finalEndDate) {
          const start = new Date(startDate);
          const oneYearLater = new Date(start);
          oneYearLater.setFullYear(start.getFullYear() + 1);
          finalEndDate = oneYearLater.toISOString().split("T")[0];
        }

        const cashierPayload = {
          staffId: parseInt(staffId),
          description: description || "",
          startDate: formatDateForFineract(startDate),
          endDate: formatDateForFineract(finalEndDate),
          isFullDay: isFullDay !== undefined ? isFullDay : true,
          dateFormat: "dd MMMM yyyy",
          locale: "en",
        };

        console.log(
          "Creating cashier in Fineract with payload:",
          JSON.stringify(cashierPayload, null, 2)
        );

        const result = await fineractService.createCashier(
          teller.fineractTellerId,
          cashierPayload
        );

        console.log(
          "Fineract cashier creation response:",
          JSON.stringify(result, null, 2)
        );
        fineractCashierId = result.resourceId || result.id;
      } catch (error: any) {
        fineractError = error;
        const errorDetails = {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          errors: error.response?.data?.errors,
        };
        console.error(
          "Error creating cashier in Fineract:",
          JSON.stringify(errorDetails, null, 2)
        );

        // Log each validation error individually
        if (
          error.response?.data?.errors &&
          Array.isArray(error.response.data.errors)
        ) {
          console.error("Validation errors:");
          error.response.data.errors.forEach((err: any, index: number) => {
            console.error(
              `  Error ${index + 1}:`,
              JSON.stringify(err, null, 2)
            );
          });
        }
        // Continue with database creation even if Fineract fails
      }
    } else {
      console.warn(
        "No Fineract teller ID found, creating cashier in database only"
      );
    }

    // Create cashier in database
    try {
      const cashier = await prisma.cashier.create({
        data: {
          tenantId: tenant.id,
          tellerId,
          fineractCashierId,
          staffId: parseInt(staffId),
          staffName: staffName || `Staff ${staffId}`,
          startDate: new Date(startDate),
          endDate: endDate
            ? new Date(endDate)
            : (() => {
                // Set to 1 year from start date if not provided
                const start = new Date(startDate);
                const oneYearLater = new Date(start);
                oneYearLater.setFullYear(start.getFullYear() + 1);
                return oneYearLater;
              })(),
          startTime,
          endTime,
          isFullDay: isFullDay !== undefined ? isFullDay : true,
          status: "PENDING",
        },
      });

      console.log("Cashier created in database:", cashier.id);

      // If Fineract creation failed, return error but still include the database record
      if (fineractError) {
        return NextResponse.json(
          {
            ...cashier,
            warning: "Cashier created in database but Fineract creation failed",
            fineractError:
              fineractError.response?.data || fineractError.message,
          },
          { status: 207 } // 207 Multi-Status - partial success
        );
      }

      return NextResponse.json(cashier);
    } catch (dbError: any) {
      console.error("Error creating cashier in database:", dbError);
      return NextResponse.json(
        {
          error: "Failed to create cashier in database",
          details: dbError.message,
          fineractError:
            fineractError?.response?.data || fineractError?.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error creating cashier:", error);
    return NextResponse.json(
      {
        error: "Failed to create cashier",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
