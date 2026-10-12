import { isArdaTenantSlug } from "@/lib/arda-tenant";
import { isArdaStockInputLoanProduct } from "@/lib/inventory/arda-stock-loan";

type LoanProductIdentity = Parameters<typeof isArdaStockInputLoanProduct>[0];

export function getArdaDocumentVariant(
  tenantSlug: string | null | undefined,
  product: LoanProductIdentity,
): "ARDA_STOCK_INPUT" | "DEFAULT" {
  return isArdaTenantSlug(tenantSlug) && isArdaStockInputLoanProduct(product)
    ? "ARDA_STOCK_INPUT"
    : "DEFAULT";
}
