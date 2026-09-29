import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";

export async function listActiveStaff() {
  return db.select({ id: staff.id, name: staff.name, email: staff.email, role: staff.role }).from(staff).where(eq(staff.active, true)).orderBy(asc(staff.name));
}

export async function listAllStaff() {
  return db.select().from(staff).orderBy(asc(staff.name));
}

export type StaffOption = Awaited<ReturnType<typeof listActiveStaff>>[number];
