import { describe, expect, it } from "vitest";
import { runPusdProof } from "./pusd-proof.js";

const PUSD_MINT = "CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s";

describe("PUSD proof", () => {
  it("verifies the official Palm USD Solana mint and circulation API", async () => {
    const proof = await runPusdProof(
      {
        rpcUrl: "https://api.mainnet-beta.solana.com",
        apiBaseUrl: "https://www.palmusd.com/api",
        mintAddress: PUSD_MINT,
        expectedDecimals: 6,
      },
      {
        connection: {
          getParsedAccountInfo: async () => ({
            value: {
              data: {
                parsed: {
                  info: {
                    decimals: 6,
                    mintAuthority: null,
                    freezeAuthority: null,
                  },
                },
              },
            },
          }) as never,
        },
        fetchImpl: async () => new Response(
          JSON.stringify({
            data: [
              {
                as_of: "2026-04-24T14:30:00Z",
                snapshot_id: "snapshot",
                chains: [
                  { chain: "SOLANA", circulating: 2895000 },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      },
    );

    expect(proof).toMatchObject({
      status: "passed",
      mintAddress: PUSD_MINT,
      decimals: 6,
      freezeAuthority: null,
      palmApiSolanaCirculating: 2895000,
    });
  });

  it("rejects non-official PUSD mint addresses", async () => {
    await expect(
      runPusdProof({
        rpcUrl: "https://api.mainnet-beta.solana.com",
        apiBaseUrl: "https://www.palmusd.com/api",
        mintAddress: "So11111111111111111111111111111111111111112",
        expectedDecimals: 6,
      }),
    ).rejects.toThrow("official Palm USD Solana mint");
  });
});
