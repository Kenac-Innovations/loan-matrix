import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadDetailsLoading() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">Loading lead details</CardTitle>
          <CardDescription>
            Hydrating the full lead page and fetching supporting loan data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={78} className="h-2" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-40 rounded-xl lg:col-span-2" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
