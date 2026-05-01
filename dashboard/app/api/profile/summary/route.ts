import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

const engineBase = process.env.ENGINE_URL ?? "http://localhost:28080";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let engineOk = false;
  let engineModules: string[] = [];
  try {
    const headers: Record<string, string> = {};
    if (process.env.AXE_API_KEY) {
      headers["X-AXE-API-Key"] = process.env.AXE_API_KEY;
    }
    const res = await fetch(`${engineBase}/status`, { cache: "no-store", headers });
    if (res.ok) {
      const body = (await res.json()) as { engine?: { modules?: string[] } };
      engineOk = true;
      engineModules = Array.isArray(body.engine?.modules) ? body.engine!.modules! : [];
    }
  } catch {
    engineOk = false;
  }

  return NextResponse.json({
    ok: true,
    session: {
      username: session.username,
      role: session.role,
      mfa: session.mfa,
      walletAddress: session.walletAddress ?? null,
      walletVerificationMethod: session.walletVerificationMethod ?? null,
      walletNetwork: session.walletNetwork ?? null
    },
    integration: {
      engineReachable: engineOk,
      engineModules,
      engineUrlConfigured: Boolean(process.env.ENGINE_URL?.trim()),
      hasServerApiKey: Boolean(process.env.AXE_API_KEY),
      hasServerHmac: Boolean(process.env.AXE_HMAC_SECRET)
    }
  });
}
