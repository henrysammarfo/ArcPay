import { type NextRequest, NextResponse } from "next/server";
import { parseRuntimeNetwork, resolveArcPayServerCandidates } from "../../server-targets";

export async function GET(request: NextRequest) {
  const network = parseRuntimeNetwork(request.nextUrl.searchParams.get("network"));
  const candidates = resolveArcPayServerCandidates(network);
  const failures: string[] = [];

  for (const serverUrl of candidates) {
    try {
      const response = await fetch(`${serverUrl}/live/quicknode`, {
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
        network,
        serverUrl,
      });
    } catch (error) {
      failures.push(`${serverUrl}: ${error instanceof Error ? error.message : "QuickNode live proof endpoint is unavailable."}`);
    }
  }

  return NextResponse.json({
    liveProof: false,
    network,
    serverUrl: candidates.at(-1) ?? "",
    message: `QuickNode backend is not reachable from this runtime. Tried ${failures.join("; ")}`,
  });
}
