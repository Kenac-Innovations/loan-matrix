"use client";

import dynamic from "next/dynamic";
import type { UserProfileData } from "./user-profile-data";

const MobileSidebar = dynamic(
  () => import("./mobile-sidebar").then((mod) => mod.MobileSidebar),
  { ssr: false }
);

interface MobileSidebarWrapperProps {
  userProfileData: UserProfileData;
  tenantLogoUrl?: string | null;
}

export function MobileSidebarWrapper({ userProfileData, tenantLogoUrl }: MobileSidebarWrapperProps) {
  return <MobileSidebar userProfileData={userProfileData} tenantLogoUrl={tenantLogoUrl} />;
}
