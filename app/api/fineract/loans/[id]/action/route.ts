import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { sendLoanStatusSms } from "@/lib/notification-service";

// POST /api/fineract/loans/[id]/action - Perform an action on a loan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();
    const {
      action,
      note,
      approvedOnDate,
      approvedLoanAmount,
      actualDisbursementDate,
    } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    const tenantSlug = extractTenantSlugFromRequest(request);

    // Build the request body based on action
    let actionBody: any = {};
    let command = "";

    switch (action) {
      case "approve":
        command = "approve";
        actionBody = {
          approvedOnDate: formatDate(approvedOnDate || new Date()),
          dateFormat: "dd MMMM yyyy",
          locale: "en",
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
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          note: note || "Loan application rejected",
        };
        break;

      case "disburse":
        command = "disburse";
        actionBody = {
          actualDisbursementDate: formatDate(
            actualDisbursementDate || new Date()
          ),
          dateFormat: "dd MMMM yyyy",
          locale: "en",
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
          dateFormat: "dd MMMM yyyy",
          locale: "en",
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

    let result;
    try {
      result = await fetchFineractAPI(
        `/loans/${loanId}?command=${command}`,
        {
          method: "POST",
          body: JSON.stringify(actionBody),
        }
      );
    } catch (error: any) {
      console.error("Fineract loan action error:", error);
      return NextResponse.json(
        {
          error:
            error?.errorData?.defaultUserMessage ||
            error?.errorData?.error ||
            error?.message ||
            `Failed to ${action} loan`,
          details: error?.errorData || null,
        },
        { status: error?.status || 500 }
      );
    }
    console.log("Loan action result:", result);

    // NOTE: Stage transitions are handled by TeamAwareStateMachineService.executeTransition()
    // which fires Fineract actions as part of the transition. The legacy transitionLeadStage
    // was removed because it bypassed validation and could move leads backwards.

    // Send SMS to applicant for approve / reject / disburse (Loan Matrix loans only)
    if (["approve", "reject", "disburse"].includes(action)) {
      try {
        const tenant = await getTenantBySlug(tenantSlug);
        if (tenant) {
          const lead = await prisma.lead.findFirst({
            where: {
              tenantId: tenant.id,
              fineractLoanId: parseInt(loanId),
            },
            select: {
              firstname: true,
              middlename: true,
              lastname: true,
              mobileNo: true,
              requestedAmount: true,
            },
          });
          if (lead?.mobileNo) {
            const clientName = [lead.firstname, lead.middlename, lead.lastname]
              .filter(Boolean)
              .join(" ");
            const amount = Number(lead.requestedAmount) || 0;
            const smsType =
              action === "approve"
                ? "approved"
                : action === "reject"
                  ? "rejected"
                  : "disbursed";
            await sendLoanStatusSms({
              type: smsType,
              clientName: clientName || "Customer",
              phone: lead.mobileNo,
              amount,
              reason: action === "reject" ? (note || "No reason provided") : undefined,
              tenantId: tenant.slug,
            });
          }
        }
      } catch (smsError) {
        console.error("Failed to send loan status SMS:", smsError);
      }
    }

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
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

