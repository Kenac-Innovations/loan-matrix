import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoansDataTable, Loan } from "@/components/tables/loans-data-table";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143";

async function fetchAllLoans(): Promise<any> {
  try {
    const session = await getSession();
    const accessToken =
      (session as any)?.base64EncodedAuthenticationKey ||
      (session as any)?.accessToken;

    if (!accessToken) {
      console.warn("No access token available for fetching loans");
      return null;
    }

    const fineractTenantId = await getFineractTenantId();

    console.log("=== LOANS PAGE - Server-Side Fetch ===");
    console.log("Using Fineract Tenant ID:", fineractTenantId);
    console.log("======================================");

    const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans?limit=500`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to fetch loans from Fineract:", response.status);
      return null;
    }

    const result = await response.json();
    console.log(
      "Loans fetched successfully, count:",
      result?.pageItems?.length || result?.length || 0
    );

    return result;
  } catch (error) {
    console.error("Error fetching loans:", error);
    return null;
  }
}

function transformLoanData(rawLoan: any): Loan {
  return {
    id: rawLoan.id?.toString() || "",
    accountNo: rawLoan.accountNo || "",
    clientName:
      rawLoan.clientName || rawLoan.clientId?.toString() || "Unknown Client",
    clientId: rawLoan.clientId?.toString() || "",
    productName:
      rawLoan.productName || rawLoan.loanProductName || "Unknown Product",
    status: rawLoan.status?.value || rawLoan.status || "Unknown",
    principal: parseFloat(rawLoan.principal || rawLoan.principalAmount || "0"),
    currency: rawLoan.currency?.code || rawLoan.currency || "USD",
    disbursedAmount: parseFloat(rawLoan.disbursedAmount || "0"),
    outstandingBalance: parseFloat(rawLoan.outstandingBalance || "0"),
    daysInArrears: parseInt(rawLoan.daysInArrears || "0"),
    approvedOnDate: rawLoan.approvedOnDate || "",
    disbursedOnDate: rawLoan.disbursedOnDate || "",
    maturityDate: rawLoan.maturityDate || "",
  };
}

export default async function LoansPage() {
  const data = await fetchAllLoans();

  console.log("Loans Page Debug:", {
    dataType: typeof data,
    data: data,
    hasPageItems: !!data?.pageItems,
    hasContent: !!data?.content,
    hasLoans: !!data?.loans,
    isArray: Array.isArray(data),
  });

  const rawItems: any[] = Array.isArray(data?.pageItems)
    ? data.pageItems
    : Array.isArray(data?.content)
    ? data.content
    : Array.isArray(data?.loans)
    ? data.loans
    : Array.isArray(data)
    ? data
    : [];

  console.log("Raw Items Debug:", {
    rawItemsLength: rawItems.length,
    rawItems: rawItems.slice(0, 2), // Show first 2 items
  });

  const loans: Loan[] = rawItems.map(transformLoanData);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
          <p className="text-muted-foreground">
            Manage and track all loan applications and disbursements
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading loans...</div>}>
            <LoansDataTable data={loans} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
