import { Skeleton } from "@/components/ui/skeleton";
import { ClientEditFormSkeleton } from "./components/client-edit-form-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-12" />
        <span>/</span>
        <Skeleton className="h-4 w-14" />
        <span>/</span>
        <Skeleton className="h-4 w-24" />
        <span>/</span>
        <Skeleton className="h-4 w-10" />
      </nav>

      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>

      <ClientEditFormSkeleton />
    </div>
  );
}
