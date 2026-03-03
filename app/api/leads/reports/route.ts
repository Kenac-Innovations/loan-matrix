import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/leads/reports
 * Fetch loan status reports from Fineract or local DB
 * 
 * Query params:
 * - report: "drafts" | "pending" | "approved" | "rejected" | "disbursed" | "payout"
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

    // Payout = disbursed loans that have been paid out (payout status PAID). Fetched via disbursed then filtered.
    const isPayoutReport = report === "payout";

    // Map report type to Fineract report name
    const reportNames: Record<string, string> = {
      pending: "system submitted pending approval",
      approved: "system approved pending disbursement",
      rejected: "system loans rejected",
      disbursed: "system disbursed",
      payout: "system disbursed", // same source, filter to PAID only below
    };

    const reportName = reportNames[report];
    if (!reportName) {
      return NextResponse.json(
        { error: "Invalid report type. Use: drafts, pending, approved, rejected, disbursed, or payout" },
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
    let result = parseReportData(data);

    console.log(`Report ${reportName} parsed ${result.length} rows`);

    // Enrich with local lead IDs and payout status by looking up via fineractLoanId
    if (result.length > 0) {
      // Get tenant from header
      const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";
      const tenant = await prisma.tenant.findFirst({
        where: { slug: tenantSlug, isActive: true },
      });

      if (tenant) {
        // Extract loan IDs and external IDs (lead IDs) from the report data
        const loanIds = result
          .map((row: any) => row.loan_id)
          .filter((id: any) => id != null);
        const externalIds = result
          .map((row: any) => row.external_id || row.client_external_id)
          .filter((id: any) => id != null && String(id).trim() !== "");

        if (loanIds.length > 0 || externalIds.length > 0) {
          // Look up local leads by fineractLoanId OR by lead ID (external_id from Fineract report)
          const leads = await prisma.lead.findMany({
            where: {
              tenantId: tenant.id,
              OR: [
                ...(loanIds.length > 0 ? [{ fineractLoanId: { in: loanIds.map((id: any) => Number(id)) } }] : []),
                ...(externalIds.length > 0 ? [{ id: { in: externalIds.map(String) } }] : []),
              ],
            },
            select: {
              id: true,
              fineractLoanId: true,
              preferredPaymentMethod: true,
            },
          });

          // Map leads by fineractLoanId and by lead ID for fast lookups
          const leadByFineractLoanId = new Map(
            leads.filter((l) => l.fineractLoanId != null).map((lead) => [lead.fineractLoanId!, lead])
          );
          const leadByIdMap = new Map(
            leads.map((lead) => [lead.id, lead])
          );

          // For disbursed or payout report, fetch payout statuses; for payout only, also payment method
          // Use fineractLoanId from matched leads as well (in case Fineract report has no loan_id column)
          const allFineractLoanIds = [
            ...loanIds.map((id: any) => Number(id)),
            ...leads.filter((l) => l.fineractLoanId != null).map((l) => l.fineractLoanId!),
          ];
          const uniqueFineractLoanIds = [...new Set(allFineractLoanIds)];

          let payoutStatusMap = new Map<number, string>();
          let payoutPaymentMethodMap = new Map<number, string>();
          if ((report === "disbursed" || report === "payout") && uniqueFineractLoanIds.length > 0) {
            const payouts = await prisma.loanPayout.findMany({
              where: {
                tenantId: tenant.id,
                fineractLoanId: { in: uniqueFineractLoanIds },
              },
              select: {
                fineractLoanId: true,
                status: true,
                paymentMethod: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            });

            for (const payout of payouts) {
              if (!payoutStatusMap.has(payout.fineractLoanId)) {
                payoutStatusMap.set(payout.fineractLoanId, payout.status);
                if (payout.paymentMethod) {
                  payoutPaymentMethodMap.set(payout.fineractLoanId, payout.paymentMethod);
                }
              }
            }
            console.log(`Fetched payout statuses for ${payoutStatusMap.size} loans`);
          }

          // Helper: friendly label for payment type (dedicated column)
          const PAYMENT_TYPE_LABELS: Record<string, string> = {
            CASH: "Cash",
            MOBILE_MONEY: "Mobile Money",
            BANK_TRANSFER: "Bank Transfer",
          };
          const isPaymentTypeValue = (v: unknown): boolean => {
            if (v == null || typeof v !== "string") return false;
            const u = v.toUpperCase().replace(/\s+/g, "_");
            return u === "CASH" || u === "MOBILE_MONEY" || u === "BANK_TRANSFER" || v === "Mobile" || v === "Cash" || v === "Bank Transfer";
          };

          // Add lead_id, payout_status, payment_type (dedicated column), and fix branch when it shows payment type
          result = result.map((row: any) => {
            const rowLoanId = row.loan_id != null ? Number(row.loan_id) : null;
            const rowExternalId = row.external_id || row.client_external_id || null;

            // Resolve the lead: try fineractLoanId match first, then external_id (lead ID)
            let resolvedLead = rowLoanId ? leadByFineractLoanId.get(rowLoanId) ?? null : null;
            if (!resolvedLead && rowExternalId) {
              resolvedLead = leadByIdMap.get(String(rowExternalId)) || null;
            }

            const resolvedLeadId = resolvedLead?.id || null;
            const resolvedFineractLoanId = resolvedLead?.fineractLoanId ?? rowLoanId;
            const fromLead = resolvedLead?.preferredPaymentMethod ?? null;
            const fromPayout = (report === "disbursed" || report === "payout") && resolvedFineractLoanId
              ? payoutPaymentMethodMap.get(resolvedFineractLoanId) : null;
            const rawPaymentType = fromLead || fromPayout || null;
            const paymentTypeLabel = rawPaymentType
              ? (PAYMENT_TYPE_LABELS[String(rawPaymentType).toUpperCase().replace(/\s+/g, "_")] || rawPaymentType)
              : null;

            const enrichedRow: any = {
              ...row,
              lead_id: resolvedLeadId,
              payment_type: paymentTypeLabel,
            };

            if (report === "disbursed" || report === "payout") {
              enrichedRow.payout_status = resolvedFineractLoanId
                ? (payoutStatusMap.get(resolvedFineractLoanId) || "PENDING")
                : "PENDING";
            }
            

            // If Fineract report put payment type in "branch", show actual branch (office) in Branch column
            if (isPaymentTypeValue(row.branch)) {
              enrichedRow.branch = row.office ?? row.office_name ?? null;
            }

            return enrichedRow;
          });

          // Disbursed report: only rows that are disbursed but NOT yet paid out (payout_status !== "PAID")
          if (report === "disbursed") {
            result = result.filter((row: any) => String(row.payout_status || "").toUpperCase() !== "PAID");
            console.log(`Disbursed report: ${result.length} disbursed-but-not-paid-out loans`);
          }

          // Payout report: only rows that have been paid out (payout_status === "PAID")
          if (isPayoutReport) {
            result = result.filter((row: any) => String(row.payout_status || "").toUpperCase() === "PAID");
            console.log(`Payout report: ${result.length} paid-out loans`);
          }

          console.log(`Enriched ${leads.length} rows with local lead IDs`);
        } else {
          // No local leads found — still add payment_type column so it's visible
          result = result.map((row: any) => ({ ...row, payment_type: null }));
        }
      }
    }

    // Ensure payment_type column is always present even if enrichment was skipped
    if (result.length > 0 && !("payment_type" in result[0])) {
      result = result.map((row: any) => ({ ...row, payment_type: null }));
    }

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

    const draftMaxAge = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const drafts = await prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        loanSubmittedToFineract: false,
        status: "DRAFT",
        createdAt: {
          gte: startDateTime > draftMaxAge ? startDateTime : draftMaxAge,
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
        preferredPaymentMethod: true,
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
      
      const paymentLabels: Record<string, string> = {
        CASH: "Cash",
        MOBILE_MONEY: "Mobile Money",
        BANK_TRANSFER: "Bank Transfer",
      };
      const rawPayment = draft.preferredPaymentMethod;
      const paymentType = rawPayment
        ? (paymentLabels[String(rawPayment).toUpperCase().replace(/\s+/g, "_")] || rawPayment)
        : null;
      return {
        lead_id: draft.id,
        client_name: fullName,
        phone_number: draft.mobileNo || "-",
        loan_amount: draft.requestedAmount?.toString() || "0",
        created_date: draft.createdAt,
        pipeline_stage: draft.currentStage?.name || "New",
        created_by: createdByName || "Unknown",
        payment_type: paymentType,
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
