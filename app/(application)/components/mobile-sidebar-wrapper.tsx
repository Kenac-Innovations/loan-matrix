"use client";

import { MobileSidebar } from "./mobile-sidebar";

interface MobileSidebarWrapperProps {
  tenantLogoUrl?: string | null;
  canReadUsers: boolean;
  canResetUssdPin: boolean;
}

export function MobileSidebarWrapper({
  tenantLogoUrl,
  canReadUsers,
  canResetUssdPin,
}: MobileSidebarWrapperProps) {
  return (
    <MobileSidebar
      tenantLogoUrl={tenantLogoUrl}
      canReadUsers={canReadUsers}
      canResetUssdPin={canResetUssdPin}
    />
  );
}
