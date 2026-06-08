import type { Metadata } from "next";
import { RecoveriesDashboard } from "./recoveries-dashboard";

export const metadata: Metadata = {
  title: "Recoveries | KENAC Loan Matrix",
  description: "Manage arrears follow-ups, NPA accounts, and court recoveries",
};

export default function RecoveriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Recoveries</h2>
          <p className="text-muted-foreground">
            Track arrears buckets, follow-ups, NPA accounts, court processes, and branch collection performance.
          </p>
        </div>
      </div>

      <RecoveriesDashboard />
    </div>
  );
}
