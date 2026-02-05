"use client";

import Link from "next/link";
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  TrendingUp,
  Users,
  Landmark,
} from "lucide-react";
import MenuItemWithSubmenu from "@/components/menu-with-sub";
import { useUserRoles } from "@/components/role-guard";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

interface SubMenuItem {
  label: string;
  href: string;
  allowedRoles?: string[];
}

/**
 * Sidebar Navigation Component
 * Handles role-based and feature-based visibility of menu items
 */
export function SidebarNav() {
  const { hasAnyRole, isLoading: rolesLoading } = useUserRoles();
  const { isEnabled } = useFeatureFlags();

  // Define submenu items with role and feature restrictions
  const leadsSubMenuItems: SubMenuItem[] = [
    { label: "Pipeline", href: "/leads" },
  ];

  // Add USSD Leads if feature is enabled
  if (isEnabled("ussdLeads")) {
    leadsSubMenuItems.push({ label: "USSD Leads", href: "/ussd-leads" });
  }

  // Only add Configuration for admins/super admins AND if feature is enabled
  if (
    !rolesLoading &&
    hasAnyRole(["ADMIN", "SUPER_ADMIN", "BRANCH_MANAGER"]) &&
    isEnabled("leadConfig")
  ) {
    leadsSubMenuItems.push({ label: "Configuration", href: "/leads/config" });
  }

  return (
    <nav className="space-y-1 px-2">
      <div className="space-y-1">
        <MenuItemWithSubmenu
          icon={<TrendingUp />}
          label="Leads"
          href="/leads"
          subMenuItems={leadsSubMenuItems}
        />
      </div>

      <Link
        href="/loans"
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
        icon={<Landmark />}
        label="Cash Management"
        href="/banks"
        subMenuItems={[
          { label: "Banks", href: "/banks" },
          { label: "Tellers", href: "/tellers" },
        ]}
      />

      {isEnabled("accounting") && (
        <MenuItemWithSubmenu
          icon={<BarChart3 />}
          label="Accounting"
          href="/accounting"
          subMenuItems={[
            { label: "Home", href: "/accounting" },
            {
              label: "Chart of Accounts",
              href: "/accounting/chart-of-accounts",
            },
            {
              label: "Journal Entries",
              href: "/accounting/search-journal",
            },
            {
              label: "Frequent Postings",
              href: "/accounting/frequent-postings",
            },
          ]}
        />
      )}

      {isEnabled("reports") && (
        <Link
          href="/reports"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <FileText className="h-4 w-4" />
          Reports
        </Link>
      )}

      {isEnabled("aiAssistant") && (
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
      )}
    </nav>
  );
}

export default SidebarNav;
