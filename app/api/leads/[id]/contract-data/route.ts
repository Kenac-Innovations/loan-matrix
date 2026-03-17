import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";
import { format } from "date-fns";
import { fetchFineractAPI } from "@/lib/api";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("Fetching contract data for leadId:", leadId);

    const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";
    console.log("Tenant slug:", tenantSlug);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      console.error("Tenant not found for slug:", tenantSlug);
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    console.log("Tenant found:", tenant.id, tenant.slug);

    // Fetch lead with all necessary data (without tenant filter for compatibility)
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        // Tenant
        tenantId: true,

        // Client information
        firstname: true,
        middlename: true,
        lastname: true,
        externalId: true,
        dateOfBirth: true,
        gender: true,
        genderId: true,
        fineractClientId: true,
        officeName: true,

        // Loan details
        loanProductName: true,
        loanProductId: true,
        loanPurpose: true,
        loanPurposeId: true,
        loanOfficerId: true,
        fundId: true,
        submittedOnDate: true,
        expectedDisbursementDate: true,

        // Affordability
        monthlyIncome: true,
        grossMonthlyIncome: true,

        // State metadata (contains loan terms)
        stateMetadata: true,
      },
    });

    if (!lead) {
      console.error("Lead not found with ID:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 },
      );
    }

    console.log("Lead found:", leadId);

    // Warn if tenant mismatch (but don't block the request)
    if (lead.tenantId !== tenant.id) {
      console.warn(
        `⚠️ Tenant mismatch for lead ${leadId}: lead.tenantId=${lead.tenantId}, expected=${tenant.id}`,
      );
    }

    // Fetch loan details
    console.log("Fetching loan details...");
    const loanDetailsResponse = await fetch(
      `${request.nextUrl.origin}/api/leads/${leadId}/loan-details`,
      {
        headers: {
          "x-tenant-slug": tenantSlug,
        },
      },
    );
    const loanDetailsResult = await loanDetailsResponse.json();
    const loanDetails = loanDetailsResult.success
      ? loanDetailsResult.data
      : null;
    console.log("Loan details fetched:", loanDetails ? "Found" : "Not found");

    // Fetch loan terms
    console.log("Fetching loan terms...");
    const loanTermsResponse = await fetch(
      `${request.nextUrl.origin}/api/leads/${leadId}/loan-terms`,
      {
        headers: {
          "x-tenant-slug": tenantSlug,
        },
      },
    );
    const loanTermsResult = await loanTermsResponse.json();
    const loanTerms = loanTermsResult.success ? loanTermsResult.data : null;
    console.log("Loan terms fetched:", loanTerms ? "Found" : "Not found");

    // Check if we have the minimum required data
    if (!lead.fineractClientId) {
      console.error("Missing fineractClientId");
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing Fineract Client ID. Please complete the client details first.",
        },
        { status: 400 },
      );
    }

    if (!lead.loanProductId && !loanDetails?.productId) {
      console.error("Missing loanProductId");
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing loan product information. Please complete the loan details first.",
        },
        { status: 400 },
      );
    }

    if (!loanTerms) {
      console.error("Missing loan terms");
      return NextResponse.json(
        {
          success: false,
          error: "Missing loan terms. Please complete the loan terms first.",
        },
        { status: 400 },
      );
    }

    // Fetch Fineract client details to get gender and other client info
    let fineractClient: any = null;
    if (lead.fineractClientId) {
      try {
        console.log("Fetching Fineract client details for gender...");
        const clientDetailsResponse = await fetch(
          `${request.nextUrl.origin}/api/fineract/clients/${lead.fineractClientId}`,
          {
            headers: {
              "x-tenant-slug": tenantSlug,
            },
          },
        );
        if (clientDetailsResponse.ok) {
          fineractClient = await clientDetailsResponse.json();
          console.log(
            "Fineract client fetched, gender:",
            fineractClient?.gender,
          );
        }
      } catch (err) {
        console.error("Error fetching Fineract client details:", err);
      }
    }

    // Fetch client template to get gender options (fallback)
    let clientTemplate: any = null;
    try {
      const clientTemplateResponse = await fetch(
        `${request.nextUrl.origin}/api/fineract/clients/template`,
        {
          headers: {
            "x-tenant-slug": tenantSlug,
          },
        },
      );
      if (clientTemplateResponse.ok) {
        clientTemplate = await clientTemplateResponse.json();
      }
    } catch (err) {
      console.error("Error fetching client template:", err);
    }

    // Fetch loan template for additional info
    let loanTemplate: any = null;
    if (lead.fineractClientId && loanDetails?.productId) {
      try {
        const templateResponse = await fetch(
          `${request.nextUrl.origin}/api/fineract/loans/template?clientId=${lead.fineractClientId}&productId=${loanDetails.productId}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`,
          {
            headers: {
              "x-tenant-slug": tenantSlug,
            },
          },
        );
        if (templateResponse.ok) {
          loanTemplate = await templateResponse.json();
        }
      } catch (err) {
        console.error("Error fetching loan template:", err);
      }
    }

    // Calculate repayment schedule
    let repaymentSchedule: any = null;
    if (loanTerms && loanDetails && loanTemplate) {
      try {
        const submittedDate = loanDetails.submittedOn
          ? format(new Date(loanDetails.submittedOn), "dd MMMM yyyy")
          : format(new Date(), "dd MMMM yyyy");

        const disbursementDate = loanDetails.disbursementOn
          ? format(new Date(loanDetails.disbursementOn), "dd MMMM yyyy")
          : format(new Date(), "dd MMMM yyyy");

        const charges = (loanTerms.charges || []).map((charge: any) => ({
          chargeId: charge.chargeId,
          amount: charge.amount,
          dueDate: charge.dueDate,
        }));

        const payload = {
          productId: parseInt(loanDetails.productId, 10),
          loanOfficerId: loanDetails.loanOfficer || "",
          loanPurposeId: loanDetails.loanPurpose || "",
          fundId: loanDetails.fund || "",
          submittedOnDate: submittedDate,
          expectedDisbursementDate: disbursementDate,
          externalId: "",
          linkAccountId: loanDetails.linkSavings || "",
          createStandingInstructionAtDisbursement:
            loanDetails.createStandingInstructions ? "true" : "",
          loanTermFrequency: loanTerms.loanTerm || 1,
          loanTermFrequencyType: loanTerms.termFrequency
            ? parseInt(loanTerms.termFrequency)
            : loanTemplate?.termPeriodFrequencyType?.id || 2,
          numberOfRepayments: loanTerms.numberOfRepayments || 1,
          repaymentEvery: loanTerms.repaymentEvery || 1,
          repaymentFrequencyType: loanTerms.repaymentFrequency
            ? parseInt(loanTerms.repaymentFrequency)
            : loanTemplate?.repaymentFrequencyType?.id || 2,
          repaymentFrequencyNthDayType:
            loanTerms.repaymentFrequencyNthDay || "",
          repaymentFrequencyDayOfWeekType:
            loanTerms.repaymentFrequencyDayOfWeek || "",
          repaymentsStartingFromDate: loanTerms.firstRepaymentOn
            ? format(new Date(loanTerms.firstRepaymentOn), "dd MMMM yyyy")
            : null,
          interestChargedFromDate: loanTerms.interestChargedFrom
            ? format(new Date(loanTerms.interestChargedFrom), "dd MMMM yyyy")
            : null,
          interestType: loanTerms.interestMethod
            ? parseInt(loanTerms.interestMethod)
            : loanTemplate?.interestType?.id || 1,
          isEqualAmortization: loanTerms.isEqualAmortization || false,
          amortizationType: loanTerms.amortization
            ? parseInt(loanTerms.amortization)
            : loanTemplate?.amortizationType?.id || 1,
          interestCalculationPeriodType: loanTerms.interestCalculationPeriod
            ? parseInt(loanTerms.interestCalculationPeriod)
            : loanTemplate?.interestCalculationPeriodType?.id || 1,
          loanIdToClose: loanTerms.loanIdToClose || "",
          isTopup: loanTerms.isTopup ? true : "",
          transactionProcessingStrategyCode:
            loanTerms.repaymentStrategy ||
            loanTemplate?.transactionProcessingStrategyCode ||
            "creocore-strategy",
          interestRateFrequencyType: loanTerms.interestRateFrequency
            ? parseInt(loanTerms.interestRateFrequency)
            : loanTemplate?.interestRateFrequencyType?.id || 2,
          interestRatePerPeriod: loanTerms.nominalInterestRate || 0,
          charges: charges,
          collateral: [],
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          clientId: lead.fineractClientId,
          loanType: "individual",
          principal: loanTerms.principal || 0,
          allowPartialPeriodInterestCalcualtion: false,
        };

        const scheduleResponse = await fetch(
          `${request.nextUrl.origin}/api/fineract/loans/calculate-schedule`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-slug": tenantSlug,
            },
            body: JSON.stringify(payload),
          },
        );

        if (scheduleResponse.ok) {
          repaymentSchedule = await scheduleResponse.json();
        }
      } catch (err) {
        console.error("Error calculating repayment schedule:", err);
      }
    }

    // Format data for contracts
    const clientName = [lead.firstname, lead.middlename, lead.lastname]
      .filter(Boolean)
      .join(" ");

    // Normalize ZMK to ZMW (Fineract uses legacy ZMK code)
    const orgCurrency = await getOrgDefaultCurrencyCode();
    const rawCurrency =
      loanTemplate?.currency?.code ||
      repaymentSchedule?.currency?.code ||
      orgCurrency;
    const currency = rawCurrency === "ZMK" ? "ZMW" : rawCurrency;
    const principal = loanTerms?.principal || 0;
    const interest = repaymentSchedule?.totalInterestCharged || 0;
    const fees = repaymentSchedule?.totalFeeChargesCharged || 0;
    const totalRepayment =
      repaymentSchedule?.totalRepaymentExpected || principal + interest + fees;

    // Calculate monthly percentage rate
    const numberOfPayments = loanTerms?.numberOfRepayments || 1;
    const monthlyPercentageRate =
      principal > 0
        ? (((interest + fees) / principal) * 100) / numberOfPayments
        : 0;

    // Format repayment schedule for contracts
    const formattedSchedule =
      repaymentSchedule?.periods
        ?.filter(
          (period: any) =>
            period.period !== undefined && !period.downPaymentPeriod,
        )
        .map((period: any) => ({
          paymentNumber: period.period,
          dueDate: Array.isArray(period.dueDate)
            ? format(
                new Date(
                  period.dueDate[0],
                  period.dueDate[1] - 1,
                  period.dueDate[2],
                ),
                "dd/MM/yyyy",
              )
            : format(new Date(period.dueDate), "dd/MM/yyyy"),
          paymentAmount:
            period.totalDueForPeriod || period.totalOriginalDueForPeriod || 0,
          principal: period.principalDue || period.principalDisbursed || 0,
          interestAndFees:
            (period.interestDue || 0) + (period.feeChargesDue || 0),
          remainingBalance: period.principalLoanBalanceOutstanding || 0,
        })) || [];

    // Get frequency label
    const getFrequencyLabel = (typeId: number): string => {
      const types: { [key: number]: string } = {
        0: "Days",
        1: "Weeks",
        2: "Months",
        3: "Years",
      };
      return types[typeId] || "Months";
    };

    const repaymentFrequency = loanTerms?.repaymentFrequency
      ? getFrequencyLabel(parseInt(loanTerms.repaymentFrequency))
      : "Monthly";

    // Format tenure
    const tenure =
      loanTerms?.loanTerm && loanTerms?.termFrequency
        ? `${loanTerms.loanTerm} ${getFrequencyLabel(
            parseInt(loanTerms.termFrequency),
          )}`
        : `${numberOfPayments} ${repaymentFrequency}`;

    // Get first payment date
    const firstPaymentDate =
      formattedSchedule.length > 0
        ? formattedSchedule[0].dueDate
        : format(new Date(), "dd/MM/yyyy");

    // Format charges
    const formattedCharges = (loanTerms?.charges || []).map((charge: any) => ({
      name: charge.name || "Unknown Charge",
      amount: charge.amount || 0,
    }));

    // Get loan officer name from logged-in user
    let loanOfficerName = "N/A";
    try {
      const session = await getSession();
      if (session?.user?.userId) {
        // Fetch user details from Fineract to get firstname and lastname
        const userDetails = await fetchFineractAPI(
          `/users/${session.user.userId}`,
        );
        if (userDetails?.firstname || userDetails?.lastname) {
          loanOfficerName =
            [userDetails.firstname, userDetails.lastname]
              .filter(Boolean)
              .join(" ") || "N/A";
          console.log(
            "Loan Officer Name from logged-in user:",
            loanOfficerName,
          );
        }
      }
    } catch (err) {
      console.error(
        "Error fetching logged-in user details for loan officer:",
        err,
      );
      // Fallback to loan template lookup if user details fetch fails
      if (loanTemplate?.loanOfficerOptions && loanDetails?.loanOfficer) {
        const officer = loanTemplate.loanOfficerOptions.find(
          (o: any) => o.id.toString() === loanDetails.loanOfficer,
        );
        loanOfficerName = officer?.displayName || "N/A";
      }
    }

    // Get loan purpose name
    let loanPurposeName = "N/A";
    if (loanTemplate?.loanPurposeOptions && loanDetails?.loanPurpose) {
      const purpose = loanTemplate.loanPurposeOptions.find(
        (p: any) => p.id.toString() === loanDetails.loanPurpose,
      );
      loanPurposeName = purpose?.name || "N/A";
    }

    // Net disbursed amount (principal - upfront fees)
    const upfrontFees = formattedCharges
      .filter(
        (c) =>
          !c.name.toLowerCase().includes("monthly") &&
          !c.name.toLowerCase().includes("recurring"),
      )
      .reduce((sum, c) => sum + c.amount, 0);
    const disbursedAmount = principal - upfrontFees;

    // Get gender name - priority: Fineract client > lead.gender > genderId lookup
    let genderName = "N/A";
    if (fineractClient?.gender?.name) {
      // Best source: Fineract client has gender object with name
      genderName = fineractClient.gender.name;
      console.log("Gender from Fineract client:", genderName);
    } else if (lead.gender) {
      // Fallback: lead.gender string field
      genderName = lead.gender;
      console.log("Gender from lead.gender:", genderName);
    } else if (lead.genderId && clientTemplate?.genderOptions) {
      // Last resort: lookup genderId in template options
      const genderOption = clientTemplate.genderOptions.find(
        (g: any) => g.id === lead.genderId,
      );
      genderName = genderOption?.name || "N/A";
      console.log("Gender from template lookup:", genderName);
    }

    // Fetch Employment Information datatable for employer details
    let employerName: string | undefined = undefined;
    let employeeNo: string | undefined = undefined;

    if (lead.fineractClientId) {
      try {
        console.log("Fetching datatables for client:", lead.fineractClientId);

        // Use fetchFineractAPI directly to avoid session context issues with internal fetch calls
        const datatables = await fetchFineractAPI(
          `/datatables?apptable=m_client`,
        );
        console.log(
          "Available datatables:",
          datatables.map((dt: any) => dt.registeredTableName),
        );

        // Find Employment Information datatable (may have different prefixes like cd_, dt_, m_)
        const employmentTable = datatables.find((dt: any) => {
          const tableName = dt.registeredTableName?.toLowerCase() || "";
          const displayName = dt.displayName?.toLowerCase() || "";
          // Match "Employment Information" or "Employment_Information" or similar
          return (
            tableName.includes("employment") ||
            displayName.includes("employment") ||
            tableName.includes("employer")
          );
        });

        if (employmentTable) {
          console.log(
            "Found Employment Information datatable:",
            employmentTable.registeredTableName,
          );

          // Fetch employment data for this client using fetchFineractAPI directly
          const employmentData = await fetchFineractAPI(
            `/datatables/${encodeURIComponent(employmentTable.registeredTableName)}/${lead.fineractClientId}?genericResultSet=true`,
          );
          console.log(
            "Employment data fetched:",
            JSON.stringify(employmentData, null, 2),
          );

          // Extract employer details from the datatable data
          if (employmentData.data && employmentData.data.length > 0) {
            const headers = employmentData.columnHeaders || [];
            const firstRow = employmentData.data[0]?.row || [];

            console.log(
              "Column headers:",
              headers.map((h: any) => h.columnName),
            );
            console.log("First row data:", firstRow);

            // Find column indices for employer and employee number fields
            // Column names from Employment Information datatable:
            // - "Employer_Name" or "Employer Name" for employer
            // - "Employee_Number" or "Employee Number" for employee number
            headers.forEach((header: any, index: number) => {
              const columnName =
                header.columnName?.toLowerCase().replace(/\s+/g, "_") || "";
              const rawColumnName = header.columnName || "";
              const value = firstRow[index];

              console.log(`Column ${index}: ${rawColumnName} = ${value}`);

              // Look for "Employer_Name" or "Employer Name" column (exact match for the name field)
              if (
                columnName === "employer_name" ||
                rawColumnName === "Employer_Name" ||
                rawColumnName === "Employer Name"
              ) {
                if (value && !employerName) {
                  employerName = value.toString();
                  console.log("Found Employer Name:", employerName);
                }
              }

              // Look for "Employee_Number" or "Employee Number" column
              if (
                columnName === "employee_number" ||
                rawColumnName === "Employee_Number" ||
                rawColumnName === "Employee Number"
              ) {
                if (value && !employeeNo) {
                  employeeNo = value.toString();
                  console.log("Found Employee Number:", employeeNo);
                }
              }
            });

            // Fallback: If we still don't have employer, try to find any column with "employer" and "name" in it
            if (!employerName) {
              headers.forEach((header: any, index: number) => {
                const columnName = header.columnName?.toLowerCase() || "";
                const value = firstRow[index];
                // Match columns like "employer_name", "employername", etc. but not "employer_id"
                if (
                  columnName.includes("employer") &&
                  (columnName.includes("name") || !columnName.includes("id")) &&
                  value &&
                  typeof value === "string" &&
                  value.length > 0
                ) {
                  employerName = value;
                  console.log("Found employer (fallback):", employerName);
                }
              });
            }

            // Fallback: If we still don't have employee number, try other patterns
            if (!employeeNo) {
              headers.forEach((header: any, index: number) => {
                const columnName = header.columnName?.toLowerCase() || "";
                const value = firstRow[index];
                if (
                  (columnName.includes("employee") &&
                    columnName.includes("num")) ||
                  columnName.includes("staff_no") ||
                  columnName.includes("emp_no")
                ) {
                  if (value) {
                    employeeNo = value.toString();
                    console.log(
                      "Found employee number (fallback):",
                      employeeNo,
                    );
                  }
                }
              });
            }
          }
        } else {
          console.log(
            "Employment Information datatable not found in available tables",
          );
        }
      } catch (err) {
        console.error("Error fetching employment info:", err);
      }
    }

    const contractData = {
      // Client Information
      clientName,
      nrc: lead.externalId || "N/A",
      dateOfBirth: lead.dateOfBirth
        ? format(new Date(lead.dateOfBirth), "dd/MM/yyyy")
        : "N/A",
      gender: genderName,
      employeeNo: employeeNo,
      employer: employerName,
      gflNo: lead.fineractClientId?.toString() || undefined,
      loanId: leadId,

      // Loan Information
      loanAmount: principal,
      disbursedAmount: disbursedAmount,
      tenure: tenure,
      numberOfPayments: numberOfPayments,
      paymentFrequency: repaymentFrequency,
      firstPaymentDate: firstPaymentDate,

      // Financial Information
      interest: interest,
      fees: fees,
      totalCostOfCredit: interest + fees,
      totalRepayment: totalRepayment,
      paymentPerPeriod:
        formattedSchedule.length > 0
          ? formattedSchedule.reduce(
              (sum: number, p: any) => sum + p.paymentAmount,
              0,
            ) / formattedSchedule.length
          : totalRepayment / numberOfPayments,
      monthlyPercentageRate: monthlyPercentageRate,

      // Schedule
      repaymentSchedule: formattedSchedule,

      // Charges
      charges: formattedCharges,

      // Other
      currency: currency,
      branch: lead.officeName || "Head Office",
      loanOfficer: loanOfficerName,
      loanPurpose: loanPurposeName,
    };

    return NextResponse.json({
      success: true,
      data: contractData,
    });
  } catch (error) {
    console.error("Error fetching contract data:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch contract data: ${errorMessage}`,
      },
      { status: 500 },
    );
  }
}
