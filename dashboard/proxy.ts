import { BPVP_LOCALE_HEADER } from "@/lib/bpvpLocale";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/wallet", "/api/auth/login"];
const PUBLIC_EXACT_PATHS = ["/"];
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/session",
  "/api/public",
  "/api/marketplace/public",
  "/api/did/public"
];

function withLocaleCookie(req: NextRequest, res: NextResponse) {
  const lang = String(req.nextUrl.searchParams.get("lang") ?? "").toLowerCase();
  if (lang === "en" || lang === "es") {
    res.cookies.set("bpvp_locale", lang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    });
  }
  return res;
}

function withSecurityHeaders(res: NextResponse) {
  const isProduction = process.env.NODE_ENV === "production";
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set("Origin-Agent-Cluster", "?1");
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  if (isProduction) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  const scriptSrc = ["script-src", "'self'", "'unsafe-inline'"];
  if (!isProduction) {
    // Dev tooling can require eval; keep it out of production.
    scriptSrc.push("'unsafe-eval'");
  }

  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc.join(" "),
    "connect-src 'self'"
  ];
  if (isProduction) {
    cspDirectives.push("upgrade-insecure-requests");
  }
  const csp = cspDirectives.join("; ");
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

function finalize(req: NextRequest, res: NextResponse) {
  return withSecurityHeaders(withLocaleCookie(req, res));
}

/** Forward `?lang=` into a request header so `getServerLocale()` matches on first SSR paint. */
function nextWithLocale(req: NextRequest) {
  const headers = new Headers(req.headers);
  const lang = req.nextUrl.searchParams.get("lang")?.toLowerCase();
  if (lang === "en" || lang === "es") {
    headers.set(BPVP_LOCALE_HEADER, lang);
  }
  return NextResponse.next({ request: { headers } });
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_EXACT_PATHS.includes(pathname)) {
    return finalize(req, nextWithLocale(req));
  }
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return finalize(req, nextWithLocale(req));
  }
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/logos/")
  ) {
    return finalize(req, nextWithLocale(req));
  }

  const session = req.cookies.get("axe_session")?.value;
  if (!session && pathname.startsWith("/api/")) {
    if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      return finalize(req, nextWithLocale(req));
    }
    return finalize(
      req,
      NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    );
  }
  if (!session && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return finalize(req, NextResponse.redirect(url));
  }
  return finalize(req, nextWithLocale(req));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
