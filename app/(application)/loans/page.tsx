import { Suspense } from "react";
import { headers, cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoansDataTable, Loan } from "@/components/tables/loans-data-table";

async function fetchAllLoans() {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const base = host ? `${proto}://${host}` : "http://localhost:3000";
  const cookieHeader = cookies().toString();
  const res = await fetch(`${base}/api/fineract/loans`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  return res.ok ? res.json() : null;
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
  const rawItems: any[] = Array.isArray(data?.pageItems)
    ? data.pageItems
    : Array.isArray(data?.content)
    ? data.content
    : Array.isArray(data?.loans)
    ? data.loans
    : Array.isArray(data)
    ? data
    : [];

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
