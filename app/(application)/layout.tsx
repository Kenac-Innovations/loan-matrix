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
  ShieldCheck,
  Users,
  TrendingUp,
} from "lucide-react";
import AIAssistant from "@/components/ai-assistant";
import { Suspense } from "react";

// Client component for mobile sidebar

import { UserProfileClient } from "./components/user-profile-client";
import { MobileSidebar } from "./components/mobile-sidebar";
import MenuItemWithSubmenu from "@/components/menu-with-sub";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch user profile data
  const userProfileData = await getUserProfileData();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#0a0e17]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 bg-white dark:bg-[#0d121f] border-gray-200 dark:border-[#1a2035] border-r h-screen sticky top-0 z-30 overflow-y-auto">
        <div className="flex h-16 items-center border-gray-200 dark:border-[#1a2035] border-b px-4 sticky top-0 bg-white dark:bg-[#0d121f] z-10">
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
            <span className="text-lg font-bold text-gray-900 dark:text-white">
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
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
            >
              <PlusCircle className="h-4 w-4" />
              New Lead
            </Link>
            {/* <Link
              href="/auth-demo"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
            >
              <ShieldCheck className="h-4 w-4" />
              Auth Demo
            </Link> */}
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
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1a2035] dark:hover:text-white"
            >
              <CreditCard className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              Loans
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1a2035] dark:hover:text-white"
            >
              <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              Clients
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1a2035] dark:hover:text-white"
            >
              <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              Documents
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1a2035] dark:hover:text-white"
            >
              <BarChart3 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              Analytics
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1a2035] dark:hover:text-white"
            >
              <Shield className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              Compliance
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1a2035] dark:hover:text-white"
            >
              <Lock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              Security
            </Link>
            <Link
              href="/dashboard/rag"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1a2035] dark:hover:text-white"
            >
              <Bot className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              AI Assistant
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1a2035] dark:hover:text-white"
            >
              <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />
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
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0a0e17] p-4 lg:p-6">
          <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        </main>
      </div>

      {/* AI Assistant */}
      <AIAssistant />
    </div>
  );
}
