import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

export async function getSettings() {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  if (row) return row;
  const [created] = await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) }))!;
}
