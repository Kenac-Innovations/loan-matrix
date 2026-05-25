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
import { TellersTable } from "./components/tellers-table";
import { getOfficeVisibilityScope } from "@/lib/office-access";

export default async function TellersPage() {
  const scope = await getOfficeVisibilityScope();
  const scopedToBranch = scope.kind === "office";
  const titleSuffix = scopedToBranch ? ` — ${scope.officeName}` : "";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Teller Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage tellers, cash allocations, and settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/tellers/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Teller
            </Button>
          </Link>
        </div>
      </div>

      {/* Tellers Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>All Tellers{titleSuffix}</CardTitle>
            {scopedToBranch && (
              <Badge variant="outline" className="gap-1 text-xs font-normal">
                <Building2 className="h-3 w-3" />
                Branch view: {scope.officeName}
              </Badge>
            )}
          </div>
          <CardDescription>
            {scopedToBranch
              ? `Showing tellers assigned to ${scope.officeName}. Other branches are not visible to your role.`
              : "Manage tellers, assign cashiers, allocate cash, and process settlements"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading tellers...</div>}>
            <TellersTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}


