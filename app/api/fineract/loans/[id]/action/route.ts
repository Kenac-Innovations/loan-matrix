import { NextRequest, NextResponse } from "next/server";
import { FineractAPIService } from "@/lib/fineract-api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getSession } from "@/lib/auth";

// POST /api/fineract/loans/[id]/action - Perform an action on a loan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();
    const { action, note, approvedOnDate, approvedLoanAmount, actualDisbursementDate } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Get session for auth
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized - no access token" },
        { status: 401 }
      );
    }

    // Get tenant
    const tenantSlug =
      request.headers.get("x-tenant-slug") ||
      request.nextUrl.hostname.split(".")[0];
    const tenantId = await getFineractTenantId(tenantSlug);

    const fineractService = new FineractAPIService({
      baseUrl: process.env.FINERACT_BASE_URL || "http://10.10.0.143",
      username: process.env.FINERACT_USERNAME || "mifos",
      password: process.env.FINERACT_PASSWORD || "password",
      tenantId: tenantId,
    });

    // Build the request body based on action
    let actionBody: any = {};
    let command = "";

    switch (action) {
      case "approve":
        command = "approve";
        actionBody = {
          approvedOnDate: formatDate(approvedOnDate || new Date()),
          note: note || undefined,
        };
        if (approvedLoanAmount) {
          actionBody.approvedLoanAmount = approvedLoanAmount;
        }
        break;

      case "reject":
        command = "reject";
        actionBody = {
          rejectedOnDate: formatDate(new Date()),
          note: note || "Loan application rejected",
        };
        break;

      case "disburse":
        command = "disburse";
        actionBody = {
          actualDisbursementDate: formatDate(actualDisbursementDate || new Date()),
          note: note || undefined,
        };
        break;

      case "undo_approval":
        command = "undoapproval";
        actionBody = {
          note: note || "Approval undone",
        };
        break;

      case "write_off":
        command = "writeoff";
        actionBody = {
          transactionDate: formatDate(new Date()),
          note: note || "Loan written off",
        };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    console.log(`Performing loan action: ${command} on loan ${loanId}`);
    console.log("Action body:", actionBody);

    // Call Fineract API
    const response = await fetch(
      `${process.env.FINERACT_BASE_URL || "http://10.10.0.143"}/fineract-provider/api/v1/loans/${loanId}?command=${command}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": tenantId,
        },
        body: JSON.stringify(actionBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Fineract loan action error:", errorData);
      return NextResponse.json(
        {
          error: errorData.defaultUserMessage || errorData.error || `Failed to ${action} loan`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("Loan action result:", result);

    return NextResponse.json({
      success: true,
      message: `Loan ${action.replace("_", " ")} successful`,
      result,
    });
  } catch (error: any) {
    console.error("Error performing loan action:", error);
    return NextResponse.json(
      { error: error.message || "Failed to perform loan action" },
      { status: 500 }
    );
  }
}

// Format date to Fineract format (dd MMMM yyyy)
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
