import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { LeadsStatusTabs } from "./components/leads-status-tabs";
import { PermissionGate } from "@/components/auth/permission-gate";
import { SpecificPermission } from "@/shared/types/auth";

export const metadata: Metadata = {
  title: "Lead Management | KENAC Loan Matrix",
  description: "Track and manage loan leads through the sales pipeline",
};

export default async function LeadsPage() {
  return (
    <>
      <div className="flex flex-col justify-between gap-3 sm:gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Lead Management</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track leads through the loan processing pipeline
          </p>
        </div>
        <PermissionGate permission={SpecificPermission.CREATE_LOAN}>
          <Button className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto" asChild>
            <Link href="/leads/new">
              <Plus className="mr-2 h-4 w-4" />
              Add New Lead
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <div className="mt-4 sm:mt-6">
        <LeadsStatusTabs />
      </div>
    </>
  );
}
