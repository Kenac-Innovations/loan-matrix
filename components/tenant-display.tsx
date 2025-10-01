import { getTenantFromHeaders } from "@/lib/tenant-service";
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
        <span className="font-medium text-foreground">{tenant.name}</span>
      </div>
    </div>
  );
}
