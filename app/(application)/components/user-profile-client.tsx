"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";
import { UserProfileData } from "./user-profile-data";
import { useMobileMenu } from "./mobile-menu-context";
import { NotificationsMenu } from "./notifications-menu";
import { GlobalSearch } from "@/components/global-search";
import { Menu, User, LogOut, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserProfileClientProps {
  userProfileData: UserProfileData;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function UserProfileClient({ userProfileData }: UserProfileClientProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { setMobileMenuOpen } = useMobileMenu();
  const profileRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  const { user, isLoggedIn } = userProfileData;
  const userFullName = user.name;
  const userEmail = user.email;

  const nameParts = user.name.split(" ");
  const initials =
    nameParts.length > 1
      ? `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase()
      : user.name.substring(0, 2).toUpperCase();

  const currentTheme =
    THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[2];
  const cycleTheme = () => {
    const index = THEME_OPTIONS.findIndex((option) => option.value === currentTheme.value);
    setTheme(THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length].value);
  };

  // Close the profile menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!profileOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  return (
    <header className="relative flex h-16 items-center justify-between gap-2 border-b border-white/20 dark:border-white/10 px-4 lg:px-6 sticky top-0 z-20 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
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

      <div className="flex-1 min-w-0 max-w-sm lg:mx-4">
        <GlobalSearch className="w-full" />
      </div>

      <div className="flex items-center gap-1 lg:gap-2">
        <NotificationsMenu
          open={notificationsOpen}
          onOpenChange={(open) => {
            setNotificationsOpen(open);
            if (open) setProfileOpen(false);
          }}
        />

        {/* User profile menu */}
        <div className="relative" ref={profileRef}>
          {isLoggedIn ? (
            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-muted lg:pl-3"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationsOpen(false);
              }}
            >
              <span className="hidden text-sm font-medium lg:inline">{userFullName}</span>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => router.push("/auth/login")}>
              Login
            </Button>
          )}

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-background shadow-lg z-50"
            >
              <div className="flex items-center gap-3 border-b border-border p-4">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{userFullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </div>

              <div className="py-1.5">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/profile");
                  }}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Your profile</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted"
                  onClick={cycleTheme}
                >
                  <currentTheme.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">Theme</span>
                  <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {currentTheme.label}
                  </span>
                </button>
              </div>

              <div className="border-t border-border py-1.5">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-destructive transition-colors hover:bg-muted"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
