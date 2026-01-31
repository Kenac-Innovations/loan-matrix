import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/leads/reports
 * Fetch loan status reports from Fineract or local DB
 * 
 * Query params:
 * - report: "drafts" | "pending" | "approved" | "rejected"
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const report = searchParams.get("report") || "pending";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Handle drafts from local database
    if (report === "drafts") {
      return await getDraftsFromLocalDB(startDate, endDate, request);
    }

    // Map report type to Fineract report name
    const reportNames: Record<string, string> = {
      pending: "system submitted pending approval",
      approved: "system approved pending disbursement",
      rejected: "system loans rejected",
    };

    const reportName = reportNames[report];
    if (!reportName) {
      return NextResponse.json(
        { error: "Invalid report type. Use: drafts, pending, approved, or rejected" },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    
    // Call the Fineract report API
    const data = await fineractService.runReport(reportName, {
      startDate,
      endDate,
      locale: "en",
      dateFormat: "yyyy-MM-dd",
    });

    console.log(`Report ${reportName} raw response:`, JSON.stringify(data).slice(0, 500));

    // Parse the report data - Fineract returns column headers and data rows
    const result = parseReportData(data);

    console.log(`Report ${reportName} parsed ${result.length} rows`);

    return NextResponse.json({
      report: report,
      reportName,
      startDate,
      endDate,
      count: result.length,
      data: result,
      rawColumnHeaders: data?.columnHeaders?.map((c: any) => c.columnName || c.name || c),
    });
  } catch (error) {
    console.error("Error fetching loan report:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch draft leads from local database
 */
async function getDraftsFromLocalDB(startDate: string, endDate: string, request: NextRequest) {
  try {
    // Get tenant from header or default to goodfellow
    const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";
    
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
    });
    
    if (!tenant) {
      console.error("Tenant not found for slug:", tenantSlug);
      return NextResponse.json(
        { error: `Tenant not found: ${tenantSlug}` },
        { status: 404 }
      );
    }

    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);
    
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    console.log("Fetching drafts for tenant:", tenant.id, "from", startDateTime, "to", endDateTime);

    // Fetch Fineract users to map user IDs to names
    let userMap: Record<string, string> = {};
    try {
      const fineractService = await getFineractServiceWithSession();
      const users = await fineractService.getUsers();
      users.forEach((user: any) => {
        userMap[user.id.toString()] = user.username || user.displayName || `User ${user.id}`;
      });
    } catch (err) {
      console.error("Error fetching Fineract users for drafts:", err);
      // Continue without user names - will fall back to IDs
    }

    const drafts = await prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        loanSubmittedToFineract: false,
        createdAt: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstname: true,
        middlename: true,
        lastname: true,
        mobileNo: true,
        requestedAmount: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        createdByUserName: true,
        currentStage: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log("Found", drafts.length, "drafts");

    // Transform to consistent format
    const data = drafts.map((draft) => {
      // Build full name from parts
      const nameParts = [draft.firstname, draft.middlename, draft.lastname].filter(Boolean);
      const fullName = nameParts.length > 0 ? nameParts.join(" ") : "Unknown";
      
      // Get user name - prefer stored name, then lookup from Fineract, then fallback to ID
      let createdByName = draft.createdByUserName;
      if (!createdByName && draft.userId) {
        createdByName = userMap[draft.userId] || draft.userId;
      }
      
      return {
        lead_id: draft.id,
        client_name: fullName,
        phone_number: draft.mobileNo || "-",
        loan_amount: draft.requestedAmount?.toString() || "0",
        created_date: draft.createdAt,
        pipeline_stage: draft.currentStage?.name || "New",
        created_by: createdByName || "Unknown",
      };
    });

    return NextResponse.json({
      report: "drafts",
      reportName: "Draft Leads (Local)",
      startDate,
      endDate,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch drafts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Parse Fineract report data into a usable format
 * Fineract reports return: { columnHeaders: [...], data: [{"row": [...]}, {"row": [...]}] }
 */
function parseReportData(reportData: any): any[] {
  if (!reportData) return [];

  // Handle array format (data rows directly)
  if (Array.isArray(reportData) && reportData.length > 0) {
    // If first item is an object without 'row' property, it's already parsed
    if (typeof reportData[0] === "object" && !Array.isArray(reportData[0]) && !reportData[0].row) {
      return reportData;
    }
  }

  // Handle Fineract standard report format
  const { columnHeaders, data } = reportData;
  
  if (!columnHeaders || !data || !Array.isArray(data)) {
    return [];
  }

  // Map column names - convert to snake_case for consistency
  const columns = columnHeaders.map((col: any) => {
    const name = col.columnName || col.name || col;
    // Convert "Loan Account" to "loan_account" for consistent access
    return name.toLowerCase().replaceAll(" ", "_").replaceAll(/[()%]/g, "");
  });

  // Also keep original column names for display
  const originalColumns = columnHeaders.map((col: any) => col.columnName || col.name || col);

  // Transform data rows to objects
  // Fineract returns data as [{"row": [...]}, {"row": [...]}]
  return data.map((item: any) => {
    const rowData = item.row || item; // Handle both {"row": [...]} and [...] formats
    const obj: Record<string, any> = {};
    
    columns.forEach((col: string, index: number) => {
      obj[col] = rowData[index];
    });
    
    // Also add original column names as _display property for the UI
    obj._columns = originalColumns;
    
    return obj;
  });
}
