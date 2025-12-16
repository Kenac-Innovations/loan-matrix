import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlug } from "@/lib/tenant-service";

/**
 * GET /api/leads/[id]/complete-details
 * Fetches complete lead information including Fineract client and loan data
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;

    // Extract tenant slug from request for internal API calls
    const host = request.headers.get("host") || "localhost:3000";
    const tenantSlug =
      request.headers.get("x-tenant-slug") || extractTenantSlug(host);

    console.log("=== FETCHING COMPLETE DETAILS FOR LEAD ===");
    console.log("Lead ID:", leadId);
    console.log("Tenant Slug:", tenantSlug);

    // Fetch lead from database
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        currentStage: true,
        familyMembers: true,
        stateTransitions: {
          include: {
            fromStage: true,
            toStage: true,
          },
          orderBy: {
            triggeredAt: "desc",
          },
        },
      },
    });

    if (!lead) {
      console.error("Lead not found in database:", leadId);
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    console.log("Lead found:", {
      id: lead.id,
      name: `${lead.firstname} ${lead.lastname}`,
      fineractClientId: lead.fineractClientId,
      fineractLoanId: lead.fineractLoanId,
    });

    // Log the fineractLoanId value and type
    console.log("Fineract Loan ID details:", {
      value: lead.fineractLoanId,
      type: typeof lead.fineractLoanId,
      isNull: lead.fineractLoanId === null,
      isUndefined: lead.fineractLoanId === undefined,
      truthy: !!lead.fineractLoanId,
    });

    // Parse state metadata to get loan details
    const stateMetadata = lead.stateMetadata as any;
    const loanDetails = stateMetadata?.loanDetails || null;
    const loanTerms = stateMetadata?.loanTerms || null;
    const repaymentSchedule = stateMetadata?.repaymentSchedule || null;
    const signatures = stateMetadata?.signatures || null;
    const cdeResult = stateMetadata?.cdeResult || null;

    // Build response object
    const response: any = {
      lead: {
        id: lead.id,
        firstname: lead.firstname,
        lastname: lead.lastname,
        middlename: lead.middlename,
        emailAddress: lead.emailAddress,
        mobileNo: lead.mobileNo,
        countryCode: lead.countryCode,
        dateOfBirth: lead.dateOfBirth,
        gender: lead.gender,
        officeName: lead.officeName,
        clientTypeName: lead.clientTypeName,
        clientClassificationName: lead.clientClassificationName,
        externalId: lead.externalId,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        status: lead.status,
        creditScore: lead.creditScore,
        annualIncome: lead.annualIncome,
        monthlyIncome: lead.monthlyIncome,
        grossMonthlyIncome: lead.grossMonthlyIncome,
        monthlyIncomeRange: lead.monthlyIncomeRange,
        monthlyExpenses: lead.monthlyExpenses,
        employmentStatus: lead.employmentStatus,
        employerName: lead.employerName,
        yearsEmployed: lead.yearsEmployed,
        yearsAtCurrentJob: lead.yearsAtCurrentJob,
        bankName: lead.bankName,
        existingLoans: lead.existingLoans,
        hasExistingLoans: lead.hasExistingLoans,
        totalDebt: lead.totalDebt,
        monthlyDebtPayments: lead.monthlyDebtPayments,
        propertyOwnership: lead.propertyOwnership,
        businessOwnership: lead.businessOwnership,
        businessType: lead.businessType,
        requestedAmount: lead.requestedAmount,
        // Affordability fields
        nationality: lead.nationality,
        mobileInOwnName: lead.mobileInOwnName,
        hasProofOfIncome: lead.hasProofOfIncome,
        hasValidNationalId: lead.hasValidNationalId,
        identityVerified: lead.identityVerified,
        employmentVerified: lead.employmentVerified,
        incomeVerified: lead.incomeVerified,
        loanPurpose: lead.loanPurpose,
        loanTerm: lead.loanTerm,
        collateralType: lead.collateralType,
        collateralValue: lead.collateralValue,
        riskScore: lead.riskScore,
        riskCategory: lead.riskCategory,
        riskFactors: lead.riskFactors,
        riskAssessmentDate: lead.riskAssessmentDate,
        riskAssessedBy: lead.riskAssessedBy,
        currentStage: lead.currentStage,
        familyMembers: lead.familyMembers,
        stateTransitions: lead.stateTransitions,
        fineractClientId: lead.fineractClientId,
        fineractLoanId: lead.fineractLoanId,
      },
      loanInfo: {
        loanDetails,
        loanTerms,
        repaymentSchedule,
        signatures,
      },
      cdeResult,
      fineractClient: null,
      fineractLoan: null,
    };

    // Fetch Fineract client data if available
    if (lead.fineractClientId) {
      try {
        console.log(
          "Fetching Fineract client data for ID:",
          lead.fineractClientId
        );
        const clientResponse = await fetch(
          `${request.nextUrl.origin}/api/fineract/clients/${lead.fineractClientId}/details`,
          {
            headers: {
              Cookie: request.headers.get("cookie") || "",
              "x-tenant-slug": tenantSlug,
            },
          }
        );

        console.log("Fineract client response status:", clientResponse.status);

        if (clientResponse.ok) {
          response.fineractClient = await clientResponse.json();
          console.log("Fineract client data fetched successfully");
        } else {
          const errorData = await clientResponse.json().catch(() => ({}));
          console.warn(
            `Failed to fetch Fineract client ${lead.fineractClientId}:`,
            clientResponse.status,
            errorData
          );
        }
      } catch (err) {
        console.error("Error fetching Fineract client:", err);
      }
    } else {
      console.log("No Fineract client ID available");
    }

    // Fetch Fineract loan data - try by ID first, then by external ID (lead ID)
    let loanFetched = false;

    // Try fetching by fineractLoanId if available
    if (lead.fineractLoanId) {
      try {
        const loanId = lead.fineractLoanId.toString();
        console.log("Fetching Fineract loan data for ID:", loanId);

        const loanResponse = await fetch(
          `${request.nextUrl.origin}/api/fineract/loans/${loanId}/details`,
          {
            headers: {
              Cookie: request.headers.get("cookie") || "",
              "x-tenant-slug": tenantSlug,
            },
          }
        );

        console.log("Fineract loan response status:", loanResponse.status);

        if (loanResponse.ok) {
          const loanData = await loanResponse.json();
          console.log("Fineract loan data fetched successfully by ID");
          console.log("Loan ID in response:", loanData?.id);
          console.log("Loan account number:", loanData?.accountNo);
          response.fineractLoan = loanData;
          loanFetched = true;
        } else {
          console.warn(
            `Failed to fetch Fineract loan by ID ${loanId}:`,
            loanResponse.status
          );
        }
      } catch (err) {
        console.error("Error fetching Fineract loan by ID:", err);
      }
    }

    // If not fetched by ID, try fetching by external ID (lead ID)
    if (!loanFetched) {
      try {
        console.log(
          "Attempting to fetch loan by external ID (lead ID):",
          leadId
        );
        const externalIdResponse = await fetch(
          `${
            request.nextUrl.origin
          }/api/fineract/loans/by-external-id?externalId=${encodeURIComponent(
            leadId
          )}`,
          {
            headers: {
              Cookie: request.headers.get("cookie") || "",
              "x-tenant-slug": tenantSlug,
            },
          }
        );

        console.log(
          "External ID loan response status:",
          externalIdResponse.status
        );

        if (externalIdResponse.ok) {
          const loanData = await externalIdResponse.json();
          console.log("Fineract loan data fetched successfully by external ID");
          console.log("Loan ID in response:", loanData?.id);
          console.log("Loan account number:", loanData?.accountNo);
          console.log("Loan external ID:", loanData?.externalId);
          response.fineractLoan = loanData;
          loanFetched = true;

          // Also save the loan ID to the lead for future lookups
          if (loanData?.id && leadId) {
            try {
              await prisma.lead.update({
                where: { id: leadId },
                data: { fineractLoanId: loanData.id },
              });
              console.log("Saved fineractLoanId to lead:", loanData.id);
            } catch (updateErr) {
              console.warn("Failed to save fineractLoanId to lead:", updateErr);
            }
          }
        } else {
          console.warn(
            `Failed to fetch Fineract loan by external ID ${leadId}:`,
            externalIdResponse.status
          );
        }
      } catch (err) {
        console.error("Error fetching Fineract loan by external ID:", err);
      }
    }

    if (!loanFetched) {
      console.log("No Fineract loan found by ID or external ID");
      console.log("Lead fineractLoanId value:", lead.fineractLoanId);
    }

    console.log("=== COMPLETE DETAILS RESPONSE READY ===");
    console.log("Has Fineract Client:", !!response.fineractClient);
    console.log("Has Fineract Loan:", !!response.fineractLoan);

    return NextResponse.json(response);
  } catch (error) {
    console.error("=== ERROR FETCHING COMPLETE LEAD DETAILS ===");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("Full error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch complete lead details",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
