import { Suspense } from "react";
import { UserPlus, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { ClientMetrics } from "./components/client-metrics";
import Link from "next/link";
import { ClientsTable } from "./components/clients-table";

export default function ClientsPage() {
  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-2">
            Manage and monitor your client portfolio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/clients/new">
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <Suspense fallback={<div>Loading metrics...</div>}>
        <ClientMetrics />
      </Suspense>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>
            Complete list of clients with their current status and details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading clients...</div>}>
            <ClientsTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
