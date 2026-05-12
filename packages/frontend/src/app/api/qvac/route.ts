import { NextResponse } from "next/server";

const DEFAULT_SERVER_URL = "http://20.208.46.195:4030";

export async function GET() {
  const serverUrl = (process.env.ARCPAY_SERVER_URL ?? process.env.NEXT_PUBLIC_ARCPAY_SERVER_URL ?? DEFAULT_SERVER_URL).replace(/\/+$/, "");

  try {
    const response = await fetch(`${serverUrl}/live/qvac`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return NextResponse.json({
        liveProof: false,
        status: "unavailable",
        serverUrl,
        upstreamStatus: response.status,
        error: "QVAC endpoint is reachable but did not return a successful proof response.",
      });
    }

    return NextResponse.json(payload ?? {
      liveProof: false,
      status: "unavailable",
      serverUrl,
      error: "QVAC endpoint returned an empty response.",
    });
  } catch (error) {
    return NextResponse.json({
      liveProof: false,
      status: "unavailable",
      serverUrl,
      error: error instanceof Error ? error.message : "QVAC live decision endpoint is unavailable.",
    });
  }
}
