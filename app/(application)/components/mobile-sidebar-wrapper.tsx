"use client";

import { MobileSidebar } from "./mobile-sidebar";

interface MobileSidebarWrapperProps {
  tenantLogoUrl?: string | null;
  canReadUsers: boolean;
  canResetUssdPin: boolean;
  canAccessUssdDetails: boolean;
}

export function MobileSidebarWrapper({
  tenantLogoUrl,
  canReadUsers,
  canResetUssdPin,
  canAccessUssdDetails,
}: MobileSidebarWrapperProps) {
  return (
    <MobileSidebar
      tenantLogoUrl={tenantLogoUrl}
      canReadUsers={canReadUsers}
      canResetUssdPin={canResetUssdPin}
      canAccessUssdDetails={canAccessUssdDetails}
    />
  );
}
