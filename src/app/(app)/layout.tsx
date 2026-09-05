import type { ReactNode } from "react";

import { MODULES } from "@/modules/registry";
import { signOut } from "@/platform/auth";
import { requireActor } from "@/platform/auth/session";
import { can } from "@/platform/authz/policy";
import { env } from "@/platform/config/env";
import { AppShell, type NavItem } from "@/platform/ui/app-shell";
import { Button } from "@/platform/ui/button";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  const actor = await requireActor();

  const navItems: NavItem[] = [
    { href: "/overview", label: "Overview", available: true },
    ...MODULES.map((module) => ({
      href: module.route,
      label: module.title,
      available: can(actor.role, module.readPermission),
    })),
    { href: "/audit", label: "Audit trail", available: can(actor.role, "audit.read") },
  ];

  async function signOutAction(): Promise<void> {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <AppShell
      navItems={navItems}
      userName={actor.name}
      userRole={actor.role}
      demoMode={env().DEMO_MODE}
      signOutAction={
        <form action={signOutAction}>
          <Button variant="secondary" size="small" type="submit">
            Sign out
          </Button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
