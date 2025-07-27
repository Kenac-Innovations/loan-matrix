"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

interface SubMenuItem {
  label: string;
  href: string;
}

interface MenuItemWithSubmenuProps {
  icon: React.ReactElement;
  label: string;
  href: string;
  subMenuItems?: SubMenuItem[];
}

const MenuItemWithSubmenu: React.FC<MenuItemWithSubmenuProps> = ({
  icon,
  label,
  href,
  subMenuItems = [],
}) => {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <div className="space-y-1">
      <Link
        href={href}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        {React.cloneElement(icon as React.ReactElement, {
          ...(icon.props as any),
          className: `h-4 w-4 ${isActive ? "text-blue-400" : ""}`,
        })}
        {label}
      </Link>

      {isActive && subMenuItems.length > 0 && (
        <div className="pl-9 space-y-1">
          {subMenuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium ${
                pathname === item.href
                  ? "text-blue-400"
                  : "text-muted-foreground hover:text-accent-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuItemWithSubmenu;
