import { NextResponse } from "next/server";

const DEFAULT_SERVER_URL = "http://20.208.46.195:4030";

export async function GET() {
  const configuredServerUrl = (process.env.ARCPAY_SERVER_URL ?? process.env.NEXT_PUBLIC_ARCPAY_SERVER_URL ?? DEFAULT_SERVER_URL).replace(/\/+$/, "");
  const fallbackServerUrl = DEFAULT_SERVER_URL.replace(/\/+$/, "");
  const candidates = Array.from(new Set([configuredServerUrl, fallbackServerUrl]));
  const failures: string[] = [];

  for (const serverUrl of candidates) {
    try {
      const response = await fetch(`${serverUrl}/live/qvac`, {
        cache: "no-store",
        signal: AbortSignal.timeout(4_500),
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        failures.push(`${serverUrl} returned HTTP ${response.status}`);
        continue;
      }

      return NextResponse.json({
        ...(payload ?? {}),
        liveProof: Boolean(payload?.liveProof),
        serverUrl,
      });
    } catch (error) {
      failures.push(`${serverUrl}: ${error instanceof Error ? error.message : "QVAC live decision endpoint is unavailable."}`);
    }
  }

  return NextResponse.json({
    liveProof: false,
    status: "unavailable",
    serverUrl: candidates.at(-1) ?? fallbackServerUrl,
    message: `QVAC backend is not reachable from this runtime. Tried ${failures.join("; ")}`,
  });
}
