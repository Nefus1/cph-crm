"use server";
import { requireStaff } from "@/lib/auth";
import { conflictSearch, searchEverything, type ConflictHit, type SearchHit } from "@/server/queries/search";

export async function globalSearch(q: string): Promise<SearchHit[]> {
  await requireStaff();
  return searchEverything(String(q ?? "").slice(0, 100));
}

export async function runConflictCheck(names: string[]): Promise<ConflictHit[]> {
  await requireStaff();
  return conflictSearch((names ?? []).map((n) => String(n).slice(0, 120)).slice(0, 20));
}
