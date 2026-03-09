// app/edit/page.tsx

import ScheduleEditor from "@/components/schedule-editor";
import { requirePermission } from "@/lib/auth-guards";

export default async function EditPage() {
  await requirePermission("schedule.edit");
  return <ScheduleEditor />;
}
