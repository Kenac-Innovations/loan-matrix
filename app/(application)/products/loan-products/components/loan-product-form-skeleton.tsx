import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoanProductFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {/* Step indicator skeleton */}
      <div className="rounded-2xl border bg-card px-4 py-5">
        <div className="flex items-center">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <Skeleton className="h-2.5 w-10" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-2 w-12" />
              </div>
              {i < 6 && <Skeleton className="mx-1 hidden h-0.5 w-6 shrink-0 sm:block" />}
            </div>
          ))}
        </div>
      </div>

      {/* Card content skeleton */}
      <Card className="overflow-hidden">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-80" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`space-y-2 ${i === 2 ? "sm:col-span-2" : ""}`}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Nav skeleton */}
      <div className="flex items-center justify-between border-t pt-4">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  );
}
