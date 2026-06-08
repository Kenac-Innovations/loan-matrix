import type { Metadata } from "next";
import { BranchPerformanceDashboard } from "./branch-performance-dashboard";

export const metadata: Metadata = {
  title: "Branch Collection Performance | KENAC Loan Matrix",
  description: "Review expected versus actual loan collections by branch",
};

export default function BranchCollectionPerformancePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Branch Collection Performance</h2>
          <p className="text-muted-foreground">
            Compare scheduled repayments against actual collections by branch.
          </p>
        </div>
      </div>

      <BranchPerformanceDashboard />
    </div>
  );
}
