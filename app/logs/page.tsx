// app/logs/page.tsx

import { requirePermission } from "@/lib/auth-guards";
import LogsViewer from "@/components/logs-viewer";

export default async function LogsPage() {
  await requirePermission("logs.read");
  return <LogsViewer />;
}
