import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function PageHeaderSkeleton({
  actions = 2,
  descriptionWidth = "w-96",
}: {
  actions?: number;
  descriptionWidth?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className={`h-4 max-w-full ${descriptionWidth}`} />
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: actions }).map((_, index) => (
            <Skeleton key={`header-action-${index}`} className="h-10 w-32" />
          ))}
        </div>
      )}
    </div>
  );
}

function TableSkeleton({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <div className="rounded-md border">
      <div
        className="grid gap-4 border-b p-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`table-header-${index}`} className="h-4 w-full" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`table-row-${rowIndex}`}
          className="grid gap-4 border-b p-4 last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={`table-cell-${rowIndex}-${columnIndex}`}
              className={columnIndex === columns - 1 ? "h-8 w-20" : "h-4 w-full"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PermissionGroupsSkeleton({ groups = 4 }: { groups?: number }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full sm:max-w-md" />
          <Skeleton className="h-4 w-44" />
        </div>

        {Array.from({ length: groups }).map((_, groupIndex) => (
          <section key={`permission-group-${groupIndex}`} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, itemIndex) => (
                <div
                  key={`permission-item-${groupIndex}-${itemIndex}`}
                  className="flex min-h-12 items-start gap-3 rounded-md border px-3 py-2"
                >
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

export function SystemLandingSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={0} />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`system-card-${index}`} className="rounded-lg">
            <CardContent className="flex gap-4 p-6">
              <Skeleton className="h-11 w-11 shrink-0" />
              <div className="w-full space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function RolesListSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <Card className="rounded-lg">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-10 w-full sm:w-80" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={5} />
        </CardContent>
      </Card>
    </div>
  );
}

export function RoleDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={3} />
      <PermissionGroupsSkeleton />
    </div>
  );
}

export function MakerCheckerSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <PermissionGroupsSkeleton groups={5} />
    </div>
  );
}

export function CheckerInboxSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <Card className="rounded-lg">
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={6} />
        </CardContent>
      </Card>
    </div>
  );
}

export function AuditTrailsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <Card className="rounded-lg">
        <CardHeader>
          <Skeleton className="h-6 w-20" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={`audit-filter-${index}`} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-lg">
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={8} />
        </CardContent>
      </Card>
    </div>
  );
}

export function DetailPageSkeleton({
  showBackButton = true,
}: {
  showBackButton?: boolean;
}) {
  return (
    <div className="space-y-6">
      {showBackButton && <Skeleton className="h-10 w-44" />}
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Card className="rounded-lg">
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={`detail-box-${index}`} className="rounded-md border p-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-lg">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function ManageJobsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={0} />
      <Skeleton className="h-9 w-96 max-w-full" />
      <Card className="rounded-lg">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={7} />
        </CardContent>
      </Card>
    </div>
  );
}

export function SchedulerJobEditSkeleton() {
  return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-10 w-36" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Card className="rounded-lg">
        <CardHeader>
          <Skeleton className="h-6 w-44" />
        </CardHeader>
        <CardContent className="space-y-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`job-edit-field-${index}`} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-28" />
        </CardContent>
      </Card>
    </div>
  );
}

export function SchedulerHistorySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-36" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card className="rounded-lg">
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={6} />
        </CardContent>
      </Card>
    </div>
  );
}
