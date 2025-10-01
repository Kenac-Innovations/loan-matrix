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
  Home,
  Lock,
  Phone,
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
  const [mounted, setMounted] = useState(false);

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
  const textColor = mounted && theme === "light" ? "text-gray-900" : "text-white";
  const textColorMuted = mounted && theme === "light" ? "text-gray-500" : "text-gray-300";
  const iconColor = mounted && theme === "light" ? "text-gray-500" : "text-gray-400";
  const iconColorActive = mounted && theme === "light" ? "text-blue-500" : "text-blue-400";
  const hoverBgColor =
    mounted && theme === "light" ? "hover:bg-gray-100" : "hover:bg-[#1a2035]";
  const activeBgColor = mounted && theme === "light" ? "bg-gray-100" : "bg-[#1a2035]";

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
          <div className="flex items-center">
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
                href="/ussd-leads"
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

              {/* Sub-menu items for Leads */}
              {(pathname.startsWith("/leads") || pathname.startsWith("/ussd-leads")) && (
                <div className="pl-10 space-y-1">
                  {/* <Link
                    href="/leads"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname === "/leads"
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    Pipeline
                  </Link> */}
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
                  {/* <Link
                    href="/leads/config"
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium ${
                      pathname === "/leads/config"
                        ? iconColorActive
                        : `${iconColor} hover:${textColor}`
                    }`}
                  >
                    Configuration
                  </Link> */}
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

              {/* Sub-menu items for AI Assistant */}
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
