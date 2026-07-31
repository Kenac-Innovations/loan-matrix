import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type AccessRestrictedProps = {
  title?: string;
  description?: string;
  className?: string;
};

/**
 * Friendly empty-state for "your account can't see this section" (typically a 403
 * from Fineract) - use instead of a raw destructive error alert wherever a missing
 * permission is an expected, unsurprising outcome rather than a bug.
 */
export function AccessRestricted({
  title = "You don't have access to this",
  description = "Your account doesn't have permission to view this section. Ask an administrator to grant the relevant permission if you believe this is a mistake.",
  className,
}: AccessRestrictedProps) {
  return (
    <Card
      className={`rounded-lg border-dashed border-destructive/40 ${className ?? ""}`}
    >
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-destructive">{title}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
