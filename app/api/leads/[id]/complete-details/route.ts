import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://mifos-be.kenac.co.zw";

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

    const tenantSlug = extractTenantSlugFromRequest(request);

    console.log("=== FETCHING COMPLETE DETAILS FOR LEAD ===");
    console.log("Lead ID:", leadId);
    console.log("Tenant Slug:", tenantSlug);

    // Fetch lead from database
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        currentStage: true,
        familyMembers: true,
        entityStakeholders: {
          orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
          include: { proofOfResidenceDocument: true },
        },
        entityBankAccounts: { orderBy: { sortOrder: "asc" } },
        stateTransitions: {
          include: {
            fromStage: true,
            toStage: true,
          },
          orderBy: {
            triggeredAt: "desc",
          },
        },
        invoiceDiscountingCase: {
          include: {
            invoices: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
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
      officeId: lead.officeId,
      officeName: lead.officeName,
      genderId: lead.genderId,
      gender: lead.gender,
      clientTypeId: lead.clientTypeId,
      clientTypeName: lead.clientTypeName,
      userId: lead.userId,
      createdByUserName: lead.createdByUserName,
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
        facilityType: lead.facilityType,
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
        stateMetadata: lead.stateMetadata,
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
        // Originator info
        userId: lead.userId,
        createdByUserName: lead.createdByUserName,
        assignedToUserId: lead.assignedToUserId,
        assignedToUserName: lead.assignedToUserName,
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
      invoiceDiscounting: lead.invoiceDiscountingCase || null,
    };

    // Get the Fineract tenant ID early (defaults to the tenant slug unless explicitly mapped)
    const fineractTenantId = await getFineractTenantId();

    // Use service-level credentials (same as page.tsx) for reliable Fineract access
    let fineractService: Awaited<ReturnType<typeof getFineractServiceWithSession>> | null = null;
    let accessToken: string | null = null;
    try {
      fineractService = await getFineractServiceWithSession();
      // Get session token for raw fetch calls
      const session = await getSession();
      accessToken =
        session?.base64EncodedAuthenticationKey || session?.accessToken || null;
      // Fallback to service token for raw fetch calls too
      if (!accessToken) {
        accessToken = "bWlmb3M6cGFzc3dvcmQ=";
      }
    } catch (err) {
      console.error("Failed to init Fineract service:", err);
    }

    if (lead.fineractClientId && fineractService) {
      try {
        console.log(
          "Fetching Fineract client data for ID:",
          lead.fineractClientId
        );

        const clientData = await fineractService.getClient(
          lead.fineractClientId
        );
        response.fineractClient = clientData;
        console.log("Fineract client data fetched successfully by ID");
      } catch (err: any) {
        console.error("Error fetching Fineract client by ID:", err?.status || err?.message);

        // Fallback: search by external ID (NRC) if client ID lookup failed
        if (lead.externalId) {
          try {
            console.log("Trying to find Fineract client by external ID:", lead.externalId);
            const searchUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients?externalId=${encodeURIComponent(lead.externalId)}`;
            const searchResponse = await fetch(searchUrl, {
              method: "GET",
              headers: {
                Authorization: `Basic ${accessToken}`,
                "Fineract-Platform-TenantId": fineractTenantId,
                Accept: "application/json",
              },
              cache: "no-store",
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const clients = Array.isArray(searchData)
                ? searchData
                : searchData?.pageItems || [];
              const matchingClient = clients.find(
                (c: any) => c.externalId === lead.externalId
              );
              if (matchingClient?.id) {
                const fullClient = await fineractService.getClient(matchingClient.id);
                response.fineractClient = fullClient;
                console.log("Fineract client found by external ID:", matchingClient.id);
              }
            }
          } catch (searchErr) {
            console.error("Error searching Fineract client by external ID:", searchErr);
          }
        }
      }
    } else if (!lead.fineractClientId && lead.externalId && fineractService) {
      // No fineractClientId stored, try searching by external ID
      try {
        console.log("No fineractClientId, searching by external ID:", lead.externalId);
        const searchUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients?externalId=${encodeURIComponent(lead.externalId)}`;
        const searchResponse = await fetch(searchUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${accessToken}`,
            "Fineract-Platform-TenantId": fineractTenantId,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const clients = Array.isArray(searchData)
            ? searchData
            : searchData?.pageItems || [];
          const matchingClient = clients.find(
            (c: any) => c.externalId === lead.externalId
          );
          if (matchingClient?.id) {
            const fullClient = await fineractService.getClient(matchingClient.id);
            response.fineractClient = fullClient;
            console.log("Fineract client found by external ID:", matchingClient.id);
          }
        }
      } catch (searchErr) {
        console.error("Error searching Fineract client by external ID:", searchErr);
      }
    } else {
      console.log(
        "No Fineract client ID available or no access token:",
        !lead.fineractClientId ? "missing client ID" : "missing access token"
      );
    }

    // Enrich lead response from Fineract client data (Fineract is source of truth)
    if (response.fineractClient) {
      const clientData = response.fineractClient;
      if (clientData.firstname) {
        response.lead.firstname = clientData.firstname;
      }
      if (clientData.lastname) {
        response.lead.lastname = clientData.lastname;
      }
      if (clientData.externalId) {
        response.lead.externalId = clientData.externalId;
      }
      if (clientData.mobileNo) {
        response.lead.mobileNo = clientData.mobileNo;
      }
      if (clientData.dateOfBirth) {
        response.lead.dateOfBirth = clientData.dateOfBirth;
      }
      if (clientData.gender?.name) {
        response.lead.gender = clientData.gender.name;
      }
      if (clientData.officeName) {
        response.lead.officeName = clientData.officeName;
      }
      if (clientData.clientType?.name) {
        response.lead.clientTypeName = clientData.clientType.name;
      }
      if (clientData.clientClassification?.name) {
        response.lead.clientClassificationName = clientData.clientClassification.name;
      }
    }

    // If still missing names, resolve from Fineract APIs using stored IDs
    if (fineractService && (!response.lead.gender || !response.lead.officeName || !response.lead.clientTypeName)) {
      try {
        const templateUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients/template`;
        const fineractHeaders = {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json",
        };

        const fetchOpts = { method: "GET" as const, headers: fineractHeaders, cache: "no-store" as const };

        const [templateResponse, officesResponse] = await Promise.all([
          fetch(templateUrl, fetchOpts),
          !response.lead.officeName && lead.officeId
            ? fetch(`${FINERACT_BASE_URL}/fineract-provider/api/v1/offices`, fetchOpts)
            : Promise.resolve(null),
        ]);

        if (templateResponse.ok) {
          const template = await templateResponse.json();

          if (!response.lead.gender && lead.genderId && template.genderOptions) {
            const gender = template.genderOptions.find((g: any) => g.id === lead.genderId);
            if (gender) response.lead.gender = gender.name;
          }
          if (!response.lead.clientTypeName && lead.clientTypeId && template.clientTypeOptions) {
            const clientType = template.clientTypeOptions.find((t: any) => t.id === lead.clientTypeId);
            if (clientType) response.lead.clientTypeName = clientType.name;
          }
          if (!response.lead.clientClassificationName && lead.clientClassificationId && template.clientClassificationOptions) {
            const classification = template.clientClassificationOptions.find((c: any) => c.id === lead.clientClassificationId);
            if (classification) response.lead.clientClassificationName = classification.name;
          }
        }

        if (officesResponse?.ok) {
          const offices = await officesResponse.json();
          const officeList = Array.isArray(offices) ? offices : [];
          const office = officeList.find((o: any) => o.id === lead.officeId);
          if (office) response.lead.officeName = office.name;
        }

        console.log("Resolved from Fineract:", {
          gender: response.lead.gender,
          officeName: response.lead.officeName,
          clientTypeName: response.lead.clientTypeName,
        });
      } catch (templateErr) {
        console.error("Error fetching Fineract template for name resolution:", templateErr);
      }
    }

    // Resolve userId to a display name if createdByUserName is missing
    if (!response.lead.createdByUserName && lead.userId && accessToken) {
      const numericId = Number(lead.userId);
      if (!Number.isNaN(numericId)) {
        try {
          const userUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/users/${numericId}`;
          const userResponse = await fetch(userUrl, {
            method: "GET",
            headers: {
              Authorization: `Basic ${accessToken}`,
              "Fineract-Platform-TenantId": fineractTenantId,
              Accept: "application/json",
            },
            cache: "no-store",
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            const displayName =
              [userData.firstname, userData.lastname].filter(Boolean).join(" ") ||
              userData.username ||
              lead.userId;
            response.lead.createdByUserName = displayName;
          }
        } catch (userErr) {
          console.error("Error fetching Fineract user for originator:", userErr);
        }
      }
    }

    // Fetch Fineract loan data by external ID (lead ID)
    let loanFetched = false;

    if (fineractService) {
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
            "Fineract-Platform-TenantId": fineractTenantId,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        console.log("Loan search response status:", searchResponse.status);

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log("Loan search raw data type:", typeof searchData);
          console.log(
            "Loan search raw data:",
            JSON.stringify(searchData).substring(0, 1000)
          );

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

          console.log("=== LOAN SEARCH RESULTS ===");
          console.log("Loans array length:", loans.length);
          console.log("Looking for loan with externalId:", leadId);

          // Log all loans returned for debugging
          loans.forEach((loan: any, index: number) => {
            console.log(
              `Loan ${index}: id=${loan.id}, externalId=${loan.externalId}, clientId=${loan.clientId}, accountNo=${loan.accountNo}`
            );
          });

          // Find loan that EXACTLY matches the external ID
          const matchingLoan = loans.find(
            (loan: any) => loan.externalId === leadId
          );

          console.log("Matching loan found:", !!matchingLoan);
          if (matchingLoan) {
            console.log("Matched loan details:", {
              id: matchingLoan.id,
              externalId: matchingLoan.externalId,
              clientId: matchingLoan.clientId,
              accountNo: matchingLoan.accountNo,
            });
          }

          if (matchingLoan?.id) {
            // Fetch full loan details with associations
            const fullLoanData = await fineractService.getLoan(matchingLoan.id);
            console.log(
              "Fineract loan data fetched successfully by external ID"
            );
            console.log("Loan ID in response:", fullLoanData?.id);
            console.log("Loan account number:", fullLoanData?.accountNo);
            console.log("Loan external ID:", fullLoanData?.externalId);
            console.log("Loan client ID:", fullLoanData?.clientId);
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

    // Fallback: fetch loan directly by stored fineractLoanId if external ID search failed
    if (!loanFetched && lead.fineractLoanId && fineractService) {
      try {
        console.log("Fetching loan directly by stored fineractLoanId:", lead.fineractLoanId);
        const fullLoanData = await fineractService.getLoan(lead.fineractLoanId);
        if (fullLoanData) {
          response.fineractLoan = fullLoanData;
          loanFetched = true;
          console.log("Fineract loan fetched by stored ID:", fullLoanData.id);
        }
      } catch (loanErr) {
        console.error("Error fetching loan by stored ID:", loanErr);
      }
    }

    if (!loanFetched) {
      console.log("No Fineract loan found for lead:", leadId);
    }

    // Auto-sync pipeline stage based on Fineract loan status
    if (response.fineractLoan?.status?.value && lead.tenantId) {
      const fineractStatus = response.fineractLoan.status.value.toLowerCase();
      let targetStageName: string | null = null;

      // Map Fineract status to pipeline stage
      if (fineractStatus.includes("reject") || fineractStatus.includes("withdrawn")) {
        targetStageName = "Rejected";
      } else if (fineractStatus.includes("active") || fineractStatus.includes("closed")) {
        targetStageName = "Disbursement";
      } else if (fineractStatus.includes("approved")) {
        targetStageName = "Approval";
      }

      // Check if stage needs to be updated
      if (targetStageName && lead.currentStage?.name !== targetStageName) {
        console.log(`Auto-sync: Fineract status "${fineractStatus}" should be stage "${targetStageName}", current: "${lead.currentStage?.name}"`);
        
        try {
          // Find the target stage
          const targetStage = await prisma.pipelineStage.findFirst({
            where: { tenantId: lead.tenantId, name: targetStageName },
          });

          if (targetStage) {
            // Update the lead's stage
            await prisma.lead.update({
              where: { id: lead.id },
              data: { currentStageId: targetStage.id },
            });

            // Update the response with corrected stage
            response.lead.currentStage = targetStage;
            console.log(`Auto-sync: Updated lead ${lead.id} to stage "${targetStageName}"`);
          }
        } catch (syncErr) {
          console.error("Auto-sync error:", syncErr);
          // Don't fail the request if auto-sync fails
        }
      }
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
