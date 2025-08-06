// app/(application)/accounting/page.tsx
import AccountingLayout from "./layout";
import StatsCards from "@/components/accounting/StatsCards";
import AccountingHome from "@/components/accounting/AccountingHome";
import { Users, FileText, ListChecks, RefreshCcw, TrendingUp, DollarSign, Calculator, Shield } from "lucide-react";

export default async function AccountingPage() {
  const stats = [
    { 
      title: "Total GL Accounts", 
      value: 128, 
      delta: "+5% MoM", 
      icon: Users,
      description: "Active general ledger accounts",
      trend: "up"
    },
    { 
      title: "Journal Entries (YTD)", 
      value: 3420, 
      delta: "+8% MoM", 
      icon: FileText,
      description: "Total entries this year",
      trend: "up"
    },
    { 
      title: "Frequent Postings", 
      value: 12, 
      delta: "+2 this week", 
      icon: ListChecks,
      description: "Recurring transactions",
      trend: "up"
    },
    { 
      title: "Closing Entries Pending", 
      value: 3, 
      delta: "—", 
      icon: RefreshCcw,
      description: "Month-end adjustments",
      trend: "neutral"
    },
  ];

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Accounting Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your financial records, chart of accounts, and journal entries
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Financial Management</span>
        </div>
      </div>

      <AccountingLayout>
        <StatsCards stats={stats} />
        <AccountingHome />
      </AccountingLayout>
    </div>
  );
}
