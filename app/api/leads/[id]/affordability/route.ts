import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";
import { buildCDEPayload, fetchFineractLoanForLead } from "@/lib/cde-utils";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("Received POST request for leadId:", leadId);

    const data = await request.json();
    console.log("Received data:", data);

    // Get tenant from x-tenant-slug header or default to "goodfellow"
    const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";
    console.log("Tenant slug:", tenantSlug);

    const tenant = await getTenantBySlug(tenantSlug);
    console.log("Found tenant:", tenant?.id, tenant?.slug);

    if (!tenant) {
      console.error("Tenant not found for slug:", tenantSlug);
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // First, try to find the lead without tenant restriction to debug
    const leadDebug = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    console.log(
      "Lead exists (without tenant filter):",
      leadDebug ? "Yes" : "No"
    );
    console.log("Lead tenantId:", leadDebug?.tenantId);
    console.log("Expected tenantId:", tenant.id);

    // Get the lead first to access tenantId and current stage
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      include: { currentStage: true },
    });

    console.log("Found lead:", lead?.id);

    if (!lead) {
      console.error("Lead not found:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    // Verify tenant match (but don't fail if it doesn't match for now)
    if (lead.tenantId !== tenant.id) {
      console.warn(
        `Tenant mismatch: Lead tenant=${lead.tenantId}, Request tenant=${tenant.id}`
      );
    }

    // Get current stateMetadata
    const currentMetadata = (lead.stateMetadata as any) || {};

    // Update the lead with affordability data
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        grossMonthlyIncome: data.grossMonthlyIncome,
        monthlyIncome: data.netMonthlyIncome,
        nationality: data.nationality || null,
        mobileInOwnName: data.mobileInOwnName || false,
        hasProofOfIncome: data.hasProofOfIncome || false,
        hasValidNationalId: data.hasValidNationalId || false,
        identityVerified: data.identityVerified || false,
        employmentVerified: data.employmentVerified || false,
        incomeVerified: data.incomeVerified || false,
        lastModified: new Date(),
      },
    });

    console.log("Successfully updated lead:", updatedLead.id);

    // ============================================================================
    // CDE (Credit Decision Engine) API CALL
    // ============================================================================
    // This is where the CDE evaluation happens automatically when affordability
    // data is saved. The CDE service evaluates the loan application and returns
    // decision, scoring, affordability, pricing, and fraud check results.
    // The result is stored in lead.stateMetadata.cdeResult for later display.
    // ============================================================================
    let cdeResult = null;
    try {
      // Fetch Fineract loan details if available
      const fineractLoan = await fetchFineractLoanForLead(updatedLead);
      const cdePayload = buildCDEPayload(updatedLead, data, fineractLoan);
      console.log("=== CALLING CDE API ===");
      console.log("CDE Payload:", JSON.stringify(cdePayload, null, 2));
      console.log(
        "CDE Endpoint:",
        `${request.nextUrl.origin}/api/cde/evaluate`
      );

      const cdeResponse = await fetch(
        `${request.nextUrl.origin}/api/cde/evaluate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cdePayload),
        }
      );

      if (cdeResponse.ok) {
        cdeResult = await cdeResponse.json();
        console.log("CDE evaluation successful:", cdeResult.decision);

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
      } else {
        const errorText = await cdeResponse.text();
        console.error("CDE evaluation failed:", cdeResponse.status, errorText);
      }
    } catch (cdeError) {
      console.error("Error calling CDE:", cdeError);
      // Don't fail the request if CDE call fails
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      cdeResult: cdeResult,
      message: "Affordability data saved successfully. Stage completed.",
    });
  } catch (error) {
    console.error("Error saving affordability data:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to save affordability data: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("GET affordability data for leadId:", leadId);

    // Fetch lead data with financial information
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        grossMonthlyIncome: true,
        monthlyIncome: true,
        nationality: true,
        mobileInOwnName: true,
        hasProofOfIncome: true,
        hasValidNationalId: true,
        identityVerified: true,
        employmentVerified: true,
        incomeVerified: true,
      },
    });

    if (!lead) {
      console.error("Lead not found:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    console.log("Found lead affordability data:", lead);

    return NextResponse.json({
      success: true,
      data: {
        grossMonthlyIncome: lead.grossMonthlyIncome || 0,
        netMonthlyIncome: lead.monthlyIncome || 0,
        nationality: lead.nationality || "",
        mobileInOwnName: lead.mobileInOwnName || false,
        hasProofOfIncome: lead.hasProofOfIncome || false,
        hasValidNationalId: lead.hasValidNationalId || false,
        identityVerified: lead.identityVerified || false,
        employmentVerified: lead.employmentVerified || false,
        incomeVerified: lead.incomeVerified || false,
      },
    });
  } catch (error) {
    console.error("Error fetching affordability data:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch affordability data: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

function calculateAffordabilityModels(lead: any) {
  const monthlyIncome = lead.monthlyIncome || 0;
  const monthlyExpenses = lead.monthlyExpenses || 0;
  const totalDebt = lead.totalDebt || 0;
  const requestedAmount = lead.requestedAmount || 0;
  const loanTerm = lead.loanTerm || 36;
  const annualIncome = lead.annualIncome || monthlyIncome * 12;
  const creditScore = lead.creditScore || 600;
  const yearsEmployed = lead.yearsEmployed || 0;
  const collateralValue = lead.collateralValue || 0;

  // Calculate monthly loan payment (assuming 12% annual interest rate)
  const monthlyInterestRate = 0.12 / 12;
  const monthlyPayment =
    requestedAmount > 0
      ? (requestedAmount *
          monthlyInterestRate *
          Math.pow(1 + monthlyInterestRate, loanTerm)) /
        (Math.pow(1 + monthlyInterestRate, loanTerm) - 1)
      : 0;

  // DTI Model Calculation
  const currentMonthlyDebt = totalDebt > 0 ? totalDebt / 12 : 0; // Assuming total debt is annual
  const newTotalMonthlyDebt = currentMonthlyDebt + monthlyPayment;
  const dtiRatio = monthlyIncome > 0 ? newTotalMonthlyDebt / monthlyIncome : 0;

  // Maximum loan amount based on 36% DTI threshold
  const maxMonthlyDebtAllowed = monthlyIncome * 0.36;
  const availableDebtCapacity = maxMonthlyDebtAllowed - currentMonthlyDebt;
  const maxLoanAmountDTI =
    availableDebtCapacity > 0
      ? (availableDebtCapacity *
          (Math.pow(1 + monthlyInterestRate, loanTerm) - 1)) /
        (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, loanTerm))
      : 0;

  // Disposable Income Model
  const disposableIncome = monthlyIncome - monthlyExpenses;
  const requiredDisposableIncome = monthlyIncome * 0.3; // 30% minimum
  const maxLoanAmountDisposable =
    disposableIncome > requiredDisposableIncome
      ? ((disposableIncome - requiredDisposableIncome) *
          (Math.pow(1 + monthlyInterestRate, loanTerm) - 1)) /
        (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, loanTerm))
      : 0;

  // Employer-Based Model
  const employerMultiplier = getEmployerMultiplier(
    lead.employmentStatus,
    yearsEmployed
  );
  const maxLoanAmountEmployer = annualIncome * employerMultiplier;

  // Expenditure Estimation Model
  const incomeBracket = getIncomeBracket(annualIncome);
  const locationFactor = 1.2; // Urban factor
  const estimatedExpenditure = (annualIncome * 0.6 * locationFactor) / 12;
  const estimatedDisposableIncome = monthlyIncome - estimatedExpenditure;
  const maxLoanAmountExpenditure =
    estimatedDisposableIncome > 0
      ? (estimatedDisposableIncome *
          0.7 *
          (Math.pow(1 + monthlyInterestRate, loanTerm) - 1)) /
        (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, loanTerm))
      : 0;

  // Overall Assessment
  const maxLoanAmounts = [
    maxLoanAmountDTI,
    maxLoanAmountDisposable,
    maxLoanAmountEmployer,
    maxLoanAmountExpenditure,
  ].filter((amount) => amount > 0);

  const overallMaxLoanAmount = Math.min(...maxLoanAmounts);
  const approved =
    requestedAmount <= overallMaxLoanAmount && creditScore >= 550;

  return {
    // DTI Model Results
    dtiModel: {
      modelName: "Standard DTI Model",
      modelType: "dti",
      isDefault: true,
      result: {
        maxLoanAmount: Math.round(maxLoanAmountDTI),
        dtiRatio: dtiRatio,
        monthlyIncome: monthlyIncome,
        monthlyDebt: Math.round(newTotalMonthlyDebt),
        currentDebt: Math.round(currentMonthlyDebt),
        proposedPayment: Math.round(monthlyPayment),
        approved: dtiRatio <= 0.36,
        factors: [
          {
            name: "DTI Ratio",
            value: `${(dtiRatio * 100).toFixed(1)}%`,
            status:
              dtiRatio <= 0.36 ? "good" : dtiRatio <= 0.43 ? "warning" : "bad",
          },
          {
            name: "Current Debt",
            value: `$${Math.round(currentMonthlyDebt).toLocaleString()}`,
            status: "neutral",
          },
          {
            name: "Proposed Payment",
            value: `$${Math.round(monthlyPayment).toLocaleString()}`,
            status: "neutral",
          },
          {
            name: "Monthly Income",
            value: `$${monthlyIncome.toLocaleString()}`,
            status: "neutral",
          },
        ],
      },
    },

    // Net Disposable Income Model Results
    disposableIncomeModel: {
      modelName: "Net Disposable Income",
      modelType: "disposableIncome",
      isDefault: false,
      result: {
        maxLoanAmount: Math.round(maxLoanAmountDisposable),
        disposableIncome: Math.round(disposableIncome),
        requiredDisposableIncome: Math.round(requiredDisposableIncome),
        monthlyIncome: monthlyIncome,
        monthlyExpenditure: monthlyExpenses,
        approved: disposableIncome >= requiredDisposableIncome,
        factors: [
          {
            name: "Disposable Income",
            value: `$${Math.round(disposableIncome).toLocaleString()}`,
            status:
              disposableIncome >= requiredDisposableIncome ? "good" : "bad",
          },
          {
            name: "Required Minimum",
            value: `$${Math.round(requiredDisposableIncome).toLocaleString()}`,
            status: "neutral",
          },
          {
            name: "Monthly Income",
            value: `$${monthlyIncome.toLocaleString()}`,
            status: "neutral",
          },
          {
            name: "Monthly Expenses",
            value: `$${monthlyExpenses.toLocaleString()}`,
            status: "neutral",
          },
        ],
      },
    },

    // Employer-Based Model Results
    employerBasedModel: {
      modelName: "Employer-Based Assessment",
      modelType: "employerBased",
      isDefault: false,
      result: {
        maxLoanAmount: Math.round(maxLoanAmountEmployer),
        annualSalary: annualIncome,
        employerType: lead.employmentStatus?.toLowerCase() || "unknown",
        salaryMultiplier: employerMultiplier,
        termYears: Math.round(loanTerm / 12),
        yearsEmployed: yearsEmployed,
        approved: yearsEmployed >= 1,
        factors: [
          {
            name: "Employer Category",
            value: lead.employmentStatus || "Unknown",
            status: yearsEmployed >= 2 ? "good" : "warning",
          },
          {
            name: "Years Employed",
            value: `${yearsEmployed} years`,
            status:
              yearsEmployed >= 2
                ? "good"
                : yearsEmployed >= 1
                ? "warning"
                : "bad",
          },
          {
            name: "Salary Multiplier",
            value: `${employerMultiplier}x`,
            status: "neutral",
          },
          {
            name: "Annual Salary",
            value: `$${annualIncome.toLocaleString()}`,
            status: "neutral",
          },
        ],
      },
    },

    // Expenditure Estimation Model Results
    expenditureEstimationModel: {
      modelName: "Expenditure Estimation",
      modelType: "expenditureEstimation",
      isDefault: false,
      result: {
        maxLoanAmount: Math.round(maxLoanAmountExpenditure),
        incomeBracket: incomeBracket,
        estimatedExpenditure: Math.round(estimatedExpenditure),
        expenditurePercentage: 0.6,
        location: "urban",
        locationFactor: locationFactor,
        approved: estimatedDisposableIncome > 0,
        factors: [
          {
            name: "Income Bracket",
            value: incomeBracket,
            status: "neutral",
          },
          {
            name: "Location Type",
            value: "Urban",
            status: "neutral",
          },
          {
            name: "Est. Expenditure",
            value: `$${Math.round(estimatedExpenditure).toLocaleString()}`,
            status: "neutral",
          },
          {
            name: "Exp. Percentage",
            value: "60%",
            status: "neutral",
          },
        ],
      },
    },

    // Overall Assessment
    overallAssessment: {
      maxLoanAmount: Math.round(overallMaxLoanAmount),
      recommendedModel: getRecommendedModel(
        maxLoanAmountDTI,
        maxLoanAmountDisposable,
        maxLoanAmountEmployer,
        maxLoanAmountExpenditure
      ),
      requestedAmount: requestedAmount,
      approved: approved,
      warnings: generateWarnings(
        dtiRatio,
        yearsEmployed,
        creditScore,
        disposableIncome,
        requiredDisposableIncome
      ),
      approvalFactors: generateApprovalFactors(
        creditScore,
        yearsEmployed,
        collateralValue,
        lead.employmentStatus
      ),
    },
  };
}

function getEmployerMultiplier(
  employmentStatus: string,
  yearsEmployed: number
): number {
  const status = employmentStatus?.toLowerCase() || "";
  let baseMultiplier = 3.0;

  if (status.includes("government") || status.includes("public")) {
    baseMultiplier = 5.0;
  } else if (status.includes("corporate") || status.includes("employed")) {
    baseMultiplier = 4.0;
  } else if (status.includes("self") || status.includes("business")) {
    baseMultiplier = 2.5;
  }

  // Adjust based on years employed
  if (yearsEmployed >= 5) {
    baseMultiplier += 0.5;
  } else if (yearsEmployed < 1) {
    baseMultiplier -= 1.0;
  }

  return Math.max(baseMultiplier, 1.0);
}

function getIncomeBracket(annualIncome: number): string {
  if (annualIncome < 30000) return "low";
  if (annualIncome < 60000) return "middle";
  if (annualIncome < 100000) return "upper-middle";
  return "high";
}

function getRecommendedModel(
  dti: number,
  disposable: number,
  employer: number,
  expenditure: number
): string {
  const models = [
    { name: "Standard DTI Model", amount: dti },
    { name: "Net Disposable Income", amount: disposable },
    { name: "Employer-Based Assessment", amount: employer },
    { name: "Expenditure Estimation", amount: expenditure },
  ];

  const validModels = models.filter((m) => m.amount > 0);
  if (validModels.length === 0) return "Standard DTI Model";

  return validModels.reduce((prev, current) =>
    current.amount > prev.amount ? current : prev
  ).name;
}

function generateWarnings(
  dtiRatio: number,
  yearsEmployed: number,
  creditScore: number,
  disposableIncome: number,
  requiredDisposableIncome: number
): string[] {
  const warnings = [];

  if (dtiRatio > 0.32) {
    warnings.push(
      `DTI ratio (${(dtiRatio * 100).toFixed(
        1
      )}%) is close to warning threshold (36%)`
    );
  }

  if (yearsEmployed < 2) {
    warnings.push(`Limited employment history (${yearsEmployed} years)`);
  }

  if (creditScore < 650) {
    warnings.push(
      `Credit score (${creditScore}) is below preferred threshold (650)`
    );
  }

  if (disposableIncome < requiredDisposableIncome) {
    warnings.push("Disposable income is below recommended minimum");
  }

  return warnings;
}

function generateApprovalFactors(
  creditScore: number,
  yearsEmployed: number,
  collateralValue: number,
  employmentStatus: string
): string[] {
  const factors = [];

  if (creditScore >= 700) {
    factors.push(`Excellent credit history (${creditScore})`);
  } else if (creditScore >= 650) {
    factors.push(`Good credit history (${creditScore})`);
  }

  if (yearsEmployed >= 3) {
    factors.push("Stable employment history");
  }

  if (collateralValue > 0) {
    factors.push("Adequate collateral provided");
  }

  if (
    employmentStatus?.toLowerCase().includes("government") ||
    employmentStatus?.toLowerCase().includes("corporate")
  ) {
    factors.push("Stable employer type");
  }

  factors.push("Existing client relationship");

  return factors;
}
