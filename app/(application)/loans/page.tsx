import { Suspense } from "react";
import { headers, cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

async function fetchAllLoans() {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const base = host ? `${proto}://${host}` : "http://localhost:3000";
  const cookieHeader = cookies().toString();
  const res = await fetch(`${base}/api/fineract/loans`, {
    cache: 'no-store',
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  return res.ok ? res.json() : null;
}

export default async function LoansPage() {
  const data = await fetchAllLoans();
  const items: any[] = Array.isArray(data?.pageItems)
    ? data.pageItems
    : Array.isArray(data?.content)
    ? data.content
    : Array.isArray(data?.loans)
    ? data.loans
    : Array.isArray(data)
    ? data
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Loans</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Account #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>{l.id}</TableCell>
                  <TableCell>{l.accountNo}</TableCell>
                  <TableCell>{l.clientName ?? l.clientId}</TableCell>
                  <TableCell>{l.productName ?? l.loanProductName}</TableCell>
                  <TableCell>{l.status?.value}</TableCell>
                  <TableCell>
                    {l.clientId ? (
                      <Link className="text-blue-600" href={`/clients/${l.clientId}/loans/${l.id}`}>View</Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


