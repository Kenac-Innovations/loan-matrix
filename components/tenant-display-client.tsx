"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  settings?: any;
}

export function TenantDisplayClient() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    // Get tenant info from the current host
    const host = window.location.host;
    const tenantSlug = extractTenantSlug(host);

    // For now, we'll use the slug as the name and display it
    // In a real app, you might want to fetch this from an API
    setTenant({
      id: tenantSlug,
      name: tenantSlug.charAt(0).toUpperCase() + tenantSlug.slice(1),
      slug: tenantSlug,
    });
  }, []);

  if (!tenant) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1a2035]">
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-white">
            {tenant.name}
          </span>
          <Badge variant="secondary" className="text-xs w-fit">
            {tenant.slug}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function extractTenantSlug(host: string): string {
  if (!host) return "default";

  // Remove port if present
  const hostWithoutPort = host.split(":")[0];

  // Handle localhost development
  if (hostWithoutPort === "localhost") {
    return "default";
  }

  // Extract subdomain
  const parts = hostWithoutPort.split(".");
  if (parts.length > 2) {
    return parts[0]; // First part is the subdomain
  }

  // If no subdomain, use default
  return "default";
}
