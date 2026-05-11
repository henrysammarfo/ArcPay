import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";

describe("arcpay", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Arcpay as Program;

  it("initializes an agent treasury with spending policy", async () => {
    const agentId = "ada-research-agent-01";
    const [treasury] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("treasury"),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(agentId),
      ],
      program.programId,
    );

    await program.methods
      .initializeTreasury(
        agentId,
        new anchor.BN(5_000),
        new anchor.BN(1_000),
        70,
      )
      .accounts({
        treasury,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.agentTreasury.fetch(treasury);

    assert.equal(account.owner.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(account.agentId, agentId);
    assert.equal(account.dailyLimit.toNumber(), 5_000);
    assert.equal(account.maxSingleTx.toNumber(), 1_000);
    assert.equal(account.minGoldrushScore, 70);
    assert.equal(account.dailySpent.toNumber(), 0);
    assert.equal(account.isActive, true);
  });
});
