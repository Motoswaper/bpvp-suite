import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const cookie = clearSessionCookie();
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
