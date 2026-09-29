import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getCurrentStaff } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { googleErrorMessage, oauthClient } from "@/lib/google/client";
import { appUrl } from "@/lib/env";

export async function GET(request: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(`${appUrl()}/settings/google?${q}`);
    res.cookies.delete("g_oauth_state");
    return res;
  };
  const me = await getCurrentStaff();
  if (!me || me.role !== "admin") return back("error=admin_only");
  const { searchParams } = request.nextUrl;
  if (searchParams.get("error")) return back(`error=${encodeURIComponent(searchParams.get("error")!)}`);
  const state = searchParams.get("state");
  if (!state || state !== request.cookies.get("g_oauth_state")?.value) return back("error=state");
  const code = searchParams.get("code");
  if (!code) return back("error=no_code");

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) return back("error=no_refresh_token");
    client.setCredentials(tokens);
    const info = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    await db
      .update(appSettings)
      .set({ googleRefreshTokenEnc: encrypt(tokens.refresh_token), googleEmail: info.data.email ?? null, googleConnectedAt: new Date() })
      .where(eq(appSettings.id, 1));
    return back("connected=1");
  } catch (err) {
    return back(`error=${encodeURIComponent(googleErrorMessage(err).slice(0, 200))}`);
  }
}
