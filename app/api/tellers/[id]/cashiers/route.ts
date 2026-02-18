import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";

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
    let { id: tellerId } = params;
    const [tenant, orgCurrency] = await Promise.all([
      getTenantFromHeaders(),
      getOrgDefaultCurrencyCode(),
    ]);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Handle fineract-prefixed IDs (e.g., "fineract-123")
    let fineractIdFromPrefix: number | null = null;
    if (tellerId.startsWith("fineract-")) {
      fineractIdFromPrefix = parseInt(tellerId.replace("fineract-", ""));
    }

    // Try to find teller by database ID first
    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // If not found, try by Fineract ID
    const fineractIdToSearch =
      fineractIdFromPrefix ||
      (!isNaN(Number(tellerId)) ? Number(tellerId) : null);
    if (!teller && fineractIdToSearch) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: fineractIdToSearch, tenantId: tenant.id },
      });
    }

    // If still not found but we have a Fineract ID, auto-sync from Fineract
    if (!teller && fineractIdToSearch) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractTeller = await fineractService.getTeller(
          fineractIdToSearch
        );

        if (fineractTeller) {
          // Auto-sync: Create the teller in the database
          teller = await prisma.teller.create({
            data: {
              tenantId: tenant.id,
              fineractTellerId: fineractIdToSearch,
              officeId: fineractTeller.officeId,
              officeName:
                fineractTeller.officeName ||
                `Office ${fineractTeller.officeId}`,
              name: fineractTeller.name,
              description: fineractTeller.description || "",
              startDate: Array.isArray(fineractTeller.startDate)
                ? new Date(
                    fineractTeller.startDate[0],
                    fineractTeller.startDate[1] - 1,
                    fineractTeller.startDate[2]
                  )
                : new Date(fineractTeller.startDate),
              endDate: fineractTeller.endDate
                ? Array.isArray(fineractTeller.endDate)
                  ? new Date(
                      fineractTeller.endDate[0],
                      fineractTeller.endDate[1] - 1,
                      fineractTeller.endDate[2]
                    )
                  : new Date(fineractTeller.endDate)
                : null,
              status: fineractTeller.status || "ACTIVE",
            },
          });
          console.log(
            `Auto-synced Fineract teller ${fineractIdToSearch} to database as ${teller.id}`
          );
        }
      } catch (syncError) {
        console.error("Error syncing teller from Fineract:", syncError);
      }
    }

    console.log("GET Cashiers - Teller lookup:", {
      tellerId,
      tenantId: tenant.id,
      found: !!teller,
      fineractTellerId: teller?.fineractTellerId,
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

    console.log(
      `Fetched ${fineractCashiers.length} cashiers from Fineract for teller ${teller.fineractTellerId}`
    );

    // Look up database cashiers by Fineract ID to get database IDs
    const dbCashiers = await prisma.cashier.findMany({
      where: {
        tellerId: teller.id, // Use the database teller ID
        tenantId: tenant.id,
        fineractCashierId: {
          not: null,
        },
      },
    });

    // Get active sessions for all cashiers
    const activeSessions = await prisma.cashierSession.findMany({
      where: {
        tellerId: teller.id,
        tenantId: tenant.id,
        sessionStatus: "ACTIVE",
      },
      select: {
        cashierId: true,
        sessionStatus: true,
      },
    });

    // Create a map of cashier ID to session status
    const sessionStatusMap = new Map(
      activeSessions.map((s) => [s.cashierId, s.sessionStatus])
    );

    // Merge Fineract data with database IDs, session status, and Fineract balance
    const mergedCashiers = await Promise.all(
      fineractCashiers.map(async (fc: any) => {
        const dbCashier = dbCashiers.find((dc) => dc.fineractCashierId === fc.id);
        const sessionStatus = dbCashier
          ? sessionStatusMap.get(dbCashier.id)
          : null;

        // Get balance from Fineract (source of truth) – use ZMK to match allocate currency
        let fineractBalance = 0;
        try {
          const summary = await fineractService.getCashierSummaryAndTransactions(
            teller.fineractTellerId!,
            fc.id,
            "ZMK"
          );
          fineractBalance = summary.netCash || 0;
        } catch (err) {
          console.error(`Error getting Fineract balance for cashier ${fc.id}:`, err);
        }

        return {
          ...fc,
          // Include database ID if found, otherwise use Fineract ID as fallback
          dbId: dbCashier?.id || null,
          // Include session status from local database
          sessionStatus: sessionStatus || "NOT_STARTED",
          // Include Fineract balance (source of truth)
          balance: fineractBalance,
          currentAllocation: {
            amount: fineractBalance,
            currency: orgCurrency,
          },
        };
      })
    );

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
    let { id: tellerId } = params;
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

    // Handle fineract-prefixed IDs (e.g., "fineract-123")
    let fineractIdFromPrefix: number | null = null;
    if (tellerId.startsWith("fineract-")) {
      fineractIdFromPrefix = parseInt(tellerId.replace("fineract-", ""));
    }

    // Try to find teller by database ID first
    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // If not found, try by Fineract ID
    const fineractIdToSearch =
      fineractIdFromPrefix ||
      (!isNaN(Number(tellerId)) ? Number(tellerId) : null);
    if (!teller && fineractIdToSearch) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: fineractIdToSearch, tenantId: tenant.id },
      });
    }

    // If still not found but we have a Fineract ID, auto-sync from Fineract
    if (!teller && fineractIdToSearch) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractTeller = await fineractService.getTeller(
          fineractIdToSearch
        );

        if (fineractTeller) {
          // Auto-sync: Create the teller in the database
          teller = await prisma.teller.create({
            data: {
              tenantId: tenant.id,
              fineractTellerId: fineractIdToSearch,
              officeId: fineractTeller.officeId,
              officeName:
                fineractTeller.officeName ||
                `Office ${fineractTeller.officeId}`,
              name: fineractTeller.name,
              description: fineractTeller.description || "",
              startDate: Array.isArray(fineractTeller.startDate)
                ? new Date(
                    fineractTeller.startDate[0],
                    fineractTeller.startDate[1] - 1,
                    fineractTeller.startDate[2]
                  )
                : new Date(fineractTeller.startDate),
              endDate: fineractTeller.endDate
                ? Array.isArray(fineractTeller.endDate)
                  ? new Date(
                      fineractTeller.endDate[0],
                      fineractTeller.endDate[1] - 1,
                      fineractTeller.endDate[2]
                    )
                  : new Date(fineractTeller.endDate)
                : null,
              status: fineractTeller.status || "ACTIVE",
            },
          });
          console.log(
            `Auto-synced Fineract teller ${fineractIdToSearch} to database as ${teller.id}`
          );
        }
      } catch (syncError) {
        console.error("Error syncing teller from Fineract:", syncError);
      }
    }

    console.log("POST Cashier - Teller lookup:", {
      tellerId,
      tenantId: tenant.id,
      found: !!teller,
      fineractTellerId: teller?.fineractTellerId,
      tellerName: teller?.name,
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

    // Create or update cashier in database (upsert to handle existing records)
    try {
      const endDateValue = endDate
        ? new Date(endDate)
        : (() => {
            // Set to 1 year from start date if not provided
            const start = new Date(startDate);
            const oneYearLater = new Date(start);
            oneYearLater.setFullYear(start.getFullYear() + 1);
            return oneYearLater;
          })();

      let cashier;
      
      // If we have a Fineract cashier ID, use upsert to handle existing records
      if (fineractCashierId) {
        cashier = await prisma.cashier.upsert({
          where: {
            tenantId_fineractCashierId: {
              tenantId: tenant.id,
              fineractCashierId: fineractCashierId,
            },
          },
          update: {
            // Update existing record with new data
            tellerId: teller.id,
            staffId: Number.parseInt(staffId),
            staffName: staffName || `Staff ${staffId}`,
            startDate: new Date(startDate),
            endDate: endDateValue,
            startTime,
            endTime,
            isFullDay: isFullDay !== undefined ? isFullDay : true,
          },
          create: {
            tenantId: tenant.id,
            tellerId: teller.id,
            fineractCashierId,
            staffId: Number.parseInt(staffId),
            staffName: staffName || `Staff ${staffId}`,
            startDate: new Date(startDate),
            endDate: endDateValue,
            startTime,
            endTime,
            isFullDay: isFullDay !== undefined ? isFullDay : true,
            status: "PENDING",
          },
        });
        console.log("Cashier upserted in database:", cashier.id);
      } else {
        // No Fineract ID, just create
        cashier = await prisma.cashier.create({
          data: {
            tenantId: tenant.id,
            tellerId: teller.id,
            staffId: Number.parseInt(staffId),
            staffName: staffName || `Staff ${staffId}`,
            startDate: new Date(startDate),
            endDate: endDateValue,
            startTime,
            endTime,
            isFullDay: isFullDay !== undefined ? isFullDay : true,
            status: "PENDING",
          },
        });
        console.log("Cashier created in database (no Fineract ID):", cashier.id);
      }

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
          details: "The cashier exists in Fineract but could not be created in the local database.",
          hint: "Please try creating the cashier manually or contact support.",
          fineractError: dbError.message,
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
