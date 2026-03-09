// lib/auth-guards.ts

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import type { AppPermission } from "@/types/auth";

export async function requireSession() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requirePermission(permission: AppPermission) {
  const session = await requireSession();

  if (!hasPermission(session.user.permissions, permission)) {
    redirect("/");
  }

  return session;
}
