import type React from "react";
import { getUserProfileData } from "./components/user-profile-data";
import { getTenantFromHeaders } from "@/lib/tenant-service";

import Image from "next/image";
import AIAssistant from "@/components/ai-assistant";
import { Suspense } from "react";

// Client components
import { UserProfileClient } from "./components/user-profile-client";
import { MobileSidebar } from "./components/mobile-sidebar";
import { SidebarNav } from "./components/sidebar-nav";
import { ChatProvider } from "@/contexts/chat-context";
import { TenantDisplay } from "@/components/tenant-display";
import { MobileMenuProvider } from "./components/mobile-menu-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userProfileData, tenant] = await Promise.all([
    getUserProfileData(),
    getTenantFromHeaders(),
  ]);
  const tenantLogoUrl = tenant?.logoFileUrl ?? null;

  return (
    <ChatProvider>
      <MobileMenuProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block lg:w-64 bg-background border-border border-r h-screen sticky top-0 z-30 overflow-y-auto">
            <div className="flex h-16 items-center justify-center border-b border-white/20 dark:border-white/10 px-4 sticky top-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md z-10">
              <div className="flex items-center">
                {tenantLogoUrl ? (
                  <img
                    src={tenantLogoUrl}
                    alt={`${tenant?.name ?? "Organization"} Logo`}
                    width={120}
                    height={40}
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <>
                    <Image
                      src="/kenac_logo_light.png"
                      alt="Kenac Logo"
                      width={120}
                      height={40}
                      className="dark:hidden"
                      priority
                    />
                    <Image
                      src="/kenac_logo.png"
                      alt="Kenac Logo"
                      width={120}
                      height={40}
                      className="hidden dark:block"
                      priority
                    />
                  </>
                )}
              </div>
            </div>
            <TenantDisplay />
            <div className="py-4 h-[calc(100vh-7rem)] overflow-y-auto">
              <SidebarNav />
            </div>
          </div>

          {/* Mobile Sidebar */}
          <MobileSidebar userProfileData={userProfileData} tenantLogoUrl={tenantLogoUrl} />

          {/* Main Content */}
          <div className="relative flex-1 h-screen overflow-y-auto">
            {/* Header with glass effect */}
            <UserProfileClient userProfileData={userProfileData} />

            {/* Main Content - scrolls under the header */}
            <main className="p-8 min-h-[calc(100vh-4rem)]">
              <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
            </main>
          </div>

          {/* AI Assistant */}
          <AIAssistant />
        </div>
      </MobileMenuProvider>
    </ChatProvider>
  );
}
