"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function UsersListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="rounded-lg border">
        <div className="space-y-2 border-b p-6">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>

          <div className="rounded-md border">
            <div className="grid grid-cols-5 gap-4 border-b px-4 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={`users-header-${index}`} className="h-4 w-20" />
              ))}
            </div>

            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <div
                  key={`users-row-${rowIndex}`}
                  className="grid grid-cols-5 gap-4 border-b px-4 py-4 last:border-b-0"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserDetailsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="rounded-lg border">
        <div className="space-y-2 border-b p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`user-detail-field-${index}`} className="space-y-2 rounded-lg border p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="space-y-2 border-b p-6">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="p-6">
          <div className="rounded-xl border-2 border-dashed p-6">
            <Skeleton className="mx-auto h-28 w-64 max-w-full" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="space-y-2 border-b p-6">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`user-role-${index}`} className="h-6 w-24" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function UserEditSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="rounded-lg border">
        <div className="space-y-2 border-b p-6">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>

        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`edit-field-${index}`} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`edit-toggle-${index}`}
                className="flex items-start gap-3 rounded-lg border p-4"
              >
                <Skeleton className="mt-1 h-4 w-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-xl border p-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="rounded-xl border-2 border-dashed p-6">
              <Skeleton className="mx-auto h-28 w-64 max-w-full" />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border p-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`edit-role-${index}`}
                  className="flex items-start gap-3 rounded-lg border p-4"
                >
                  <Skeleton className="mt-1 h-4 w-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
