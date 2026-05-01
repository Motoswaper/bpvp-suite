import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const repoRoot = path.resolve(process.cwd(), "..");
const reportDir = path.join(repoRoot, ".run", "reports");

export async function GET() {
  try {
    const jsonPath = path.join(reportDir, "amm-audit-latest.json");
    const sigPath = path.join(reportDir, "amm-audit-latest.sig");
    const [rawJson, rawSig] = await Promise.all([
      fs.readFile(jsonPath, "utf8"),
      fs.readFile(sigPath, "utf8")
    ]);
    const data = JSON.parse(rawJson);
    return NextResponse.json({
      ok: true,
      audit: data,
      signature: rawSig.trim()
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "latest AMM audit not available", details: String(error) },
      { status: 404 }
    );
  }
}
