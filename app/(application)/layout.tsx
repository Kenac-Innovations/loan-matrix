
import type React from "react";
import { getUserProfileData } from "./components/user-profile-data";

// Client components

import Link from "next/link";
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  Home,
  Lock,
  PlusCircle,
  Settings,
  Shield,
  Users,
  TrendingUp,
} from "lucide-react";
import AIAssistant from "@/components/ai-assistant";
import { Suspense } from "react";

// Client component for mobile sidebar

import { UserProfileClient } from "./components/user-profile-client";
import { MobileSidebar } from "./components/mobile-sidebar";
import MenuItemWithSubmenu from "@/components/menu-with-sub";
import { ChatProvider } from "@/contexts/chat-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch user profile data
  const userProfileData = await getUserProfileData();

  return (
    <ChatProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:w-64 bg-background border-border border-r h-screen sticky top-0 z-30 overflow-y-auto">
          <div className="flex h-16 items-center border-border border-b px-4 sticky top-0 bg-background z-10">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500 text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M7 7h10" />
                  <path d="M7 12h10" />
                  <path d="M7 17h10" />
                </svg>
              </div>
              <span className="text-lg font-bold">
                {userProfileData.tenantId.toUpperCase()}
              </span>
              {!userProfileData.isLoggedIn && (
                <span className="ml-2 text-xs bg-yellow-500 text-white px-2 py-0.5 rounded">
                  Guest
                </span>
              )}
            </div>
          </div>
          <div className="py-4 h-[calc(100vh-4rem)] overflow-y-auto">
            <nav className="space-y-1 px-2">
              <Link
                href="/leads/new"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <PlusCircle className="h-4 w-4" />
                New Lead
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>

              <div className="space-y-1">
                <MenuItemWithSubmenu
                  icon={<TrendingUp />}
                  label="Leads"
                  href="/leads"
                  subMenuItems={[
                    { label: "Pipeline", href: "/leads" },
                    { label: "Configuration", href: "/leads/config" },
                  ]}
                />
              </div>


              <Link
                href="#"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <CreditCard className="h-4 w-4" />
                Loans
              </Link>

              <div className="space-y-1">
                <MenuItemWithSubmenu
                  icon={<Users />}
                  label="Clients"
                  href="/clients"
                  subMenuItems={[
                    { label: "All Clients", href: "/clients" },
                    { label: "Add Client", href: "/clients/new" },
                  ]}
                />
              </div>

                <MenuItemWithSubmenu
                  icon={<BarChart3 />}
                  label="Accounting"
                  href="/accounting"
                  subMenuItems={[
                    { label: "Home", href: "/accounting" },
                    { label: "Chart of Accounts", href: "/accounting/chart-of-accounts" },
                    { label: "Journal Entries", href: "/accounting/journal-entries" },
                    { label: "Search Journal", href: "/accounting/search-journal" },
                    { label: "Frequent Postings", href: "/accounting/frequent-postings" },
                  ]}
                />


                <Link
                  href="#"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <FileText className="h-4 w-4" />
                  Documents
                </Link>

                <Link
                  href="#"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>

                <Link
                  href="#"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Shield className="h-4 w-4" />
                  Compliance
                </Link>

                <Link
                  href="#"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Lock className="h-4 w-4" />
                  Security
                </Link>

                <div className="space-y-1">
                  <MenuItemWithSubmenu
                    icon={<Bot />}
                    label="AI Assistant"
                    href="/ai-assistant"
                    subMenuItems={[
                      { label: "Chat", href: "/ai-assistant" },
                      { label: "Admin", href: "/rag-admin" },
                    ]}
                  />
                </div>

                <Link
                  href="#"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </nav>
          </div>
        </div>

        {/* Mobile Sidebar */}
        <MobileSidebar userProfileData={userProfileData} />

        {/* Main Content */}
        <div className="flex flex-1 flex-col h-screen overflow-hidden">
          {/* Pass user profile data to the client component */}
          <UserProfileClient userProfileData={userProfileData} />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
            <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
          </main>
        </div>

        {/* AI Assistant */}
        <AIAssistant />
      </div>
    </ChatProvider>
  );
}

