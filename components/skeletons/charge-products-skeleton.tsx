import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChargeProductsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-9 gap-4 border-b p-4">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={`charge-header-${index}`} className="h-4 w-full" />
              ))}
            </div>

            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <div
                key={`charge-row-${rowIndex}`}
                className="grid grid-cols-9 gap-4 border-b p-4 last:border-b-0"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
