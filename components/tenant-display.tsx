import { getTenantFromHeaders } from "@/lib/tenant-service";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

export async function TenantDisplay() {
  const tenant = await getTenantFromHeaders();

  if (!tenant) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{tenant.name}</span>
          <Badge variant="secondary" className="text-xs w-fit">
            {tenant.slug}
          </Badge>
        </div>
      </div>
    </div>
  );
}
