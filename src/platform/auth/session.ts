import { redirect } from "next/navigation";

import { auth } from "@/platform/auth";
import { AuthorizationError } from "@/platform/authz/errors";
import { can, type Permission, type Role } from "@/platform/authz/policy";

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export async function currentActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return {
    id: session.user.id,
    name: session.user.name ?? "Unknown",
    email: session.user.email ?? "unknown@invalid",
    role: session.user.role,
  };
}

export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) {
    redirect("/signin");
  }
  return actor;
}

export async function requirePermission(
  permission: Permission,
): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor.role, permission)) {
    throw new AuthorizationError(
      `Role ${actor.role} is not allowed to ${permission}.`,
    );
  }
  return actor;
}
