import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonForm() {
  return (
    <div className="space-y-6">
      {/* Form skeleton */}
      <div className="border rounded-lg">
        {/* Card header skeleton */}
        <div className="p-6 border-b">
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>

        {/* Card content skeleton */}
        <div className="p-6 space-y-8">
          {/* Administrative Information Section */}
          <div className="space-y-6 mb-8">
            <div className="border-b pb-3 mb-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="space-y-6 mb-8">
            <div className="border-b pb-3 mb-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-6 mb-8">
            <div className="border-b pb-3 mb-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>

          {/* Client Classification Section */}
          <div className="space-y-6 mb-8">
            <div className="border-b pb-3 mb-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="space-y-6 mb-8">
            <div className="border-b pb-3 mb-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>

          {/* Next of Kin Section */}
          <div className="space-y-6 mb-8">
            <div className="border-b pb-3 mb-6 flex justify-between items-center">
              <div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>

            <div className="text-center py-8">
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
          </div>

          {/* Account Settings Section */}
          <div className="space-y-6 mb-8">
            <div className="border-b pb-3 mb-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-full" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        </div>

        {/* Card footer skeleton */}
        <div className="p-6 border-t flex justify-between">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}
