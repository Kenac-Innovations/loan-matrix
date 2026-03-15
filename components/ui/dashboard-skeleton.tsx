import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <>
      {/* Summary Cards Skeleton */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section Skeleton */}
      <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-6">
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
            <Skeleton className="h-[150px] w-full mt-6" />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section Skeleton */}
      <div className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-8 w-20" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance Table Skeleton */}
      <div className="mt-6 overflow-hidden">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="w-full min-w-[640px]">
                {/* Table Header */}
                <div className="border-b pb-3 mb-3">
                  <div className="grid grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-20" />
                    ))}
                  </div>
                </div>
                {/* Table Rows */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-5 gap-4 py-3 border-b">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
