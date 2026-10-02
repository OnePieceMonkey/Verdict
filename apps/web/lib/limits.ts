/** NFR-04 / NFR-05: upload limits, per-IP rate limit and a global daily model budget. */
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || "5") * 1024 * 1024;
export const MAX_PAGES = Number(process.env.MAX_PAGES || "5");
const RUNS_PER_IP_PER_HOUR = Number(process.env.RUNS_PER_IP_PER_HOUR || "12");

const hits = new Map<string, number[]>();

/** Sliding one-hour window per IP, in memory (single instance, no database by design). */
export function takeRateLimit(ip: string, now = Date.now()): { ok: boolean; retryAfterS: number } {
  const windowStart = now - 3600_000;
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RUNS_PER_IP_PER_HOUR) {
    const oldest = recent[0] ?? now;
    return { ok: false, retryAfterS: Math.ceil((oldest + 3600_000 - now) / 1000) };
  }
  recent.push(now);
  hits.set(ip, recent);
  return { ok: true, retryAfterS: 0 };
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
