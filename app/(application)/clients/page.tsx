import { Suspense } from "react";
import { UserPlus, Search, Filter, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Client Directory</CardTitle>
          <CardDescription>
            Search and filter through your client database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients by name, ID, or email..."
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button variant="outline" size="sm">
                Status
              </Button>
              <Button variant="outline" size="sm">
                Office
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
