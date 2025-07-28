import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch lead data with financial information
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
        tenantId: tenant.id,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Debug: Log the lead data to see what fields are available
    console.log("Lead data for affordability:", {
      id: lead.id,
      monthlyIncome: lead.monthlyIncome,
      monthlyExpenses: lead.monthlyExpenses,
      creditScore: lead.creditScore,
      requestedAmount: lead.requestedAmount,
      // Add other financial fields to debug
    });

    // Calculate affordability models based on real data
    const affordabilityData = calculateAffordabilityModels(lead);

    return NextResponse.json(affordabilityData);
  } catch (error) {
    console.error("Error fetching affordability data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
