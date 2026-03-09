// app/page.tsx

import ScheduleApp from "@/components/schedule-app";
import { requirePermission } from "@/lib/auth-guards";

export default async function Page() {
  await requirePermission("schedule.read");
  return <ScheduleApp />;
}
