import { prisma } from "@/lib/prisma";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getAccessToken } from "@/lib/api";

/**
 * Build CDE evaluation payload from lead data
 */
export function buildCDEPayload(
  lead: any,
  additionalData?: any,
  fineractLoan?: any
) {
  console.log("Fineract Loan:", fineractLoan);
  // Calculate age from date of birth
  const calculateAge = (dob: Date | string | null): number | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  // Map employment status to CDE format
  const mapEmploymentType = (status: string | null): string => {
    if (!status) return "UNEMPLOYED";
    const s = status.toUpperCase();
    if (s.includes("SELF") || s.includes("BUSINESS")) return "SELF_EMPLOYED";
    if (s.includes("FULL_TIME") || s.includes("FULLTIME")) return "FULL_TIME";
    if (s.includes("PART_TIME") || s.includes("PARTTIME")) return "PART_TIME";
    if (s.includes("CONTRACT")) return "CONTRACT";
    if (s.includes("CASUAL")) return "CASUAL";
    return "FULL_TIME";
  };

  // Map ID type
  const mapIdType = (idType: string | null): string => {
    if (!idType) return "NATIONAL_ID";
    const t = idType.toUpperCase();
    if (t.includes("NATIONAL") || t.includes("NRC")) return "NATIONAL_ID";
    if (t.includes("PASSPORT")) return "PASSPORT";
    if (t.includes("DRIVER")) return "DRIVERS_LICENSE";
    return "NATIONAL_ID";
  };

  const age = calculateAge(lead.dateOfBirth);
  const employmentLengthMonths = lead.yearsEmployed
    ? Math.round(lead.yearsEmployed * 12)
    : additionalData?.employmentLengthMonths || 0;

  // Map employment type to income type
  const mapIncomeType = (employmentType: string): string => {
    if (!employmentType) return "SALARIED";
    const e = employmentType.toUpperCase();
    if (e.includes("SELF") || e.includes("BUSINESS")) return "SELF_EMPLOYED";
    if (e.includes("FULL_TIME") || e.includes("FULLTIME")) return "SALARIED";
    if (e.includes("PART_TIME") || e.includes("PARTTIME")) return "SALARIED";
    return "SALARIED";
  };

  // Get Fineract loan ID for mifosLoanId
  const mifosLoanId =
    fineractLoan?.id?.toString() ||
    (lead.stateMetadata as any)?.loanId?.toString() ||
    lead.externalId ||
    lead.id;

  // Get currency from Fineract loan, default to ZMK
  const currency =
    fineractLoan?.currency?.code || fineractLoan?.currency?.nameCode || "ZMK";

  // Get requested amount from Fineract loan (principal) if available, otherwise from lead
  const requestedAmount =
    fineractLoan?.principal ||
    fineractLoan?.approvedPrincipal ||
    fineractLoan?.proposedPrincipal ||
    (lead.requestedAmount && lead.requestedAmount > 0
      ? lead.requestedAmount
      : null) ||
    0;

  // Get requested term from Fineract loan if available
  const requestedTerm =
    fineractLoan?.numberOfRepayments ||
    fineractLoan?.termFrequency ||
    lead.loanTerm ||
    12;

  // Remove spaces from phone number
  const mobileNumber = lead.mobileNo
    ? `${lead.countryCode || "+263"}${lead.mobileNo.replace(/\s+/g, "")}`
    : "";

  const payload = {
    mifosLoanId: mifosLoanId,
    applicant: {
      firstName: lead.firstname || "",
      lastName: lead.lastname || "",
      nationality: lead.nationality || "Zimbabwean",
      idType: mapIdType(lead.idType),
      idNumber: lead.idNumber || lead.externalId || "",
      dateOfBirth: lead.dateOfBirth
        ? new Date(lead.dateOfBirth).toISOString().split("T")[0]
        : null,
      age: age || null,
      mobileNumber: mobileNumber,
      mobileInOwnName:
        lead.mobileInOwnName || additionalData?.mobileInOwnName || false,
      email: lead.emailAddress || "",
      address: lead.address || lead.residentialAddress || "",
      employmentType: mapEmploymentType(lead.employmentStatus),
      employer: lead.employerName || lead.employmentStatus || "",
      employmentLengthMonths: employmentLengthMonths,
      incomeType: mapIncomeType(lead.employmentStatus),
      occupation: lead.occupation || "",
      industry: lead.industry || "",
      grossMonthlyIncome:
        additionalData?.grossMonthlyIncome || lead.grossMonthlyIncome || 0,
      netMonthlyIncome:
        additionalData?.netMonthlyIncome || lead.monthlyIncome || 0,
      existingDebts: [],
      totalMonthlyDebtPayments:
        additionalData?.monthlyDebtPayments ||
        lead.monthlyExpenses ||
        lead.totalDebt ||
        0,
      creditScore: 0,
      providedDocuments: [],
      payslipsProvided: 0,
      hasBankStatements: lead.hasBankStatements || false,
      bankStatementMonths: 0,
      hasValidNationalId: !!lead.idNumber,
      soundMind: true,
      hasProofOfIncome:
        lead.hasProofOfIncome || additionalData?.hasProofOfIncome || false,
      collateralOffered: (lead.collateralValue || 0) > 0,
      identityVerified: !!lead.idNumber,
      employmentVerified: false,
      incomeVerified:
        lead.incomeVerified || additionalData?.incomeVerified || false,
    },
    loanProductType: "TERM",
    requestedAmount: requestedAmount,
    requestedTerm: requestedTerm,
    currency: currency,
    channel: "WEB",
  };

  return payload;
}

/**
 * Fetch Fineract loan details for a lead
 */
export async function fetchFineractLoanForLead(lead: any): Promise<any> {
  try {
    const stateMetadata = (lead.stateMetadata as any) || {};
    console.log("=== FETCHING FINERACT LOAN FOR CDE ===");
    console.log("Lead ID:", lead.id);
    console.log("Lead External ID:", lead.externalId);
    console.log("State Metadata:", JSON.stringify(stateMetadata, null, 2));

    // Try multiple sources for loan ID
    // 1. Check stateMetadata.loanId (set when loan is created)
    // 2. Check if complete-details stored it elsewhere in stateMetadata
    const loanId = stateMetadata.loanId || stateMetadata.fineractLoanId || null;

    console.log("Loan ID from stateMetadata.loanId:", stateMetadata.loanId);
    console.log(
      "Loan ID from stateMetadata.fineractLoanId:",
      stateMetadata.fineractLoanId
    );
    console.log("Final loanId to use:", loanId);

    if (!loanId) {
      console.log(
        "No loan ID found - trying to fetch by external ID using lead ID"
      );

      // Try fetching by external ID using the lead ID
      // The loan's external ID is set to the lead ID when created
      if (lead.id) {
        try {
          const accessToken = await getAccessToken();
          const fineractTenantId = await getFineractTenantId();
          const baseUrl =
            process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

          if (accessToken) {
            // Use lead ID as the external ID to search for the loan
            const searchUrl = `${baseUrl}/fineract-provider/api/v1/loans?externalId=${encodeURIComponent(
              lead.id
            )}&associations=all`;
            console.log(
              "Trying to fetch loan by external ID (lead ID):",
              searchUrl
            );

            const loanResponse = await fetch(searchUrl, {
              method: "GET",
              headers: {
                Authorization: `Basic ${accessToken}`,
                "Fineract-Platform-TenantId": fineractTenantId,
                Accept: "application/json",
              },
            });

            if (loanResponse.ok) {
              const searchData = await loanResponse.json();

              // Handle different response formats
              let loans = [];
              if (Array.isArray(searchData)) {
                loans = searchData;
              } else if (
                searchData.pageItems &&
                Array.isArray(searchData.pageItems)
              ) {
                loans = searchData.pageItems;
              } else if (
                searchData.content &&
                Array.isArray(searchData.content)
              ) {
                loans = searchData.content;
              }

              // Find the loan that matches the lead ID exactly
              const matchingLoan = loans.find(
                (loan: any) => loan.externalId === lead.id
              );

              if (matchingLoan) {
                console.log("Fineract loan found by external ID (lead ID):", {
                  id: matchingLoan.id,
                  accountNo: matchingLoan.accountNo,
                  externalId: matchingLoan.externalId,
                });

                // Fetch full details if we only got basic info
                if (matchingLoan.id) {
                  try {
                    const detailsUrl = `${baseUrl}/fineract-provider/api/v1/loans/${matchingLoan.id}?associations=all`;
                    const detailsResponse = await fetch(detailsUrl, {
                      method: "GET",
                      headers: {
                        Authorization: `Basic ${accessToken}`,
                        "Fineract-Platform-TenantId": fineractTenantId,
                        Accept: "application/json",
                      },
                    });

                    if (detailsResponse.ok) {
                      const fullLoanData = await detailsResponse.json();
                      console.log("Full loan details fetched successfully");
                      return fullLoanData;
                    }
                  } catch (err) {
                    console.warn(
                      "Could not fetch full loan details, using search result:",
                      err
                    );
                  }
                }

                return matchingLoan;
              } else {
                console.log(
                  "No loan found matching external ID (lead ID):",
                  lead.id
                );
              }
            } else {
              console.log(
                "Failed to fetch loan by external ID:",
                loanResponse.status
              );
            }
          }
        } catch (extError) {
          console.warn("Error fetching loan by external ID:", extError);
        }
      }

      console.log("No loan ID found in lead stateMetadata or by external ID");
      return null;
    }

    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();
    const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

    if (!accessToken) {
      console.warn("No access token available to fetch Fineract loan");
      return null;
    }

    const loanUrl = `${baseUrl}/fineract-provider/api/v1/loans/${loanId}`;
    console.log("Fetching Fineract loan details for CDE:", loanUrl);

    const loanResponse = await fetch(loanUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        Accept: "application/json",
      },
    });

    if (loanResponse.ok) {
      const fineractLoan = await loanResponse.json();
      console.log("Fineract loan fetched for CDE:", {
        id: fineractLoan.id,
        accountNo: fineractLoan.accountNo,
        currency: fineractLoan.currency?.code,
        principal: fineractLoan.principal,
        approvedPrincipal: fineractLoan.approvedPrincipal,
        proposedPrincipal: fineractLoan.proposedPrincipal,
        numberOfRepayments: fineractLoan.numberOfRepayments,
      });
      return fineractLoan;
    } else {
      console.warn(
        "Failed to fetch Fineract loan for CDE:",
        loanResponse.status
      );
      return null;
    }
  } catch (loanError) {
    console.warn("Error fetching Fineract loan for CDE:", loanError);
    return null;
  }
}

/**
 * Call CDE API and store result in lead stateMetadata
 */
export async function callCDEAndStore(
  leadId: string,
  requestOrigin?: string
): Promise<any> {
  try {
    // Get the lead with all necessary data, including fineractLoanId if it exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      console.error("Lead not found for CDE evaluation:", leadId);
      return null;
    }

    console.log("Lead fetched for CDE:", {
      id: lead.id,
      fineractLoanId: (lead as any).fineractLoanId,
      stateMetadata: (lead.stateMetadata as any) || {},
    });

    // Fetch Fineract loan details if available
    const fineractLoan = await fetchFineractLoanForLead(lead);

    // Build CDE payload with Fineract loan data if available
    const cdePayload = buildCDEPayload(lead, undefined, fineractLoan);
    console.log("\n==========================================");
    console.log("=== CDE API CALL - PAYLOAD ===");
    console.log("==========================================");
    console.log("Lead ID:", leadId);
    console.log("Lead External ID:", lead.externalId);
    console.log("\n--- FULL CDE PAYLOAD ---");
    console.log(JSON.stringify(cdePayload, null, 2));
    console.log("\n--- PAYLOAD SUMMARY ---");
    console.log("Mifos Loan ID (Account No):", cdePayload.mifosLoanId);
    console.log("Currency:", cdePayload.currency);
    console.log(
      "Applicant:",
      `${cdePayload.applicant.firstName} ${cdePayload.applicant.lastName}`
    );
    console.log(
      "Mobile Number (spaces removed):",
      cdePayload.applicant.mobileNumber
    );
    console.log("Requested Amount:", cdePayload.requestedAmount);
    console.log("Requested Term:", cdePayload.requestedTerm, "months");
    console.log(
      "Gross Monthly Income:",
      cdePayload.applicant.grossMonthlyIncome
    );
    console.log("Net Monthly Income:", cdePayload.applicant.netMonthlyIncome);
    console.log(
      "Total Monthly Debt:",
      cdePayload.applicant.totalMonthlyDebtPayments
    );
    console.log("Employment Type:", cdePayload.applicant.employmentType);
    console.log("Income Type:", cdePayload.applicant.incomeType);
    console.log("==========================================\n");

    // Get tenant ID from headers
    const tenantId = await getFineractTenantId();
    console.log("CDE Tenant ID:", tenantId);

    // For server-side calls, call the CDE validate endpoint directly
    // CDE API structure: /api/v1/{tenantId}/loans/validate
    const CDE_BASE_URL = process.env.CDE_BASE_URL || "http://localhost:8090";
    const cdeUrl = `${CDE_BASE_URL}/api/v1/${tenantId}/loans/validate`;

    console.log("CDE URL:", cdeUrl);

    // Call CDE service directly
    const cdeResponse = await fetch(cdeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: JSON.stringify(cdePayload),
    });

    console.log("CDE Response Status:", cdeResponse.status);

    if (!cdeResponse.ok) {
      const errorText = await cdeResponse.text();
      console.error("CDE Error Response:", errorText);
      return null;
    }

    const cdeResult = await cdeResponse.json();
    console.log("=== CDE EVALUATION RESULT ===");
    console.log("Decision:", cdeResult.decision);
    console.log("Credit Score:", cdeResult.scoringResult?.creditScore);
    console.log("Recommendation:", cdeResult.recommendation);

    // Get current stateMetadata
    const currentMetadata = ((lead as any).stateMetadata as any) || {};

    // Store CDE result in stateMetadata
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        stateMetadata: {
          ...currentMetadata,
          cdeResult: cdeResult,
          cdeEvaluatedAt: new Date().toISOString(),
        },
      },
    });

    console.log("CDE result stored in lead stateMetadata");
    console.log(
      "⚠️  Manual review required - CDE result is a recommendation only"
    );

    return cdeResult;
  } catch (error) {
    console.error("Error calling CDE:", error);
    return null;
  }
}
