import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { format } from "date-fns";
import { getSession } from "@/lib/auth";
import { callCDEAndStore } from "@/lib/cde-utils";
import { sendLoanStatusSms } from "@/lib/notification-service";
import { createLoanCharge } from "@/lib/fineract-loan-charge";
import { filterInitialLoanChargesForTopup } from "@/lib/topup-disbursement-charge-service";

/**
 * POST /api/leads/[id]/create-loan
 * Creates a Fineract loan from a manual lead and returns the core response.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = id;

    // Get the current session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load lead by ID
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Get loan details from request body
    const loanData = await request.json();

    if (!loanData.clientId || !loanData.productId || !loanData.principal) {
      return NextResponse.json(
        {
          error:
            "Missing required loan data: clientId, productId, and principal are required",
        },
        { status: 400 }
      );
    }

    // Determine submitted, expected disbursement, and first repayment dates
    const submittedDate = loanData.submittedOn
      ? new Date(loanData.submittedOn)
      : new Date();
    const disbursementDate = loanData.disbursementOn
      ? new Date(loanData.disbursementOn)
      : new Date();
    const firstRepaymentDate = loanData.firstRepaymentOn
      ? new Date(loanData.firstRepaymentOn)
      : null;

    const dateStr = format(submittedDate, "yyyy-MM-dd");
    const disbursementDateStr = format(disbursementDate, "yyyy-MM-dd");

    const isInvoiceDiscountingLead = lead.facilityType === "INVOICE_DISCOUNTING";

    const requestedCharges = Array.isArray(loanData.charges)
      ? loanData.charges
      : [];
    const isTopup = Boolean(loanData.isTopup && loanData.loanIdToClose);
    const initialLoanCharges = isInvoiceDiscountingLead
      ? []
      : await filterInitialLoanChargesForTopup({
          tenantId: lead.tenantId,
          isTopup,
          charges: requestedCharges,
        });

    // Build loan payload
    const payload: any = {
      clientId: loanData.clientId,
      productId: loanData.productId,
      principal: loanData.principal,
      loanTermFrequency: loanData.loanTermFrequency || 12,
      loanTermFrequencyType: 2, // Months
      numberOfRepayments: loanData.numberOfRepayments || 12,
      repaymentEvery: loanData.repaymentEvery || 1,
      repaymentFrequencyType: 2, // Months
      interestRatePerPeriod: loanData.interestRatePerPeriod || 7,
      interestRateFrequencyType: 2, // Per month
      interestType: 0, // Flat
      amortizationType: 1, // Equal installments
      interestCalculationPeriodType: 1, // Same as repayment period
      transactionProcessingStrategyCode: "creocore-strategy",
      submittedOnDate: dateStr,
      expectedDisbursementDate: disbursementDateStr,
      ...(firstRepaymentDate && {
        repaymentsStartingFromDate: format(firstRepaymentDate, "yyyy-MM-dd"),
      }),
      locale: "en",
      dateFormat: "yyyy-MM-dd",
      // Use lead ID as initial external ID, will be updated to loan ID after creation
      externalId: leadId,
      allowPartialPeriodInterestCalcualtion: false,
      isEqualAmortization: false,
      charges: initialLoanCharges.map((charge: any) => {
            const chargePayload: any = {
              chargeId: charge.chargeId,
              amount: charge.amount,
            };

            if (charge.dueDate) {
              chargePayload.dueDate = charge.dueDate;
            }

            return chargePayload;
          }),
      collateral: [],
      loanType: "individual",
      ...(isTopup
        ? { isTopup: true, loanIdToClose: parseInt(loanData.loanIdToClose) }
        : {}),
    };

    // Add optional fields if provided
    if (loanData.loanPurpose) {
      payload.loanPurposeId = loanData.loanPurpose;
    }

    if (loanData.loanOfficer) {
      payload.loanOfficerId = loanData.loanOfficer;
    }

    if (loanData.fund) {
      payload.fundId = loanData.fund;
    }

    // POST to Fineract /loans
    const result = await fetchFineractAPI("/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Set external ID to loan ID for future reference
    if (result && result.resourceId) {
      const loanId = result.resourceId;

      if (isInvoiceDiscountingLead && requestedCharges.length > 0) {
        for (const charge of requestedCharges) {
          const chargePayload: any = {
            chargeId: charge.chargeId,
            amount: charge.amount,
            locale: "en",
            externalId: "",
            note: "",
            paymentTypeId: "",
          };

          if (charge.dueDate) {
            chargePayload.dueDate = charge.dueDate;
            chargePayload.dateFormat = "dd MMMM yyyy";
          }

          await createLoanCharge(Number(loanId), chargePayload);
        }
      }

      // Update the loan with the external ID set to the loan ID
      try {
        await fetchFineractAPI(`/loans/${loanId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalId: String(loanId),
            locale: "en",
            dateFormat: "yyyy-MM-dd",
          }),
        });

        console.log(`Updated loan ${loanId} with external ID set to loan ID`);

        // Update the lead with loan ID, client ID, and submission tracking
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            fineractLoanId: loanId,
            loanSubmittedToFineract: true,
            loanSubmissionDate: new Date(),
            fineractClientId: loanData.clientId,
            clientCreatedInFineract: true,
            clientCreationDate: lead.clientCreationDate || new Date(),
            stateMetadata: {
              ...((lead.stateMetadata as any) || {}),
              loanId: loanId,
              loanCreatedAt: new Date().toISOString(),
            },
          },
        });
      } catch (updateError) {
        console.error("Failed to update loan external ID:", updateError);
        // Don't fail the entire operation if external ID update fails
      }
    }

    // Send SMS: loan submitted, pending approval (best-effort)
    if (result?.resourceId && lead?.mobileNo) {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: lead.tenantId },
          select: { slug: true },
        });
        const clientName = [lead.firstname, lead.middlename, lead.lastname]
          .filter(Boolean)
          .join(" ");
        await sendLoanStatusSms({
          type: "pending_approval",
          clientName: clientName || "Customer",
          phone: lead.mobileNo,
          amount: Number(loanData.principal) || 0,
          tenantId: tenant?.slug,
        });
      } catch (smsError) {
        console.error("Failed to send pending-approval SMS:", smsError);
      }
    }

    // Call CDE to evaluate the loan application after loan creation
    try {
      console.log("=== CALLING CDE AFTER LOAN CREATION ===");
      // For server-side calls, we can use a relative URL or construct from headers
      const cdeResult = await callCDEAndStore(leadId);
      if (cdeResult) {
        console.log("CDE evaluation completed:", cdeResult.decision);
      }
    } catch (cdeError) {
      console.error("Error calling CDE after loan creation:", cdeError);
      // Don't fail the request if CDE call fails
    }

    return NextResponse.json({
      success: true,
      coreResponse: result,
      loanId: result?.resourceId,
    });
  } catch (error: any) {
    console.error("Error creating loan from lead:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(
        {
          error: error.message,
          status: error.status,
          errorData: error.errorData,
        },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
