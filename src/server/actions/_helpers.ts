import "server-only";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { activities } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

export async function logActivity(
  tx: DbLike,
  a: { matterId?: string | null; contactId?: string | null; type: string; body: string; authorId?: string | null },
) {
  await tx.insert(activities).values({
    matterId: a.matterId ?? null,
    contactId: a.contactId ?? null,
    type: a.type,
    body: a.body,
    authorId: a.authorId ?? null,
  });
}

export async function nextMatterNumber(tx: DbLike, openedOn?: string | null) {
  const res = await tx.execute<{ n: string }>(sql`select nextval('matter_number_seq')::text as n`);
  const yy = (openedOn ?? new Date().toISOString()).slice(2, 4);
  return `CPH-${yy}-${String(res[0].n).padStart(4, "0")}`;
}

export function revalidateAll() {
  revalidatePath("/", "layout");
}
