"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { cn } from "@/platform/ui/cn";

export interface NavItem {
  href: string;
  label: string;
  available: boolean;
}

export interface AppShellProps {
  navItems: readonly NavItem[];
  userName: string;
  userRole: string;
  demoMode: boolean;
  signOutAction: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  navItems,
  userName,
  userRole,
  demoMode,
  signOutAction,
  children,
}: AppShellProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center justify-between gap-3 border-b border-line bg-panel px-page-narrow md:px-page">
        <div className="flex items-center gap-3">
          <span className="text-product font-medium text-ink">Control Room</span>
          {demoMode ? (
            <span
              className="rounded-control border border-warning px-2 py-0.5 text-meta font-medium text-warning"
              data-testid="demo-mode-indicator"
            >
              Demo mode · synthetic data
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-meta text-muted">
            {userName} · {userRole}
          </span>
          {signOutAction}
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Applications"
          className="flex gap-1 overflow-x-auto border-b border-line bg-panel p-2 md:w-rail md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r"
        >
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-disabled={item.available ? undefined : "true"}
                className={cn(
                  "flex min-h-11 items-center rounded-control px-3 text-body text-ink hover:bg-primary-soft md:min-h-9",
                  active && "bg-primary-soft font-medium text-primary",
                  !item.available && "text-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-page-narrow md:p-page">{children}</main>
      </div>
    </div>
  );
}
