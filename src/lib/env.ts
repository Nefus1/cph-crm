/** Dev-only auth bypass. Can never be enabled on Vercel (VERCEL=1 at build and runtime). */
export function devAuthBypass(): boolean {
  return process.env.DEV_AUTH_BYPASS === "true" && process.env.VERCEL !== "1";
}

export function appUrl(): string {
  return (process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");
}

export function supabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
