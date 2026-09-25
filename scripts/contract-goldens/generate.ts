/**
 * Golden HTML fixture generator for contract templates.
 * Generates expected outputs from TS generators to seed Java port testing.
 *
 * Run with: TZ=Africa/Harare LOAN_MATRIX_BE_DIR=../loan-matrix-be node_modules/.bin/tsx scripts/contract-goldens/generate.ts
 * Output feeds LeadContractTemplateGoldenTest in loan-matrix-be.
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Freeze time at 2026-03-15T10:30:00+02:00 (10:30 UTC+2)
const frozenDate = new Date("2026-03-15T10:30:00+02:00");
const originalDate = globalThis.Date;

class FrozenDate extends Date {
  constructor(...args: any[]) {
    if (args.length === 0) {
      // new Date() with no args -> frozen time
      super(frozenDate.getTime());
    } else {
      // All other forms behave normally
      super(...args);
    }
  }

  static now(): number {
    return frozenDate.getTime();
  }
}

// Copy static methods
Object.setPrototypeOf(FrozenDate, originalDate);
for (const key of Object.getOwnPropertyNames(originalDate)) {
  if (key !== "prototype" && key !== "length" && key !== "name") {
    const descriptor = Object.getOwnPropertyDescriptor(originalDate, key);
    if (descriptor && descriptor.value && typeof descriptor.value === "function") {
      (FrozenDate as any)[key] = (originalDate as any)[key];
    }
  }
}

globalThis.Date = FrozenDate as any;

// Import types
import type { ContractData } from "../../app/(application)/leads/new/components/contract-types";

interface KeyFactsData {
  clientName: string;
  clientId?: string;
  nrc?: string;
  applicationNo?: string;
  loanId?: string;
  loanAmount: number;
  disbursedAmount: number;
  interest: number;
  fees: number;
  totalCostOfCredit: number;
  totalRepayment: number;
  paymentPerPeriod: number;
  tenure: string;
  numberOfPayments: number;
  paymentFrequency: string;
  firstPaymentDate: string;
  monthlyPercentageRate: number;
  charges: Array<{
    name: string;
    amount: number;
    isRecurring?: boolean;
    frequency?: string;
  }>;
  lateFeeAmount?: number;
  lateFeeDays?: number;
  defaultInterestRate?: number;
  defaultInterestDays?: number;
  collateral?: string;
  mandatorySavings?: number;
  variableInterestApplies?: boolean;
  repaymentSchedule: Array<{
    paymentNumber: number;
    dueDate: string;
    paymentAmount: number;
    principal: number;
    interestAndFees: number;
    remainingBalance: number;
  }>;
  currency: string;
  preparedDate?: string;
  validFor?: string;
}

interface KeyFactsSignatureData {
  borrower?: string | null;
  guarantor?: string | null;
  creditProvider?: string | null;
}

// Verbatim copy of getKeyFactsData from loan-contracts.tsx
function getKeyFactsData(contractData: ContractData, leadId: string): KeyFactsData | null {
  if (!contractData) return null;

  return {
    clientName: contractData.clientName,
    clientId: contractData.gflNo,
    nrc: contractData.nrc,
    applicationNo: contractData.loanId || leadId,
    loanId: contractData.loanId,
    loanAmount: contractData.loanAmount,
    disbursedAmount: contractData.disbursedAmount,
    interest: contractData.interest,
    fees: contractData.fees,
    totalCostOfCredit: contractData.totalCostOfCredit,
    totalRepayment: contractData.totalRepayment,
    paymentPerPeriod: contractData.paymentPerPeriod,
    tenure: contractData.tenure,
    numberOfPayments: contractData.numberOfPayments,
    paymentFrequency: contractData.paymentFrequency,
    firstPaymentDate: contractData.firstPaymentDate,
    monthlyPercentageRate: contractData.monthlyPercentageRate,
    charges: contractData.charges.map((charge) => ({
      name: charge.name,
      amount: charge.amount,
      isRecurring:
        charge.name.toLowerCase().includes("monthly") ||
        charge.name.toLowerCase().includes("recurring"),
      frequency: charge.name.toLowerCase().includes("monthly")
        ? "month"
        : undefined,
    })),
    lateFeeAmount: undefined,
    lateFeeDays: 10,
    defaultInterestRate: 25,
    defaultInterestDays: 10,
    collateral: undefined,
    mandatorySavings: undefined,
    variableInterestApplies: false,
    repaymentSchedule: contractData.repaymentSchedule,
    currency: contractData.currency,
    preparedDate: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    validFor: "30 days",
  };
}

// Verbatim copy of ardaDocumentData logic
function applyArdaDefaults(contractData: ContractData): ContractData {
  if (!contractData || contractData.documentVariant !== "ARDA_STOCK_INPUT") {
    return contractData;
  }

  if (contractData.stockLoanSelection) {
    return contractData;
  }

  return {
    ...contractData,
    stockLoanSelection: {
      inventoryItemName: "Stock item not recorded",
      quantity: "Not recorded",
      unitOfMeasure: "Not recorded",
      unitValue: "0.00",
      totalValue: String(contractData.loanAmount || 0),
      currencyCode: contractData.currency || "USD",
      fineractOfficeName: contractData.branch,
    },
  };
}

interface ScenarioInput {
  template: "default-contract" | "kfs" | "mandate" | "arda-contract" | "arda-mandate" | "omama";
  leadId: string;
  now: string;
  data: ContractData;
  signatures?: {
    borrower?: string | null;
    guarantor?: string | null;
    loanOfficer?: string | null;
  };
  organizationName?: string | null;
  logoUrl?: string | null;
  templateFile?: string;
}

async function main() {
  // Import generators after time is frozen
  const { generateContractHTML } = await import("../../app/(application)/leads/new/components/contract-template");
  const { generateKeyFactsStatementHTML } = await import("../../app/(application)/leads/new/components/key-facts-statement-template");
  const { generateMandateFormHTML } = await import("../../app/(application)/leads/new/components/mandate-form-template");
  const { generateArdaStockLoanContractHTML } = await import("../../app/(application)/leads/new/components/arda-stock-loan-contract");
  const { generateArdaStockLoanMandateHTML } = await import("../../app/(application)/leads/new/components/arda-stock-loan-mandate");
  const { fillOmamaContractTemplate } = await import("../../app/(application)/leads/new/components/omama-contract-template");

  const fixturesDir = path.join(__dirname, "fixtures");
  // Defaults to a loan-matrix-be checkout next to this repo; override with LOAN_MATRIX_BE_DIR.
  const backendDir =
    process.env.LOAN_MATRIX_BE_DIR ?? path.resolve(__dirname, "../../../loan-matrix-be");
  const backendResourcesDir = path.join(backendDir, "src/test/resources/leadcontracts");

  // Ensure backend directories exist
  await fs.mkdir(path.join(backendResourcesDir, "golden"), { recursive: true });
  await fs.mkdir(path.join(backendResourcesDir, "templates"), { recursive: true });

  // Get all fixture files
  const files = await fs.readdir(fixturesDir);
  const fixtureFiles = files.filter((f) => f.endsWith(".json"));

  for (const file of fixtureFiles) {
    const scenario = path.basename(file, ".json");
    console.log(`Processing scenario: ${scenario}`);

    const fixtureContent = await fs.readFile(path.join(fixturesDir, file), "utf-8");
    const input: ScenarioInput = JSON.parse(fixtureContent);

    let html: string;

    try {
      if (input.template === "default-contract") {
        html = generateContractHTML(input.data, input.signatures);
      } else if (input.template === "kfs") {
        const keyFactsData = getKeyFactsData(input.data, input.leadId);
        if (!keyFactsData) throw new Error("Failed to generate KFS data");
        html = generateKeyFactsStatementHTML(keyFactsData, {
          borrower: input.signatures?.borrower,
          guarantor: input.signatures?.guarantor,
          creditProvider: input.signatures?.loanOfficer,
        });
      } else if (input.template === "mandate") {
        html = generateMandateFormHTML(input.data, {
          borrower: input.signatures?.borrower,
          organization: {
            name: input.organizationName,
            logoUrl: input.logoUrl,
          },
        });
      } else if (input.template === "arda-contract") {
        const ardaData = applyArdaDefaults(input.data);
        html = generateArdaStockLoanContractHTML(ardaData, {
          borrower: input.signatures?.borrower,
          loanOfficer: input.signatures?.loanOfficer,
        });
      } else if (input.template === "arda-mandate") {
        const ardaData = applyArdaDefaults(input.data);
        html = generateArdaStockLoanMandateHTML(ardaData, {
          borrower: input.signatures?.borrower,
        });
      } else if (input.template === "omama") {
        if (!input.templateFile) throw new Error("templateFile required for omama");
        const templatePath = path.join(__dirname, "../../templates", input.templateFile);
        const templateContent = await fs.readFile(templatePath, "utf-8");
        html = fillOmamaContractTemplate(templateContent, input.data, input.logoUrl || "", {
          borrower: input.signatures?.borrower,
          guarantor: input.signatures?.guarantor,
          loanOfficer: input.signatures?.loanOfficer,
        });
      } else {
        throw new Error(`Unknown template type: ${input.template}`);
      }

      // Write scenario directory to backend
      const scenarioDir = path.join(backendResourcesDir, "golden", scenario);
      await fs.mkdir(scenarioDir, { recursive: true });

      // Write input.json
      await fs.writeFile(
        path.join(scenarioDir, "input.json"),
        JSON.stringify(input, null, 2)
      );

      // Write expected.html
      await fs.writeFile(path.join(scenarioDir, "expected.html"), html);

      console.log(`  ✓ Generated ${scenario}`);
    } catch (error) {
      console.error(`  ✗ Failed to generate ${scenario}:`, error);
      process.exit(1);
    }
  }

  // Copy template files
  console.log("\nCopying template files...");
  const omamaTemplateSource = path.join(__dirname, "../../templates/omama-full-loan/full-loan-template-from-db.html");
  const omamaTemplateDest = path.join(backendResourcesDir, "templates/omama-full-loan/full-loan-template-from-db.html");
  await fs.mkdir(path.dirname(omamaTemplateDest), { recursive: true });
  await fs.copyFile(omamaTemplateSource, omamaTemplateDest);
  console.log("  ✓ Copied omama-full-loan/full-loan-template-from-db.html");

  const rulethuTemplateSource = path.join(__dirname, "../../templates/rulethu-full-loan/acknowledgement-of-debt-2025.html");
  const rulethuTemplateDest = path.join(backendResourcesDir, "templates/rulethu-full-loan/acknowledgement-of-debt-2025.html");
  await fs.mkdir(path.dirname(rulethuTemplateDest), { recursive: true });
  await fs.copyFile(rulethuTemplateSource, rulethuTemplateDest);
  console.log("  ✓ Copied rulethu-full-loan/acknowledgement-of-debt-2025.html");

  console.log("\n✓ All fixtures generated successfully!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
