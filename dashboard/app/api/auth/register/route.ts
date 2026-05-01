import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildSessionCookie, createSessionToken, parseUsersConfig, upsertUser } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";

function generateTokenLike(lengthBytes: number) {
  return randomBytes(lengthBytes).toString("base64url");
}

function nextTesterUsername() {
  const existing = new Set(parseUsersConfig().map((u) => u.username.toLowerCase()));
  for (let i = 0; i < 20; i += 1) {
    const candidate = `tester-${generateTokenLike(4).toLowerCase()}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error("could not allocate tester username");
}

export async function POST(_req: NextRequest) {
  const wantsRedirect = _req.nextUrl.searchParams.get("redirect") === "1";
  const requestOrigin = _req.headers.get("origin")?.trim();
  const forwardedHost = (_req.headers.get("x-forwarded-host") ?? _req.headers.get("host"))?.split(",")[0]?.trim();
  const forwardedProto = (_req.headers.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim().replace(/:$/, "");
  const publicOrigin = requestOrigin || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "");

  const respondError = (status: number, error: string) => {
    if (!wantsRedirect) {
      return NextResponse.json({ ok: false, error }, { status });
    }
    const url = new URL("/login", publicOrigin || _req.url);
    url.searchParams.set("registerError", error);
    return NextResponse.redirect(url, 303);
  };

  if (!isSameOriginRequest(_req)) {
    return respondError(403, "invalid origin");
  }
  const ip = getClientIp(_req);
  const limit = checkRateLimit(`register:${ip}`, 4, 60_000);
  if (!limit.ok) {
    return respondError(429, "too many requests");
  }
  const allowPublicRegister = process.env.BPVP_ALLOW_PUBLIC_REGISTER === "true";
  if (!allowPublicRegister) {
    return respondError(403, "public registration disabled");
  }
  try {
    const username = nextTesterUsername();
    const password = generateTokenLike(18);
    upsertUser({
      username,
      role: "viewer",
      password,
      enabled: true
    });

    const token = createSessionToken({
      username,
      role: "viewer",
      mfa: false
    });

    const res = wantsRedirect
      ? (() => {
          const url = new URL("/market", publicOrigin || _req.url);
          return NextResponse.redirect(url, 303);
        })()
      : NextResponse.json({
          ok: true,
          user: {
            username,
            role: "viewer",
            password
          }
        });
    const cookie = buildSessionCookie(token);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (error) {
    return respondError(
      500,
      error instanceof Error ? error.message : "failed to register tester"
    );
  }
}
