import { redirect } from "next/navigation";
import { getCurrentUser, firstOwnedSheet } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function DashboardIndexPage() {
  const user = await getCurrentUser();
  const first = firstOwnedSheet(user);
  if (first) {
    redirect(`/dashboard/${first.tool}/${first.level}`);
  }
  redirect("/dashboard/snowflake/senior");
}
