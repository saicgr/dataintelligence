import "server-only";

/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Per-instance only (not shared across serverless instances), so it's a
 * pragmatic brute-force speed bump rather than a global guarantee — a real
 * global limit would use Upstash/Redis. Good enough to stop a single client
 * from hammering the hidden-test oracle.
 */
const buckets = new Map<string, number[]>();

export interface RateLimit {
  ok: boolean;
  retryAfter: number; // seconds until the next request is allowed
}

export function rateLimit(key: string, max: number, windowMs: number, nowMs: number): RateLimit {
  const cutoff = nowMs - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    const retryAfter = Math.ceil((hits[0] + windowMs - nowMs) / 1000);
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }
  hits.push(nowMs);
  buckets.set(key, hits);
  // opportunistic cleanup so the map doesn't grow unbounded
  if (buckets.size > 5000) {
    Array.from(buckets.keys()).forEach((k) => {
      const live = (buckets.get(k) ?? []).filter((t: number) => t > cutoff);
      if (live.length === 0) buckets.delete(k);
      else buckets.set(k, live);
    });
  }
  return { ok: true, retryAfter: 0 };
}

/** Best-effort caller identity: signed-in user id, else client IP from headers. */
export function clientKey(userId: string | null, req: Request): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || req.headers.get("x-real-ip") || "anon";
  return `ip:${ip}`;
}
