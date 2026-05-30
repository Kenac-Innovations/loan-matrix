import { Skeleton } from "@/components/ui/skeleton";

export function ClientEditFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card">
        <div className="border-b p-6">
          <Skeleton className="h-7 w-56 mb-2" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-4 pt-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}
