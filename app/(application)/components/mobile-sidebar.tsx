"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { UserProfileData } from "./user-profile-data";
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  Home,
  Lock,
  Settings,
  Shield,
  Users,
  TrendingUp,
  X,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileSidebarProps {
  userProfileData: UserProfileData;
}

export function MobileSidebar({ userProfileData }: MobileSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Get login status and tenant
  const { isLoggedIn, tenantId } = userProfileData;

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
  const bgColor = theme === "light" ? "bg-white" : "bg-[#0d121f]";
  const borderColor =
    theme === "light" ? "border-gray-200" : "border-[#1a2035]";
  const textColor = theme === "light" ? "text-gray-900" : "text-white";
  const textColorMuted = theme === "light" ? "text-gray-500" : "text-gray-300";
  const iconColor = theme === "light" ? "text-gray-500" : "text-gray-400";
  const iconColorActive = theme === "light" ? "text-blue-500" : "text-blue-400";
  const hoverBgColor =
    theme === "light" ? "hover:bg-gray-100" : "hover:bg-[#1a2035]";
  const activeBgColor = theme === "light" ? "bg-gray-100" : "bg-[#1a2035]";

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className={textColor}
          onClick={() => setMobileMenuOpen(true)}
          data-mobile-toggle="true"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </div>

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
            <span className={`text-lg font-bold ${textColor}`}>
              {tenantId.toUpperCase()}
            </span>
            {!isLoggedIn && (
              <span className="ml-2 text-xs bg-yellow-500 text-white px-2 py-0.5 rounded">
                Guest
              </span>
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
        <div className="py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="space-y-1 px-2">
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                pathname === "/dashboard"
                  ? `${activeBgColor} ${textColor}`
                  : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
              }`}
            >
              <Home
                className={`h-5 w-5 ${
                  pathname === "/dashboard" ? iconColorActive : iconColor
                }`}
              />
              Dashboard
            </Link>
            <div className="space-y-1">
              <Link
                href="/leads"
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/leads")
                    ? `${activeBgColor} ${textColor}`
                    : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
                }`}
              >
                <TrendingUp
                  className={`h-5 w-5 ${
                    pathname.startsWith("/leads") ? iconColorActive : iconColor
                  }`}
                />
                Leads
              </Link>

              {/* Sub-menu items for Leads */}
              {pathname.startsWith("/leads") && (
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
                </div>
              )}
            </div>
            <Link
              href="#"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${textColorMuted} ${hoverBgColor} hover:${textColor}`}
            >
              <CreditCard className={`h-5 w-5 ${iconColor}`} />
              Loans
            </Link>
            <Link
              href="#"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${textColorMuted} ${hoverBgColor} hover:${textColor}`}
            >
              <Users className={`h-5 w-5 ${iconColor}`} />
              Clients
            </Link>
            <Link
              href="#"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${textColorMuted} ${hoverBgColor} hover:${textColor}`}
            >
              <FileText className={`h-5 w-5 ${iconColor}`} />
              Documents
            </Link>
            <Link
              href="#"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${textColorMuted} ${hoverBgColor} hover:${textColor}`}
            >
              <BarChart3 className={`h-5 w-5 ${iconColor}`} />
              Analytics
            </Link>
            <Link
              href="#"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${textColorMuted} ${hoverBgColor} hover:${textColor}`}
            >
              <Shield className={`h-5 w-5 ${iconColor}`} />
              Compliance
            </Link>
            <Link
              href="#"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${textColorMuted} ${hoverBgColor} hover:${textColor}`}
            >
              <Lock className={`h-5 w-5 ${iconColor}`} />
              Security
            </Link>
            <Link
              href="/dashboard/rag"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                pathname.startsWith("/dashboard/rag")
                  ? `${activeBgColor} ${textColor}`
                  : `${textColorMuted} ${hoverBgColor} hover:${textColor}`
              }`}
            >
              <Bot
                className={`h-5 w-5 ${
                  pathname.startsWith("/dashboard/rag")
                    ? iconColorActive
                    : iconColor
                }`}
              />
              AI Assistant
            </Link>
            <Link
              href="#"
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${textColorMuted} ${hoverBgColor} hover:${textColor}`}
            >
              <Settings className={`h-5 w-5 ${iconColor}`} />
              Settings
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
