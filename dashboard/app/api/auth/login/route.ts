import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, buildSessionCookie, createSessionToken } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

export async function POST(req: NextRequest) {
  const wantsRedirect = req.nextUrl.searchParams.get("redirect") === "1";
  const requestOrigin = req.headers.get("origin")?.trim();
  const forwardedHost = (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))?.split(",")[0]?.trim();
  const forwardedProto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim().replace(/:$/, "");
  const publicOrigin = requestOrigin || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "");
  const respondError = (status: number, error: string) => {
    if (!wantsRedirect) return NextResponse.json({ ok: false, error }, { status });
    const url = new URL("/login-basic", publicOrigin || req.url);
    url.searchParams.set("loginError", error);
    return NextResponse.redirect(url, 303);
  };

  if (!isSameOriginRequest(req)) {
    await writeSecurityEvent({
      category: "auth",
      outcome: "denied",
      ip: getClientIp(req),
      route: "/api/auth/login",
      reason: "invalid_origin"
    });
    return respondError(403, "invalid origin");
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(`login:${ip}`, 12, 60_000);
  if (!limit.ok) {
    await writeSecurityEvent({
      category: "auth",
      outcome: "denied",
      ip,
      route: "/api/auth/login",
      reason: "rate_limited"
    });
    return respondError(429, "too many requests");
  }
  const contentType = req.headers.get("content-type") ?? "";
  let username = "admin";
  let password = "";
  let otp: string | undefined;
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    username = String(body.username ?? "admin");
    password = String(body.password ?? "");
    otp = body.otp ? String(body.otp) : undefined;
  } else {
    const form = await req.formData().catch(() => null);
    username = String(form?.get("username") ?? "admin");
    password = String(form?.get("password") ?? "");
    const otpRaw = String(form?.get("otp") ?? "");
    otp = otpRaw ? otpRaw : undefined;
  }

  if (!password) {
    await writeSecurityEvent({
      category: "auth",
      outcome: "denied",
      actor: username,
      ip,
      route: "/api/auth/login",
      reason: "missing_password"
    });
    return respondError(400, "password is required");
  }

  const auth = authenticateUser({ username, password, otp });
  if (!auth.ok) {
    await writeSecurityEvent({
      category: "auth",
      outcome: "denied",
      actor: username,
      ip,
      route: "/api/auth/login",
      reason: auth.reason
    });
    return respondError(401, auth.reason);
  }

  const token = createSessionToken({
    username: auth.user.username,
    role: auth.user.role,
    mfa: auth.user.mfa
  });

  const res = wantsRedirect
    ? NextResponse.redirect(new URL("/market", publicOrigin || req.url), 303)
    : NextResponse.json({ ok: true, role: auth.user.role, username: auth.user.username });
  const cookie = buildSessionCookie(token);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  await writeSecurityEvent({
    category: "auth",
    outcome: "allowed",
    actor: auth.user.username,
    role: auth.user.role,
    ip,
    route: "/api/auth/login",
    action: "login"
  });
  return res;
}
