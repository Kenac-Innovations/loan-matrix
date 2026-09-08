import { getFineractTenantId } from "@/lib/fineract-tenant-service";

type UssdAdmissionApplication = {
  userNationalId?: string;
  userPhoneNumber: string;
  loanMatrixLoanProductId: number;
  referenceNumber: string;
};

type AdmissionAction = "reserve" | "attach" | "assert-disbursement";

const DEFAULT_GUARDED_PRODUCT_IDS = [12];

export function requiresUssdLoanAdmission(productId: number): boolean {
  const configuredProductIds = process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS
    ?.split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  const guardedProductIds =
    configuredProductIds && configuredProductIds.length > 0
      ? configuredProductIds
      : DEFAULT_GUARDED_PRODUCT_IDS;

  return guardedProductIds.includes(productId);
}

export async function assertUssdLoanAdmission(
  application: UssdAdmissionApplication,
  action: AdmissionAction,
  fineractLoanId?: number
): Promise<void> {
  if (!application.userNationalId) {
    throw new Error("Loan admission blocked: missing national ID");
  }
  const tenantId = await getFineractTenantId();
  const baseUrl = process.env.CDE_BASE_URL || "http://localhost:8090";
  const response = await fetch(`${baseUrl}/api/v1/${tenantId}/loan-admissions/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      idNumber: application.userNationalId,
      phoneNumber: application.userPhoneNumber,
      productExternalId: String(application.loanMatrixLoanProductId),
      idempotencyKey: application.referenceNumber,
      ...(fineractLoanId !== undefined ? { fineractLoanId } : {}),
    }),
  });

  const body = await response.json().catch(() => null) as { admitted?: boolean; reason?: string; error?: string } | null;
  if (!response.ok || !body?.admitted) {
    throw new Error(`Loan admission blocked: ${body?.reason || body?.error || "unavailable"}`);
  }
}
