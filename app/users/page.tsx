// app/users/page.tsx

import UsersManager from "@/components/users-manager";
import { requirePermission } from "@/lib/auth-guards";

export default async function UsersPage() {
  await requirePermission("employees.manage");
  return <UsersManager />;
}
