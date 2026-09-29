import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { GOOGLE_SCOPES, googleConfigured, oauthClient } from "@/lib/google/client";
import { appUrl } from "@/lib/env";

export async function GET() {
  const me = await getCurrentStaff();
  if (!me || me.role !== "admin") return NextResponse.redirect(`${appUrl()}/settings/google?error=admin_only`);
  if (!googleConfigured()) return NextResponse.redirect(`${appUrl()}/settings/google?error=not_configured`);
  const state = randomBytes(16).toString("hex");
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
    state,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set("g_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
