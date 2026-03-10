"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { UserProfileData } from "./user-profile-data";
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  Receipt,
  Users,
  TrendingUp,
  X,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TenantDisplayClient } from "@/components/tenant-display-client";
import { useMobileMenu } from "./mobile-menu-context";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

interface MobileSidebarProps {
  userProfileData: UserProfileData;
  /** Organization logo URL from document service (when set) */
  tenantLogoUrl?: string | null;
}

export function MobileSidebar({ userProfileData, tenantLogoUrl }: MobileSidebarProps) {
  const pathname = usePathname();
  const { mobileMenuOpen, setMobileMenuOpen } = useMobileMenu();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isEnabled } = useFeatureFlags();

  // Get login status and tenant
  const { isLoggedIn, tenantId } = userProfileData;

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu when changing routes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        (event.target as HTMLElement).closest("[data-mobile-toggle]") === null
      ) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Define colors based on theme
  const bgColor = mounted && theme === "light" ? "bg-white" : "bg-[#0d121f]";
  const borderColor =
    mounted && theme === "light" ? "border-gray-200" : "border-[#1a2035]";
  const textColor =
    mounted && theme === "light" ? "text-gray-900" : "text-white";
  const textColorMuted =
    mounted && theme === "light" ? "text-gray-500" : "text-gray-300";
  const iconColor =
    mounted && theme === "light" ? "text-gray-500" : "text-gray-400";
  const iconColorActive =
    mounted && theme === "light" ? "text-blue-500" : "text-blue-400";
  const hoverBgColor =
    mounted && theme === "light" ? "hover:bg-gray-100" : "hover:bg-[#1a2035]";
  const activeBgColor =
    mounted && theme === "light" ? "bg-gray-100" : "bg-[#1a2035]";

  return (
    <>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        ref={mobileMenuRef}
        className={`fixed inset-y-0 left-0 z-50 w-64 ${bgColor} transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className={`flex h-16 items-center justify-between ${borderColor} border-b px-4`}
        >
          <div className="flex items-center">
            {tenantLogoUrl ? (
              <img
                src={tenantLogoUrl}
                alt="Organization Logo"
                width={100}
                height={32}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <>
                <Image
                  src="/kenac_logo_light.png"
                  alt="Kenac Logo"
                  width={100}
                  height={32}
                  className="dark:hidden"
                  priority
                />
                <Image
                  src="/kenac_logo.png"
                  alt="Kenac Logo"
                  width={100}
                  height={32}
                  className="hidden dark:block"
                  priority
                />
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={textColor}
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <TenantDisplayClient />
        <div className="py-4 h-[calc(100vh-7rem)] overflow-y-auto">
          <nav className="space-y-1 px-2">
            <div className="space-y-1">
              <Link
                href="/leads"
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/leads") || pathname.startsWith("/ussd-leads")
                    ? `${activeBgColor} ${textColor}`
                    : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
                }`}
              >
                <TrendingUp
                  className={`h-5 w-5 ${
                    pathname.startsWith("/leads") || pathname.startsWith("/ussd-leads") ? iconColorActive : iconColor
                  }`}
                />
                Leads
              </Link>

              {(pathname.startsWith("/leads") ||
                pathname.startsWith("/ussd-leads")) && (
                <div className="pl-10 space-y-1">
                  <Link
                    href="/leads"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname === "/leads"
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    Pipeline
                  </Link>
                  {isEnabled("ussdLeads") && (
                    <Link
                      href="/ussd-leads"
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                        pathname === "/ussd-leads"
                          ? iconColorActive
                          : `${iconColor} hover:${textColor}`
                      }`}
                    >
                      USSD Leads
                    </Link>
                  )}
                  {isEnabled("leadConfig") && (
                    <Link
                      href="/leads/config"
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                        pathname === "/leads/config"
                          ? iconColorActive
                          : `${iconColor} hover:${textColor}`
                      }`}
                    >
                      Configuration
                    </Link>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/loans"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                pathname.startsWith("/loans")
                  ? `${activeBgColor} ${textColor}`
                  : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
              }`}
            >
              <CreditCard
                className={`h-5 w-5 ${
                  pathname.startsWith("/loans") ? iconColorActive : iconColor
                }`}
              />
              Loans
            </Link>

            <div className="space-y-1">
              <Link
                href="/collections"
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/collections")
                    ? `${activeBgColor} ${textColor}`
                    : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
                }`}
              >
                <Receipt
                  className={`h-5 w-5 ${
                    pathname.startsWith("/collections") ? iconColorActive : iconColor
                  }`}
                />
                Collections
              </Link>

              {pathname.startsWith("/collections") && (
                <div className="pl-10 space-y-1">
                  <Link
                    href="/collections"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname === "/collections"
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    Expected Payments
                  </Link>
                  <Link
                    href="/collections/bulk-receipting"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname === "/collections/bulk-receipting"
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    Bulk Receipting
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Link
                href="/clients"
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/clients")
                    ? `${activeBgColor} ${textColor}`
                    : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
                }`}
              >
                <Users
                  className={`h-5 w-5 ${
                    pathname.startsWith("/clients") ? iconColorActive : iconColor
                  }`}
                />
                Clients
              </Link>

              {pathname.startsWith("/clients") && (
                <div className="pl-10 space-y-1">
                  <Link
                    href="/clients"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname === "/clients"
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    All Clients
                  </Link>
                  <Link
                    href="/clients/new"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname === "/clients/new"
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    Add Client
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Link
                href="/banks"
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/banks") || pathname.startsWith("/tellers")
                    ? `${activeBgColor} ${textColor}`
                    : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
                }`}
              >
                <Landmark
                  className={`h-5 w-5 ${
                    pathname.startsWith("/banks") || pathname.startsWith("/tellers") ? iconColorActive : iconColor
                  }`}
                />
                Cash Management
              </Link>

              {(pathname.startsWith("/banks") ||
                pathname.startsWith("/tellers")) && (
                <div className="pl-10 space-y-1">
                  <Link
                    href="/banks"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname.startsWith("/banks")
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    Banks
                  </Link>
                  <Link
                    href="/tellers"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname.startsWith("/tellers")
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    Tellers
                  </Link>
                </div>
              )}
            </div>

            {isEnabled("accounting") && (
              <div className="space-y-1">
                <Link
                  href="/accounting"
                  className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                    pathname.startsWith("/accounting")
                      ? `${activeBgColor} ${textColor}`
                      : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
                  }`}
                >
                  <BarChart3
                    className={`h-5 w-5 ${
                      pathname.startsWith("/accounting") ? iconColorActive : iconColor
                    }`}
                  />
                  Accounting
                </Link>

                {pathname.startsWith("/accounting") && (
                  <div className="pl-10 space-y-1">
                    <Link
                      href="/accounting"
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                        pathname === "/accounting"
                          ? iconColorActive
                          : `${iconColor} hover:${textColor}`
                      }`}
                    >
                      Home
                    </Link>
                    <Link
                      href="/accounting/chart-of-accounts"
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                        pathname === "/accounting/chart-of-accounts"
                          ? iconColorActive
                          : `${iconColor} hover:${textColor}`
                      }`}
                    >
                      Chart of Accounts
                    </Link>
                    <Link
                      href="/accounting/search-journal"
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                        pathname === "/accounting/search-journal"
                          ? iconColorActive
                          : `${iconColor} hover:${textColor}`
                      }`}
                    >
                      Journal Entries
                    </Link>
                    <Link
                      href="/accounting/frequent-postings"
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                        pathname === "/accounting/frequent-postings"
                          ? iconColorActive
                          : `${iconColor} hover:${textColor}`
                      }`}
                    >
                      Frequent Postings
                    </Link>
                  </div>
                )}
              </div>
            )}

            {isEnabled("reports") && (
              <Link
                href="/reports"
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                  pathname === "/reports"
                    ? `${activeBgColor} ${textColor}`
                    : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
                }`}
              >
                <FileText
                  className={`h-5 w-5 ${
                    pathname === "/reports" ? iconColorActive : iconColor
                  }`}
                />
                Reports
              </Link>
            )}

            {isEnabled("aiAssistant") && (
              <div className="space-y-1">
                <Link
                  href="/ai-assistant"
                  className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                    pathname.startsWith("/ai-assistant") ||
                    pathname.startsWith("/rag-admin")
                      ? `${activeBgColor} ${textColor}`
                      : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
                  }`}
                >
                  <Bot
                    className={`h-5 w-5 ${
                      pathname.startsWith("/ai-assistant") ||
                      pathname.startsWith("/rag-admin")
                        ? iconColorActive
                        : iconColor
                    }`}
                  />
                  AI Assistant
                </Link>

                {(pathname.startsWith("/ai-assistant") ||
                  pathname.startsWith("/rag-admin")) && (
                  <div className="pl-10 space-y-1">
                    <Link
                      href="/ai-assistant"
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                        pathname === "/ai-assistant"
                          ? iconColorActive
                          : `${iconColor} hover:${textColor}`
                      }`}
                    >
                      Chat
                    </Link>
                    <Link
                      href="/rag-admin"
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                        pathname === "/rag-admin"
                          ? iconColorActive
                          : `${iconColor} hover:${textColor}`
                      }`}
                    >
                      Admin
                    </Link>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}
