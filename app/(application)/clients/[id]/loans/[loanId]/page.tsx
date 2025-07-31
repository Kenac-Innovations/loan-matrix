import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientLoanDetails } from "./components/client-loan-details";

interface PageProps {
  params: Promise<{
    id: string;
    loanId: string;
  }>;
}

export default async function ClientLoanDetailsPage({ params }: PageProps) {
  const { id, loanId } = await params;
  const clientId = parseInt(id);
  const loanIdNum = parseInt(loanId);

  if (isNaN(clientId) || isNaN(loanIdNum)) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/clients" className="hover:text-foreground">Clients</Link>
        <span>/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-foreground">Client #{clientId}</Link>
        <span>/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-foreground">Loans</Link>
        <span>/</span>
        <span className="text-foreground">Loan #{loanId}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/clients/${clientId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Client
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Loan Details</h1>
          <p className="text-muted-foreground">
            Client #{clientId} - Loan #{loanId}
          </p>
        </div>
      </div>

      {/* Client Loan Details */}
      <Suspense fallback={<div>Loading loan details...</div>}>
        <ClientLoanDetails clientId={clientId} loanId={loanIdNum} />
      </Suspense>
    </div>
  );
} 