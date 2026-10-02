/**
 * Wraps a data load so production logs name the step that failed (and its real error),
 * instead of only Next's opaque error digest. Also flags slow steps.
 */
export async function logged<T>(name: string, promise: PromiseLike<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await promise;
    const ms = Date.now() - started;
    if (ms > 2000) console.warn(`data: ${name} slow ${ms}ms`);
    return result;
  } catch (err) {
    const e = err as { message?: string; cause?: { message?: string } };
    console.error(`data: ${name} failed after ${Date.now() - started}ms: ${e?.cause?.message || e?.message || String(err)}`);
    throw err;
  }
}
