import { NextResponse } from "next/server";

const DEFAULT_INDEXER_API = "https://indexer.umbraprivacy.com";

export async function GET() {
  const network = process.env.UMBRA_NETWORK ?? "devnet";
  const indexerApiEndpoint = (process.env.UMBRA_INDEXER_API_ENDPOINT ?? DEFAULT_INDEXER_API).replace(/\/+$/, "");

  try {
    const response = await fetch(indexerApiEndpoint, { method: "GET", cache: "no-store" });
    const text = await response.text();

    return NextResponse.json({
      status: response.ok ? "indexer_reachable" : "indexer_responded",
      network,
      indexerApiEndpoint,
      httpStatus: response.status,
      responsePreview: text.slice(0, 240),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Umbra indexer status failed.", network, indexerApiEndpoint },
      { status: 502 },
    );
  }
}
