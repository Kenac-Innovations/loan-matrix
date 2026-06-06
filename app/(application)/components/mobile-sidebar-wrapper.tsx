"use client";

import { MobileSidebar } from "./mobile-sidebar";

interface MobileSidebarWrapperProps {
  tenantLogoUrl?: string | null;
  canReadUsers: boolean;
}

export function MobileSidebarWrapper({
  tenantLogoUrl,
  canReadUsers,
}: MobileSidebarWrapperProps) {
  return (
    <MobileSidebar
      tenantLogoUrl={tenantLogoUrl}
      canReadUsers={canReadUsers}
    />
  );
}
