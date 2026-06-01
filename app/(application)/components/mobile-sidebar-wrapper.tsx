"use client";

import dynamic from "next/dynamic";

const MobileSidebar = dynamic(
  () => import("./mobile-sidebar").then((mod) => mod.MobileSidebar),
  { ssr: false }
);

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
