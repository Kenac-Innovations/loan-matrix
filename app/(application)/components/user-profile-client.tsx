"use client";

import { useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";
import { UserProfileData } from "./user-profile-data";
import {
  Bell,
  Search,
  Menu,
  User,
  Settings,
  HelpCircle,
  LogOut,
  Users,
  CreditCard,
  DollarSign,
  Shield,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

interface UserProfileClientProps {
  userProfileData: UserProfileData;
}

export function UserProfileClient({ userProfileData }: UserProfileClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Get user details and login status
  const { user, isLoggedIn } = userProfileData;
  const userFullName = user.name;
  const userEmail = user.email;
  const userRoles = user.roles || [];
  const userRole = user.role; // For backward compatibility

  // Get initials for avatar fallback
  const nameParts = user.name.split(" ");
  const initials =
    nameParts.length > 1
      ? `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`
      : user.name.substring(0, 2).toUpperCase();

  // Define colors based on theme
  const bgColor = theme === "light" ? "bg-white" : "bg-[#0d121f]";
  const borderColor =
    theme === "light" ? "border-gray-200" : "border-[#1a2035]";
  const textColor = theme === "light" ? "text-gray-900" : "text-white";
  const textColorMuted = theme === "light" ? "text-gray-500" : "text-gray-300";
  const iconColor = theme === "light" ? "text-gray-500" : "text-gray-400";
  const hoverBgColor =
    theme === "light" ? "hover:bg-gray-100" : "hover:bg-[#1a2035]";

  return (
    <header
      className={`flex h-16 items-center justify-between ${borderColor} border-b ${bgColor} px-4 lg:px-6 sticky top-0 z-20`}
    >
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
      <div className="relative w-full max-w-md lg:max-w-sm mx-4 lg:mx-0">
        <Search className={`absolute left-2.5 top-2.5 h-4 w-4 ${iconColor}`} />
        <input
          type="search"
          placeholder="Search..."
          className={`w-full rounded-md border ${borderColor} ${bgColor} py-2 pl-8 pr-4 text-sm ${textColor} placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="relative" ref={notificationRef}>
          <Button
            variant="ghost"
            size="icon"
            className={`${textColor} relative`}
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setProfileOpen(false);
            }}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">
              8
            </span>
            <span className="sr-only">Notifications</span>
          </Button>

          {notificationsOpen && (
            <div
              className={`absolute right-0 mt-2 w-80 rounded-md border ${borderColor} ${bgColor} shadow-lg z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm`}
            >
              <div className={`p-3 border-b ${borderColor}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-medium ${textColor}`}>
                    Notifications
                  </h3>
                  <Badge
                    variant="outline"
                    className="bg-blue-500 text-white border-0 text-xs"
                  >
                    8 New
                  </Badge>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                <div className="p-2">
                  <h4
                    className={`text-xs font-semibold ${iconColor} px-2 py-1`}
                  >
                    CLIENT APPROVALS
                  </h4>
                  <div className="mt-1 space-y-1">
                    <button
                      className={`w-full text-left rounded-md p-2 ${hoverBgColor} transition-colors`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-blue-500/20 p-1 mt-0.5">
                          <Users className="h-3 w-3 text-blue-500" />
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${textColor}`}>
                            New client verification needed
                          </p>
                          <p className={`text-xs ${iconColor}`}>
                            Robert Johnson submitted KYC documents
                          </p>
                          <p className="text-xs text-gray-500">
                            10 minutes ago
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      className={`w-full text-left rounded-md p-2 ${hoverBgColor} transition-colors`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-blue-500/20 p-1 mt-0.5">
                          <Users className="h-3 w-3 text-blue-500" />
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${textColor}`}>
                            Client information updated
                          </p>
                          <p className={`text-xs ${iconColor}`}>
                            Sarah Williams updated contact details
                          </p>
                          <p className="text-xs text-gray-500">1 hour ago</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className={`p-2 border-t ${borderColor}`}>
                  <h4
                    className={`text-xs font-semibold ${iconColor} px-2 py-1`}
                  >
                    LOAN APPROVALS
                  </h4>
                  <div className="mt-1 space-y-1">
                    <button
                      className={`w-full text-left rounded-md p-2 ${hoverBgColor} transition-colors`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-green-500/20 p-1 mt-0.5">
                          <CreditCard className="h-3 w-3 text-green-500" />
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${textColor}`}>
                            Loan ready for final approval
                          </p>
                          <p className={`text-xs ${iconColor}`}>
                            $245,000 Mortgage for Robert Johnson
                          </p>
                          <p className="text-xs text-gray-500">
                            30 minutes ago
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      className={`w-full text-left rounded-md p-2 ${hoverBgColor} transition-colors`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-yellow-500/20 p-1 mt-0.5">
                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${textColor}`}>
                            Risk assessment needed
                          </p>
                          <p className={`text-xs ${iconColor}`}>
                            $125,000 Mortgage for Michael Chen
                          </p>
                          <p className="text-xs text-gray-500">2 hours ago</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className={`p-2 border-t ${borderColor}`}>
                  <h4
                    className={`text-xs font-semibold ${iconColor} px-2 py-1`}
                  >
                    DISBURSEMENTS
                  </h4>
                  <div className="mt-1 space-y-1">
                    <button
                      className={`w-full text-left rounded-md p-2 ${hoverBgColor} transition-colors`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-purple-500/20 p-1 mt-0.5">
                          <DollarSign className="h-3 w-3 text-purple-500" />
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${textColor}`}>
                            Disbursement ready
                          </p>
                          <p className={`text-xs ${iconColor}`}>
                            $50,000 Business loan for Sarah Williams
                          </p>
                          <p className="text-xs text-gray-500">Just now</p>
                        </div>
                      </div>
                    </button>
                    <button
                      className={`w-full text-left rounded-md p-2 ${hoverBgColor} transition-colors`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-purple-500/20 p-1 mt-0.5">
                          <DollarSign className="h-3 w-3 text-purple-500" />
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${textColor}`}>
                            Disbursement scheduled
                          </p>
                          <p className={`text-xs ${iconColor}`}>
                            $75,000 Personal loan for Emily Rodriguez
                          </p>
                          <p className="text-xs text-gray-500">5 hours ago</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className={`p-2 border-t ${borderColor}`}>
                  <h4
                    className={`text-xs font-semibold ${iconColor} px-2 py-1`}
                  >
                    SECURITY
                  </h4>
                  <div className="mt-1 space-y-1">
                    <button
                      className={`w-full text-left rounded-md p-2 ${hoverBgColor} transition-colors`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-red-500/20 p-1 mt-0.5">
                          <Shield className="h-3 w-3 text-red-500" />
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${textColor}`}>
                            Security alert
                          </p>
                          <p className={`text-xs ${iconColor}`}>
                            Multiple failed login attempts detected
                          </p>
                          <p className="text-xs text-gray-500">
                            45 minutes ago
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className={`p-2 border-t ${borderColor}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full ${borderColor} ${textColor} ${hoverBgColor}`}
                >
                  View All Notifications
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-0"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationsOpen(false);
            }}
          >
            {isLoggedIn ? (
              <Avatar className="h-8 w-8 border-2 border-blue-500">
                <AvatarImage src="/professional-avatar.png" alt="Avatar" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/auth/login")}
              >
                Login
              </Button>
            )}
          </Button>

          {profileOpen && (
            <div
              className={`absolute right-0 mt-2 w-64 rounded-md border ${borderColor} ${bgColor} shadow-lg z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm`}
            >
              <div className={`p-4 border-b ${borderColor}`}>
                <div className="flex items-center gap-3">
                  {isLoggedIn && (
                    <Avatar className="h-10 w-10 border-2 border-blue-500">
                      <AvatarImage
                        src="/professional-avatar.png"
                        alt="Avatar"
                      />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    <p className={`text-sm font-medium ${textColor}`}>
                      {userFullName}
                    </p>
                    <p className={`text-xs ${iconColor}`}>{userEmail}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {userRoles.length > 0 ? (
                    userRoles.map((role, index) => {
                      // Define different colors for different roles
                      const colors = [
                        "bg-blue-500",
                        "bg-green-500",
                        "bg-purple-500",
                        "bg-amber-500",
                        "bg-rose-500",
                        "bg-cyan-500",
                        "bg-emerald-500",
                        "bg-indigo-500",
                      ];
                      const colorIndex = index % colors.length;
                      return (
                        <Badge
                          key={role.id}
                          className={`${colors[colorIndex]} text-white border-0 text-xs`}
                          title={role.description}
                        >
                          {role.name}
                        </Badge>
                      );
                    })
                  ) : (
                    <Badge className="bg-blue-500 text-white border-0 text-xs">
                      {userRole || "User"}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="py-2">
                <button
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm ${textColor} ${hoverBgColor} transition-colors`}
                >
                  <User className={`h-4 w-4 ${iconColor}`} />
                  <span>My Profile</span>
                </button>
                <button
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm ${textColor} ${hoverBgColor} transition-colors`}
                >
                  <Settings className={`h-4 w-4 ${iconColor}`} />
                  <span>Account Settings</span>
                </button>
                <button
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm ${textColor} ${hoverBgColor} transition-colors`}
                >
                  <Bell className={`h-4 w-4 ${iconColor}`} />
                  <span>Notification Preferences</span>
                </button>
              </div>

              <div className={`border-t ${borderColor} py-2`}>
                <button
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm ${textColor} ${hoverBgColor} transition-colors`}
                >
                  <HelpCircle className={`h-4 w-4 ${iconColor}`} />
                  <span>Help & Support</span>
                </button>
                <button
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm text-red-400 ${hoverBgColor} transition-colors`}
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4 text-red-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
