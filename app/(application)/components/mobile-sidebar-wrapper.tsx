"use client";

import { MobileSidebar } from "./mobile-sidebar";

interface MobileSidebarWrapperProps {
  tenantLogoUrl?: string | null;
  canReadUsers: boolean;
  canResetUssdPin: boolean;
  canUpdateUssdClientDetails: boolean;
}

export function MobileSidebarWrapper({
  tenantLogoUrl,
  canReadUsers,
  canResetUssdPin,
  canUpdateUssdClientDetails,
}: MobileSidebarWrapperProps) {
  return (
    <MobileSidebar
      tenantLogoUrl={tenantLogoUrl}
      canReadUsers={canReadUsers}
      canResetUssdPin={canResetUssdPin}
      canUpdateUssdClientDetails={canUpdateUssdClientDetails}
    />
  );
}
