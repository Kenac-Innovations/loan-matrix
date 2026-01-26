import type React from "react";
import { getUserProfileData } from "./components/user-profile-data";

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
  // Fetch user profile data
  const userProfileData = await getUserProfileData();

  return (
    <ChatProvider>
      <MobileMenuProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block lg:w-64 bg-background border-border border-r h-screen sticky top-0 z-30 overflow-y-auto">
            <div className="flex h-16 items-center justify-center border-border border-b px-4 sticky top-0 bg-background z-10">
              <div className="flex items-center">
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
              </div>
            </div>
            <TenantDisplay />
            <div className="py-4 h-[calc(100vh-7rem)] overflow-y-auto">
              <SidebarNav />
            </div>
          </div>

          {/* Mobile Sidebar */}
          <MobileSidebar userProfileData={userProfileData} />

          {/* Main Content */}
          <div className="flex flex-1 flex-col h-screen overflow-hidden">
            {/* Pass user profile data to the client component */}
            <UserProfileClient userProfileData={userProfileData} />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8 bg-background">
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
