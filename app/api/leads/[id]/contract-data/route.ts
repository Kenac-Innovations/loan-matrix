import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";
import { format } from "date-fns";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
        { status: 404 }
      );
    }

    console.log("Lead found:", leadId);

    // Warn if tenant mismatch (but don't block the request)
    if (lead.tenantId !== tenant.id) {
      console.warn(
        `⚠️ Tenant mismatch for lead ${leadId}: lead.tenantId=${lead.tenantId}, expected=${tenant.id}`
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
      }
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
      }
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
        { status: 400 }
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
        { status: 400 }
      );
    }

    if (!loanTerms) {
      console.error("Missing loan terms");
      return NextResponse.json(
        {
          success: false,
          error: "Missing loan terms. Please complete the loan terms first.",
        },
        { status: 400 }
      );
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
          }
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
          loanIdToClose: "",
          isTopup: "",
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
          }
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

    const currency =
      loanTemplate?.currency?.code ||
      repaymentSchedule?.currency?.code ||
      "ZMW";
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
            period.period !== undefined && !period.downPaymentPeriod
        )
        .map((period: any) => ({
          paymentNumber: period.period,
          dueDate: Array.isArray(period.dueDate)
            ? format(
                new Date(
                  period.dueDate[0],
                  period.dueDate[1] - 1,
                  period.dueDate[2]
                ),
                "dd/MM/yyyy"
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
            parseInt(loanTerms.termFrequency)
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

    // Get loan officer name
    let loanOfficerName = "N/A";
    if (loanTemplate?.loanOfficerOptions && loanDetails?.loanOfficer) {
      const officer = loanTemplate.loanOfficerOptions.find(
        (o: any) => o.id.toString() === loanDetails.loanOfficer
      );
      loanOfficerName = officer?.displayName || "N/A";
    }

    // Get loan purpose name
    let loanPurposeName = "N/A";
    if (loanTemplate?.loanPurposeOptions && loanDetails?.loanPurpose) {
      const purpose = loanTemplate.loanPurposeOptions.find(
        (p: any) => p.id.toString() === loanDetails.loanPurpose
      );
      loanPurposeName = purpose?.name || "N/A";
    }

    // Net disbursed amount (principal - upfront fees)
    const upfrontFees = formattedCharges
      .filter(
        (c) =>
          !c.name.toLowerCase().includes("monthly") &&
          !c.name.toLowerCase().includes("recurring")
      )
      .reduce((sum, c) => sum + c.amount, 0);
    const disbursedAmount = principal - upfrontFees;

    const contractData = {
      // Client Information
      clientName,
      nrc: lead.externalId || "N/A",
      dateOfBirth: lead.dateOfBirth
        ? format(new Date(lead.dateOfBirth), "dd/MM/yyyy")
        : "N/A",
      gender: lead.gender || "N/A",
      employeeNo: undefined,
      employer: undefined,
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
              0
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
      { status: 500 }
    );
  }
}
