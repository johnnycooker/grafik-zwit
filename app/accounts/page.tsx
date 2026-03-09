// app/accounts/page.tsx

import { requirePermission } from "@/lib/auth-guards";
import AccountsManager from "@/components/accounts-manager";

export default async function AccountsPage() {
  await requirePermission("accounts.manage");
  return <AccountsManager />;
}
