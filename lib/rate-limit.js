/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Good enough for a demo / small deployment. For larger production use,
 * swap this for a shared store (e.g. Upstash Redis) — the interface
 * (ok, remaining, reset) is intentionally the same shape.
 */

// Shared across all route bundles via globalThis so limits hold app-wide
const g = globalThis;
if (!g.__edumockRateBuckets) g.__edumockRateBuckets = new Map();
const buckets = g.__edumockRateBuckets;

// Periodically drop stale buckets so the Map doesn't grow forever
function cleanup() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}
const CLEANUP_EVERY = 60_000;
let lastCleanup = Date.now();

export function rateLimit(key, { limit = 20, windowMs = 60_000 } = {}) {
  if (Date.now() - lastCleanup > CLEANUP_EVERY) {
    cleanup();
    lastCleanup = Date.now();
  }

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  const ok = bucket.count <= limit;

  return {
    ok,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function resetLimit(key) {
  buckets.delete(key);
}

/** Login attempts: 20 tries per 5 minutes per IP (generous for shared
 *  school networks / demo retries, still blocks real brute force) */
export function loginRateLimit(ip) {
  return rateLimit(`login:${ip}`, { limit: 20, windowMs: 5 * 60_000 });
}
loginRateLimit.reset = (ip) => resetLimit(`login:${ip}`);

/** Outgoing client IP for a Next.js request */
export function requestIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'local';
}
