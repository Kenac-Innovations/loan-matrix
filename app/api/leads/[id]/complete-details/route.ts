import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlug } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getFineractService } from "@/lib/fineract-api";

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143";

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

    // Get session for Fineract API calls
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    // Fetch Fineract client data if available
    if (lead.fineractClientId && accessToken) {
      try {
        console.log(
          "Fetching Fineract client data for ID:",
          lead.fineractClientId
        );

        const fineractService = getFineractService(accessToken, tenantSlug);
        const clientData = await fineractService.getClient(
          lead.fineractClientId
        );
        response.fineractClient = clientData;
        console.log("Fineract client data fetched successfully");
      } catch (err) {
        console.error("Error fetching Fineract client:", err);
      }
    } else {
      console.log(
        "No Fineract client ID available or no access token:",
        !lead.fineractClientId ? "missing client ID" : "missing access token"
      );
    }

    // Fetch Fineract loan data by external ID (lead ID)
    let loanFetched = false;

    if (accessToken) {
      const fineractService = getFineractService(accessToken, tenantSlug);

      try {
        console.log("Fetching loan by external ID (lead ID):", leadId);

        // Search for loan by external ID
        const searchUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans?externalId=${encodeURIComponent(
          leadId
        )}`;
        const searchResponse = await fetch(searchUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${accessToken}`,
            "Fineract-Platform-TenantId": tenantSlug,
            Accept: "application/json",
          },
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          let loans = [];
          if (Array.isArray(searchData)) {
            loans = searchData;
          } else if (
            searchData.pageItems &&
            Array.isArray(searchData.pageItems)
          ) {
            loans = searchData.pageItems;
          } else if (searchData.content && Array.isArray(searchData.content)) {
            loans = searchData.content;
          }

          const matchingLoan = loans.find(
            (loan: any) => loan.externalId === leadId
          );

          if (matchingLoan?.id) {
            // Fetch full loan details with associations
            const fullLoanData = await fineractService.getLoan(matchingLoan.id);
            console.log(
              "Fineract loan data fetched successfully by external ID"
            );
            console.log("Loan ID in response:", fullLoanData?.id);
            console.log("Loan account number:", fullLoanData?.accountNo);
            console.log("Has summary:", !!fullLoanData?.summary);
            response.fineractLoan = fullLoanData;
            loanFetched = true;
          } else {
            console.log("No loan found with external ID:", leadId);
          }
        } else {
          console.warn(
            `Failed to search Fineract loans by external ID ${leadId}:`,
            searchResponse.status
          );
        }
      } catch (err) {
        console.error("Error fetching Fineract loan by external ID:", err);
      }
    }

    if (!loanFetched) {
      console.log("No Fineract loan found for lead:", leadId);
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
