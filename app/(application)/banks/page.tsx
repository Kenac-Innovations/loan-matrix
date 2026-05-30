import { Suspense } from "react";
import { Plus, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BanksTable } from "./components/banks-table";
import { BanksPageSkeleton } from "@/components/skeletons/banks-skeleton";

export default function BanksPage() {
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
          <CardTitle>All Banks</CardTitle>
          <CardDescription>
            Manage banks, allocate funds, and assign tellers. Banks are the top
            level of the cash management hierarchy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<BanksPageSkeleton />}>
            <BanksTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
