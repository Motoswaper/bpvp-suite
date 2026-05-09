import { NextRequest } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function hostnameFromForwardedHost(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return new URL(`http://${trimmed}`).hostname.toLowerCase();
  } catch {
    return trimmed.split(":")[0].toLowerCase();
  }
}

/**
 * Validates browser Origin against this request's public host(s).
 * Behind Cloudflare Tunnel, Host can be the local upstream (e.g. host.docker.internal:3100)
 * while Origin is the public URL; x-forwarded-host (or a matching hostname) must align.
 */
export function isSameOriginRequest(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const originHost = originUrl.hostname.toLowerCase();
  const originProto = originUrl.protocol.replace(":", "").toLowerCase();

  const forwardedHostParts: string[] = [];
  const xf = req.headers.get("x-forwarded-host");
  if (xf) {
    for (const part of xf.split(",")) {
      const p = part.trim();
      if (p) forwardedHostParts.push(p);
    }
  }
  const hostHeader = req.headers.get("host")?.split(",")[0]?.trim();
  if (hostHeader) forwardedHostParts.push(hostHeader);

  const xfProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  let proto = xfProto?.replace(/:$/, "").toLowerCase() ?? "";
  if (!proto) {
    try {
      proto = new URL(req.url).protocol.replace(":", "").toLowerCase();
    } catch {
      proto = "";
    }
  }
  if (!proto) proto = originProto;

  /**
   * Cloudflare Tunnel (and similar): browser sends Origin https://public-host while Next.js sees
   * http://127.0.0.1 upstream. Match via x-forwarded-host, or Referer when forwarded-host is absent.
   */
  if (originProto !== proto) {
    const forwardedMatchesOriginHost = forwardedHostParts.some((raw) => hostnameFromForwardedHost(raw) === originHost);
    const tunnelHttpsToHttp = originProto === "https" && proto === "http";
    let hostOk = forwardedMatchesOriginHost;
    if (!hostOk && tunnelHttpsToHttp) {
      const ref = req.headers.get("referer");
      if (ref) {
        try {
          hostOk = new URL(ref).hostname.toLowerCase() === originHost;
        } catch {
          hostOk = false;
        }
      }
    }
    if (!(tunnelHttpsToHttp && hostOk)) {
      return false;
    }
  }

  const localAliases = new Set(["localhost", "127.0.0.1", "::1"]);
  const originIsLocal = localAliases.has(originHost);
  const originHostnameMatches = forwardedHostParts.some((raw) => {
    const h = hostnameFromForwardedHost(raw);
    if (h === originHost) return true;
    if (originIsLocal && localAliases.has(h)) return true;
    return false;
  });
  if (originHostnameMatches) return true;

  for (const raw of forwardedHostParts) {
    const candidate = `${proto}://${raw}`.replace(/\/$/, "");
    if (origin === candidate) return true;
  }

  return false;
}

export function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { ok: true as const, remaining: maxRequests - 1, resetAt: next.resetAt };
  }
  if (current.count >= maxRequests) {
    return { ok: false as const, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  buckets.set(key, current);
  return { ok: true as const, remaining: maxRequests - current.count, resetAt: current.resetAt };
}
