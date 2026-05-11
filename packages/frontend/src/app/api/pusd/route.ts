import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const OFFICIAL_PUSD_SOLANA_MINT = "CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s";
const DEFAULT_PUSD_RPC_URL = "https://api.mainnet-beta.solana.com";
const DEFAULT_PUSD_API_BASE_URL = "https://www.palmusd.com/api";
const DEFAULT_DECIMALS = 6;

export async function GET() {
  const mintAddress = process.env.PUSD_MINT_ADDRESS ?? OFFICIAL_PUSD_SOLANA_MINT;
  const expectedDecimals = Number(process.env.PUSD_EXPECTED_DECIMALS ?? DEFAULT_DECIMALS);
  const apiBaseUrl = (process.env.PUSD_API_BASE_URL ?? DEFAULT_PUSD_API_BASE_URL).replace(/\/+$/, "");

  if (mintAddress !== OFFICIAL_PUSD_SOLANA_MINT) {
    return NextResponse.json({ error: `PUSD_MINT_ADDRESS must be ${OFFICIAL_PUSD_SOLANA_MINT}.` }, { status: 400 });
  }

  try {
    const connection = new Connection(process.env.PUSD_RPC_URL ?? process.env.QUICKNODE_RPC_URL ?? DEFAULT_PUSD_RPC_URL, "confirmed");
    const mint = new PublicKey(mintAddress);
    const account = await connection.getParsedAccountInfo(mint, "confirmed");
    const parsed = account.value?.data;

    if (!parsed || typeof parsed !== "object" || !("parsed" in parsed)) {
      return NextResponse.json({ error: "PUSD mint account was not returned as parsed SPL mint data." }, { status: 502 });
    }

    const info = (parsed as { parsed: { info?: { decimals?: number; mintAuthority?: string | null; freezeAuthority?: string | null } } }).parsed.info;
    if (!info || info.decimals !== expectedDecimals) {
      return NextResponse.json({ error: `PUSD decimals mismatch. Expected ${expectedDecimals}, got ${info?.decimals ?? "unknown"}.` }, { status: 502 });
    }

    const circulation = await fetch(`${apiBaseUrl}/v1/circulation`, { cache: "no-store" });
    const body = await circulation.json() as {
      data?: Array<{ as_of?: string; snapshot_id?: string; chains?: Array<{ chain?: string; circulating?: number }> }>;
    };
    if (!circulation.ok) {
      return NextResponse.json({ error: `Palm USD API responded with HTTP ${circulation.status}.`, details: body }, { status: circulation.status });
    }

    const latest = body.data?.[0];
    const solana = latest?.chains?.find((chain) => chain.chain === "SOLANA");
    if (!latest?.as_of || !latest.snapshot_id || !solana || Number(solana.circulating) <= 0) {
      return NextResponse.json({ error: "Palm USD API did not report positive Solana PUSD circulation.", details: body }, { status: 502 });
    }

    return NextResponse.json({
      status: "passed",
      mintAddress,
      decimals: info.decimals,
      mintAuthority: info.mintAuthority ?? null,
      freezeAuthority: info.freezeAuthority ?? null,
      palmApiSolanaCirculating: Number(solana.circulating),
      palmApiAsOf: latest.as_of,
      palmApiSnapshotId: latest.snapshot_id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PUSD proof failed." },
      { status: 502 },
    );
  }
}
