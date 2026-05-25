import { Suspense } from "react";
import { Plus, Download, Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BanksTable } from "./components/banks-table";
import { getOfficeVisibilityScope } from "@/lib/office-access";

export default async function BanksPage() {
  const scope = await getOfficeVisibilityScope();
  const scopedToBranch = scope.kind === "office";
  const titleSuffix = scopedToBranch ? ` — ${scope.officeName}` : "";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Bank Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage banks (vaults), fund allocations, and connected tellers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/banks/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Bank
            </Button>
          </Link>
        </div>
      </div>

      {/* Banks Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>All Banks{titleSuffix}</CardTitle>
            {scopedToBranch && (
              <Badge variant="outline" className="gap-1 text-xs font-normal">
                <Building2 className="h-3 w-3" />
                Branch view: {scope.officeName}
              </Badge>
            )}
          </div>
          <CardDescription>
            {scopedToBranch
              ? `Showing banks assigned to ${scope.officeName}. Other branches are not visible to your role.`
              : "Manage banks, allocate funds, and assign tellers. Banks are the top level of the cash management hierarchy."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading banks...</div>}>
            <BanksTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

