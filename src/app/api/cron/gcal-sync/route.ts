import { NextResponse, type NextRequest } from "next/server";
import { syncPendingEvents } from "@/lib/google/calendar";

/** Vercel Cron: retries calendar pushes that failed or are pending. Protected by CRON_SECRET. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncPendingEvents(100);
  return NextResponse.json(result);
}
