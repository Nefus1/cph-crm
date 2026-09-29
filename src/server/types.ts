export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof Error) {
    // Redirects thrown by requireStaff must propagate
    if ("digest" in error && typeof (error as { digest?: string }).digest === "string" && (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")) throw error;
    return { ok: false, error: error.message };
  }
  return { ok: false, error: String(error) };
}
