"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
export function InventoryTabs() {
  const path = usePathname();
  const { features, tenantSlug } = useFeatureFlags();
  const links = [
    { href: "/inventory", label: "Stock Control" },
    ...(features.hasInventoryFinance
      ? [{ href: "/inventory/finances", label: "Financials" }]
      : []),
    ...(tenantSlug === "arda" && features.hasInventoryReports
      ? [{ href: "/inventory/reports", label: "Reports" }]
      : []),
  ];
  if (links.length === 1) return null;
  return (
    <nav
      aria-label="Inventory sections"
      className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={path === link.href ? "page" : undefined}
          className={`rounded-md px-4 py-2 text-sm font-medium ${path === link.href ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
