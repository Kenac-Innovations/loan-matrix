import type { Metadata } from "next";
import { LoanProductEligibilityManager } from "./components/loan-product-eligibility-manager";

export const metadata: Metadata = {
  title: "Loan Product Eligibility | KENAC Loan Matrix",
  description: "Upload and sync product-specific user eligibility for USSD loan applications",
};

export default function LoanProductEligibilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Loan Product Eligibility</h2>
        <p className="text-muted-foreground">
          Upload CSV files with Name, NRC and Phone to control who can apply for selected loan products in USSD.
        </p>
      </div>
      <LoanProductEligibilityManager />
    </div>
  );
}
