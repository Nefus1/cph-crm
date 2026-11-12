import { officeWorkspace } from "@/server/queries/office-workflows";
import { Workspace } from "@/components/workflows/workspace";
import { todayISO } from "@/lib/dates";
export default async function Page() { return <Workspace data={await officeWorkspace()} mode="progress" today={todayISO()} />; }
