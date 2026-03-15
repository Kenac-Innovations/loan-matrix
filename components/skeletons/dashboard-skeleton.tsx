import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-6">
        {/* Loan Portfolio Chart */}
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-md" />
          </CardContent>
        </Card>

        {/* Risk Assessment Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Risk Progress Bars */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-2 w-20" />
                </div>
              </div>
            ))}
            <Skeleton className="h-[150px] w-full rounded-md" />
          </CardContent>
        </Card>
      </div>

      {/* Three Column Cards Row */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-8 w-16" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security Alerts */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Inbox */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-8 w-16" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-12" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Dashboard Table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Table Header */}
              <div className="grid grid-cols-5 gap-4 pb-3 border-b">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>

              {/* Table Rows */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-4 py-3 border-b">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
