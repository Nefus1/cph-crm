import "server-only";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { appUrl } from "@/lib/env";

/**
 * One firm-level Google connection (the account that owns 1A CPH FOLDER and the
 * Hearings and Deadlines calendar). Staff sign-in is separate (Supabase Auth).
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${appUrl()}/api/google/callback`);
}

export async function getAuthedClient() {
  if (!googleConfigured()) return null;
  const settings = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  if (!settings?.googleRefreshTokenEnc) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: decrypt(settings.googleRefreshTokenEnc) });
  return { client, settings };
}

export function driveApi(auth: ReturnType<typeof oauthClient>) {
  return google.drive({ version: "v3", auth });
}

export function calendarApi(auth: ReturnType<typeof oauthClient>) {
  return google.calendar({ version: "v3", auth });
}

export function sheetsApi(auth: ReturnType<typeof oauthClient>) {
  return google.sheets({ version: "v4", auth });
}

export function googleErrorMessage(err: unknown): string {
  const e = err as { message?: string; response?: { data?: { error?: { message?: string } | string; error_description?: string } } };
  const data = e?.response?.data;
  if (data) {
    if (typeof data.error === "string") return data.error_description ? `${data.error}: ${data.error_description}` : data.error;
    if (data.error?.message) return data.error.message;
  }
  return e?.message ?? String(err);
}
