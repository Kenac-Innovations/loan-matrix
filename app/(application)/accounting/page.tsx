// app/(application)/accounting/page.tsx
import AccountingLayout from "./layout";
import StatsCards from "@/components/accounting/StatsCards";
import AccountingHome from "@/components/accounting/AccountingHome";
import { Users, FileText, ListChecks, RefreshCcw } from "lucide-react";

export default async function AccountingPage() {
  const stats = [
    { title: "Total Accounts",          value: 128,      delta: "+5% MoM",       icon: Users },
    { title: "Journal Entries (YTD)",   value: 3420,     delta: "+8% MoM",       icon: FileText },
    { title: "Frequent Postings",       value: 12,       delta: "+2 this week",  icon: ListChecks },
    { title: "Closing Entries Pending", value: 3,        delta: "—",             icon: RefreshCcw },
  ];

  return (
    <>
      {/* Single page-level title */}
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
        Accounting
      </h1>

      <AccountingLayout>
        <StatsCards stats={stats} />
        <AccountingHome />
      </AccountingLayout>
    </>
  );
}
