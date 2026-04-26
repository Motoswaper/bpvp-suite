import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function sha(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? "");
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "dashboard password not configured" },
      { status: 500 }
    );
  }

  const ok = timingSafeEqual(sha(password), sha(expected));
  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("axe_session", "active", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return res;
}
