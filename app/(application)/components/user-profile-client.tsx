"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useCurrency } from "@/contexts/currency-context";
import { useTheme } from "next-themes";
import { UserProfileData } from "./user-profile-data";
import { useMobileMenu } from "./mobile-menu-context";
import { useNotifications } from "@/hooks/use-notifications";
import { useAlerts, Alert, getAlertTypeColor, getAlertTypeBgColor } from "@/hooks/use-alerts";
import {
  FineractNotification,
  getNotificationCategory,
  formatNotificationDate,
} from "@/shared/types/notification";
import {
  Bell,
  Search,
  Menu,
  User,
  HelpCircle,
  LogOut,
  Users,
  CreditCard,
  DollarSign,
  Shield,
  AlertCircle,
  RefreshCw,
  Loader2,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardList,
  Clock,
  FileCheck,
  Info,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

interface UserProfileClientProps {
  userProfileData: UserProfileData;
}

// Helper function to get icon and color based on notification category
function getNotificationIcon(notification: FineractNotification) {
  const category = getNotificationCategory(notification);

  switch (category) {
    case "CLIENT":
      return {
        icon: <Users className="h-3 w-3 text-blue-500" />,
        bgColor: "bg-blue-500/20",
      };
    case "LOAN":
      return {
        icon: <CreditCard className="h-3 w-3 text-green-500" />,
        bgColor: "bg-green-500/20",
      };
    case "DISBURSEMENT":
      return {
        icon: <DollarSign className="h-3 w-3 text-purple-500" />,
        bgColor: "bg-purple-500/20",
      };
    case "REPAYMENT":
      return {
        icon: <DollarSign className="h-3 w-3 text-emerald-500" />,
        bgColor: "bg-emerald-500/20",
      };
    case "SYSTEM":
      return {
        icon: <Shield className="h-3 w-3 text-red-500" />,
        bgColor: "bg-red-500/20",
      };
    default:
      return {
        icon: <AlertCircle className="h-3 w-3 text-yellow-500" />,
        bgColor: "bg-yellow-500/20",
      };
  }
}

// Helper function to get icon component for alert type
function getAlertIcon(type: string) {
  switch (type) {
    case "SUCCESS":
      return CheckCircle2;
    case "WARNING":
      return AlertTriangle;
    case "ERROR":
      return XCircle;
    case "TASK":
      return ClipboardList;
    case "REMINDER":
      return Clock;
    case "APPROVAL":
      return FileCheck;
    case "SYSTEM":
      return Shield;
    case "INFO":
    default:
      return Info;
  }
}

// Local system role interface
interface LocalSystemRole {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
}

export function UserProfileClient({ userProfileData }: UserProfileClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { formatAmount } = useCurrency();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { mobileMenuOpen, setMobileMenuOpen } = useMobileMenu();
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Local system roles state
  const [localRoles, setLocalRoles] = useState<LocalSystemRole[]>([]);
  const [localRolesLoading, setLocalRolesLoading] = useState(true);

  // Fetch local system roles
  useEffect(() => {
    async function fetchLocalRoles() {
      try {
        const response = await fetch("/api/users/roles");
        if (response.ok) {
          const data = await response.json();
          setLocalRoles(data.roles || []);
        }
      } catch (error) {
        console.error("Error fetching local roles:", error);
      } finally {
        setLocalRolesLoading(false);
      }
    }
    fetchLocalRoles();
  }, []);

  // Use the notifications hook with SSE (Fineract notifications)
  const {
    notifications,
    unreadCount: fineractUnreadCount,
    isLoading: fineractLoading,
    error: fineractError,
    isConnected,
    onViewNotifications,
    onCloseNotifications,
    refresh: refreshFineract,
  } = useNotifications();

  // Use the alerts hook (local system alerts)
  const {
    alerts,
    unreadCount: alertsUnreadCount,
    isLoading: alertsLoading,
    error: alertsError,
    markAsRead: markAlertAsRead,
    markAllAsRead: markAllAlertsAsRead,
    dismissAlert,
    refresh: refreshAlerts,
  } = useAlerts();

  // Combined unread count
  const totalUnreadCount = fineractUnreadCount + alertsUnreadCount;
  const isLoading = fineractLoading || alertsLoading;
  const error = fineractError || alertsError;

  // Refresh both
  const refresh = async () => {
    await Promise.all([refreshFineract(), refreshAlerts()]);
  };

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

  // Handle notification dropdown toggle
  const handleNotificationToggle = () => {
    if (!notificationsOpen) {
      // Opening the dropdown - mark as read
      onViewNotifications();
    } else {
      // Closing the dropdown
      onCloseNotifications();
    }
    setNotificationsOpen(!notificationsOpen);
    setProfileOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        if (notificationsOpen) {
          onCloseNotifications();
        }
        setNotificationsOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationsOpen, onCloseNotifications]);

  return (
    <header className="flex h-16 items-center justify-between border-border border-b bg-background px-4 lg:px-6 sticky top-0 z-20">
      {/* Mobile Menu Button */}
      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setMobileMenuOpen(true)}
          data-mobile-toggle="true"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </div>

      {/* Mobile search - hidden on larger screens */}
      <div className="lg:hidden relative flex-1 max-w-sm mx-2">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search..."
          className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-4 text-sm placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Desktop search - hidden on mobile */}
      <div className="hidden lg:block relative w-full max-w-sm mx-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search..."
          className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-4 text-sm placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
        <div className="relative" ref={notificationRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={handleNotificationToggle}
          >
            <Bell className="h-5 w-5" />
            {/* Unread count badge */}
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-background shadow-lg z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm">
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">Notifications</h3>
                    {/* SSE Connection indicator */}
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
                      }`}
                      title={isConnected ? "Connected (live updates)" : "Connecting..."}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      refresh();
                    }}
                    disabled={isLoading}
                    title="Reconnect"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {isLoading && alerts.length === 0 && notifications.length === 0 ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <div className="p-4 text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={refresh}
                    >
                      Retry
                    </Button>
                  </div>
                ) : alerts.length === 0 && notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Inbox className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No notifications
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      You&apos;re all caught up!
                    </p>
                  </div>
                ) : (
                  <div className="p-2">
                    {/* System Alerts Section */}
                    {alerts.length > 0 && (
                      <div className="space-y-1 mb-2">
                        <div className="flex items-center justify-between px-1 mb-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Alerts
                          </p>
                          {alertsUnreadCount > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAllAlertsAsRead();
                              }}
                              className="text-xs text-blue-500 hover:text-blue-600"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                        {alerts.map((alert) => {
                          const AlertIcon = getAlertIcon(alert.type);
                          const handleAlertClick = () => {
                            if (alert.actionUrl) {
                              setNotificationsOpen(false);
                              markAlertAsRead(alert.id).catch(console.error);
                              router.push(alert.actionUrl);
                            }
                          };
                          return (
                            <div
                              key={alert.id}
                              role={alert.actionUrl ? "button" : undefined}
                              tabIndex={alert.actionUrl ? 0 : undefined}
                              onClick={handleAlertClick}
                              onKeyDown={(e) => {
                                if (alert.actionUrl && (e.key === "Enter" || e.key === " ")) {
                                  e.preventDefault();
                                  handleAlertClick();
                                }
                              }}
                              className={`relative w-full text-left rounded-md p-2 hover:bg-accent transition-colors ${
                                !alert.isRead ? "bg-accent/50" : ""
                              } ${alert.actionUrl ? "cursor-pointer" : ""}`}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  className={`rounded-full ${getAlertTypeBgColor(alert.type)} p-1 mt-0.5`}
                                >
                                  <AlertIcon className={`h-3 w-3 ${getAlertTypeColor(alert.type)}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {alert.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {alert.message}
                                  </p>
                                  {alert.actionUrl && (
                                    <span className="text-xs text-blue-500 hover:text-blue-600 mt-1 hover:underline inline-block">
                                      {alert.actionLabel || "View Details"}
                                    </span>
                                  )}
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {formatNotificationDate(alert.createdAt)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  {!alert.isRead && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      dismissAlert(alert.id);
                                    }}
                                    className="p-0.5 hover:bg-muted rounded opacity-50 hover:opacity-100"
                                    title="Dismiss"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Fineract Notifications Section */}
                    {notifications.length > 0 && (
                      <div className="space-y-1">
                        {alerts.length > 0 && (
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1 mt-2">
                            Activity
                          </p>
                        )}
                        {notifications.map((notification) => {
                          const { icon, bgColor } =
                            getNotificationIcon(notification);
                          return (
                            <button
                              key={notification.id}
                              className={`w-full text-left rounded-md p-2 hover:bg-accent transition-colors ${
                                !notification.isRead ? "bg-accent/50" : ""
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  className={`rounded-full ${bgColor} p-1 mt-0.5`}
                                >
                                  {icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {notification.action || "Notification"}
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {notification.content}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {formatNotificationDate(
                                      notification.createdAt
                                    )}
                                  </p>
                                </div>
                                {!notification.isRead && (
                                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {(alerts.length > 0 || notifications.length > 0) && (
                <div className="p-2 border-t border-border">
                  <Button variant="outline" size="sm" className="w-full">
                    View All Notifications
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Dropdown with Tenant */}
        <div className="relative" ref={profileRef}>
          <Button
            variant="ghost"
            className="rounded-full p-1 h-auto"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationsOpen(false);
            }}
          >
            {isLoggedIn ? (
              <>
                {/* Mobile: Icon only */}
                <div className="lg:hidden">
                  <Avatar className="h-8 w-8 border-2 border-blue-500">
                    <AvatarImage src="/professional-avatar.svg" alt="Avatar" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </div>

                {/* Desktop: Full profile with username */}
                <div className="hidden lg:flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {userFullName}
                  </span>
                  <Avatar className="h-8 w-8 border-2 border-blue-500">
                    <AvatarImage src="/professional-avatar.svg" alt="Avatar" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </div>
              </>
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
            <div className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-background shadow-lg z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {isLoggedIn && (
                    <Avatar className="h-10 w-10 border-2 border-blue-500">
                      <AvatarImage
                        src="/professional-avatar.svg"
                        alt="Avatar"
                      />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    <p className="text-sm font-medium">{userFullName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {localRolesLoading ? (
                    <Badge className="bg-muted text-muted-foreground border-0 text-xs">
                      Loading...
                    </Badge>
                  ) : localRoles.length > 0 ? (
                    localRoles.map((role, index) => {
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
                          title={role.description || role.name}
                        >
                          {role.displayName}
                        </Badge>
                      );
                    })
                  ) : (
                    <Badge className="bg-gray-500 text-white border-0 text-xs">
                      No Role Assigned
                    </Badge>
                  )}
                </div>
              </div>

              <div className="py-2">
                <button
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/profile");
                  }}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>My Profile</span>
                </button>
              </div>

              <div className="border-t border-border py-2">
                <button className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <span>Help & Support</span>
                </button>
                <button
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-accent transition-colors"
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
