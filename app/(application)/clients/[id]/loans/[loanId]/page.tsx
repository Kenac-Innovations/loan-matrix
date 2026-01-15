import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
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
    <div className="space-y-4">
      {/* Enhanced Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span className="text-muted-foreground/50">/</span>
        <Link href="/clients" className="hover:text-foreground transition-colors">Clients</Link>
        <span className="text-muted-foreground/50">/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-foreground transition-colors">Client #{clientId}</Link>
        <span className="text-muted-foreground/50">/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-foreground transition-colors">Loans</Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground font-medium">Loan #{loanId}</span>
      </nav>

      {/* Enhanced Header */}
      <div className="flex items-center gap-6">
        <BackButton className="shadow-sm" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Loan Details</h1>
                <p className="text-muted-foreground">
                  Client #{clientId} - Loan #{loanId}
                </p>
              </div>
            </div>
            {/* Loan Actions will be rendered here by ClientLoanDetails */}
            <div id="loan-actions-container"></div>
          </div>
        </div>
      </div>

      {/* Client Loan Details */}
      <Suspense fallback={
        <div className="space-y-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="h-32 rounded-xl bg-muted animate-pulse"></div>
            <div className="h-32 rounded-xl bg-muted animate-pulse"></div>
            <div className="h-32 rounded-xl bg-muted animate-pulse"></div>
          </div>
          <div className="h-96 rounded-xl bg-muted animate-pulse"></div>
        </div>
      }>
        <ClientLoanDetails clientId={clientId} loanId={loanIdNum} />
      </Suspense>
    </div>
  );
} 