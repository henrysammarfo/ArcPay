import { NextResponse } from "next/server";

const DEFAULT_SERVER_URL = "http://localhost:4030";

export async function GET() {
  const serverUrl = (process.env.NEXT_PUBLIC_ARCPAY_SERVER_URL ?? DEFAULT_SERVER_URL).replace(/\/+$/, "");

  try {
    const response = await fetch(`${serverUrl}/live/qvac`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as unknown;

    return NextResponse.json(payload ?? { error: "QVAC endpoint returned an empty response." }, {
      status: response.ok ? 200 : response.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "QVAC live decision endpoint is unavailable." },
      { status: 502 },
    );
  }
}
