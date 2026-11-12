import { after } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { folderConnectors, folderJobs, matterFolders } from "@/db/schema";
import { discoverPendingFolders } from "@/lib/folders/service";
import { retrySeconds } from "@/lib/folders/templates";

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const connector = await db.query.folderConnectors.findFirst({
    where: and(eq(folderConnectors.tokenHash, createHash("sha256").update(token).digest("hex")), isNull(folderConnectors.revokedAt)),
  });
  if (!connector) return Response.json({ error: "unauthorized" }, { status: 401 });
  await db.update(folderConnectors).set({ lastSeenAt: new Date() }).where(eq(folderConnectors.id, connector.id));
  const { operation } = await context.params;
  if (operation === "heartbeat") {
    after(() => discoverPendingFolders(3).then(() => {}));
    return Response.json({ ok: true });
  }
  if (operation === "claim") {
    const result = await db.transaction(async (tx) => {
      const rows = await tx.execute<{ id: string }>(sql`
        select j.id from folder_jobs j join matter_folders f on f.id = j.binding_id
        join app_settings s on s.id = 1
        join folder_connectors c on c.id = j.connector_id and c.revoked_at is null
        where j.connector_id = ${connector.id} and (s.folder_setup_enabled or f.is_verification)
        and j.attempts < 8 and j.next_attempt_at <= now()
        and (j.state = 'waiting' or (j.state = 'creating' and j.lease_until < now()))
        order by j.created_at for update of j skip locked limit 1`);
      if (!rows[0]) return null;
      const [job] = await tx
        .update(folderJobs)
        .set({ state: "creating", attempts: sql`${folderJobs.attempts} + 1`, leaseToken: randomUUID(), leaseUntil: new Date(Date.now() + 120000) })
        .where(eq(folderJobs.id, rows[0].id))
        .returning();
      await tx.update(matterFolders).set({ localStatus: "creating" }).where(eq(matterFolders.id, job.bindingId));
      return { id: job.id, leaseToken: job.leaseToken, payload: job.payload };
    });
    // An expired final attempt needs an explicit retry, not an eternally "creating" UI.
    await db.execute(
      sql`with failed as (update folder_jobs set state = 'error', error = 'connector_error' where state = 'creating' and lease_until < now() and attempts >= 8 and connector_id = ${connector.id} returning binding_id) update matter_folders set local_status = 'error' where id in (select binding_id from failed)`,
    );
    return Response.json({ job: result });
  }
  if (operation !== "complete" && operation !== "failure") return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const body = z
      .object({
        id: z.string().uuid(),
        leaseToken: z.string().uuid(),
        error: z.enum(["invalid_path", "folder_collision", "permission_denied", "connector_error", "root_unavailable"]).optional(),
      })
      .parse(await request.json());
    await db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(folderJobs)
        .where(and(eq(folderJobs.id, body.id), eq(folderJobs.connectorId, connector.id)))
        .for("update");
      if (!job || job.leaseToken !== body.leaseToken) throw new Error("lease_expired");
      if (operation === "complete" && job.state === "done") return; // lost acknowledgement
      if (job.state !== "creating" || !job.leaseUntil || job.leaseUntil.getTime() <= Date.now()) throw new Error("lease_expired");
      const done = operation === "complete";
      const terminal = !done && (job.attempts >= 8 || ["invalid_path", "folder_collision", "permission_denied"].includes(body.error ?? ""));
      await tx
        .update(folderJobs)
        .set({
          state: done ? "done" : terminal ? "error" : "waiting",
          error: done ? null : (body.error ?? "connector_error"),
          leaseUntil: null,
          nextAttemptAt: new Date(Date.now() + retrySeconds(job.attempts) * 1000),
        })
        .where(eq(folderJobs.id, job.id));
      await tx
        .update(matterFolders)
        .set({ localStatus: done ? "ready" : terminal ? "error" : "waiting" })
        .where(eq(matterFolders.id, job.bindingId));
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof z.ZodError ? "invalid_input" : "lease_expired" }, { status: 409 });
  }
}
